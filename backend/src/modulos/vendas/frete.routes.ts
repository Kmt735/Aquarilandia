import { Router } from 'express'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limiteFrete } from '../../middlewares/rateLimit.js'
import { freteController } from './frete.controller.js'

export const freteRoutes = Router()

// Pública: o carrinho cota antes do login. exigirOrigem antes do limite, para pedido de outro site nem contar
freteRoutes.post('/calcular', exigirOrigem, limiteFrete, freteController.calcular)
