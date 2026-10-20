import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../utils/AppError.js'

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message, detalhes: err.detalhes })
    return
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ erro: 'JSON inválido' })
    return
  }
  console.error(err)
  res.status(500).json({ erro: 'Erro interno do servidor' })
}
