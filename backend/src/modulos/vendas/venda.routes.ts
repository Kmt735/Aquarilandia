import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { vendaController } from './venda.controller.js'

export const vendaRoutes = Router()

// exigirOrigem antes do autenticar: recusa o pedido de outro site sem consultar a sessão no banco
vendaRoutes.post('/', exigirOrigem, autenticar, vendaController.criar)
