export interface Categoria {
  id: number
  nome: string
  slug: string
}

export type NovaCategoria = Pick<Categoria, 'nome' | 'slug'>
export type AtualizacaoCategoria = Partial<NovaCategoria>

export interface PaginacaoCategorias {
  pagina: number
  limite: number
}

export interface ListaCategorias {
  itens: Categoria[]
  total: number
}
