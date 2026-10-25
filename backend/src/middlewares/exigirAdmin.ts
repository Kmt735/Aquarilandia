import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/AppError.js'

export function exigirAdmin(req: Request, _res: Response, next: NextFunction): void {
      if (req.usuario?.papel !== 'admin') throw new AppError('Você não tem permissão para esta ação.', 403)
      next()
    }