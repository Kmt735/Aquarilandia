import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configFrete } from '../src/modulos/vendas/frete.config.ts'
import { calcularFrete } from '../src/modulos/vendas/frete.service.ts'
import { AppError } from '../src/utils/AppError.ts'

const racao = { categoria: 'racoes' }
const peixe = { categoria: 'peixes' }
const filtro = { categoria: 'filtros' }
const entrega = (cep, itens = [racao], subtotal = 5000) => calcularFrete({ cep, retirada: false, itens, subtotal })
const erroCep = { cep: 'Informe um CEP válido com 8 números ou escolha retirar na loja.' }

function recusa(fn, mensagem, detalhes) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof AppError)
    assert.equal(err.statusCode, 422)
    assert.equal(err.message, mensagem)
    assert.deepEqual(err.detalhes, detalhes)
    return true
  })
}

describe('Frete — calcularFrete (#27)', () => {
  describe('São João del Rei (entrega própria)', () => {
    for (const cep of ['36300000', '36305123', '36309999']) {
      it(`${cep} → propria, R$ 10,00, 1 dia`, () => {
        assert.deepEqual(entrega(cep), { frete: 1000, prazoDias: 1, tipoEntrega: 'propria' })
      })
    }
    for (const cep of ['36299999', '36310000']) {
      it(`${cep}, logo fora da borda → Minas Gerais pelos Correios`, () => {
        assert.deepEqual(entrega(cep), { frete: 2500, prazoDias: 4, tipoEntrega: 'correios' })
      })
    }
  })

  describe('faixas do Brasil', () => {
    for (const [cep, frete, prazoDias, onde] of [
      ['01310100', 3000, 5, 'São Paulo (capital)'],
      ['13010000', 3000, 5, 'São Paulo (interior)'],
      ['20040002', 3000, 5, 'Rio de Janeiro'],
      ['30130010', 2500, 4, 'Belo Horizonte'],
      ['40020000', 4000, 7, 'Salvador'],
      ['50030000', 4500, 8, 'Recife'],
      ['60060000', 5500, 10, 'Fortaleza'],
      ['70040000', 4000, 7, 'Brasília'],
      ['80010000', 3500, 6, 'Curitiba'],
      ['90010000', 4000, 7, 'Porto Alegre'],
      ['01000000', 3000, 5, 'primeiro CEP coberto'],
      ['99999999', 4000, 7, 'último CEP (Rio Grande do Sul)'],
    ]) {
      it(`${cep} (${onde}) → correios, ${frete} centavos, ${prazoDias} dias`, () => {
        assert.deepEqual(entrega(cep), { frete, prazoDias, tipoEntrega: 'correios' })
      })
    }
    for (const cep of ['00000000', '00999999']) {
      it(`${cep}, fora de todas as faixas → 422 em cep`, () => recusa(() => entrega(cep), 'Dados inválidos', erroCep))
    }
  })

  describe('retirada na loja', () => {
    it('sem cep → frete 0, prazo de retirada', () => {
      assert.deepEqual(calcularFrete({ retirada: true, itens: [racao], subtotal: 5000 }),
        { frete: 0, prazoDias: 1, tipoEntrega: 'retirada' })
    })
    it('com cep (inclusive inválido) → o cep é ignorado', () => {
      for (const cep of ['01310100', '36300000', 'abc']) {
        assert.deepEqual(calcularFrete({ cep, retirada: true, itens: [racao], subtotal: 5000 }),
          { frete: 0, prazoDias: 1, tipoEntrega: 'retirada' })
      }
    })
    it('com peixe → aceita (o cliente busca na loja)', () => {
      assert.deepEqual(calcularFrete({ cep: '01310100', retirada: true, itens: [peixe, racao], subtotal: 5000 }),
        { frete: 0, prazoDias: 1, tipoEntrega: 'retirada' })
    })
  })

  describe('peixe vivo', () => {
    it('em São João del Rei → aceito', () => {
      assert.deepEqual(entrega('36300000', [peixe, racao, peixe]), { frete: 1000, prazoDias: 1, tipoEntrega: 'propria' })
    })
    it('fora → 422 com um detalhe por item de peixe, nos índices certos', () => {
      const msg = 'Este peixe só pode ser entregue em São João del Rei.'
      recusa(() => entrega('30130010', [racao, peixe, filtro, peixe]),
        'Peixes vivos só são entregues em São João del Rei.',
        { 'itens.1.produtoId': msg, 'itens.3.produtoId': msg })
      recusa(() => entrega('36310000', [peixe]), 'Peixes vivos só são entregues em São João del Rei.',
        { 'itens.0.produtoId': msg })
    })
    it('CEP fora de todas as faixas com peixe → o erro é o do CEP', () => {
      recusa(() => entrega('00500000', [peixe]), 'Dados inválidos', erroCep)
    })
  })

  describe('CEP inválido na entrega', () => {
    for (const [descricao, cep] of [
      ['sem cep', undefined], ['vazio', ''], ['7 dígitos', '3630000'], ['9 dígitos', '363000000'],
      ['com letra', '3630000a'], ['com máscara', '36300-000'], ['com espaço', ' 36300000'],
      ['dígito não ASCII', '٣٦٣٠٠٠٠٠'], ['número em vez de texto', 36300000],
    ]) {
      it(`${descricao} → 422 em cep`, () => recusa(() => entrega(cep), 'Dados inválidos', erroCep))
    }
  })

  describe('frete grátis (config de teste com freteGratisAcima = 10000)', () => {
    const config = { ...configFrete, freteGratisAcima: 10000 }
    const calcular = (cep, subtotal, retirada = false) => calcularFrete({ cep, retirada, itens: [racao], subtotal }, config)
    it('subtotal 9999 → frete cobrado', () => {
      assert.deepEqual(calcular('30130010', 9999), { frete: 2500, prazoDias: 4, tipoEntrega: 'correios' })
      assert.deepEqual(calcular('36300000', 9999), { frete: 1000, prazoDias: 1, tipoEntrega: 'propria' })
    })
    it('subtotal 10000 → frete 0, prazo igual', () => {
      assert.deepEqual(calcular('30130010', 10000), { frete: 0, prazoDias: 4, tipoEntrega: 'correios' })
      assert.deepEqual(calcular('36300000', 10000), { frete: 0, prazoDias: 1, tipoEntrega: 'propria' })
    })
    it('retirada continua 0', () => {
      assert.deepEqual(calcular(undefined, 9999, true), { frete: 0, prazoDias: 1, tipoEntrega: 'retirada' })
    })
    it('a config de verdade não tem frete grátis', () => {
      assert.equal(configFrete.freteGratisAcima, null)
      assert.equal(entrega('30130010', [racao], 1_000_000).frete, 2500)
    })
  })

  describe('config de verdade', () => {
    it('faixas do Brasil sem buraco e sem sobreposição, de 01000000 a 99999999', () => {
      const faixas = [...configFrete.faixasBrasil].sort((a, b) => a.cepInicio.localeCompare(b.cepInicio))
      assert.equal(faixas[0].cepInicio, '01000000')
      assert.equal(faixas.at(-1).cepFim, '99999999')
      for (const [i, faixa] of faixas.entries()) {
        for (const cep of [faixa.cepInicio, faixa.cepFim]) assert.match(cep, /^[0-9]{8}$/)
        assert.ok(faixa.cepInicio <= faixa.cepFim, faixa.nome)
        assert.ok(Number.isInteger(faixa.valor) && faixa.valor >= 0, `${faixa.nome}: valor em centavos`)
        assert.ok(Number.isInteger(faixa.prazoDias) && faixa.prazoDias >= 0, `${faixa.nome}: prazo inteiro`)
        if (i === 0) continue
        const esperado = String(Number(faixas[i - 1].cepFim) + 1).padStart(8, '0')
        assert.equal(faixa.cepInicio, esperado, `${faixa.nome} começa logo depois de ${faixas[i - 1].nome}`)
      }
    })
    it('São João del Rei fica dentro da faixa de Minas (por isso é checada antes)', () => {
      const minas = configFrete.faixasBrasil.find((faixa) => faixa.nome === 'Minas Gerais')
      assert.ok(minas.cepInicio <= configFrete.saoJoaoDelRei.cepInicio)
      assert.ok(configFrete.saoJoaoDelRei.cepFim <= minas.cepFim)
    })
    it('a função é pura: a mesma entrada dá o mesmo resultado e a entrada não é alterada', () => {
      const entrada = { cep: '36300000', retirada: false, itens: [peixe], subtotal: 5000 }
      const copia = structuredClone(entrada)
      assert.deepEqual(calcularFrete(entrada), calcularFrete(entrada))
      assert.deepEqual(entrada, copia)
      const resultado = calcularFrete(entrada)
      resultado.frete = 1
      assert.equal(configFrete.saoJoaoDelRei.valor, 1000, 'mexer no resultado não altera a config')
    })
  })
})
