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
