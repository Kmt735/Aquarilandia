import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'

describe('GET /api/categorias — contrato HTTP', () => {
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

  it('é pública, consulta o repository e retorna itens/total com a paginação padrão', async () => {
    const lista = { itens: [{ id: 1, nome: 'Peixes', slug: 'peixes' }], total: 12 }
    const consulta = mock.method(db, 'query', async () => ({ rows: [lista] }))

    const resposta = await fetch(`${origem}/api/categorias`)

    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), lista)
    assert.equal(consulta.mock.callCount(), 1)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [20, 0])
  })

  it('aplica pagina e limite no acesso ao banco', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 12 }] }))

    const resposta = await fetch(`${origem}/api/categorias?pagina=3&limite=5`)

    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { itens: [], total: 12 })
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [5, 10])
  })

  it('aceita o limite máximo de 100 itens', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 0 }] }))

    const resposta = await fetch(`${origem}/api/categorias?limite=100`)

    assert.equal(resposta.status, 200)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [100, 0])
  })

  const invalidos = [
    ['pagina=0', 'pagina'],
    ['pagina=-1', 'pagina'],
    ['pagina=1.5', 'pagina'],
    ['pagina=abc', 'pagina'],
    ['pagina=', 'pagina'],
    ['pagina=1e2', 'pagina'],
    ['pagina=01', 'pagina'],
    ['pagina=9007199254740992', 'pagina'],
    ['pagina=9007199254740991&limite=100', 'pagina'],
    ['pagina=1&pagina=2', 'pagina'],
    ['pagina[]=1', 'pagina[]'],
    ['limite=0', 'limite'],
    ['limite=-1', 'limite'],
    ['limite=1.5', 'limite'],
    ['limite=abc', 'limite'],
    ['limite=', 'limite'],
    ['limite=101', 'limite'],
    ['limite=10&limite=20', 'limite'],
    ['busca=peixes', 'busca'],
    ['__proto__=1', '__proto__'],
  ]

  for (const [query, campo] of invalidos) {
    it(`recusa ${query} com 400 antes de consultar o banco`, async () => {
      const consulta = mock.method(db, 'query', async () => {
        throw new Error('A validação deveria impedir esta consulta')
      })

      const resposta = await fetch(`${origem}/api/categorias?${query}`)
      const corpo = await resposta.json()

      assert.equal(resposta.status, 400)
      assert.equal(corpo.erro, 'Parâmetros inválidos')
      assert.equal(typeof corpo.detalhes[campo], 'string')
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  it('reúne os erros de pagina e limite na resposta', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))

    const resposta = await fetch(`${origem}/api/categorias?pagina=0&limite=101`)
    const corpo = await resposta.json()

    assert.equal(resposta.status, 400)
    assert.deepEqual(Object.keys(corpo.detalhes).sort(), ['limite', 'pagina'])
    assert.equal(consulta.mock.callCount(), 0)
  })

  it('trata falha do banco com o erro 500 existente, sem expor detalhes internos', async () => {
    mock.method(console, 'error', () => {})
    mock.method(db, 'query', async () => {
      throw new Error('Falha interna: postgres://usuario:senha@banco/categorias')
    })

    const resposta = await fetch(`${origem}/api/categorias`)

    assert.equal(resposta.status, 500)
    assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
  })

  it('preserva o formato e os dados das outras consultas do catálogo', async () => {
    const consulta = mock.method(db, 'query', async () => {
      throw new Error('As outras consultas continuam usando seus dados atuais')
    })

    for (const [caminho, quantidade] of [['servicos', 6]]) {
      const resposta = await fetch(`${origem}/api/${caminho}`)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 200)
      assert.equal(Array.isArray(corpo), true)
      assert.equal(corpo.length, quantidade)
    }
    assert.equal(consulta.mock.callCount(), 0)
  })
})
