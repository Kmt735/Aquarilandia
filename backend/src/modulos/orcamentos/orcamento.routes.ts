import { Router } from 'express'
import { orcamentoController } from './orcamento.controller.js'

export const orcamentoRoutes = Router()

orcamentoRoutes.post('/', orcamentoController.criar)
orcamentoRoutes.get('/', orcamentoController.listar)
