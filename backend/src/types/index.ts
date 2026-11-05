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

// Contrato interno vendas → estoque; números validados pelo servidor, nunca preço/saldo do navegador.
export interface ItemMovimento {
  produtoId: number
  quantidade: number
}
