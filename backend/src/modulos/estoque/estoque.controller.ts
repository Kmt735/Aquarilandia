import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError.js'
import { estoqueService } from './estoque.service.js'

export const estoqueController = {
  async consultarSaldo(req: Request<{ produtoId: string }>, res: Response): Promise<void> {
    res.json(await estoqueService.consultarSaldo(req.params.produtoId, req.query))
  },

  async consultarHistorico(req: Request, res: Response): Promise<void> {
    res.json(await estoqueService.consultarHistorico(req.query))
  },

  async criar(req: Request, res: Response): Promise<void> {
    if (!req.usuario) throw new AppError('Faça login para continuar.', 401)
    res.status(201).json(await estoqueService.registrarMovimentacao(req.usuario.id, req.body, req.get('Idempotency-Key'), req.query))
  },
}
