import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'

describe('Estoque — listagem administrativa de saldos HTTP', () => {
  let servidor, origem
  const item = { produtoId: 42, nome: 'Filtro externo', ativo: false, saldoAtual: 7 }
  before(async () => { servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening'); origem = `http://127.0.0.1:${servidor.address().port}` })
  afterEach(() => mock.restoreAll())
  after(async () => { if (servidor) await new Promise((r) => servidor.close(r)); await db.end() })
  function autenticar(papel = 'admin') {
    const usuario = { id: 7, papel, valida: true }
    const sessao = mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => usuario.valida ? { id: usuario.id, papel: usuario.papel } : null)
    return { usuario, sessao }
  }
  const banco = (itens = [item], total = '1') => mock.method(db, 'query', async () => ({ rows: [{ itens, total }] }))
  const consultar = (query = '', headers = {}, method = 'GET') => fetch(`${origem}/api/estoque${query ? '?' + query : ''}`, { method, headers: { Cookie: 'sid=fixture', ...headers } })
  for (const [nome, cookie, papel, status] of [['visitante', '', 'admin', 401], ['cliente', 'sid=fixture', 'cliente', 403]]) {
    it(`${nome} não consulta nem recebe quantidades, inclusive HEAD e parâmetros malformados`, async () => {
      autenticar(papel); const sql = banco()
      for (const method of ['GET', 'HEAD']) {
        const r = await consultar('ativo=invalido', { Cookie: cookie, 'X-Role': 'admin' }, method)
        assert.equal(r.status, status); assert.match(r.headers.get('cache-control'), /no-store/); assert.match(r.headers.get('vary'), /Cookie/)
        assert.doesNotMatch(await r.text(), /saldoAtual|Filtro externo|produtoId/)
      }
      assert.equal(sql.mock.callCount(), 0)
    })
  }
  it('papel atual e revogação são reconsultados, sem confiar em cabeçalho do cliente', async () => {
    const { usuario, sessao } = autenticar(); const sql = banco()
    assert.equal((await consultar()).status, 200)
    usuario.papel = 'cliente'; assert.equal((await consultar('', { 'X-Role': 'admin' })).status, 403)
    usuario.valida = false; assert.equal((await consultar()).status, 401)
    assert.equal(sessao.mock.callCount(), 3); assert.equal(sql.mock.callCount(), 1)
  })
  it('admin recebe DTO individual no envelope, defaults e uma consulta de leitura sem histórico', async () => {
    autenticar(); const sql = banco(); const r = await consultar()
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { itens: [item], total: 1 })
    assert.deepEqual(sql.mock.calls[0].arguments[1], [20, 0]); assert.equal(sql.mock.callCount(), 1)
    assert.match(sql.mock.calls[0].arguments[0], /FROM produtos p/)
    assert.doesNotMatch(sql.mock.calls[0].arguments[0], /movimentacoes_estoque|operacoes_estoque|FOR UPDATE|FOR SHARE|INSERT|UPDATE|DELETE/)
    assert.match(r.headers.get('cache-control'), /no-store/); assert.match(r.headers.get('vary'), /Cookie/)
  })
  it('HEAD administrativo não retorna corpo; Origin não é exigido nas leituras', async () => {
    autenticar(); banco()
    for (const headers of [{}, { Origin: 'https://outra-origem.example' }]) assert.equal((await consultar('', headers)).status, 200)
    const head = await consultar('', {}, 'HEAD'); assert.equal(head.status, 200); assert.equal(await head.text(), '')
    assert.match(head.headers.get('cache-control'), /no-store/); assert.match(head.headers.get('vary'), /Cookie/)
  })
  it('filtros combinados são parametrizados, busca escapada e textos usam trim como catálogo', async () => {
    autenticar(); const sql = banco()
    const q = new URLSearchParams({ categoria: ' filtros ', busca: ' Filtro 50%_! ', ativo: 'false', em_estoque: 'false', ordem: '-saldo', pagina: '2', limite: '5' })
    assert.equal((await consultar(q.toString())).status, 200)
    const [consulta, valores] = sql.mock.calls[0].arguments
    assert.deepEqual(valores, ['filtros', '%Filtro 50!%!_!!%', false, false, 5, 5])
    assert.ok(!consulta.includes('Filtro 50')); assert.ok(!consulta.includes("'filtros'")); assert.match(consulta, /ESCAPE '!'/)
  })
  for (const campo of ['ativo', 'em_estoque']) for (const valor of ['true', 'false']) {
    it(`${campo}=${valor} é enviado como booleano, incluindo false`, async () => {
      autenticar(); const sql = banco(); assert.equal((await consultar(`${campo}=${valor}`)).status, 200)
      assert.deepEqual(sql.mock.calls[0].arguments[1], [valor === 'true', 20, 0])
    })
  }
  for (const [ordem, esperado] of [['nome', 'nome ASC'], ['-nome', 'nome DESC'], ['saldo', '"saldoAtual" ASC'], ['-saldo', '"saldoAtual" DESC']]) {
    it(`ordem fechada ${ordem} desempata pelo produtoId crescente`, async () => {
      autenticar(); const sql = banco(); assert.equal((await consultar(`ordem=${ordem}`)).status, 200)
      assert.ok(sql.mock.calls[0].arguments[0].includes(`ORDER BY ${esperado}, "produtoId" ASC`))
    })
  }
  it('página vazia preserva total e aceita limite máximo; lista vazia é 200', async () => {
    autenticar(); const sql = banco([], '31'); const r = await consultar('pagina=5&limite=100')
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { itens: [], total: 31 })
    assert.deepEqual(sql.mock.calls[0].arguments[1], [100, 400]); mock.restoreAll()
    autenticar(); banco([], '0'); assert.deepEqual(await (await consultar()).json(), { itens: [], total: 0 })
  })
  it('busca de 150 e slug de 80 caracteres são aceitos', async () => {
    autenticar(); banco(); assert.equal((await consultar(new URLSearchParams({ busca: 'a'.repeat(150), categoria: 'b'.repeat(80) }).toString())).status, 200)
  })
  it('falha do banco usa erro genérico, redige logs e mantém no-store', async () => {
    autenticar(); const logs = mock.method(console, 'error', () => {})
    mock.method(db, 'query', async () => { throw Object.assign(new Error('SELECT senha=NAO_EXIBIR sid=COOKIE path=/interno'), { code: '42P01' }) })
    const r = await consultar(); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
    assert.match(r.headers.get('cache-control'), /no-store/); assert.doesNotMatch(JSON.stringify(logs.mock.calls), /SELECT|NAO_EXIBIR|COOKIE|\/interno/)
  })
  it('caminhos de histórico e saldo individual continuam chegando aos handlers existentes', async () => {
    autenticar(); mock.method(db, 'query', async (sql) => ({ rows: sql.startsWith('SELECT id AS') ? [item] : [{ existe: true, itens: [], total: '0' }] }))
    const headers = { Cookie: 'sid=fixture' }
    assert.deepEqual(await (await fetch(`${origem}/api/estoque/42`, { headers })).json(), item)
    assert.deepEqual(await (await fetch(`${origem}/api/estoque/movimentacoes?produtoId=42`, { headers })).json(), { itens: [], total: 0 })
  })
  const invalidos = [
    ...['ativo', 'em_estoque'].flatMap((campo) => ['', 'TRUE', 'False', '1', '0', ' true ', 'null'].map((valor) => new URLSearchParams({ [campo]: valor }).toString())),
    'ativo=true&ativo=true', 'em_estoque=false&em_estoque=true', 'ativo[]=true', 'em_estoque[x]=true',
    'ordem=', 'ordem=preco', 'ordem=SALDO', 'ordem=nome&ordem=saldo', 'ordem[]=nome',
    new URLSearchParams({ ordem: 'nome; DROP TABLE produtos' }).toString(),
    ...['', ' ', 'a'.repeat(151), 'Filtro\u0000externo', 'Filtro\nexterno', 'Filtro\u007fexterno'].map((busca) => new URLSearchParams({ busca }).toString()),
    'busca=x&busca=y', 'busca[]=x',
    ...['', ' ', 'Filtros', '-filtros', 'filtros-', 'filtros--novos', 'peixes/doce', 'peixes_doce', 'a'.repeat(81), "x' OR true --"].map((categoria) => new URLSearchParams({ categoria }).toString()),
    'categoria=filtros&categoria=peixes', 'categoria[]=filtros',
    ...['pagina', 'limite'].flatMap((campo) => ['', '0', '-1', '01', '1.5', '1e2', '1 ', '1\n', '9007199254740992'].map((valor) => new URLSearchParams({ [campo]: valor }).toString())),
    'pagina=1&pagina=2', 'pagina[]=1', 'limite=101', 'limite=1&limite=1', 'limite[]=1', 'pagina=9007199254740991&limite=100',
    'abaixoDe=5', 'produtoId=42', 'tipo=entrada', 'de=2026-11-15', 'incluir_inativos=true', 'desconhecido=1', '__proto__=admin',
  ]
  for (const q of invalidos) it(`parâmetro inválido: ${q}`, async () => {
    autenticar(); const sql = banco(); const r = await consultar(q)
    assert.equal(r.status, 400); assert.equal((await r.json()).erro, 'Parâmetros inválidos'); assert.equal(sql.mock.callCount(), 0)
    assert.match(r.headers.get('cache-control'), /no-store/)
  })
})
