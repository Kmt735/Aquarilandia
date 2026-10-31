import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aplicarConferencia, conferirCarrinho, formatoParaSalvar, lerCarrinhoSalvo } from '../src/services/carrinho.js'
import { subtotalEmCentavos } from '../src/utils/dinheiro.js'

const produto = (id, alteracoes = {}) => ({ id, nome: 'Nome atual da API', preco: 12345, centavos: true, emEstoque: true, ...alteracoes })
const salvo = (itens) => JSON.stringify({ versao: 2, itens })

test('formato novo conserva IDs numéricos e quantidades, sem snapshot de preço', async () => {
  const inicial = lerCarrinhoSalvo(salvo([{ id: 12, qtd: 2 }]))
  assert.deepEqual(inicial.avisos, []); assert.equal(inicial.bloqueado, false)
  assert.deepEqual(formatoParaSalvar(inicial.registros), { versao: 2, itens: [{ id: 12, qtd: 2 }] })
  const prontos = aplicarConferencia(inicial.registros, await conferirCarrinho(inicial.registros, async (id) => produto(id)))
  assert.equal(subtotalEmCentavos(prontos.map((r) => ({ ...r.item, qtd: r.qtd }))), 24690)
  assert.deepEqual(formatoParaSalvar(prontos), { versao: 2, itens: [{ id: 12, qtd: 2 }] })
})

test('IDs textuais legados, inclusive texto numérico, são removidos sem tentar adivinhar', () => {
  const r = lerCarrinhoSalvo(JSON.stringify([{ id: 'betta-splendens', qtd: 1, item: { preco: 20 } }, { id: '12', qtd: 1 }]))
  assert.deepEqual(r.registros, []); assert.ok(r.avisos.some((a) => a.includes('foram removidos')))
})

test('carrinho misto reconstrói ID real e ignora preço em reais/centavos salvo', async () => {
  const r = lerCarrinhoSalvo(JSON.stringify([
    { id: 'antigo', qtd: 1, item: { preco: 20 } },
    { id: 12, qtd: 2, item: { id: 12, preco: 3.5, centavos: false, nome: 'Não confiar' } },
    { id: 13, qtd: 1, item: { id: 13, preco: 1, centavos: true, emEstoque: true } },
  ]))
  const prontos = aplicarConferencia(r.registros, await conferirCarrinho(r.registros, async (id) => produto(id, { preco: id === 13 ? 5000 : 12345 })))
  assert.deepEqual(prontos.map((p) => [p.id, p.item.preco]), [[12, 12345], [13, 5000]])
  assert.equal(prontos[0].item.nome, 'Nome atual da API')
  assert.equal(subtotalEmCentavos(prontos.map((p) => ({ ...p.item, qtd: p.qtd }))), 29690)
  const relido = lerCarrinhoSalvo(JSON.stringify(formatoParaSalvar(prontos)))
  assert.deepEqual(relido.avisos, []); assert.deepEqual(relido.registros.map((p) => p.id), [12, 13])
})

test('duplicados somam quantidades, mantêm ordem e respeitam o teto visual', () => {
  const r = lerCarrinhoSalvo(salvo([{ id: 2, qtd: 2 }, { id: 1, qtd: 1 }, { id: 2, qtd: 3 }, { id: 3, qtd: 200 }]))
  assert.deepEqual(formatoParaSalvar(r.registros).itens, [{ id: 2, qtd: 5 }, { id: 1, qtd: 1 }, { id: 3, qtd: 99 }])
  assert.ok(r.avisos.some((a) => a.includes('duplicados')))
})

for (const linha of [null, {}, { id: 0, qtd: 1 }, { id: 2147483648, qtd: 1 }, { id: 1, qtd: 0 }, { id: 1, qtd: '2' }, { id: 1, qtd: 1.5 }, { id: 1, qtd: 1, item: { id: 2 } }]) {
  test(`registro incompleto/contraditório não quebra a leitura: ${JSON.stringify(linha)}`, () => {
    const r = lerCarrinhoSalvo(salvo([linha, { id: 12, qtd: 1 }]))
    assert.deepEqual(r.registros.map((r) => r.id), [12])
  })
}
for (const bruto of ['{json-incompleto', 'null', '42', '{}', '{"versao":2,"itens":{}}']) {
  test(`armazenamento malformado/desconhecido é explícito: ${bruto}`, () => {
    const r = lerCarrinhoSalvo(bruto); assert.deepEqual(r.registros, []); assert.ok(r.avisos.length)
  })
}
test('versão futura é preservada, não migrada ou apagada automaticamente', () => {
  const r = lerCarrinhoSalvo('{"versao":3,"itens":[{"id":12,"qtd":1}]}')
  assert.equal(r.bloqueado, true); assert.ok(r.avisos[0].includes('preservado'))
})
test('ausência de armazenamento é um carrinho vazio válido', () => {
  assert.deepEqual(lerCarrinhoSalvo(null), { registros: [], avisos: [], bloqueado: false })
})
test('produto inativo (404) ou esgotado sai; falha temporária mantém só intenção, sem preço', async () => {
  const registros = lerCarrinhoSalvo(salvo([{ id: 1, qtd: 1 }, { id: 2, qtd: 1 }, { id: 3, qtd: 1 }, { id: 4, qtd: 1 }])).registros
  const resultados = await conferirCarrinho(registros, async (id) => {
    if (id === 1) throw Object.assign(new Error(), { status: 404 })
    if (id === 2) return produto(id, { emEstoque: false })
    if (id === 3) throw Object.assign(new Error(), { status: 500 })
    return produto(id)
  })
  const prontos = aplicarConferencia(registros, resultados)
  assert.deepEqual(prontos.map((r) => r.id), [3, 4]); assert.equal(prontos[0].item, null); assert.equal(prontos[0].erro, true)
  assert.deepEqual(formatoParaSalvar(prontos).itens, [{ id: 3, qtd: 1 }, { id: 4, qtd: 1 }])
})
test('preço alterado vem da API e é identificado sem reconverter moeda', async () => {
  const registros = [{ id: 1, qtd: 2, item: produto(1, { preco: 10000 }) }]
  const resultado = await conferirCarrinho(registros, async () => produto(1, { preco: 12500 }))
  assert.equal(resultado[0].precoAlterado, true)
  assert.equal(aplicarConferencia(registros, resultado)[0].item.preco, 12500)
})
test('retorno fora do contrato ou erro desconhecido mantém item pendente sem total fictício', async () => {
  for (const retorno of [produto(2), produto(1, { preco: 12.5 }), produto(1, { centavos: false })]) {
    const r = await conferirCarrinho([{ id: 1, qtd: 1 }], async () => retorno)
    assert.equal(r[0].estado, 'erro'); assert.equal(r[0].item, null)
  }
  assert.equal((await conferirCarrinho([{ id: 1, qtd: 1 }], async () => { throw null }))[0].estado, 'erro')
})
test('resposta tardia não ressuscita removidos nem sobrescreve quantidade recente', () => {
  const resultado = [{ id: 1, estado: 'valido', item: produto(1) }, { id: 2, estado: 'valido', item: produto(2) }]
  const atuais = [{ id: 1, qtd: 5, item: null }, { id: 3, qtd: 1, item: null }]
  const depois = aplicarConferencia(atuais, resultado)
  assert.deepEqual(depois.map((r) => [r.id, r.qtd]), [[1, 5], [3, 1]])
})
test('revalidação limita requisições simultâneas sem perder itens', async () => {
  let abertas = 0, maximo = 0
  const r = await conferirCarrinho(Array.from({ length: 15 }, (_, n) => ({ id: n + 1, qtd: 1 })), async (id) => {
    abertas++; maximo = Math.max(maximo, abertas); await new Promise((r) => setTimeout(r, 1)); abertas--; return produto(id)
  })
  assert.equal(r.length, 15); assert.ok(maximo <= 4)
})
