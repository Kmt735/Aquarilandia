import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { authController } from './auth.controller.js'

export const authRoutes = Router()

authRoutes.post('/cadastro', authController.cadastrar)
authRoutes.post('/login', authController.login)
authRoutes.post('/logout', autenticar, authController.logout)
authRoutes.get('/sessao', autenticar, authController.buscarSessao)