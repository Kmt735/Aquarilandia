import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as esperar } from 'node:timers/promises'
import { test } from 'node:test'

// Teste explícito do formatter real do Caddy, sem Docker obrigatório no runner e sem banco/gateway.
// CADDY_BIN=/caminho/caddy node --test testes/homologacao/logs-caddy.test.mjs
test('Caddy encaminha credenciais ao upstream sem registrá-las nos logs', { timeout: 15_000 }, async (t) => {
  const binario = process.env.CADDY_BIN
  assert.ok(binario, 'Defina CADDY_BIN com o executável do Caddy usado em produção.')
  const pasta = await mkdtemp(join(tmpdir(), 'aquarilandia-logs-caddy-'))
  t.after(() => rm(pasta, { recursive: true, force: true }))

  const recebidas = []
  const upstream = createServer((req, res) => {
    recebidas.push({ url: req.url, headers: req.headers })
    res.setHeader('Set-Cookie', 'sid=fixture-cookie-resposta; HttpOnly')
    res.writeHead(req.url.startsWith('/api/falha') ? 500 : 200)
    res.end('fixture')
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  t.after(() => new Promise((resolve) => upstream.close(resolve)))

  const reserva = createServer()
  reserva.listen(0, '127.0.0.1')
  await once(reserva, 'listening')
  const porta = reserva.address().port
  await new Promise((resolve) => reserva.close(resolve))
  const origem = `http://127.0.0.1:${porta}`
  const ambiente = { ...process.env, DOMINIO: origem, XDG_CONFIG_HOME: pasta, XDG_DATA_HOME: pasta }
  const adaptado = spawnSync(binario, ['adapt', '--config', new URL('../../Caddyfile', import.meta.url).pathname,
    '--adapter', 'caddyfile'], { env: ambiente, encoding: 'utf8', timeout: 5000 })
  assert.equal(adaptado.status, 0, adaptado.stderr)
  const config = JSON.parse(adaptado.stdout)
  config.admin = { disabled: true, config: { persist: false } }
  let proxies = 0
  function substituirUpstream(valor) {
    if (!valor || typeof valor !== 'object') return
    if (valor.handler === 'reverse_proxy') {
      valor.upstreams = [{ dial: `127.0.0.1:${upstream.address().port}` }]
      proxies++
    }
    for (const filho of Object.values(valor)) substituirUpstream(filho)
  }
  // Só o destino muda: regras de log e headers são exatamente as do Caddyfile de produção.
  substituirUpstream(config)
  assert.equal(proxies, 1)
  const arquivo = join(pasta, 'caddy.json')
  await writeFile(arquivo, JSON.stringify(config))
  const processo = spawn(binario, ['run', '--config', arquivo], { env: ambiente, stdio: ['ignore', 'pipe', 'pipe'] })
  let saida = '', erros = ''
  processo.stdout.on('data', (chunk) => { saida += chunk })
  processo.stderr.on('data', (chunk) => { erros += chunk })
  t.after(async () => {
    if (processo.exitCode !== null || processo.signalCode !== null) return
    const encerrado = once(processo, 'exit')
    processo.kill('SIGTERM')
    await encerrado
  })
  let pronto = false
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    if (processo.exitCode !== null) assert.fail(`Caddy encerrou: ${erros}`)
    try {
      const resposta = await fetch(`${origem}/pronto`, { signal: AbortSignal.timeout(200) })
      await resposta.text()
      pronto = true
      break
    } catch { await esperar(50) }
  }
  assert.ok(pronto, `Caddy não iniciou: ${erros}`)

  const headers = {
    'X-Webhook-Secret': 'fixture-segredo-webhook-header',
    'X-Webhook-Signature': 'fixture-assinatura-webhook',
    Referer: `${origem}/redefinir-senha?token=fixture-token-recuperacao`,
    Cookie: 'sid=fixture-cookie-pedido',
  }
  for (const [caminho, status] of [['/api/pagamentos/webhook', 200], ['/api/falha', 500]]) {
    const url = `${caminho}?webhookSecret=fixture-segredo-webhook-query`
    const resposta = await fetch(origem + url, { method: 'POST', headers, signal: AbortSignal.timeout(2000) })
    assert.equal(resposta.status, status)
    await resposta.text()
    const recebida = recebidas.find((item) => item.url === url)
    assert.ok(recebida)
    for (const [nome, valor] of Object.entries(headers)) assert.equal(recebida.headers[nome.toLowerCase()], valor)
  }

  function entradas() {
    return saida.slice(0, saida.lastIndexOf('\n') + 1).split('\n').filter(Boolean).map((linha) => JSON.parse(linha))
      .filter((linha) => linha.request?.uri?.startsWith('/api/'))
  }
  for (let tentativa = 0; tentativa < 40 && entradas().length < 2; tentativa++) await esperar(25)
  const logs = entradas()
  assert.equal(logs.length, 2, `Esperados logs de sucesso e falha: ${erros}`)
  assert.deepEqual(logs.map((linha) => linha.status), [200, 500])
  for (const log of logs) {
    assert.ok(!log.request.uri.includes('?'), 'Query string apareceu no log')
    for (const nome of Object.keys(headers)) assert.ok(!(nome in log.request.headers), `${nome} apareceu no log`)
    assert.ok(!('Set-Cookie' in log.resp_headers), 'Set-Cookie apareceu no log')
  }
  for (const segredo of [...Object.values(headers), 'fixture-segredo-webhook-query', 'fixture-cookie-resposta',
    'fixture-token-recuperacao']) {
    assert.ok(!(saida + erros).includes(segredo), 'Credencial fictícia apareceu na saída do Caddy')
  }
})
