import type { FichaTecnica } from './ficha.types.js'
import type { ProdutoPublico } from './produto.types.js'

type FichaPeixePublica = Extract<FichaTecnica, { tipo: 'peixes' }>

export interface PeixePublico extends ProdutoPublico {
  categoria: 'peixes'
  ficha: FichaPeixePublica
}

export interface FiltrosPeixes {
  pagina: number
  limite: number
  temperatura?: number
  ph?: number
  tamanhoMax?: number
  aquarioLitros?: number
  dificuldade?: FichaPeixePublica['dados']['dificuldade']
  temperamento?: FichaPeixePublica['dados']['temperamento']
  tipoAgua?: FichaPeixePublica['dados']['tipoAgua']
  busca?: string
}

export interface ListaPeixes {
  itens: PeixePublico[]
  total: number
}
