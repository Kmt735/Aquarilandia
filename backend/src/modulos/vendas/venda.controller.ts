import type { Request, Response } from 'express'
import { vendaService } from './venda.service.js'

// O `!` em req.usuario é seguro só porque a rota passa antes pelo `autenticar`.
// O dono vem da sessão: nenhum clienteId do body é lido (api.md, seção 11)
export const vendaController = {
  async criar(req: Request, res: Response): Promise<void> {
    res.status(201).json(await vendaService.criar(req.usuario!.id, req.body))
  },
}
