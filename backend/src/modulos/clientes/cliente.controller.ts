import type { Request, Response } from 'express'
import { authService } from '../auth/auth.service.js'
import { clienteService } from './cliente.service.js'

// O `!` em req.usuario é seguro só porque toda rota /me passa antes pelo `autenticar`
export const clienteController = {
  async buscarMeusDados(req: Request, res: Response): Promise<void> {
    res.json(await clienteService.buscarMeusDados(req.usuario!.id))
  },

  async atualizarMeusDados(req: Request, res: Response): Promise<void> {
    res.json(await clienteService.atualizarMeusDados(req.usuario!.id, req.body))
  },

  async trocarMinhaSenha(req: Request, res: Response): Promise<void> {
    await authService.trocarSenha(req.usuario!.id, req.cookies.sid, req.body)
    res.status(204).end()
  },
}
