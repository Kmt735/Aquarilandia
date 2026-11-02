import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../utils/AppError.js'
import { registrarErro } from '../utils/registrarErro.js'

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` })
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ erro: 'Corpo da requisição excede o limite de 100 KiB' })
    return
  }
  if (err?.type === 'encoding.unsupported') {
    res.status(415).json({ erro: 'Codificação de corpo não suportada. Envie JSON sem compressão.' })
    return
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ erro: err.message, detalhes: err.detalhes })
    return
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ erro: 'JSON inválido' })
    return
  }
  registrarErro(err, 'api')
  res.status(500).json({ erro: 'Erro interno do servidor' })
}
