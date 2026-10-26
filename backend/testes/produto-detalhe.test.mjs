import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'

describe('GET /api/produtos/:id — contrato HTTP', () => {
  let servidor
  let origem
  const basicos = {
    id: 42, categoriaId: 12, categoria: 'acessorios', nome: 'Redinha', descricao: null,
    marca: null, preco: 4990, imagemUrl: null, emEstoque: false,
  }

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

  it('retorna objeto público e ficha null para produto comum, parametrizando o ID numérico', async () => {
    const produto = { ...basicos, ficha: null }
    const consulta = mock.method(db, 'query', async () => ({ rows: [produto] }))
    const resposta = await fetch(`${origem}/api/produtos/42`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), produto)
    assert.equal(consulta.mock.callCount(), 1)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [42])
  })

  for (const [categoria, dados] of [
    ['peixes', { nomeCientifico: 'Betta splendens', tipoAgua: 'doce', phMin: 6, phMax: 7.5 }],
    ['aquarios', { volumeLitros: 40, comprimentoCm: 50, material: 'vidro', tipoAgua: 'doce' }],
  ]) {
    it(`inclui a ficha de ${categoria} no objeto`, async () => {
      const produto = { ...basicos, categoria, ficha: { tipo: categoria, dados } }
      mock.method(db, 'query', async () => ({ rows: [produto] }))
      const resposta = await fetch(`${origem}/api/produtos/42`)
      assert.equal(resposta.status, 200)
      assert.deepEqual(await resposta.json(), produto)
    })
  }

  it('mantém os campos básicos do detalhe iguais aos da listagem', async () => {
    mock.method(db, 'query', async (_sql, parametros) => ({
      rows: parametros.length === 1 ? [{ ...basicos, ficha: null }] : [{ itens: [basicos], total: 1 }],
    }))
    const lista = await (await fetch(`${origem}/api/produtos`)).json()
    const resposta = await fetch(`${origem}/api/produtos/${lista.itens[0].id}`)
    const { ficha, ...produto } = await resposta.json()
    assert.equal(resposta.status, 200)
    assert.deepEqual(produto, lista.itens[0])
    assert.equal(ficha, null)
  })

  it('retorna 404 para produto inexistente ou inativo, sem fallback', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await fetch(`${origem}/api/produtos/42?incluir_inativos=true`, {
      headers: { Cookie: 'sid=teste' },
    })
    assert.equal(resposta.status, 404)
    assert.deepEqual(await resposta.json(), { erro: 'Produto não encontrado' })
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [42])
  })

  it('aceita o maior ID INTEGER como válido e consulta o banco', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await fetch(`${origem}/api/produtos/2147483647`)
    assert.equal(resposta.status, 404)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [2147483647])
  })

  for (const id of [
    '0', '-1', '1.5', '1e2', '01', '0x2', 'NaN', 'Infinity', ' 1 ',
    '2147483648', '9007199254740992', 'aquario-vidro-40l', "1' OR true --", '1;DROP TABLE produtos',
  ]) {
    it(`recusa ID ${id} com 400 antes de consultar o banco`, async () => {
      const consulta = mock.method(db, 'query', async () => { throw new Error('Não deveria consultar') })
      const resposta = await fetch(`${origem}/api/produtos/${encodeURIComponent(id)}`)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 400)
      assert.equal(corpo.erro, 'Parâmetros inválidos')
      assert.equal(typeof corpo.detalhes.id, 'string')
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  it('trata falha do banco sem expor detalhes internos nem retornar dados fixos', async () => {
    mock.method(console, 'error', () => {})
    mock.method(db, 'query', async () => { throw new Error('Falha interna: senha=segredo') })
    const resposta = await fetch(`${origem}/api/produtos/42`)
    assert.equal(resposta.status, 500)
    assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
  })
})
