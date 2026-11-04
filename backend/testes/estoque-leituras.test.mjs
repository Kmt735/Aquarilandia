import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'

describe('Estoque — leituras administrativas HTTP', () => {
  let servidor, origem
  const saldo = { produtoId: 42, nome: 'Produto do catálogo', ativo: false, saldoAtual: 7 }
  const movimento = {
    operacaoId: '8cb69e42-2b70-4c92-bd9a-5d22ce1bc68d', produtoId: 42, tipo: 'abertura', quantidade: 7,
    delta: 7, saldoAnterior: 0, saldoPosterior: 7, criadoEm: '2026-11-03T12:00:00.123456+00:00',
    motivo: 'Saldo preexistente.', origem: 'abertura', autorId: null,
  }
  const rotas = ['/api/estoque/42', '/api/estoque/movimentacoes?produtoId=42']
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening'); origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => { if (servidor) await new Promise((r) => servidor.close(r)); await db.end() })
  function autenticar(papel = 'admin') {
    const usuario = { id: 7, papel, valido: true }
    const sessao = mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => usuario.valido ? { id: usuario.id, papel: usuario.papel } : null)
    return { usuario, sessao }
  }
  function banco() {
    return mock.method(db, 'query', async (sql) => ({ rows: sql.startsWith('SELECT id AS') ? [saldo] : [{ existe: true, itens: [movimento], total: 1 }] }))
  }
  const get = (rota, headers = {}, method = 'GET') => fetch(`${origem}${rota}`, { method, headers: { Cookie: 'sid=fixture', ...headers } })
  for (const rota of rotas) {
    for (const [nome, cookie, papel, status] of [['visitante', '', 'admin', 401], ['cliente', 'sid=fixture', 'cliente', 403]]) {
      it(`${nome}: ${rota} exige permissão inclusive no HEAD`, async () => {
        autenticar(papel); const query = banco()
        for (const method of ['GET', 'HEAD']) {
          const r = await get(rota, { Cookie: cookie, 'X-Role': 'admin' }, method)
          assert.equal(r.status, status); assert.match(r.headers.get('cache-control'), /no-store/); assert.match(r.headers.get('vary'), /Cookie/)
          assert.doesNotMatch(await r.text(), /Saldo preexistente|saldoAtual|saldoPosterior|Produto do catálogo/)
        }
        assert.equal(query.mock.callCount(), 0)
      })
    }
    it(`${rota}: sessão e papel são reconsultados; cliente não controla o papel`, async () => {
      const { usuario, sessao } = autenticar(); const query = banco()
      assert.equal((await get(rota)).status, 200)
      usuario.papel = 'cliente'; assert.equal((await get(rota, { 'X-Role': 'admin' })).status, 403)
      usuario.valido = false; assert.equal((await get(rota)).status, 401)
      assert.equal(sessao.mock.callCount(), 3); assert.equal(query.mock.callCount(), 1)
    })
    it(`${rota}: admin lê sem Origin ou com Origin diferente, mantendo no-store`, async () => {
      autenticar(); banco()
      for (const headers of [{}, { Origin: 'https://origem-diferente.example' }]) {
        const r = await get(rota, headers); assert.equal(r.status, 200)
        assert.match(r.headers.get('cache-control'), /no-store/); assert.match(r.headers.get('vary'), /Cookie/)
      }
      const head = await get(rota, {}, 'HEAD'); assert.equal(head.status, 200); assert.equal(await head.text(), '')
    })
    it(`${rota}: produto inexistente retorna 404`, async () => {
      autenticar(); mock.method(db, 'query', async (sql) => ({ rows: sql.startsWith('SELECT id AS') ? [] : [{ existe: false, itens: [], total: 0 }] }))
      const r = await get(rota); assert.equal(r.status, 404); assert.deepEqual(await r.json(), { erro: 'Produto não encontrado' })
    })
    it(`${rota}: falha do banco não expõe SQL, credenciais, motivo ou sessão`, async () => {
      autenticar(); const log = mock.method(console, 'error', () => {})
      mock.method(db, 'query', async () => { throw Object.assign(new Error('SQL senha=SEGREDO motivo=PRIVADO cookie=sid'), { code: '42P01' }) })
      const r = await get(rota); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
      assert.doesNotMatch(JSON.stringify(log.mock.calls), /SEGREDO|PRIVADO|cookie|SELECT/)
    })
  }
  it('saldo consulta inativo pelo ID parametrizado e responde com DTO explícito', async () => {
    autenticar(); const query = banco(); const r = await get(rotas[0])
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), saldo)
    assert.deepEqual(query.mock.calls[0].arguments[1], [42])
  })
  it('histórico usa paginação padrão e ISO UTC, sem expor marcador de existência ou metadados privados', async () => {
    autenticar(); const query = banco(); const r = await get(rotas[1])
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { itens: [{ ...movimento, criadoEm: '2026-11-03T12:00:00.123Z' }], total: 1 })
    assert.deepEqual(query.mock.calls[0].arguments[1], [42, 20, 0])
  })
  it('histórico parametriza página/limite e mantém total na página vazia', async () => {
    autenticar(); const query = mock.method(db, 'query', async () => ({ rows: [{ existe: true, itens: [], total: 3 }] }))
    const r = await get('/api/estoque/movimentacoes?produtoId=42&pagina=2&limite=5')
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { itens: [], total: 3 })
    assert.deepEqual(query.mock.calls[0].arguments[1], [42, 5, 5])
  })
  const invalidos = [
    ...['0', '-1', '01', '1.0', '1e2', '2147483648', 'abc', ' 42 ', "1' OR true --"].map((id) => `/api/estoque/${encodeURIComponent(id)}`),
    '/api/estoque/42?incluir_inativos=true', '/api/estoque/42?produtoId=43',
    '/api/estoque/movimentacoes',
    ...['', '0', '01', '-1', '1e2', '2147483648', 'a'].map((id) => `/api/estoque/movimentacoes?produtoId=${id}`),
    '/api/estoque/movimentacoes?produtoId=42&produtoId=43', '/api/estoque/movimentacoes?produtoId[]=42',
    ...['pagina=0', 'pagina=01', 'pagina=1.5', 'pagina=1e2', 'pagina=', 'pagina=1&pagina=2',
      'pagina=9007199254740992', 'pagina=9007199254740991&limite=100',
      'limite=0', 'limite=101', 'limite=', 'limite=abc', 'limite=1&limite=2',
      'tipo=saida', 'de=2026-11-01', 'ate=2026-11-03', 'ordem=nome', '__proto__=admin'].map((q) => `/api/estoque/movimentacoes?produtoId=42&${q}`),
  ]
  for (const rota of invalidos) {
    it(`consulta inválida: ${rota}`, async () => {
      autenticar(); const query = banco(); const r = await get(rota)
      assert.equal(r.status, 400); assert.equal((await r.json()).erro, 'Parâmetros inválidos'); assert.equal(query.mock.callCount(), 0)
    })
  }
})
