import type { RequestHandler } from 'express'
import { AppError } from '../utils/AppError.js'

export const exigirAdmin: RequestHandler = (req, _res, next) => {
  if (!req.usuario) throw new AppError('Faça login para continuar.', 401)
  if (req.usuario.papel !== 'admin') throw new AppError('Acesso permitido somente para administradores.', 403)
  next()
}
