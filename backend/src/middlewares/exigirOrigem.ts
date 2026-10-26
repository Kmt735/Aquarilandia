import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../utils/AppError.js'

export const exigirOrigem: RequestHandler = (req, _res, next) => {
  if (req.get('origin') !== env.corsOrigin) throw new AppError('Origem da requisição não permitida.', 403)
  next()
}
