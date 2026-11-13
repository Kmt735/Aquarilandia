// Opções que o administrador escolhe ao atualizar um pedido.
// "Andamento" usa os mesmos valores do status da compra (utils/statusPedido.js, backend: status_venda),
// só com nomes mais diretos para a equipe da loja.
export const ANDAMENTO_ADMIN = [
  { valor: 'aguardando_pagamento', rotulo: 'Aguardando pagamento' },
  { valor: 'paga', rotulo: 'Recebido (pagamento aprovado)' },
  { valor: 'em_separacao', rotulo: 'Preparando' },
  { valor: 'enviada', rotulo: 'Saiu para entrega' },
  { valor: 'pronta_retirada', rotulo: 'Pronto para retirada' },
  { valor: 'entregue', rotulo: 'Chegou (concluído)' },
  { valor: 'cancelamento_solicitado', rotulo: 'Cancelamento solicitado' },
  { valor: 'cancelada', rotulo: 'Cancelado' },
]

export const PAGAMENTO_ADMIN = [
  { valor: 'pendente', rotulo: 'Pendente' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'recusado', rotulo: 'Recusado' },
  { valor: 'estornado', rotulo: 'Estornado' },
]

// A situação da entrega depende de o pedido ser entregue em casa ou retirado na loja
export const ENTREGA_ADMIN = {
  endereco: [
    { valor: 'a_enviar', rotulo: 'Aguardando envio' },
    { valor: 'a_caminho', rotulo: 'A caminho' },
    { valor: 'entregue', rotulo: 'Entregue' },
  ],
  retirada: [
    { valor: 'aguardando_retirada', rotulo: 'Aguardando retirada' },
    { valor: 'retirado', rotulo: 'Retirado' },
  ],
}

// Variante do selo (Badge) de cada situação de pagamento
export const TOM_PAGAMENTO = { pendente: 'aviso', pago: 'sucesso', recusado: 'destructive', estornado: 'secondary' }

export const rotuloDe = (lista, valor) => lista.find((o) => o.valor === valor)?.rotulo ?? valor