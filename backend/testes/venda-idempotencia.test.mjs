import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { AppError } from '../src/utils/AppError.ts'
import {
  formatarReais,
  hashDoPedido,
  lerTotalEsperado,
  validarChaveIdempotencia,
  validarPedido,
} from '../src/modulos/vendas/venda.validacao.ts'

const pedidoDe = (body) => validarPedido(body, 'endereco')
const erro422 = (detalhes) => (e) => {
  assert.ok(e instanceof AppError); assert.equal(e.statusCode, 422); assert.deepEqual(e.detalhes, detalhes)
  return true
}
const item = (produtoId, quantidade) => ({ produtoId, quantidade })

describe('validarChaveIdempotencia (mesmo padrão do estoque)', () => {
  const erro400 = (e) => {
    assert.ok(e instanceof AppError); assert.equal(e.statusCode, 400); assert.equal(e.message, 'Dados inválidos')
    assert.deepEqual(e.detalhes, { 'Idempotency-Key': 'Informe um UUID canônico em minúsculas (versão 1 a 8 e variante RFC).' })
    return true
  }

  it('UUID canônico em minúsculas passa como veio', () => {
    assert.equal(validarChaveIdempotencia('7f0c6a7e-2b1d-4c3a-9e8f-1a2b3c4d5e6f'), '7f0c6a7e-2b1d-4c3a-9e8f-1a2b3c4d5e6f')
  })

  for (const chave of [undefined, '', 'abc', '7F0C6A7E-2B1D-4C3A-9E8F-1A2B3C4D5E6F', '7f0c6a7e-2b1d-0c3a-9e8f-1a2b3c4d5e6f',
    '7f0c6a7e-2b1d-4c3a-7e8f-1a2b3c4d5e6f', ' 7f0c6a7e-2b1d-4c3a-9e8f-1a2b3c4d5e6f', '7f0c6a7e2b1d4c3a9e8f1a2b3c4d5e6f', 123]) {
    it(`chave ${JSON.stringify(chave) ?? 'ausente'} → 400`, () => assert.throws(() => validarChaveIdempotencia(chave), erro400))
  }
})

describe('totalEsperado', () => {
  const erro = { totalEsperado: 'Atualize o carrinho antes de finalizar a compra.' }

  it('inteiro de 0 a 2147483647 passa', () => {
    for (const valor of [0, 1, 5480, 2147483647]) assert.equal(lerTotalEsperado(valor), valor)
  })

  for (const valor of [undefined, null, '5480', -1, 1.5, 2147483648, NaN]) {
    it(`${JSON.stringify(valor) ?? 'ausente'} → 422 em totalEsperado`, () => {
      assert.throws(() => lerTotalEsperado(valor), erro422(erro))
    })
  }

  it('a venda exige totalEsperado e junta o erro com os outros', () => {
    assert.throws(() => pedidoDe({ itens: [item(1, 1)] }),
      erro422({ entrega: 'Escolha um endereço de entrega ou retirar na loja.', ...erro }))
    assert.deepEqual(pedidoDe({ itens: [item(1, 1)], retirada: true, totalEsperado: 900 }).totalEsperado, 900)
  })

  it('a cotação (#28) não muda: não exige nem devolve totalEsperado', () => {
    assert.deepEqual(validarPedido({ itens: [item(1, 1)], retirada: true }, 'cep'), { itens: [{ produtoId: 1, quantidade: 1, indice: 0 }], entrega: { retirada: true } })
    assert.equal('totalEsperado' in validarPedido({ itens: [item(1, 1)], retirada: true, totalEsperado: 'x' }, 'cep'), false)
  })
})

describe('hashDoPedido (forma canônica)', () => {
  const base = { itens: [item(5, 2), item(3, 1)], enderecoId: 7, totalEsperado: 5480 }
  const hash = hashDoPedido(pedidoDe(base))

  it('SHA-256 em hex (64 caracteres, como o CHECK do banco exige)', () => assert.match(hash, /^[0-9a-f]{64}$/))

  it('a mesma compra em outra ordem, dividida em itens ou com chaves extras → o mesmo hash', () => {
    for (const body of [
      { itens: [item(3, 1), item(5, 2)], enderecoId: 7, totalEsperado: 5480 },
      { itens: [item(5, 1), item(3, 1), item(5, 1)], enderecoId: 7, totalEsperado: 5480 },
      { ...base, precoUnitario: 1, status: 'paga', cep: '00000000' },
      { totalEsperado: 5480, enderecoId: 7, itens: base.itens, retirada: false },
    ]) assert.equal(hashDoPedido(pedidoDe(body)), hash, JSON.stringify(body))
  })

  it('outra compra → outro hash (quantidade, produto, entrega ou total diferentes)', () => {
    const outros = [
      { ...base, itens: [item(5, 3), item(3, 1)] },
      { ...base, itens: [item(5, 2), item(4, 1)] },
      { ...base, itens: [item(5, 2)] },
      { ...base, enderecoId: 8 },
      { itens: base.itens, retirada: true, totalEsperado: 5480 },
      { ...base, totalEsperado: 5481 },
    ].map((body) => hashDoPedido(pedidoDe(body)))
    assert.equal(new Set([hash, ...outros]).size, outros.length + 1)
  })
})

describe('formatarReais', () => {
  it('centavos → R$ com vírgula decimal e ponto de milhar', () => {
    assert.equal(formatarReais(0), 'R$ 0,00')
    assert.equal(formatarReais(5), 'R$ 0,05')
    assert.equal(formatarReais(1990), 'R$ 19,90')
    assert.equal(formatarReais(123456), 'R$ 1.234,56')
    assert.equal(formatarReais(2147483647), 'R$ 21.474.836,47')
  })
})
