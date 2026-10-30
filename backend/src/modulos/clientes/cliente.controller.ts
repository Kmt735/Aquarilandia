import type { Request, Response } from 'express'
import { clienteService } from './cliente.service.js'

// O `!` em req.usuario é seguro só porque toda rota /me passa antes pelo `autenticar`
export const clienteController = {
  async buscarMeusDados(req: Request, res: Response): Promise<void> {
    res.json(await clienteService.buscarMeusDados(req.usuario!.id))
  },

  async atualizarMeusDados(req: Request, res: Response): Promise<void> {
    res.json(await clienteService.atualizarMeusDados(req.usuario!.id, req.body))
  },
}
