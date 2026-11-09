// Os mesmos valores do DOMAIN status_venda (db/init/20_vendas.sql): o ?status= das listagens é conferido nesta lista
export const listaStatusVenda = [
  'aguardando_pagamento',
  'paga',
  'em_separacao',
  'enviada',
  'pronta_retirada',
  'entregue',
  'cancelamento_solicitado',
  'cancelada',
] as const

export type StatusVenda = (typeof listaStatusVenda)[number]

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

// ---------- Compras do cliente (#33, #34, #37) ----------

export interface FiltroVendas {
  status: StatusVenda | null
  pagina: number
  limite: number
}

// Linha da listagem como sai do banco: o resumo é montado no service
export interface LinhaResumoVenda {
  id: number
  status: StatusVenda
  total: number
  tipoEntrega: TipoEntrega
  quantidadeItens: number
  primeiroItem: string | null
  criadoEm: Date
}

// Item de GET /api/clientes/me/vendas e de GET /api/clientes/:id/vendas
export interface ResumoVenda {
  id: number
  status: StatusVenda
  total: number
  tipoEntrega: TipoEntrega
  quantidadeItens: number
  // 'Filtro X' ou 'Filtro X e mais 2 itens'; null só numa venda sem itens (não acontece pela API)
  resumo: string | null
  criadoEm: Date
}

export interface PaginaVendas {
  dados: ResumoVenda[]
  total: number
  pagina: number
  limite: number
}
