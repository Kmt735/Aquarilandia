import assert from 'node:assert/strict'
import { once } from 'node:events'
import { gzipSync } from 'node:zlib'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'

const produto = { id: 42, categoriaId: 12, categoria: 'acessorios', nome: 'Item inativo', descricao: null, marca: null, preco: 12345, imagemUrl: null, emEstoque: false, ativo: false }
describe('Ciclo 2 — consultas administrativas e reativação HTTP', () => {
  let servidor, origem
  before(async () => { servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening'); origem = `http://127.0.0.1:${servidor.address().port}` })
  afterEach(() => mock.restoreAll())
  after(async () => { await new Promise((resolve) => servidor.close(resolve)); await db.end() })
  const autorizar = (papel = 'admin') => mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => papel ? { id: 7, papel } : null)
  const chamar = (caminho = '/produtos?incluir_inativos=true', opcoes = {}) => fetch(`${origem}/api${caminho}`, { ...opcoes, headers: { Cookie: 'sid=fixture', ...opcoes.headers } })
  function transacao(ativo = false, falha = false) {
    const consultas = [], liberar = mock.fn()
    const client = { release: liberar, async query(sql, params) {
      consultas.push({ sql, params })
      if (sql.startsWith('SELECT ativo')) return { rows: [{ ativo }] }
      if (sql.startsWith('UPDATE produtos')) { if (falha) throw new Error('segredo-interno'); return { rows: [] } }
      if (sql.includes('END AS ficha')) return { rows: [{ ...produto, ficha: null, ativo: true }] }
      return { rows: [] }
    } }
    mock.method(db, 'connect', async () => client)
    return { consultas, liberar }
  }
  for (const caminho of ['/produtos?incluir_inativos=true', '/produtos/42?incluir_inativos=true', '/produtos/42/reativar']) {
    for (const [caso, papel, cookie, status] of [['visitante', 'admin', '', 401], ['sessão inválida', null, 'sid=fixture', 401], ['cliente', 'cliente', 'sid=fixture', 403]]) {
      it(`${caso}: ${caminho} responde ${status} sem dados de produto`, async () => {
        autorizar(papel)
        const query = mock.method(db, 'query', async () => { assert.fail('Não deve consultar produtos') })
        const connect = mock.method(db, 'connect', async () => { assert.fail('Não deve iniciar escrita') })
        const r = await chamar(caminho, { method: caminho.endsWith('reativar') ? 'POST' : 'GET', headers: { Cookie: cookie, Origin: env.corsOrigin } })
        assert.equal(r.status, status); assert.equal(r.headers.get('cache-control'), 'no-store')
        assert.equal(JSON.stringify(await r.json()).includes(produto.nome), false)
        assert.equal(query.mock.callCount(), 0); assert.equal(connect.mock.callCount(), 0)
      })
    }
  }
  it('GET admin dispensa Origin, pagina, filtra ativo=false e não retorna ficha/estoque bruto', async () => {
    autorizar()
    const query = mock.method(db, 'query', async () => ({ rows: [{ itens: [produto], total: 7 }] }))
    const r = await chamar('/produtos?incluir_inativos=true&ativo=false&pagina=2&limite=2&ordem=-preco&categoria=acessorios&busca=Item&preco_min=0')
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('vary'), /Cookie/)
    assert.deepEqual(await r.json(), { itens: [produto], total: 7 })
    const [sql, valores] = query.mock.calls[0].arguments
    assert.match(sql, /p\.ativo = \$14/); assert.match(sql, /preco DESC, id ASC/)
    assert.deepEqual(valores, ['acessorios', '%Item%', 0, null, 2, 2, null, null, null, null, null, null, null, false])
  })
  it('detalhe admin inclui ativo e consulta o ID parametrizado', async () => {
    autorizar(); const query = mock.method(db, 'query', async () => ({ rows: [{ ...produto, ficha: null }] }))
    const r = await chamar('/produtos/42?incluir_inativos=true')
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ...produto, ficha: null })
    const [sql, params] = query.mock.calls[0].arguments
    assert.match(sql, /WHERE p.id = \$1/); assert.doesNotMatch(sql, /WHERE p.id = \$1 AND p.ativo/); assert.deepEqual(params, [42])
  })
  it('consulta pública não depende de sessão, continua sem ativo e sem filtro administrativo', async () => {
    const sessao = autorizar('cliente')
    mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 0 }] }))
    assert.equal((await chamar('/produtos?incluir_inativos=false')).status, 200)
    assert.equal(sessao.mock.callCount(), 0)
    assert.equal((await chamar('/produtos?ativo=false')).status, 400)
  })
  for (const query of ['ativo=1', 'ativo=true&ativo=false', 'pagina=0', 'limite=101', 'preco_min=20&preco_max=10', 'ordem=constructor', 'sql=1']) {
    it(`recusa filtros administrativos inválidos: ${query}`, async () => {
      autorizar(); const banco = mock.method(db, 'query', async () => { assert.fail('Não deve consultar') })
      assert.equal((await chamar(`/produtos?incluir_inativos=true&${query}`)).status, 400); assert.equal(banco.mock.callCount(), 0)
    })
  }
  it('duplicidade de flag não seleciona caminho privilegiado', async () => {
    const sessao = autorizar(); const r = await chamar('/produtos?incluir_inativos=true&incluir_inativos=false')
    assert.equal(r.status, 400); assert.equal(sessao.mock.callCount(), 0)
  })
  it('mudança/revogação de papel é respeitada em todas as leituras', async () => {
    let papel = 'admin'
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => papel ? { id: 7, papel } : null)
    mock.method(db, 'query', async () => ({ rows: [{ itens: [produto], total: 1 }] }))
    assert.equal((await chamar()).status, 200); papel = 'cliente'; assert.equal((await chamar()).status, 403)
    papel = null; assert.equal((await chamar()).status, 401)
  })
  for (const origin of ['', 'null', 'https://invalida.example']) {
    it(`reativação exige Origin correto: ${JSON.stringify(origin)}`, async () => {
      autorizar(); assert.equal((await chamar('/produtos/42/reativar', { method: 'POST', headers: { Origin: origin } })).status, 403)
    })
  }
  for (const body of [null, [], { ativo: true }, { estoque: 10 }, { id: 9 }, { ficha: {} }]) {
    it(`reativação recusa payload: ${JSON.stringify(body)}`, async () => {
      autorizar(); const connect = mock.method(db, 'connect', async () => assert.fail('Não deve conectar'))
      const r = await chamar('/produtos/42/reativar', { method: 'POST', headers: { Origin: env.corsOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      assert.equal(r.status, 400); assert.equal(connect.mock.callCount(), 0)
    })
  }
  for (const id of ['0', '01', '2147483648', 'texto']) {
    it(`valida ID administrativo ${id}`, async () => {
      autorizar()
      assert.equal((await chamar(`/produtos/${id}?incluir_inativos=true`)).status, 400)
      assert.equal((await chamar(`/produtos/${id}/reativar`, { method: 'POST', headers: { Origin: env.corsOrigin } })).status, 400)
    })
  }
  for (const ativo of [false, true]) {
    it(`reativa com transação e repetição sem UPDATE quando ativo=${ativo}`, async () => {
      autorizar(); const tx = transacao(ativo)
      const r = await chamar('/produtos/42/reativar', { method: 'POST', headers: { Origin: env.corsOrigin } })
      assert.equal(r.status, 200); assert.equal((await r.json()).ativo, true)
      assert.equal(tx.consultas[0].sql, 'BEGIN'); assert.equal(tx.consultas.at(-1).sql, 'COMMIT')
      assert.equal(tx.consultas.filter((c) => c.sql.startsWith('UPDATE')).length, ativo ? 0 : 1)
      assert.deepEqual(tx.consultas[1].params, [42]); assert.equal(tx.liberar.mock.callCount(), 1)
    })
  }
  it('HEAD administrativo mantém sessão/admin, no-store e corpo vazio', async () => {
    autorizar(); mock.method(db, 'query', async () => ({ rows: [{ itens: [produto], total: 1 }] }))
    const r = await chamar('/produtos?incluir_inativos=true', { method: 'HEAD' })
    assert.equal(r.status, 200); assert.equal(await r.text(), ''); assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.equal((await chamar('/produtos?incluir_inativos=true', { method: 'HEAD', headers: { Cookie: '' } })).status, 401)
  })
  it('reativação preserva limites 413 e rejeição 415 do parser compartilhado', async () => {
    autorizar()
    const headers = { Origin: env.corsOrigin, 'Content-Type': 'application/json' }
    assert.equal((await chamar('/produtos/42/reativar', { method: 'POST', headers, body: JSON.stringify({ dado: 'x'.repeat(102400) }) })).status, 413)
    assert.equal((await chamar('/produtos/42/reativar', { method: 'POST', headers: { ...headers, 'Content-Encoding': 'gzip' }, body: gzipSync('{}') })).status, 415)
  })
  it('falha durante escrita provoca rollback e erro genérico', async () => {
    autorizar(); const tx = transacao(false, true); mock.method(console, 'error', () => {})
    const r = await chamar('/produtos/42/reativar', { method: 'POST', headers: { Origin: env.corsOrigin } })
    assert.equal(r.status, 500); assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
    assert.equal(tx.consultas.at(-1).sql, 'ROLLBACK'); assert.equal(tx.liberar.mock.callCount(), 1)
  })
  it('falha das leituras administrativas é genérica e sem cache', async () => {
    autorizar(); mock.method(console, 'error', () => {}); mock.method(db, 'query', async () => { throw new Error('segredo-interno') })
    for (const path of ['/produtos?incluir_inativos=true', '/produtos/42?incluir_inativos=true']) {
      const r = await chamar(path); assert.equal(r.status, 500); assert.equal(r.headers.get('cache-control'), 'no-store')
      assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
    }
  })
})
