import { Router } from 'express'
import { catalogoRoutes } from './catalogo.routes.js'
import { orcamentoRoutes } from './orcamento.routes.js'

export const routes = Router()

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})
routes.use('/', catalogoRoutes)
routes.use('/orcamentos', orcamentoRoutes)
