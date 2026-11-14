import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { env } from '../src/config/env.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'

// R-06 (Lote 14a), sem banco: nas escritas de admin de /api/clientes e /api/vendas, o exigirOrigem roda ANTES da guarda
// D-41. Sem Origin → 403 sem consultar a sessão; leitura de admin continua sem exigir Origin.
describe('Escritas de admin: exigirOrigem antes da guarda (R-06)', () => {
  let servidor, base
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}/api`
  })
  after(async () => { await new Promise((r) => servidor.close(r)) })
  afterEach(() => mock.restoreAll())

  for (const [metodo, caminho] of [['PATCH', '/clientes/1'], ['DELETE', '/clientes/1'], ['POST', '/vendas/1/status'], ['POST', '/clientes/rota-nova'], ['PUT', '/vendas/1']]) {
    it(`${metodo} ${caminho} sem Origin → 403 de origem, sem consultar a sessão`, async () => {
      const sessao = mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => { throw new Error('não devia consultar a sessão') })
      const r = await fetch(`${base}${caminho}`, { method: metodo, headers: { Cookie: 'sid=qualquer', 'Content-Type': 'application/json' }, body: '{}' })
      assert.deepEqual([r.status, await r.json()], [403, { erro: 'Origem da requisição não permitida.' }])
      assert.equal(sessao.mock.callCount(), 0)
    })
  }

  it('com Origin, a guarda continua valendo: sem login → 401', async () => {
    const r = await fetch(`${base}/clientes/1`, { method: 'PATCH', headers: { Origin: env.corsOrigin, 'Content-Type': 'application/json' }, body: '{"ativo":false}' })
    assert.deepEqual([r.status, await r.json()], [401, { erro: 'Faça login para continuar.' }])
  })

  it('leitura de admin sem Origin continua chegando na guarda (401 sem login, não 403 de origem)', async () => {
    for (const caminho of ['/clientes', '/vendas']) {
      const r = await fetch(`${base}${caminho}`)
      assert.deepEqual([r.status, await r.json()], [401, { erro: 'Faça login para continuar.' }], caminho)
    }
  })
})
