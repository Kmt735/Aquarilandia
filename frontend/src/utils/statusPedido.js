// Status da compra (backend: DOMAIN status_venda, docs/decisoes.md D-11). Texto e ícone sempre juntos com a cor.
export const STATUS_PEDIDO = {
  aguardando_pagamento: { rotulo: 'Aguardando pagamento', tom: 'aviso', icone: 'relogio' },
  paga: { rotulo: 'Pagamento aprovado', tom: 'sucesso', icone: 'check' },
  em_separacao: { rotulo: 'Em separação', tom: 'info', icone: 'caixa' },
  enviada: { rotulo: 'Enviada', tom: 'info', icone: 'caminhao' },
  pronta_retirada: { rotulo: 'Pronta para retirada na loja', tom: 'sucesso', icone: 'loja' },
  entregue: { rotulo: 'Entregue', tom: 'sucesso', icone: 'check' },
  cancelamento_solicitado: {
    rotulo: 'Cancelamento em processamento',
    descricao: 'Cancelamento em processamento: estamos devolvendo o seu pagamento.',
    tom: 'aviso',
    icone: 'relogio',
  },
  cancelada: { rotulo: 'Cancelada', tom: 'neutro', icone: 'x' },
}

// O cliente cancela até antes do envio (D-11: aguardando_pagamento, paga, em_separacao e pronta_retirada → cancelada)
export const STATUS_CANCELAVEIS = ['aguardando_pagamento', 'paga', 'em_separacao', 'pronta_retirada']

export const podeCancelar = (status) => STATUS_CANCELAVEIS.includes(status)

// Linhas do tempo esperadas, para mostrar as próximas etapas apagadas
export const ETAPAS_ENTREGA = ['aguardando_pagamento', 'paga', 'em_separacao', 'enviada', 'entregue']
export const ETAPAS_RETIRADA = ['aguardando_pagamento', 'paga', 'em_separacao', 'pronta_retirada', 'entregue']
