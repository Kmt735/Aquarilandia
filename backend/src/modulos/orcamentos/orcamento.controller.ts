import type { Request, Response } from 'express'
import { idParam } from '../../utils/validacao.js'
import { orcamentoService } from './orcamento.service.js'

export const orcamentoController = {
  async criar(req: Request, res: Response): Promise<void> {
    res.status(201).json(await orcamentoService.criar(req.body ?? {}))
  },

  // no-store: a resposta tem nome e telefone e não pode ficar em cache (D-41)
  async listar(req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-store').json(await orcamentoService.listar(req.query))
  },

  async atualizarStatus(req: Request<{ id: string }>, res: Response): Promise<void> {
    const id = idParam(req.params.id)
    res.set('Cache-Control', 'no-store').json(await orcamentoService.atualizarStatus(id, req.body))
  },
}
