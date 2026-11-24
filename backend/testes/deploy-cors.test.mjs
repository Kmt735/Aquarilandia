import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, describe, it, mock } from 'node:test'

const origens = ['https://loja-fixture.vercel.app', 'https://previa-fixture.vercel.app']
process.env.CORS_ORIGIN = origens.join(',')
const { app } = await import('../src/app.ts')
const { db } = await import('../src/config/db.ts')

describe('Deploy separado — origens explícitas da Vercel', () => {
  let servidor, base, consultas
  before(async () => {
    consultas = mock.method(db, 'query', async () => { throw new Error('Não consultar banco sem credenciais válidas') })
    servidor = app.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}`
  })
  after(async () => {
    mock.restoreAll()
    await new Promise((resolver) => servidor.close(resolver))
    await db.end()
  })
  for (const origem of origens) {
    it('aceita o preflight e a escrita de uma origem configurada', async () => {
      const preflight = await fetch(`${base}/api/auth/login`, { method: 'OPTIONS',
        headers: { Origin: origem, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type' } })
      assert.equal(preflight.status, 204)
      assert.equal(preflight.headers.get('access-control-allow-origin'), origem)
      assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true')
      const resposta = await fetch(`${base}/api/auth/login`, { method: 'POST',
        headers: { Origin: origem, 'Content-Type': 'application/json' }, body: '{}' })
      assert.equal(resposta.status, 422, 'A validação do login deve ser alcançada após conferir a origem')
      assert.equal(resposta.headers.get('access-control-allow-origin'), origem)
      assert.equal(consultas.mock.callCount(), 0)
    })
  }
  for (const origem of ['https://outra-previa.vercel.app', 'null', null]) {
    it('recusa escrita de origem não configurada ou ausente', async () => {
      const resposta = await fetch(`${base}/api/auth/login`, { method: 'POST',
        headers: { ...(origem && { Origin: origem }), 'Content-Type': 'application/json' }, body: '{}' })
      assert.equal(resposta.status, 403)
      assert.equal(resposta.headers.get('access-control-allow-origin'), null)
      assert.equal(consultas.mock.callCount(), 0)
    })
  }
})
