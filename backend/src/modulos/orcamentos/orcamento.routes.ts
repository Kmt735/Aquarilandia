import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limiteOrcamento } from '../../middlewares/rateLimit.js'
import { orcamentoController } from './orcamento.controller.js'

export const orcamentoRoutes = Router()

orcamentoRoutes.post('/', exigirOrigem, limiteOrcamento, orcamentoController.criar)
// Somente a criação é pública; consultas e futuros handlers administrativos ficam após a guarda (D-41).
orcamentoRoutes.use(autenticar, exigirAdmin)
orcamentoRoutes.get('/', orcamentoController.listar)
// Escrita administrativa: exigirOrigem (CSRF) depois da guarda, como a D-41 prevê
orcamentoRoutes.patch('/:id', exigirOrigem, orcamentoController.atualizarStatus)
