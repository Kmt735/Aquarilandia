export interface Categoria {
  nome: string
  icone: string
  dica?: string
}

export interface Produto {
  id: string
  nome: string
  descricao: string
  preco: number
  icone: string
  categoria: string
  emEstoque: boolean
  volumeLitros?: number
  capacidadeMaxLitros?: number
}

export type CaracteristicaPeixe = 'doce' | 'salgada' | 'pacifico' | 'facil'

export interface Peixe {
  id: string
  nome: string
  cientifico: string
  icone: string
  agua: string
  temperamento: string
  aquarioMinimo: string
  dificuldade: string
  disponivel: boolean
  compativelCom: string
  caracteristicas: Record<CaracteristicaPeixe, boolean>
}

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

export interface UsuarioLogado {
  id: number
  papel: 'cliente' | 'admin'
}