import type { NextFunction, Request, Response } from 'express'
import { hashToken } from '../modulos/auth/sessao.js'
import { sessaoRepository } from '../modulos/auth/sessao.repository.js'
import { AppError } from '../utils/AppError.js'

const MSG_NAO_AUTENTICADO = 'Faça login para continuar.'

export async function autenticar(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.sid

  if (typeof token !== 'string') throw new AppError(MSG_NAO_AUTENTICADO, 401)

  const usuario = await sessaoRepository.buscarUsuarioPorTokenHash(hashToken(token))
  if (usuario === null) throw new AppError(MSG_NAO_AUTENTICADO, 401)

  req.usuario = usuario
  next()
}