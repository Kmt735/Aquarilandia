import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { orcamentoController } from './orcamento.controller.js'

export const orcamentoRoutes = Router()

orcamentoRoutes.post('/', exigirOrigem, orcamentoController.criar)
// Somente a criação é pública; consultas e futuros handlers administrativos ficam após a guarda.
orcamentoRoutes.use(autenticar, exigirAdmin)
orcamentoRoutes.get('/', orcamentoController.listar)
