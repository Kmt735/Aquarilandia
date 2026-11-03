import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { podeTransicionar } from '../src/modulos/vendas/venda.transicoes.ts'

// A tabela é repetida aqui de propósito, escrita à mão a partir da #29: se alguém mudar o arquivo de
// transições sem mudar a regra combinada, o teste acusa
const permitidas = [
  ['aguardando_pagamento', 'paga', 'gateway'],
  ['aguardando_pagamento', 'cancelada', 'cliente'],
  ['aguardando_pagamento', 'cancelada', 'admin'],
  ['aguardando_pagamento', 'cancelada', 'sistema'],
  ['paga', 'em_separacao', 'admin'],
  ['em_separacao', 'enviada', 'admin'],
  ['em_separacao', 'pronta_retirada', 'admin'],
  ['enviada', 'entregue', 'admin'],
  ['pronta_retirada', 'entregue', 'admin'],
  ['paga', 'cancelamento_solicitado', 'cliente'],
  ['paga', 'cancelamento_solicitado', 'admin'],
  ['em_separacao', 'cancelamento_solicitado', 'cliente'],
  ['em_separacao', 'cancelamento_solicitado', 'admin'],
  ['pronta_retirada', 'cancelamento_solicitado', 'cliente'],
  ['pronta_retirada', 'cancelamento_solicitado', 'admin'],
  ['cancelamento_solicitado', 'cancelada', 'sistema'],
  ['cancelamento_solicitado', 'cancelada', 'admin'],
]

const status = [
  'aguardando_pagamento', 'paga', 'em_separacao', 'enviada', 'pronta_retirada',
  'entregue', 'cancelamento_solicitado', 'cancelada',
]
const atores = ['cliente', 'admin', 'sistema', 'gateway']

describe('Vendas — tabela de transições de status (#29)', () => {
  for (const [de, para, ator] of permitidas) {
    it(`permite ${de} → ${para} por ${ator}`, () => {
      assert.equal(podeTransicionar(de, para, ator), true)
    })
  }

  const proibidas = [
    ['admin não confirma pagamento', 'aguardando_pagamento', 'paga', 'admin'],
    ['cliente não confirma pagamento', 'aguardando_pagamento', 'paga', 'cliente'],
    ['gateway não cancela', 'aguardando_pagamento', 'cancelada', 'gateway'],
    ['cliente não separa', 'paga', 'em_separacao', 'cliente'],
    ['sistema não separa', 'paga', 'em_separacao', 'sistema'],
    ['venda paga não vai direto para cancelada', 'paga', 'cancelada', 'admin'],
    ['venda paga não vai direto para cancelada (cliente)', 'paga', 'cancelada', 'cliente'],
    ['em separação não vai direto para cancelada', 'em_separacao', 'cancelada', 'admin'],
    ['pronta para retirada não vai direto para cancelada', 'pronta_retirada', 'cancelada', 'sistema'],
    ['cancelamento solicitado não volta para separação', 'cancelamento_solicitado', 'em_separacao', 'admin'],
    ['cancelamento solicitado não é concluído pelo cliente', 'cancelamento_solicitado', 'cancelada', 'cliente'],
    ['cancelamento solicitado não é concluído pelo gateway', 'cancelamento_solicitado', 'cancelada', 'gateway'],
    ['aguardando pagamento não é enviada', 'aguardando_pagamento', 'enviada', 'admin'],
    ['venda enviada não é cancelada pelo cliente', 'enviada', 'cancelamento_solicitado', 'cliente'],
    ['venda enviada não é cancelada pelo admin', 'enviada', 'cancelamento_solicitado', 'admin'],
    ['pago não pula a separação', 'paga', 'enviada', 'admin'],
    ['não volta de entregue para enviada', 'entregue', 'enviada', 'admin'],
    ['cliente não marca entregue', 'enviada', 'entregue', 'cliente'],
    ['ator inválido', 'paga', 'em_separacao', 'hacker'],
    ['ator vazio', 'aguardando_pagamento', 'paga', ''],
    ['status de origem inválido', 'inexistente', 'paga', 'gateway'],
    ['status de destino inválido', 'paga', 'inexistente', 'admin'],
    ['origem no protótipo', '__proto__', 'paga', 'gateway'],
    ['destino no protótipo', 'paga', 'constructor', 'admin'],
  ]
  for (const [descricao, de, para, ator] of proibidas) {
    it(`proíbe: ${descricao} (${de} → ${para} por ${ator || '""'})`, () => {
      assert.equal(podeTransicionar(de, para, ator), false)
    })
  }

  for (const final of ['entregue', 'cancelada']) {
    it(`${final} é final: nenhum destino para nenhum ator`, () => {
      for (const para of status) for (const ator of atores) assert.equal(podeTransicionar(final, para, ator), false)
    })
  }

  it('nenhum status vai para ele mesmo', () => {
    for (const s of status) for (const ator of atores) assert.equal(podeTransicionar(s, s, ator), false)
  })

  it('exatamente as combinações da tabela são permitidas (as outras 239 são proibidas)', () => {
    const esperadas = new Set(permitidas.map((linha) => linha.join('|')))
    let proibidas = 0
    for (const de of status) for (const para of status) for (const ator of atores) {
      const permitida = esperadas.has([de, para, ator].join('|'))
      assert.equal(podeTransicionar(de, para, ator), permitida, `${de} → ${para} por ${ator}`)
      if (!permitida) proibidas++
    }
    assert.equal(proibidas, status.length * status.length * atores.length - permitidas.length)
    assert.equal(proibidas, 239)
  })
})
