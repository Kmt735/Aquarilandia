import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'

describe('GET /api/produtos — contrato HTTP', () => {
  let servidor
  let origem

  before(async () => {
    servidor = app.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })

  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })

  it('retorna o envelope público e consulta com paginação padrão', async () => {
    const lista = {
      itens: [{
        id: 10, categoriaId: 3, categoria: 'filtros', nome: 'Filtro externo', descricao: null,
        marca: null, preco: 8990, imagemUrl: null, emEstoque: true,
      }],
      total: 1,
    }
    const consulta = mock.method(db, 'query', async () => ({ rows: [lista] }))

    const resposta = await fetch(`${origem}/api/produtos`)

    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), lista)
    assert.equal(consulta.mock.callCount(), 1)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [null, null, null, null, 20, 0, null, null, null, null, null, null, null])
  })

  it('combina filtros, normaliza textos e parametriza busca literal e paginação', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 7 }] }))
    const query = new URLSearchParams({
      categoria: ' filtros ', busca: "  Kit 100%_! d'água  ", preco_min: '0', preco_max: '20000',
      pagina: '2', limite: '5', ordem: '-preco',
    })

    const resposta = await fetch(`${origem}/api/produtos?${query}`)

    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { itens: [], total: 7 })
    const [sql, parametros] = consulta.mock.calls[0].arguments
    assert.deepEqual(parametros, ['filtros', "%Kit 100!%!_!! d'água%", 0, 20000, 5, 5, null, null, null, null, null, null, null])
    assert.equal(sql.includes("Kit 100%_! d'água"), false)
  })

  for (const ordem of ['nome', 'preco', '-preco']) {
    it(`aceita a ordenação ${ordem}`, async () => {
      mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 0 }] }))
      const resposta = await fetch(`${origem}/api/produtos?ordem=${ordem}`)
      assert.equal(resposta.status, 200)
    })
  }

  it('aceita limite 100, preços zero e o maior INTEGER do PostgreSQL', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 0 }] }))
    const resposta = await fetch(`${origem}/api/produtos?limite=100&preco_min=0&preco_max=2147483647`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [null, null, 0, 2147483647, 100, 0, null, null, null, null, null, null, null])
  })

  it('aceita incluir_inativos=false mantendo a consulta pública', async () => {
    mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 0 }] }))
    const resposta = await fetch(`${origem}/api/produtos?incluir_inativos=false`)
    assert.equal(resposta.status, 200)
  })

  const invalidos = [
    ['pagina=0', 'pagina'],
    ['pagina=-1', 'pagina'],
    ['pagina=1.5', 'pagina'],
    ['pagina=', 'pagina'],
    ['pagina=1e2', 'pagina'],
    ['pagina=01', 'pagina'],
    ['pagina=9007199254740992', 'pagina'],
    ['pagina=9007199254740991&limite=100', 'pagina'],
    ['pagina=1&pagina=2', 'pagina'],
    ['pagina[]=1', 'pagina[]'],
    ['limite=0', 'limite'],
    ['limite=101', 'limite'],
    ['limite=abc', 'limite'],
    ['limite=1&limite=2', 'limite'],
    ['preco_min=-1', 'preco_min'],
    ['preco_min=89.90', 'preco_min'],
    ['preco_min=1e2', 'preco_min'],
    ['preco_min=2147483648', 'preco_min'],
    ['preco_max=abc', 'preco_max'],
    ['preco_max=', 'preco_max'],
    ['preco_max=01', 'preco_max'],
    ['preco_min=10&preco_max=9', 'preco_max'],
    ['preco_min=0&preco_min=1', 'preco_min'],
    ['categoria=', 'categoria'],
    ['categoria=Aquários', 'categoria'],
    ['categoria=filtros&categoria=plantas', 'categoria'],
    ['categoria=filtros%27%20OR%20true--', 'categoria'],
    ['busca=%20%20', 'busca'],
    ['busca=a&busca=b', 'busca'],
    [`busca=${'a'.repeat(151)}`, 'busca'],
    ['ordem=', 'ordem'],
    ['ordem=id', 'ordem'],
    ['ordem=constructor', 'ordem'],
    ['ordem=nome%3BDELETE%20FROM%20produtos', 'ordem'],
    ['ordem=nome&ordem=preco', 'ordem'],
    ['incluir_inativos=1', 'incluir_inativos'],
    ['incluir_inativos=false&incluir_inativos=true', 'incluir_inativos'],
    ['disponibilidade=in', 'disponibilidade'],
    ['emEstoque=true', 'emEstoque'],
    ['tipo_agua=salgada', 'tipo_agua'],
    ['__proto__=1', '__proto__'],
  ]

  for (const [query, campo] of invalidos) {
    it(`recusa ${query.slice(0, 90)} com 400 antes de consultar o banco`, async () => {
      const consulta = mock.method(db, 'query', async () => {
        throw new Error('Não deveria consultar o banco')
      })
      const resposta = await fetch(`${origem}/api/produtos?${query}`)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 400)
      assert.equal(corpo.erro, 'Parâmetros inválidos')
      assert.equal(typeof corpo.detalhes[campo], 'string')
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  it('reúne erros de filtros independentes', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await fetch(`${origem}/api/produtos?categoria=&preco_min=-1&ordem=abc`)
    assert.equal(resposta.status, 400)
    assert.deepEqual(Object.keys((await resposta.json()).detalhes).sort(), ['categoria', 'ordem', 'preco_min'])
    assert.equal(consulta.mock.callCount(), 0)
  })

  it('consulta administrativa sem sessão retorna 401 antes do banco', async () => {
    const consulta = mock.method(db, 'query', async () => assert.fail('Não deve consultar'))
    const resposta = await fetch(`${origem}/api/produtos?incluir_inativos=true`)
    assert.equal(resposta.status, 401)
    assert.deepEqual(await resposta.json(), { erro: 'Faça login para continuar.' })
    assert.equal(consulta.mock.callCount(), 0)
  })

  it('trata falha do banco sem expor a mensagem interna', async () => {
    mock.method(console, 'error', () => {})
    mock.method(db, 'query', async () => { throw new Error('Falha interna: senha=segredo') })
    const resposta = await fetch(`${origem}/api/produtos`)
    assert.equal(resposta.status, 500)
    assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
  })
})
