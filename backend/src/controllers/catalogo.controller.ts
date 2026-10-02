import type { Request, Response } from 'express'
import { catalogoService } from '../services/catalogo.service.js'

const texto = (valor: unknown) => (typeof valor === 'string' && valor ? valor : undefined)

export const catalogoController = {
  categorias(_req: Request, res: Response) {
    res.json(catalogoService.listarCategorias())
  },

  produtos(req: Request, res: Response) {
    res.json(
      catalogoService.listarProdutos({
        categoria: texto(req.query.categoria),
        disponibilidade: texto(req.query.disponibilidade),
      }),
    )
  },

  produto(req: Request<{ id: string }>, res: Response) {
    res.json(catalogoService.buscarProduto(req.params.id))
  },

  peixes(req: Request, res: Response) {
    const filtros = texto(req.query.filtros)?.split(',').filter(Boolean) ?? []
    res.json(catalogoService.listarPeixes(filtros))
  },

  peixe(req: Request<{ id: string }>, res: Response) {
    res.json(catalogoService.buscarPeixe(req.params.id))
  },

  servicos(_req: Request, res: Response) {
    res.json(catalogoService.listarServicos())
  },
}
