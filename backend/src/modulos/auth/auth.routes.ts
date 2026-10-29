import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { limiteCadastro, limiteLogin } from '../../middlewares/rateLimit.js'
import { authController } from './auth.controller.js'

export const authRoutes = Router()

authRoutes.post('/cadastro', limiteCadastro, authController.cadastrar)
authRoutes.post('/login', limiteLogin, authController.login)
authRoutes.post('/logout', autenticar, authController.logout)
authRoutes.get('/sessao', autenticar, authController.buscarSessao)