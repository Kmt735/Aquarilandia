export type StatusVenda =
  | 'aguardando_pagamento'
  | 'paga'
  | 'em_separacao'
  | 'pronta_retirada'
  | 'enviada'
  | 'entregue'
  | 'cancelamento_solicitado'
  | 'cancelada'

export type TipoEntrega = 'correios' | 'propria' | 'retirada'

// Item do body depois de validado. indice = posição no array do body, para o erro apontar o item certo
export interface ItemPedido {
  produtoId: number
  quantidade: number
  indice: number
}

// Cotação (#28): retirada ou CEP. Venda (#30): retirada ou um endereço salvo do cliente
export type EntregaCotacao = { retirada: true } | { retirada: false; cep: string }
export type EntregaVenda = { retirada: true } | { retirada: false; enderecoId: number }

// O body da venda já validado: itens somados, entrega e o total que a cotação mostrou (só para conferir)
export interface PedidoVenda {
  itens: ItemPedido[]
  entrega: EntregaVenda
  totalEsperado: number
}

export interface CotacaoFrete {
  frete: number
  prazoDias: number
  tipoEntrega: TipoEntrega
  subtotal: number
  total: number
}

// Cópia do endereço no momento da compra (D-12); null na retirada
export interface EntregaCopiada {
  cep: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  cidade: string
  uf: string
}

export interface NovaVenda {
  clienteId: number
  subtotal: number
  frete: number
  total: number
  tipoEntrega: TipoEntrega
  prazoEntregaDias: number
  destinatario: string
  telefone: string
  endereco: EntregaCopiada | null
  // Idempotency-Key do header e SHA-256 do pedido (21_vendas_idempotencia.sql)
  chaveIdempotencia: string
  hashRequisicao: string
}

export interface NovoItemVenda {
  produtoId: number
  nomeProduto: string
  precoUnitario: number
  quantidade: number
  subtotal: number
}

// A venda como o cliente vê: resposta do POST /api/vendas (criação e repetição) e, depois, do detalhe (#34)
export interface VendaCriada {
  id: number
  status: StatusVenda
  tipoEntrega: TipoEntrega
  subtotal: number
  frete: number
  total: number
  prazoEntregaDias: number
  expiraEm: Date
  criadoEm: Date
  itens: NovoItemVenda[]
  entrega: (EntregaCopiada & { destinatario: string; telefone: string }) | null
}

// repetida = a mesma Idempotency-Key já tinha criado esta venda (o controller manda Idempotent-Replayed: true)
export interface ResultadoCriacaoVenda {
  venda: VendaCriada
  repetida: boolean
}
