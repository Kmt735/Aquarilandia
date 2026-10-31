import type { Request, Response } from 'express'
import { idParam } from '../../utils/validacao.js'
import { enderecoService } from './endereco.service.js'

// O `!` em req.usuario é seguro só porque toda rota de endereço passa antes pelo `autenticar`
export const enderecoController = {
  async listarMeus(req: Request, res: Response): Promise<void> {
    res.json(await enderecoService.listarMeus(req.usuario!.id))
  },

  async criar(req: Request, res: Response): Promise<void> {
    res.status(201).json(await enderecoService.criar(req.usuario!.id, req.body))
  },

  async atualizar(req: Request<{ enderecoId: string }>, res: Response): Promise<void> {
    const enderecoId = idParam(req.params.enderecoId)
    res.json(await enderecoService.atualizar(req.usuario!.id, enderecoId, req.body))
  },
}
