import type { Request, Response } from 'express'
import { freteService } from './frete.service.js'

export const freteController = {
  async calcular(req: Request, res: Response): Promise<void> {
    res.json(await freteService.cotar(req.body))
  },
}
