import type { Request, Response } from 'express'
import { enderecoService } from './endereco.service.js'

// O `!` em req.usuario é seguro só porque toda rota de endereço passa antes pelo `autenticar`
export const enderecoController = {
  async listarMeus(req: Request, res: Response): Promise<void> {
    res.json(await enderecoService.listarMeus(req.usuario!.id))
  },

  async criar(req: Request, res: Response): Promise<void> {
    res.status(201).json(await enderecoService.criar(req.usuario!.id, req.body))
  },
}
