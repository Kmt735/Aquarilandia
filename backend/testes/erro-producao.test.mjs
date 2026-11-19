import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'

// O runner executa cada arquivo em processo separado: este liga a produção só aqui (valores fictícios, D-52)
process.env.NODE_ENV = 'production'
process.env.DATABASE_URL = 'postgres://fixture:senha-ficticia-de-producao-com-32-caracteres@127.0.0.1:1/fixture'
process.env.CORS_ORIGIN = 'https://loja.example'
process.env.FRONTEND_URL = 'https://loja.example'
process.env.API_URL = 'https://api.loja.example'
process.env.GATEWAY_ACCESS_TOKEN = 'token-ficticio-de-teste'
process.env.GATEWAY_WEBHOOK_SECRET = 'segredo-ficticio-de-teste-com-mais-de-32-caracteres'
// Lote 14a (D-54): obrigatórias em produção. Fictícias: nenhum caso deste arquivo manda e-mail
process.env.EMAIL_API_KEY = 'chave-ficticia-do-resend-de-teste'
process.env.EMAIL_REMETENTE = 'Loja <loja@remetente-ficticio.example>'
const { app } = await import('../src/app.ts')
const { db } = await import('../src/config/db.ts')
const { env } = await import('../src/config/env.ts')

// Complemento de segurança do Lote 11: em produção, um erro inesperado responde 500 com a mensagem genérica, sem
// stack, sem a mensagem interna e sem nome de tabela ou constraint; o log leva só a mensagem fixa e o SQLSTATE
describe('errorHandler em produção — erro inesperado', () => {
  let servidor, base
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}/api`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    await new Promise((r) => servidor.close(r))
    await db.end()
  })

  it('erro do PostgreSQL com tabela, constraint, detalhe e stack → 500 { erro } genérico; log só com o código', async () => {
    assert.equal(env.nodeEnv, 'production')
    const erro = Object.assign(new Error('duplicate key value violates unique constraint "uq_pagamentos_gateway_cobranca"'), {
      code: '23505', table: 'pagamentos', constraint: 'uq_pagamentos_gateway_cobranca', schema: 'public',
      detail: 'Key (gateway_cobranca_id)=(pix_char_SEGREDO) already exists.', where: 'SQL statement', routine: '_bt_check_unique',
    })
    mock.method(db, 'query', async () => { throw erro })
    const logs = mock.method(console, 'error', () => {})
    const r = await fetch(`${base}/categorias`)
    const texto = await r.text()
    assert.equal(r.status, 500)
    assert.deepEqual(JSON.parse(texto), { erro: 'Erro interno do servidor' })
    for (const proibido of ['stack', 'at ', 'pagamentos', 'uq_', 'duplicate', 'pix_char', 'gateway_cobranca_id', '23505', 'constraint', 'detail']) {
      assert.equal(texto.includes(proibido), false, `a resposta vazou ${proibido}`)
    }
    assert.deepEqual(logs.mock.calls.map((c) => c.arguments), [['Erro interno do servidor', { contexto: 'api', codigo: '23505' }]])
  })

  it('Error comum com mensagem interna → o mesmo 500 genérico, código NAO_CLASSIFICADO', async () => {
    mock.method(db, 'query', async () => { throw new Error('mensagem interna com maria@exemplo.example') })
    const logs = mock.method(console, 'error', () => {})
    const r = await fetch(`${base}/categorias`)
    const texto = await r.text()
    assert.equal(r.status, 500)
    assert.deepEqual(JSON.parse(texto), { erro: 'Erro interno do servidor' })
    assert.equal(texto.includes('maria'), false)
    assert.equal(logs.mock.calls.map((c) => c.arguments.join(' ')).join('\n').includes('maria'), false)
  })
})
