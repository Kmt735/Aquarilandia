import { Router } from 'express'
import { catalogoController } from '../controllers/catalogo.controller.js'
import { autenticar } from '../middlewares/autenticar.js'
import { exigirAdmin } from '../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../middlewares/exigirOrigem.js'
import { categoriaController } from '../modulos/catalogo/categoria.controller.js'
import { peixeController } from '../modulos/catalogo/peixe.controller.js'
import { produtoController } from '../modulos/catalogo/produto.controller.js'

export const catalogoRoutes = Router()

catalogoRoutes.get('/categorias', categoriaController.listar)
catalogoRoutes.get('/categorias/:id', categoriaController.buscarPorId)
catalogoRoutes.post('/categorias', autenticar, exigirAdmin, exigirOrigem, categoriaController.criar)
catalogoRoutes.patch('/categorias/:id', autenticar, exigirAdmin, exigirOrigem, categoriaController.atualizar)
catalogoRoutes.delete('/categorias/:id', autenticar, exigirAdmin, exigirOrigem, categoriaController.remover)
catalogoRoutes.get('/produtos', produtoController.listar)
catalogoRoutes.get('/produtos/:id', produtoController.buscarPorId)
catalogoRoutes.post('/produtos', autenticar, exigirAdmin, exigirOrigem, produtoController.criar)
catalogoRoutes.patch('/produtos/:id', autenticar, exigirAdmin, exigirOrigem, produtoController.atualizar)
catalogoRoutes.get('/peixes', peixeController.listar)
catalogoRoutes.get('/peixes/:id', peixeController.buscarPorId)
catalogoRoutes.get('/servicos', catalogoController.servicos)
