import { Router } from 'express'
import { catalogoController } from '../controllers/catalogo.controller.js'

export const catalogoRoutes = Router()

catalogoRoutes.get('/categorias', catalogoController.categorias)
catalogoRoutes.get('/produtos', catalogoController.produtos)
catalogoRoutes.get('/produtos/:id', catalogoController.produto)
catalogoRoutes.get('/peixes', catalogoController.peixes)
catalogoRoutes.get('/peixes/:id', catalogoController.peixe)
catalogoRoutes.get('/servicos', catalogoController.servicos)
