import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { estoqueService } from '../src/modulos/estoque/estoque.service.ts'
import { consolidarItens, ItensIndisponiveisError } from '../src/modulos/estoque/estoque-venda.validacao.ts'
import { AppError } from '../src/utils/AppError.ts'

describe('Estoque de vendas — validação do contrato interno', () => {
  it('consolida repetidos e ordena sem alterar o array original', () => {
    const itens = [{ produtoId: 9, quantidade: 2 }, { produtoId: 2, quantidade: 1 }, { produtoId: 9, quantidade: 3 }]
    assert.deepEqual(consolidarItens(itens), [{ produtoId: 2, quantidade: 1 }, { produtoId: 9, quantidade: 5 }])
    assert.equal(itens.length, 3); assert.equal(itens[0].quantidade, 2)
  })
  for (const [nome, itens] of [['vazio', []], ['null', null], ['objeto', {}], ['item null', [null]], ['id textual', [{ produtoId: '1', quantidade: 1 }]],
    ['zero', [{ produtoId: 0, quantidade: 1 }]], ['quantidade textual', [{ produtoId: 1, quantidade: '1' }]], ['fração', [{ produtoId: 1, quantidade: 1.5 }]],
    ['infinito', [{ produtoId: 1, quantidade: Infinity }]], ['NaN', [{ produtoId: NaN, quantidade: 1 }]], ['negativo', [{ produtoId: 1, quantidade: -1 }]],
    ['overflow', [{ produtoId: 1, quantidade: 2147483648 }]], ['overflow consolidado', [{ produtoId: 1, quantidade: 2147483647 }, { produtoId: 1, quantidade: 1 }]],
    ['campo protegido', [{ produtoId: 1, quantidade: 1, estoque: 3 }]], ['campos herdados', [Object.create({ produtoId: 1, quantidade: 1 })]]]) {
    it(`${nome}: recusa antes de consultar o executor`, async () => {
      await assert.rejects(estoqueService.baixarParaVenda(1, itens, { query() { assert.fail('Não deve consultar o banco') } }), (e) => e instanceof AppError && e.statusCode === 400)
    })
  }
  for (const id of [0, -1, '1', null, 1.1, NaN, Infinity, 2147483648]) {
    it(`ID de venda inválido ${String(id)}`, async () => {
      for (const chamada of [() => estoqueService.baixarParaVenda(id, [{ produtoId: 1, quantidade: 1 }], {}), () => estoqueService.estornarVenda(id, {})]) {
        await assert.rejects(chamada(), (e) => e.statusCode === 400)
      }
    })
  }
  it('erro de domínio contém todos os IDs/quantidades solicitadas, sem revelar saldo', () => {
    const erro = new ItensIndisponiveisError([{ produtoId: 7, quantidade: 2 }, { produtoId: 9, quantidade: 3 }])
    assert.ok(erro instanceof AppError); assert.equal(erro.statusCode, 409)
    assert.deepEqual(erro.itensIndisponiveis, [{ produtoId: 7, quantidade: 2 }, { produtoId: 9, quantidade: 3 }])
    assert.deepEqual(Object.keys(erro.detalhes), ['itens.7.quantidade', 'itens.9.quantidade'])
    assert.doesNotMatch(JSON.stringify(erro), /saldo|estoqueAtual|SELECT|senha/)
  })
})
