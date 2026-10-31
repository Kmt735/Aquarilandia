import assert from 'node:assert/strict'
import { once } from 'node:events'
import { inspect } from 'node:util'
import { gzipSync } from 'node:zlib'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
process.env.NODE_ENV = 'development'
const { app } = await import('../src/app.ts')
const { db } = await import('../src/config/db.ts')
const { env } = await import('../src/config/env.ts')
const { limiteCadastro, limiteLogin } = await import('../src/middlewares/rateLimit.ts')
const { AppError } = await import('../src/utils/AppError.ts')
const { authService } = await import('../src/modulos/auth/auth.service.ts')

describe('Ciclo 0 — Origin, CORS, rate limit e erros no código combinado', () => {
  let servidor, origem
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  beforeEach(() => {
    // Limpa só o estado de fixtures entre casos; configuração e limiares reais não são alterados.
    limiteLogin.resetKey('127.0.0.1'); limiteCadastro.resetKey('127.0.0.1')
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })
  function enviar(caminho, body = '{}', { origin = env.corsOrigin, headers = {} } = {}) {
    const cabecalhos = { 'Content-Type': 'application/json', ...headers }
    if (origin !== null) cabecalhos.Origin = origin
    return fetch(`${origem}${caminho}`, { method: 'POST', headers: cabecalhos, body })
  }
  function semBanco() {
    return mock.method(db, 'query', async () => { throw new Error('Não acessar banco neste cenário') })
  }
  for (const caminho of ['/api/auth/login', '/api/auth/cadastro', '/api/auth/logout', '/api/orcamentos']) {
    it(`recusa Origin ausente, null ou incorreto em ${caminho} antes do banco`, async () => {
      const consulta = semBanco()
      for (const origin of [null, 'null', 'https://origem-invalida.example']) {
        const resposta = await enviar(caminho, '{}', { origin })
        assert.equal(resposta.status, 403)
        assert.deepEqual(await resposta.json(), { erro: 'Origem da requisição não permitida.' })
        assert.equal(resposta.headers.get('set-cookie'), null)
      }
      assert.equal(consulta.mock.callCount(), 0)
    })
  }
  it('POST de orçamento continua público com Origin válido e sem sessão', async () => {
    const consulta = semBanco()
    const resposta = await enviar('/api/orcamentos', JSON.stringify({ nome: 'Pessoa Fictícia', telefone: '00900000000',
      servico: 'Outro', mensagem: 'Fixture pública de integração' }))
    assert.equal(resposta.status, 201)
    assert.equal((await resposta.json()).nome, 'Pessoa Fictícia')
    assert.equal(consulta.mock.callCount(), 0)
    assert.equal(resposta.headers.get('access-control-allow-origin'), env.corsOrigin)
    assert.equal(resposta.headers.get('access-control-allow-credentials'), 'true')
  })
  it('preflight permite a origem configurada e não autoriza origem arbitrária nem acessa sessão', async () => {
    const consulta = semBanco()
    for (const origin of [env.corsOrigin, 'https://origem-invalida.example']) {
      const resposta = await fetch(`${origem}/api/orcamentos`, { method: 'OPTIONS', headers: { Origin: origin,
        'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' } })
      assert.equal(resposta.status, 204)
      assert.equal(resposta.headers.get('access-control-allow-origin'), env.corsOrigin)
      assert.equal(resposta.headers.get('access-control-allow-credentials'), 'true')
      assert.match(resposta.headers.get('access-control-allow-headers'), /content-type/i)
    }
    assert.equal(consulta.mock.callCount(), 0)
  })
  for (const caminho of ['/api/auth/login', '/api/auth/cadastro']) {
    it(`limite real em ${caminho}: cinco tentativas inválidas e sexta 429`, async () => {
      const consulta = semBanco()
      for (let i = 0; i < 5; i++) {
        const resposta = await enviar(caminho); assert.equal(resposta.status, 422); await resposta.json()
      }
      const resposta = await enviar(caminho)
      assert.equal(resposta.status, 429)
      assert.deepEqual(await resposta.json(), { erro: 'Muitas tentativas. Tente de novo em alguns minutos. ' })
      assert.ok(Number(resposta.headers.get('retry-after')) > 0)
      assert.ok(resposta.headers.has('ratelimit'))
      assert.equal(consulta.mock.callCount(), 0)
    })
    it(`Origin e parser rejeitados não gastam o limite de ${caminho}`, async () => {
      const consulta = semBanco()
      for (let i = 0; i < 6; i++) {
        assert.equal((await enviar(caminho, '{}', { origin: 'https://origem-invalida.example' })).status, 403)
        assert.equal((await enviar(caminho, '{')).status, 400)
        assert.equal((await enviar(caminho, JSON.stringify({ dados: 'x'.repeat(102400) }))).status, 413)
        assert.equal((await enviar(caminho, gzipSync('{}'), { headers: { 'Content-Encoding': 'gzip' } })).status, 415)
      }
      for (let i = 0; i < 5; i++) assert.equal((await enviar(caminho)).status, 422)
      assert.equal((await enviar(caminho)).status, 429)
      assert.equal(consulta.mock.callCount(), 0)
    })
  }
  it('logins bem-sucedidos não esgotam o limite reservado às falhas', async () => {
    const consulta = semBanco()
    mock.method(authService, 'login', async (body) => {
      if (body.email !== 'cliente@example.com') throw new AppError('Email ou senha incorretos.', 401)
      return { cliente: { id: 7, nome: 'Cliente Fictício', papel: 'cliente' }, token: 'token-fixture-ciclo0',
        expiraEm: new Date(Date.now() + 3600000) }
    })
    for (let i = 0; i < 7; i++) {
      const resposta = await enviar('/api/auth/login', JSON.stringify({ email: 'cliente@example.com', senha: 'SenhaFicticia123!' }))
      assert.equal(resposta.status, 200); await resposta.json()
    }
    for (let i = 0; i < 5; i++) assert.equal((await enviar('/api/auth/login')).status, 401)
    assert.equal((await enviar('/api/auth/login')).status, 429)
    assert.equal(consulta.mock.callCount(), 0)
  })
  it('em desenvolvimento um X-Forwarded-For forjado não troca a chave do limitador', async () => {
    assert.equal(app.get('trust proxy'), false)
    const consulta = semBanco()
    const log = mock.method(console, 'error', () => {})
    for (let i = 0; i < 6; i++) {
      const resposta = await enviar('/api/auth/login', '{}', { headers: { 'X-Forwarded-For': `198.51.100.${i + 1}` } })
      assert.equal(resposta.status, i === 5 ? 429 : 422)
    }
    // O pacote também pode emitir diagnóstico de configuração para XFF em acesso direto.
    assert.ok(log.mock.callCount() <= 1)
    assert.equal(consulta.mock.callCount(), 0)
  })
  it('erro inesperado não expõe mensagem, stack, SQL, senha ou token na resposta nem no log', async () => {
    const marcador = 'DADO_SINTETICO_NAO_PUBLICAR'
    mock.method(db, 'query', async () => { throw Object.assign(new Error(marcador), {
      code: 'XX000', detail: marcador, query: marcador, senha: marcador, token: marcador,
    }) })
    const log = mock.method(console, 'error', () => {})
    const resposta = await fetch(`${origem}/api/categorias`)
    assert.equal(resposta.status, 500)
    assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    assert.equal(log.mock.callCount(), 1)
    assert.equal(inspect(log.mock.calls[0].arguments).includes(marcador), false)
    assert.equal(log.mock.calls[0].arguments[1].codigo, 'XX000')
  })
  it('não copia códigos arbitrários do erro para o log', async () => {
    const marcador = 'TOKEN_SINTETICO_NAO_PUBLICAR'
    mock.method(db, 'query', async () => { throw { code: marcador, detail: marcador } })
    const log = mock.method(console, 'error', () => {})
    const resposta = await fetch(`${origem}/api/categorias`)
    assert.equal(resposta.status, 500)
    assert.equal(inspect(log.mock.calls[0].arguments).includes(marcador), false)
  })
  it('erro assíncrono do pool usa a mesma redação sem detalhe privado', () => {
    const marcador = 'DADO_SINTETICO_DO_POOL'
    const log = mock.method(console, 'error', () => {})
    db.emit('error', Object.assign(new Error(marcador), { code: '08006', detail: marcador }))
    assert.equal(log.mock.callCount(), 1)
    assert.equal(inspect(log.mock.calls[0].arguments).includes(marcador), false)
    assert.equal(log.mock.calls[0].arguments[1].contexto, 'pool')
    assert.equal(log.mock.calls[0].arguments[1].codigo, '08006')
  })
})
