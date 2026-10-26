import type { Request, Response } from 'express'
import { catalogoService } from '../services/catalogo.service.js'

export const catalogoController = {
  servicos(_req: Request, res: Response) {
    res.json(catalogoService.listarServicos())
  },
}
