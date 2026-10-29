import type{ NextFunction, Request, Response } from 'express'
import { rateLimit } from 'express-rate-limit'
import { AppError } from '../utils/AppError.js'

const msgMuitasTentativas = 'Muitas tentativas. Tente de novo em alguns minutos. '

function responderLimite(_req: Request, _res: Response, next: NextFunction): void{
    next(new AppError(msgMuitasTentativas, 429))
}

export const limiteLogin = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})

export const limiteCadastro = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: responderLimite,
})