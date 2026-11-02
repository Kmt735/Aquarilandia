import { Router, type RequestHandler } from 'express'
import { catalogoController } from '../controllers/catalogo.controller.js'
import { autenticar } from '../middlewares/autenticar.js'
import { exigirAdmin } from '../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../middlewares/exigirOrigem.js'
import { categoriaController } from '../modulos/catalogo/categoria.controller.js'
import { peixeController } from '../modulos/catalogo/peixe.controller.js'
import { produtoController } from '../modulos/catalogo/produto.controller.js'

export const catalogoRoutes = Router()

// O valor literal true seleciona uma cadeia administrativa completa, sem fallback público.
const consultaDeInativos: RequestHandler = (req, res, next) => {
  if (req.query.incluir_inativos !== 'true') return next('route')
  res.set('Cache-Control', 'no-store')
  res.vary('Cookie')
  next()
}
const semCache: RequestHandler = (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
}

catalogoRoutes.get('/categorias', categoriaController.listar)
catalogoRoutes.get('/categorias/:id', categoriaController.buscarPorId)
catalogoRoutes.post('/categorias', autenticar, exigirAdmin, exigirOrigem, categoriaController.criar)
catalogoRoutes.patch('/categorias/:id', autenticar, exigirAdmin, exigirOrigem, categoriaController.atualizar)
catalogoRoutes.delete('/categorias/:id', autenticar, exigirAdmin, exigirOrigem, categoriaController.remover)
catalogoRoutes.get('/produtos', consultaDeInativos, autenticar, exigirAdmin, produtoController.listarAdministrativos)
catalogoRoutes.get('/produtos', produtoController.listar)
catalogoRoutes.get('/produtos/:id', consultaDeInativos, autenticar, exigirAdmin, produtoController.buscarAdministrativo)
catalogoRoutes.get('/produtos/:id', produtoController.buscarPorId)
catalogoRoutes.post('/produtos/:id/reativar', semCache, autenticar, exigirAdmin, exigirOrigem, produtoController.reativar)
catalogoRoutes.post('/produtos', autenticar, exigirAdmin, exigirOrigem, produtoController.criar)
catalogoRoutes.patch('/produtos/:id', autenticar, exigirAdmin, exigirOrigem, produtoController.atualizar)
catalogoRoutes.delete('/produtos/:id', autenticar, exigirAdmin, exigirOrigem, produtoController.remover)
catalogoRoutes.get('/peixes', peixeController.listar)
catalogoRoutes.get('/peixes/:id', peixeController.buscarPorId)
catalogoRoutes.get('/servicos', catalogoController.servicos)
