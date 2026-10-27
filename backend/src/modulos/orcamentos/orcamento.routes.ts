import { Router } from 'express'
import { orcamentoController } from './orcamento.controller.js'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'

export const orcamentoRoutes = Router()

orcamentoRoutes.post('/', orcamentoController.criar)
// Somente a criação é pública; consultas e futuros handlers administrativos ficam após a guarda.
orcamentoRoutes.use(autenticar, exigirAdmin)
orcamentoRoutes.get('/', orcamentoController.listar)
