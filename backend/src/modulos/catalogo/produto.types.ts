import type { FichaTecnica } from './ficha.types.js'

export type OrdemProdutos = 'preco' | '-preco' | 'nome'

export interface ProdutoPublico {
  id: number
  categoriaId: number
  categoria: string
  nome: string
  descricao: string | null
  marca: string | null
  preco: number
  imagemUrl: string | null
  emEstoque: boolean
}

export interface FiltrosProdutos {
  pagina: number
  limite: number
  ordem: OrdemProdutos
  categoria?: string
  busca?: string
  precoMin?: number
  precoMax?: number
  tipoAgua?: 'doce' | 'salobra' | 'marinho'
  volumeMin?: number
  volumeMax?: number
  vazaoMin?: number
  indicadoPlantado?: boolean
  precisaCo2?: boolean
  iluminacao?: 'baixa' | 'media' | 'alta'
}

export interface ListaProdutos {
  itens: ProdutoPublico[]
  total: number
}
export interface DetalheProduto extends ProdutoPublico {
  ficha: FichaTecnica | null
}

export type NovoProduto = Pick<ProdutoPublico, 'categoriaId' | 'nome' | 'descricao' | 'marca' | 'preco'> & {
  ficha: FichaTecnica | null
}

// A forma é validada antes do lock; os valores só são aceitos após validar o estado final.
export interface AtualizacaoProduto {
  nome?: unknown
  descricao?: unknown
  marca?: unknown
  preco?: unknown
  ficha?: { dados: Record<string, unknown> }
}
