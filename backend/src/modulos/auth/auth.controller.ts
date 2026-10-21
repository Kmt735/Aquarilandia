import type { Request, Response } from "express";
import { authService } from "./auth.service.js";

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

    res.cookie('sid', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiraEm,
      path: '/'
    })

    res.status(200).json(cliente)
  }
}
