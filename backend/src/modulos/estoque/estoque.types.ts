export type TipoMovimentoAdmin = 'entrada' | 'ajuste_positivo' | 'ajuste_negativo' | 'saida'

export interface NovoMovimentoAdmin {
  produtoId: number
  tipo: TipoMovimentoAdmin
  quantidade: number
  motivo: string
}

export interface ResultadoMovimento {
  operacaoId: string
  produtoId: number
  tipo: TipoMovimentoAdmin
  quantidade: number
  saldoAnterior: number
  saldoAtual: number
  criadoEm: Date
}

export interface OperacaoPersistida extends ResultadoMovimento {
  hashRequisicao: string
}

export interface SaldoProdutoAdmin {
  produtoId: number
  nome: string
  ativo: boolean
  saldoAtual: number
}

export interface FiltrosHistoricoEstoque {
  produtoId: number
  pagina: number
  limite: number
}

export interface MovimentoHistoricoAdmin {
  operacaoId: string
  produtoId: number
  tipo: TipoMovimentoAdmin | 'abertura' | 'baixa_venda' | 'estorno_venda'
  quantidade: number
  delta: number
  saldoAnterior: number
  saldoPosterior: number
  criadoEm: string
  motivo: string
  origem: 'admin' | 'abertura' | 'venda'
  autorId: number | null
  vendaId?: number
  operacaoOriginalId?: string | null
}

export interface HistoricoEstoque {
  itens: MovimentoHistoricoAdmin[]
  total: number
}
