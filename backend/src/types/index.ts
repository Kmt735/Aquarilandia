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

// Contrato interno catálogo → vendas (D-15/D-25/D-51): preco em centavos e categoria = categorias.slug.
export interface ProdutoVenda {
  id: number
  nome: string
  preco: number
  ativo: boolean
  categoria: string
}
