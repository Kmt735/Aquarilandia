export type StatusOrcamento = 'novo' | 'em_atendimento' | 'concluido'

export interface Orcamento {
  id: number
  nome: string
  telefone: string
  servico: string
  mensagem: string | null
  status: StatusOrcamento
  criadoEm: Date
  atualizadoEm: Date
}

export type NovoOrcamento = Pick<Orcamento, 'nome' | 'telefone' | 'servico' | 'mensagem'>

export interface FiltrosOrcamento {
  status?: StatusOrcamento
  limite: number
  offset: number
}

export interface ListaOrcamentos {
  dados: Orcamento[]
  total: number
  pagina: number
  limite: number
}
