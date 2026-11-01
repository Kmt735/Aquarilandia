export interface Servico {
  id: string
  nome: string
  icone: string
  descricao: string
  resumo?: string
  destaque?: boolean
}

export interface UsuarioLogado {
  id: number
  papel: 'cliente' | 'admin'
}