export interface Servico {
  id: string
  nome: string
  icone: string
  descricao: string
  resumo?: string
  destaque?: boolean
}

export interface NovoOrcamento {
  nome: string
  telefone: string
  servico: string
  mensagem?: string
}

export interface Orcamento extends NovoOrcamento {
  id: string
  criadoEm: string
}
