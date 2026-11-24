import type { ENCONTROU, MOTIVOS, ORIGENS, STATUS } from './avaliacao.config.js'

export type StatusAvaliacao = (typeof STATUS)[number]
export type Motivo = (typeof MOTIVOS)[number]
export type Encontrou = (typeof ENCONTROU)[number]
export type Origem = (typeof ORIGENS)[number]

export interface AvaliacaoProduto {
  id: number
  produtoId: number
  nota: number
  nome: string | null
  comentario: string | null
  status: StatusAvaliacao
  criadaEm: Date
  moderadaEm: Date | null
}

// No painel: com o nome e a categoria do produto (para o link ir à página de produto ou de peixe)
export interface AvaliacaoProdutoAdmin extends AvaliacaoProduto {
  produtoNome: string
  produtoCategoria: string
}

export interface AvaliacaoSite {
  id: number
  nota: number
  motivo: Motivo | null
  encontrou: Encontrou | null
  comentario: string | null
  origem: Origem
  pagina: string | null
  status: StatusAvaliacao
  criadaEm: Date
  moderadaEm: Date | null
}

export type NovaAvaliacaoProduto = Pick<AvaliacaoProduto, 'nota' | 'nome' | 'comentario'>
export type NovaAvaliacaoSite = Pick<AvaliacaoSite, 'nota' | 'motivo' | 'encontrou' | 'comentario' | 'origem' | 'pagina'>

export interface Resumo {
  total: number
  media: number
  // Da nota 5 para a 1 (a ordem em que a tela mostra)
  distribuicao: { nota: number; qtd: number }[]
}

export interface FiltrosAdmin {
  status?: StatusAvaliacao
  nota?: number
  limite: number
  offset: number
}
