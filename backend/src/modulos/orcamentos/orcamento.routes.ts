import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { orcamentoController } from './orcamento.controller.js'

export const orcamentoRoutes = Router()

orcamentoRoutes.post('/', exigirOrigem, orcamentoController.criar)
orcamentoRoutes.get('/', autenticar, exigirAdmin, orcamentoController.listar)
