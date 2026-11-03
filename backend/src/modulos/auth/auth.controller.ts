import type { Request, Response  } from "express";
import { authService } from "./auth.service.js";
import { opcoesCookie } from './sessao.cookie.js'

// A mesma resposta exista a conta ou não (api.md, seção 11)
const msgEsqueciSenha = 'Se este e-mail estiver cadastrado, você receberá um link para criar uma senha nova.'

export const authController = {
    async cadastrar (req: Request, res: Response): Promise<void>{
        const cliente = await authService.cadastrar(req.body)
        res.status(201).json(cliente)
    },
      async login(req: Request, res: Response): Promise<void> {
    const { cliente, token, expiraEm } = await authService.login(req.body, {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null
    })

    res.cookie('sid', token, { ...opcoesCookie, expires: expiraEm })

    res.status(200).json(cliente)
  },
  async logout(req: Request, res: Response): Promise<void> {
  await authService.logout(req.cookies.sid)
  res.clearCookie('sid', opcoesCookie)
  res.status(204).end()
  },
  async buscarSessao(req: Request, res: Response): Promise<void> {
  res.json(await authService.buscarSessao(req.usuario!.id))
  },
  async esqueciSenha(req: Request, res: Response): Promise<void> {
    await authService.esqueciSenha(req.body)
    res.status(202).json({ mensagem: msgEsqueciSenha })
  },
}
