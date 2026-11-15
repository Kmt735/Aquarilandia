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
  const geral = '/api/estoque/movimentacoes'
  const rotas = ['/api/estoque/42', `${geral}?produtoId=42`, geral]
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
    if (rota !== geral) it(`${rota}: produto inexistente retorna 404`, async () => {
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
  it('ausência de produtoId consulta todo o histórico, sem filtro de produto ou período oculto', async () => {
    autenticar(); const query = banco(); const r = await get(geral)
    assert.equal(r.status, 200); assert.equal((await r.json()).total, 1)
    const [sql, parametros] = query.mock.calls[0].arguments
    assert.deepEqual(parametros, [20, 0])
    assert.doesNotMatch(sql, /WHERE m\.(produto_id|criado_em)|now\(\)|FOR UPDATE|INSERT|UPDATE|DELETE/)
    assert.equal(query.mock.callCount(), 1)
  })
  for (const tipo of ['entrada', 'ajuste_positivo', 'ajuste_negativo', 'saida', 'abertura', 'baixa_venda', 'estorno_venda']) {
    it(`tipo real ${tipo} é aceito e enviado como parâmetro`, async () => {
      autenticar(); const query = banco(); const r = await get(`${geral}?tipo=${tipo}`)
      assert.equal(r.status, 200)
      const [sql, parametros] = query.mock.calls[0].arguments
      assert.deepEqual(parametros, [tipo, 20, 0]); assert.ok(!sql.includes(`'${tipo}'`))
    })
  }
  it('combina filtros, normaliza fuso e preserva microssegundos no intervalo', async () => {
    autenticar(); const query = banco()
    const params = new URLSearchParams({ produtoId: '42', tipo: 'entrada', de: '2026-11-01T10:20:30.123456-03:00',
      ate: '2026-11-01T13:20:30.123457Z', pagina: '2', limite: '5' })
    const r = await get(`${geral}?${params}`); assert.equal(r.status, 200)
    assert.deepEqual(query.mock.calls[0].arguments[1], [42, 'entrada', '2026-11-01T13:20:30.123456Z', '2026-11-01T13:20:30.123457Z', 5, 5])
    assert.equal(query.mock.callCount(), 1)
  })
  for (const [entrada, esperado] of [
    ['2024-02-29T23:30:00-03:00', '2024-03-01T02:30:00.000000Z'],
    ['2000-02-29T00:00:00.1+02:30', '2000-02-28T21:30:00.100000Z'],
    ['0099-01-01T00:00:00Z', '0099-01-01T00:00:00.000000Z'],
    ['1969-12-31T23:59:59.999999Z', '1969-12-31T23:59:59.999999Z'],
    ['2026-11-01T00:00:00.12Z', '2026-11-01T00:00:00.120000Z'],
  ]) {
    it(`aceita instante existente e fuso explícito: ${entrada}`, async () => {
      autenticar(); const query = banco()
      for (const campo of ['de', 'ate']) {
        assert.equal((await get(`${geral}?${new URLSearchParams({ [campo]: entrada })}`)).status, 200)
      }
      assert.deepEqual(query.mock.calls[0].arguments[1], [esperado, 20, 0])
      assert.deepEqual(query.mock.calls[1].arguments[1], [esperado, 20, 0])
    })
  }
  it('total geral mantém número acima do INTEGER do banco, inclusive em página vazia', async () => {
    autenticar(); mock.method(db, 'query', async () => ({ rows: [{ existe: true, itens: [], total: '2147483648' }] }))
    assert.deepEqual(await (await get(geral)).json(), { itens: [], total: 2147483648 })
  })
  const invalidos = [
    ...['0', '-1', '01', '1.0', '1e2', '2147483648', 'abc', ' 42 ', '42\n', '42\u2028', "1' OR true --"].map((id) => `/api/estoque/${encodeURIComponent(id)}`),
    '/api/estoque/42?incluir_inativos=true', '/api/estoque/42?produtoId=43',
    ...['', '0', '01', '-1', '1e2', '2147483648', 'a', '42\n'].map((id) => `/api/estoque/movimentacoes?produtoId=${encodeURIComponent(id)}`),
    '/api/estoque/movimentacoes?produtoId=42&produtoId=43', '/api/estoque/movimentacoes?produtoId[]=42',
    ...['pagina=0', 'pagina=01', 'pagina=1.5', 'pagina=1e2', 'pagina=', 'pagina=1&pagina=2',
      'pagina=9007199254740992', 'pagina=9007199254740991&limite=100',
      'limite=0', 'limite=101', 'limite=', 'limite=abc', 'limite=1&limite=2', 'limite=1%0A', 'pagina=1%0A',
      'tipo=admin', 'tipo=venda', 'tipo=desconhecido', 'tipo=', 'tipo=Entrada', 'tipo=entrada&tipo=saida', 'tipo[]=entrada',
      'de=2026-11-01', 'ate=2026-11-03', 'de[]=2026-11-01T00:00:00Z', 'de=2026-11-01T00:00:00Z&de=2026-11-02T00:00:00Z',
      'ate=2026-11-01T00:00:00Z&ate=2026-11-02T00:00:00Z', 'ate[x]=data',
      'ordem=nome', 'origem=venda', 'incluir_inativos=true', '__proto__=admin'].map((q) => `/api/estoque/movimentacoes?produtoId=42&${q}`),
    ...['', 'infinity', '2026-02-30T12:00:00Z', '2026-02-29T12:00:00Z', '1900-02-29T12:00:00Z',
      '2026-04-31T12:00:00Z', '2026-00-01T00:00:00Z', '2026-13-01T00:00:00Z', '2026-01-00T00:00:00Z',
      '2026-11-01T24:00:00Z', '2026-11-01T23:60:00Z', '2026-11-01T23:59:60Z',
      '2026-11-01T00:00:00', '2026-11-01T00:00Z', '2026-11-01 00:00:00Z', '2026-11-01T00:00:00z',
      '2026-11-01T00:00:00+24:00', '2026-11-01T00:00:00-03:60', '2026-11-01T00:00:00+0300',
      '2026-11-01T00:00:00.1234567Z', '2026-11-01T00:00:00,1Z', '2026-11-01T00:00:00.Z',
      '0000-01-01T00:00:00Z', '0001-01-01T00:00:00+01:00', '9999-12-31T23:59:59-01:00',
      ' 2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z ', '2026-11-01T00:00:00Z\n', '2026-11-01T00:00:00Z\r\n',
      '2026-11-01T00:00:00Z\u2028', "2026-11-01T00:00:00Z' OR true --",
    ].flatMap((data) => ['de', 'ate'].map((campo) => `${geral}?${new URLSearchParams({ [campo]: data })}`)),
    ...[
      ['2026-11-02T00:00:00Z', '2026-11-01T00:00:00Z'],
      ['2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'],
      ['2026-11-01T00:00:00.000001Z', '2026-11-01T00:00:00.000000Z'],
      ['2026-11-01T00:00:00-03:00', '2026-11-01T03:00:00Z'],
    ].map(([de, ate]) => `${geral}?${new URLSearchParams({ de, ate })}`),
  ]
  for (const rota of invalidos) {
    it(`consulta inválida: ${rota}`, async () => {
      autenticar(); const query = banco(); const r = await get(rota)
      assert.equal(r.status, 400); assert.equal((await r.json()).erro, 'Parâmetros inválidos'); assert.equal(query.mock.callCount(), 0)
    })
  }
})
