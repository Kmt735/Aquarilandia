import { Router, type RequestHandler } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { estoqueController } from './estoque.controller.js'

export const estoqueRoutes = Router()
const semCache: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  res.vary('Cookie')
  next()
}
// Leituras seguem o catálogo administrativo: sessão/admin, sem exigir Origin; caminho estático primeiro.
estoqueRoutes.get('/movimentacoes', semCache, autenticar, exigirAdmin, estoqueController.consultarHistorico)
estoqueRoutes.get('/:produtoId', semCache, autenticar, exigirAdmin, estoqueController.consultarSaldo)
estoqueRoutes.post('/movimentacoes', semCache, autenticar, exigirAdmin, exigirOrigem, estoqueController.criar)
