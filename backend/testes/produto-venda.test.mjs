import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { db } from '../src/config/db.ts'
import { produtoService } from '../src/modulos/catalogo/produto.service.ts'
import { AppError } from '../src/utils/AppError.ts'

const semBanco = { query() { assert.fail('Não deve consultar o banco') } }
const ehErroComum = (e) => e instanceof Error && !(e instanceof AppError)

describe('produtoService.buscarParaVenda — contrato interno com vendas', () => {
  afterEach(() => mock.restoreAll())

  for (const ids of [[0], [-1], [1.5], [2147483648], [1, 0], [NaN], [Infinity], ['1'], ['3'], [null], null, undefined, {}]) {
    it(`IDs inválidos ${JSON.stringify(ids)}: Error comum, sem consultar o banco`, async () => {
      const consulta = mock.method(db, 'query', () => assert.fail('Não deve usar o pool'))
      await assert.rejects(produtoService.buscarParaVenda(ids, semBanco), ehErroComum)
      await assert.rejects(produtoService.buscarParaVenda(ids), ehErroComum)
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  it('lista vazia retorna [] sem consultar o executor nem o pool', async () => {
    const consulta = mock.method(db, 'query', () => assert.fail('Não deve usar o pool'))
    assert.deepEqual(await produtoService.buscarParaVenda([], semBanco), [])
    assert.deepEqual(await produtoService.buscarParaVenda([]), [])
    assert.equal(consulta.mock.callCount(), 0)
  })

  it('101 IDs distintos: Error comum, sem consultar o banco', async () => {
    const consulta = mock.method(db, 'query', () => assert.fail('Não deve usar o pool'))
    const ids = Array.from({ length: 101 }, (_, i) => i + 1)
    await assert.rejects(produtoService.buscarParaVenda(ids, semBanco), (e) => ehErroComum(e) && /100/.test(e.message))
    await assert.rejects(produtoService.buscarParaVenda(ids), ehErroComum)
    assert.equal(consulta.mock.callCount(), 0)
  })

  it('100 IDs distintos são aceitos; 150 entradas que viram 1 ID também (o limite vale depois de tirar repetidos)', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    await produtoService.buscarParaVenda(Array.from({ length: 100 }, (_, i) => i + 1))
    await produtoService.buscarParaVenda(Array(150).fill(7))
    assert.equal(consulta.mock.callCount(), 2)
    assert.equal(consulta.mock.calls[0].arguments[1][0].length, 100)
    assert.deepEqual(consulta.mock.calls[1].arguments[1], [[7]])
  })

  it('com executor: limites 1 e 2147483647 vão como um único parâmetro de array, com FOR NO KEY UPDATE OF p em ordem de id', async () => {
    const linhas = [{ id: 1, nome: 'A', preco: 100, ativo: true, categoria: 'peixes' }]
    const chamadas = []
    const consulta = mock.method(db, 'query', () => assert.fail('Com executor não deve usar o pool'))
    const executor = { async query(sql, params) { chamadas.push({ sql, params }); return { rows: linhas } } }
    assert.deepEqual(await produtoService.buscarParaVenda([1, 2147483647], executor), linhas)
    assert.equal(chamadas.length, 1)
    assert.equal(consulta.mock.callCount(), 0)
    assert.deepEqual(chamadas[0].params, [[1, 2147483647]])
    assert.match(chamadas[0].sql, /WHERE p\.id = ANY\(\$1::integer\[\]\)/)
    assert.match(chamadas[0].sql, /ORDER BY p\.id\s+FOR NO KEY UPDATE OF p\s*$/)
    assert.doesNotMatch(chamadas[0].sql, /ativo\s*(=|AND)|WHERE p\.ativo/)
  })

  it('sem executor: usa o pool, SEM trava, e remove repetidos antes de consultar', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    assert.deepEqual(await produtoService.buscarParaVenda([3, 1, 3, 1]), [])
    assert.equal(consulta.mock.callCount(), 1)
    const [sql, params] = consulta.mock.calls[0].arguments
    assert.deepEqual(params, [[3, 1]])
    assert.match(sql, /ORDER BY p\.id\s*$/)
    assert.doesNotMatch(sql, /FOR\s+(NO KEY\s+)?UPDATE|FOR SHARE|FOR KEY SHARE/)
  })

  it('com executor: repetidos também viram um só', async () => {
    const chamadas = []
    const executor = { async query(sql, params) { chamadas.push(params); return { rows: [] } } }
    await produtoService.buscarParaVenda([5, 5, 2, 5], executor)
    assert.deepEqual(chamadas, [[[5, 2]]])
  })

  it('id faltando não vira erro: devolve só as linhas encontradas', async () => {
    const executor = { async query() { return { rows: [{ id: 2, nome: 'B', preco: 5, ativo: false, categoria: 'acessorios' }] } } }
    assert.deepEqual(await produtoService.buscarParaVenda([2, 99], executor), [{ id: 2, nome: 'B', preco: 5, ativo: false, categoria: 'acessorios' }])
  })
})
