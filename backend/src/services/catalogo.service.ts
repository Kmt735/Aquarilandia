import { categorias } from '../data/categorias.js'
import { peixes } from '../data/peixes.js'
import { produtos } from '../data/produtos.js'
import { servicos } from '../data/servicos.js'
import type { CaracteristicaPeixe, Peixe } from '../types/index.js'
import { AppError } from '../utils/AppError.js'

// Por enquanto os dados ficam em memória; trocar por um banco depois
export const catalogoService = {
  listarCategorias: () => categorias,

  listarProdutos({ categoria, disponibilidade }: { categoria?: string; disponibilidade?: string }) {
    return produtos.filter(
      (p) =>
        (!categoria || p.categoria === categoria) &&
        (!disponibilidade || (disponibilidade === 'in') === p.emEstoque),
    )
  },

  buscarProduto(id: string) {
    const produto = produtos.find((p) => p.id === id)
    if (!produto) throw new AppError('Produto não encontrado', 404)
    return produto
  },

  // filtros: doce, salgada, pacifico, facil, disp
  listarPeixes(filtros: string[] = []) {
    const atende = (peixe: Peixe, filtro: string) =>
      filtro === 'disp' ? peixe.disponivel : Boolean(peixe.caracteristicas[filtro as CaracteristicaPeixe])
    return peixes.filter((p) => filtros.every((f) => atende(p, f)))
  },

  buscarPeixe(id: string) {
    const peixe = peixes.find((p) => p.id === id)
    if (!peixe) throw new AppError('Peixe não encontrado', 404)
    return peixe
  },

  listarServicos: () => servicos,
}
