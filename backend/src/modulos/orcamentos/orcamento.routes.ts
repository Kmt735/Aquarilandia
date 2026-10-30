import { Router } from 'express'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { orcamentoController } from './orcamento.controller.js'

export const orcamentoRoutes = Router()

orcamentoRoutes.post('/', exigirOrigem, orcamentoController.criar)
orcamentoRoutes.get('/', orcamentoController.listar)
