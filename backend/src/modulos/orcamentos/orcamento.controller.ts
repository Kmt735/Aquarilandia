import type { Request, Response } from 'express'
import { orcamentoService } from './orcamento.service.js'

export const orcamentoController = {
  criar(req: Request, res: Response) {
    res.status(201).json(orcamentoService.criar(req.body ?? {}))
  },

  listar(_req: Request, res: Response) {
    res.json(orcamentoService.listar())
  },
}
