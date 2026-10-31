import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limiteCadastro, limiteLogin } from '../../middlewares/rateLimit.js'
import { authController } from './auth.controller.js'

export const authRoutes = Router()

// exigirOrigem vem primeiro: pedido de outro site é recusado sem consultar o banco e sem gastar o limite do IP
authRoutes.post('/cadastro', exigirOrigem, limiteCadastro, authController.cadastrar)
authRoutes.post('/login', exigirOrigem, limiteLogin, authController.login)
authRoutes.post('/logout', exigirOrigem, autenticar, authController.logout)
authRoutes.get('/sessao', autenticar, authController.buscarSessao)
