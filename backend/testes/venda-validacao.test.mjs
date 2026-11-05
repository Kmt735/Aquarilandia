import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ItensIndisponiveisError } from '../src/modulos/estoque/estoque-venda.validacao.ts'
import { AppError } from '../src/utils/AppError.ts'
import {
  exigirDisponiveis,
  lerEntrega,
  precificar,
  somarPorProduto,
  somarTotal,
  traduzirErroFrete,
  traduzirEstoqueInsuficiente,
  validarItens,
  validarPedido,
} from '../src/modulos/vendas/venda.validacao.ts'

// Confere o 422 e as chaves exatas de detalhes
const erro422 = (detalhes) => (e) => {
  assert.ok(e instanceof AppError, `esperava AppError, veio ${e}`)
  assert.equal(e.statusCode, 422)
  assert.deepEqual(e.detalhes, detalhes)
  return true
}
const item = (produtoId, quantidade, extra = {}) => ({ produtoId, quantidade, ...extra })

describe('validarItens', () => {
  for (const valor of [undefined, null, 'itens', {}, [], Array.from({ length: 31 }, (_, i) => item(i + 1, 1))]) {
    it(`lista ${Array.isArray(valor) ? `com ${valor.length} itens` : JSON.stringify(valor)} → 422 em itens`, () => {
      assert.throws(() => validarItens(valor), erro422({ itens: 'Adicione de 1 a 30 produtos.' }))
    })
  }

  it('30 itens passam e guardam o índice original', () => {
    const { itens } = validarItens(Array.from({ length: 30 }, (_, i) => item(i + 1, 1)))
    assert.equal(itens.length, 30)
    assert.deepEqual(itens[29], { produtoId: 30, quantidade: 1, indice: 29 })
  })

  for (const produtoId of [0, -1, 1.5, '3', null, undefined, NaN, 2147483648, true]) {
    it(`produtoId ${JSON.stringify(produtoId) ?? 'undefined'} → 'Produto inválido.'`, () => {
      assert.throws(() => validarItens([item(1, 1), item(produtoId, 1)]), erro422({ 'itens.1.produtoId': 'Produto inválido.' }))
    })
  }

  for (const quantidade of [0, -1, 1.5, 51, '2', null]) {
    it(`quantidade ${JSON.stringify(quantidade)} → 'A quantidade precisa ser de 1 a 50.'`, () => {
      assert.throws(() => validarItens([item(1, quantidade)]),
        erro422({ 'itens.0.quantidade': 'A quantidade precisa ser de 1 a 50.' }))
    })
  }

  it('junta os erros de vários itens, e item que não é objeto erra nos dois campos', () => {
    assert.throws(() => validarItens([item(0, 1), 'x', item(2, 99)]), erro422({
      'itens.0.produtoId': 'Produto inválido.',
      'itens.1.produtoId': 'Produto inválido.',
      'itens.1.quantidade': 'A quantidade precisa ser de 1 a 50.',
      'itens.2.quantidade': 'A quantidade precisa ser de 1 a 50.',
    }))
  })

  it('ignora precoUnitario, subtotal e outras chaves do item', () => {
    assert.deepEqual(validarItens([item(7, 2, { precoUnitario: 1, subtotal: 1, nome: 'x' })]).itens,
      [{ produtoId: 7, quantidade: 2, indice: 0 }])
  })
})

describe('somarPorProduto', () => {
  it('um item por produto, somando, com o PRIMEIRO índice e na ordem da primeira aparição', () => {
    const entrada = validarItens([item(5, 1), item(3, 2), item(5, 3), item(9, 1), item(3, 4)]).itens
    assert.deepEqual(somarPorProduto(entrada), [
      { produtoId: 5, quantidade: 4, indice: 0 },
      { produtoId: 3, quantidade: 6, indice: 1 },
      { produtoId: 9, quantidade: 1, indice: 3 },
    ])
    assert.equal(entrada[0].quantidade, 1, 'não altera os itens recebidos')
  })

  it('soma acima de 50 → 422 no primeiro índice do produto', () => {
    const entrada = validarItens([item(1, 1), item(2, 30), item(1, 1), item(2, 21)]).itens
    assert.throws(() => somarPorProduto(entrada), erro422({ 'itens.1.quantidade': 'A quantidade precisa ser de 1 a 50.' }))
  })

  it('soma exatamente 50 passa', () => {
    assert.deepEqual(somarPorProduto(validarItens([item(4, 25), item(4, 25)]).itens), [{ produtoId: 4, quantidade: 50, indice: 0 }])
  })
})

describe('lerEntrega', () => {
  const entrega = { entrega: 'Escolha um endereço de entrega ou retirar na loja.' }

  it('retirada true (cotação e venda)', () => {
    assert.deepEqual(lerEntrega({ retirada: true }, 'cep'), { retirada: true })
    assert.deepEqual(lerEntrega({ retirada: true }, 'endereco'), { retirada: true })
  })

  for (const retirada of ['true', 1, 'sim', 0, {}]) {
    it(`retirada ${JSON.stringify(retirada)} (não boolean) → 422 em retirada`, () => {
      assert.throws(() => lerEntrega({ retirada, cep: '36300000' }, 'cep'),
        erro422({ retirada: 'Informe true para retirar na loja ou false para entrega.' }))
    })
  }

  it('nada escolhido, ou retirada false sem destino → 422 em entrega', () => {
    for (const dados of [{}, { retirada: false }, { retirada: null }, { cep: '' }, { cep: null }]) {
      assert.throws(() => lerEntrega(dados, 'cep'), erro422(entrega))
    }
    for (const dados of [{}, { retirada: false }, { enderecoId: null }]) assert.throws(() => lerEntrega(dados, 'endereco'), erro422(entrega))
  })

  it('retirada e destino juntos → 422 em entrega', () => {
    assert.throws(() => lerEntrega({ retirada: true, cep: '36300000' }, 'cep'), erro422(entrega))
    assert.throws(() => lerEntrega({ retirada: true, enderecoId: 3 }, 'endereco'), erro422(entrega))
  })

  it('cotação: CEP com ou sem máscara; CEP inválido → 422 em cep', () => {
    assert.deepEqual(lerEntrega({ cep: '36300-000' }, 'cep'), { retirada: false, cep: '36300000' })
    assert.deepEqual(lerEntrega({ retirada: false, cep: '01001000' }, 'cep'), { retirada: false, cep: '01001000' })
    for (const cep of ['3630000', '363000000', 'abc', 36300000]) {
      assert.throws(() => lerEntrega({ cep }, 'cep'),
        erro422({ cep: 'Informe um CEP válido com 8 números ou escolha retirar na loja.' }))
    }
  })

  it('venda: enderecoId inteiro positivo; o cep do body é ignorado', () => {
    assert.deepEqual(lerEntrega({ enderecoId: 12, cep: 'qualquer' }, 'endereco'), { retirada: false, enderecoId: 12 })
    for (const enderecoId of [0, -1, 1.5, '12', 2147483648]) {
      assert.throws(() => lerEntrega({ enderecoId }, 'endereco'), erro422({ enderecoId: 'Endereço inválido.' }))
    }
  })
})

describe('validarPedido', () => {
  it('body que não é objeto → 422 em body', () => {
    for (const body of [null, 'x', [], 3]) assert.throws(() => validarPedido(body, 'cep'), erro422({ body: 'Formato de dados inválido.' }))
  })

  it('erros de itens e de entrega saem juntos', () => {
    assert.throws(() => validarPedido({ itens: [item(0, 1)], totalEsperado: 0 }, 'endereco'), erro422({
      'itens.0.produtoId': 'Produto inválido.',
      entrega: 'Escolha um endereço de entrega ou retirar na loja.',
    }))
  })

  it('soma os repetidos e ignora total, status, clienteId e preços do body', () => {
    const body = { itens: [item(2, 1, { precoUnitario: 1 }), item(2, 2)], retirada: true, total: 1, status: 'paga', clienteId: 99, totalEsperado: 1500 }
    assert.deepEqual(validarPedido(body, 'endereco'),
      { itens: [{ produtoId: 2, quantidade: 3, indice: 0 }], entrega: { retirada: true }, totalEsperado: 1500 })
  })
})

describe('exigirDisponiveis, precificar e somarTotal', () => {
  const produtos = [
    { id: 1, nome: 'Filtro', preco: 1990, ativo: true, categoria: 'filtros' },
    { id: 2, nome: 'Antigo', preco: 500, ativo: false, categoria: 'racoes' },
  ]

  it('inexistente ou inativo → 422 no índice original', () => {
    const itens = [{ produtoId: 1, quantidade: 1, indice: 0 }, { produtoId: 2, quantidade: 1, indice: 3 }, { produtoId: 9, quantidade: 1, indice: 5 }]
    assert.throws(() => exigirDisponiveis(itens, produtos),
      erro422({ 'itens.3.produtoId': 'Produto indisponível.', 'itens.5.produtoId': 'Produto indisponível.' }))
  })

  it('preço do catálogo vezes a quantidade, na ordem dos itens', () => {
    const itens = [{ produtoId: 1, quantidade: 3, indice: 0 }]
    const { linhas, subtotal } = precificar(itens, exigirDisponiveis(itens, produtos))
    assert.deepEqual(linhas, [{ produtoId: 1, nomeProduto: 'Filtro', precoUnitario: 1990, quantidade: 3, subtotal: 5970, categoria: 'filtros' }])
    assert.equal(subtotal, 5970)
  })

  it('total acima do INTEGER do banco → 422', () => {
    assert.equal(somarTotal(2147483000, 647), 2147483647)
    assert.throws(() => somarTotal(2147483000, 648), (e) => e instanceof AppError && e.statusCode === 422 && 'itens' in e.detalhes)
  })
})

describe('traduzirErroFrete', () => {
  const somados = [{ produtoId: 1, quantidade: 3, indice: 0 }, { produtoId: 7, quantidade: 1, indice: 4 }]

  it('índice do peixe na lista somada → índice original; cep passa como veio', () => {
    const err = new AppError('Peixes vivos só são entregues em São João del Rei.', 422, { 'itens.1.produtoId': 'Peixe.' })
    assert.throws(() => traduzirErroFrete(err, somados), (e) => {
      assert.equal(e.message, err.message); assert.deepEqual(e.detalhes, { 'itens.4.produtoId': 'Peixe.' }); return true
    })
    const cep = new AppError('Dados inválidos', 422, { cep: 'CEP.' })
    assert.throws(() => traduzirErroFrete(cep, somados), erro422({ cep: 'CEP.' }))
  })

  it('outro erro, ou índice que não existe, é relançado sem mudança', () => {
    for (const err of [new Error('x'), new AppError('Outro', 409), new AppError('Dados inválidos', 422, { 'itens.9.produtoId': 'x' })]) {
      assert.throws(() => traduzirErroFrete(err, somados), (e) => e === err)
    }
  })
})

describe('traduzirEstoqueInsuficiente', () => {
  const somados = [{ produtoId: 10, quantidade: 3, indice: 0 }, { produtoId: 20, quantidade: 1, indice: 2 }]

  it('o 409 por produtoId do estoque vira itens.<indiceOriginal>.quantidade', () => {
    const err = new ItensIndisponiveisError([{ produtoId: 20, quantidade: 1 }, { produtoId: 10, quantidade: 3 }])
    assert.throws(() => traduzirEstoqueInsuficiente(err, somados), (e) => {
      assert.ok(e instanceof AppError); assert.equal(e.statusCode, 409); assert.equal(e.message, 'Estoque insuficiente')
      assert.deepEqual(e.detalhes, {
        'itens.2.quantidade': 'Não temos essa quantidade em estoque.',
        'itens.0.quantidade': 'Não temos essa quantidade em estoque.',
      })
      assert.equal(JSON.stringify(e.detalhes).includes('20'), false, 'o produtoId não aparece mais nas chaves')
      return true
    })
  })

  it('erro de outra forma é relançado como veio', () => {
    const semLista = new AppError('Estoque insuficiente', 409, { 'itens.10.quantidade': 'x' })
    const outroProduto = new ItensIndisponiveisError([{ produtoId: 99, quantidade: 1 }])
    for (const err of [new AppError('Itens incompatíveis com a venda persistida', 409), new Error('falha do banco'),
      new AppError('Estoque insuficiente', 422), semLista, outroProduto, 'texto']) {
      assert.throws(() => traduzirEstoqueInsuficiente(err, somados), (e) => e === err)
    }
  })
})
