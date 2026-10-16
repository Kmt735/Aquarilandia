import { Router } from 'express'
import { db } from '../config/db.js'
import { catalogoRoutes } from './catalogo.routes.js'
import { orcamentoRoutes } from '../modulos/orcamentos/orcamento.routes.js'

export const routes = Router()

routes.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ status: 'ok', banco: 'ok' })
  } catch {
    res.status(503).json({ status: 'erro', banco: 'indisponível' })
  }
})
routes.use('/', catalogoRoutes)
routes.use('/orcamentos', orcamentoRoutes)
