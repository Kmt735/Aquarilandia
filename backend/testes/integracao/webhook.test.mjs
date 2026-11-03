import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, describe, it, mock } from 'node:test'
import pg from 'pg'

const urlTeste = process.env.TEST_DATABASE_URL
describe('Webhook AbacatePay — POST /api/pagamentos/webhook com a aplicação real e o PostgreSQL (#45)', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para verificar o webhook no PostgreSQL.',
}, () => {
  const schema = `teste_webhook_${randomUUID().replaceAll('-', '')}`
  // Segredo de teste definido aqui, antes de carregar a aplicação; o do .env nunca é usado
  const segredo = `segredo-teste-${randomUUID()}`
  const chavePublica = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
  let cliente, pool, servidor, origem, schemaCriado = false
  let logs

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    // Uma venda e um pagamento pendentes: o webhook não pode mexer neles nesta tarefa
    const { rows: [c] } = await cliente.query(
      "INSERT INTO clientes (nome, email, senha_hash) VALUES ('Comprador', 'comprador@teste.example', 'hash-fixture') RETURNING id")
    const { rows: [v] } = await cliente.query(
      `INSERT INTO vendas (cliente_id, subtotal, frete, total, tipo_entrega, entrega_destinatario, entrega_telefone,
                           prazo_entrega_dias)
       VALUES ($1, 1000, 0, 1000, 'retirada', 'Comprador', '32999999999', 1) RETURNING id`, [c.id])
    await cliente.query(
      `INSERT INTO pagamentos (venda_id, gateway, gateway_cobranca_id, metodo, valor)
       VALUES ($1, 'abacatepay', 'pix_char_abc123', 'pix', 1000)`, [v.id])

    const urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlAplicacao.toString()
    process.env.GATEWAY_WEBHOOK_SECRET = segredo
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  after(async () => {
    try {
      if (servidor) await new Promise((resolve) => servidor.close(resolve))
      if (pool) await pool.end()
    } finally {
      if (cliente) {
        try { if (schemaCriado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`) }
        finally { await cliente.end() }
      }
    }
  })
  beforeEach(() => {
    mock.restoreAll()
    logs = ['error', 'info', 'log', 'warn'].map((nome) => mock.method(console, nome, () => {}))
  })

  // Foto das três tabelas: o webhook desta tarefa não grava nada
  const foto = async () => (await cliente.query(`
    SELECT (SELECT coalesce(json_agg(v ORDER BY id), '[]') FROM vendas v)::text AS vendas,
           (SELECT coalesce(json_agg(p ORDER BY id), '[]') FROM pagamentos p)::text AS pagamentos,
           (SELECT coalesce(json_agg(e ORDER BY id), '[]') FROM eventos_webhook e)::text AS eventos`)).rows[0]
  const evento = (event = 'transparent.completed') => JSON.stringify({
    id: 'log_Qw8eR2tY4uI6oP1aS3dF5gH7', event, apiVersion: 2, devMode: true,
    data: { transparent: { id: 'pix_char_abc123', amount: 1000, status: 'PAID' }, customer: { name: 'Maria Fictícia' } },
  })
  const assinar = (corpo) => createHmac('sha256', chavePublica).update(corpo).digest('base64')
  function enviar(corpo, { query = `?webhookSecret=${encodeURIComponent(segredo)}`, assinatura = assinar(corpo), headers = {} } = {}) {
    return fetch(`${origem}/api/pagamentos/webhook${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(assinatura === null ? {} : { 'X-Webhook-Signature': assinatura }), ...headers },
      body: corpo,
    })
  }
  const impresso = () => logs.flatMap((espiao) => espiao.mock.calls.map((c) => c.arguments.join(' '))).join('\n')

  it('válido (sem Origin e sem cookie) → 200, e nenhuma linha muda em vendas, pagamentos e eventos_webhook', async () => {
    const antes = await foto()
    for (const event of ['transparent.completed', 'transparent.refunded', 'checkout.completed', 'evento.novo']) {
      const resposta = await enviar(evento(event))
      assert.equal(resposta.status, 200, event)
      assert.deepEqual(await resposta.json(), { recebido: true })
    }
    assert.deepEqual(await foto(), antes)
    const texto = impresso()
    assert.match(texto, /\[webhook\] recebido log_Qw8eR2tY4uI6oP1aS3dF5gH7 transparent.completed/)
    assert.match(texto, /\[webhook\] recebido log_Qw8eR2tY4uI6oP1aS3dF5gH7 transparent.refunded/)
    assert.equal(texto.includes('checkout.completed'), false, 'evento não tratado é só confirmado')
    for (const parte of [segredo, 'Maria Fictícia', 'pix_char_abc123']) assert.equal(texto.includes(parte), false)
  })

  it('com um Origin qualquer também não dá 403 (a rota não usa exigirOrigem)', async () => {
    const resposta = await enviar(evento(), { headers: { Origin: 'https://site-qualquer.example' } })
    assert.equal(resposta.status, 200)
  })

  it('corpo com espaços: a assinatura dos bytes crus vale; a do JSON re-serializado não', async () => {
    const comEspacos = '{ "id": "log_abc", "event": "transparent.completed" }'
    assert.equal((await enviar(comEspacos)).status, 200)
    const reserializado = JSON.stringify(JSON.parse(comEspacos))
    assert.equal((await enviar(comEspacos, { assinatura: assinar(reserializado) })).status, 401)
  })

  for (const [descricao, opcoes] of [
    ['segredo errado', { query: '?webhookSecret=errado' }],
    ['sem segredo', { query: '' }],
    ['segredo repetido', { query: `?webhookSecret=${encodeURIComponent(segredo)}&webhookSecret=${encodeURIComponent(segredo)}` }],
    ['sem assinatura', { assinatura: null }],
    ['assinatura de outro corpo', { assinatura: assinar('{"id":"outro"}') }],
  ]) {
    it(`${descricao} → 401 { erro: 'Não autorizado.' }, sem payload no log e sem gravar nada`, async () => {
      const antes = await foto()
      const resposta = await enviar(evento(), opcoes)
      assert.equal(resposta.status, 401)
      assert.deepEqual(await resposta.json(), { erro: 'Não autorizado.' })
      assert.deepEqual(await foto(), antes)
      const texto = impresso()
      assert.match(texto, /\[webhook\] assinatura ou segredo inválido/)
      for (const parte of [segredo, 'Maria Fictícia', 'log_Qw8']) assert.equal(texto.includes(parte), false)
    })
  }

  it('Content-Type que não é JSON → 401 (sem corpo cru não há assinatura)', async () => {
    const corpo = evento()
    const resposta = await enviar(corpo, { headers: { 'Content-Type': 'text/plain' } })
    assert.equal(resposta.status, 401)
  })

  it('as rotas de JSON de sempre continuam iguais: JSON malformado 400 e corpo acima de 100 KiB 413', async () => {
    const malformado = await fetch(`${origem}/api/pagamentos/webhook?webhookSecret=${encodeURIComponent(segredo)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"id":',
    })
    assert.equal(malformado.status, 400)
    assert.deepEqual(await malformado.json(), { erro: 'JSON inválido' })
    const grande = await enviar(JSON.stringify({ id: 'log_x', event: 'transparent.completed', lixo: 'a'.repeat(102_400) }))
    assert.equal(grande.status, 413)
    const health = await fetch(`${origem}/api/health`)
    assert.equal(health.status, 200)
  })
})
