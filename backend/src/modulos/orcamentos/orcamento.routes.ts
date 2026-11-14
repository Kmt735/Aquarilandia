import { Router } from 'express'
import type { RequestHandler } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limiteOrcamento } from '../../middlewares/rateLimit.js'
import { orcamentoController } from './orcamento.controller.js'

export const orcamentoRoutes = Router()

// R-06 (Lote 14a): nas escritas de admin o exigirOrigem vem ANTES da guarda, como em toda escrita da API: um pedido de
// outro site é recusado sem nem consultar a sessão no banco. As leituras de admin continuam sem Origin
const origemNasEscritas: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }
  exigirOrigem(req, res, next)
}

orcamentoRoutes.post('/', exigirOrigem, limiteOrcamento, orcamentoController.criar)
// Somente a criação é pública; consultas e futuros handlers administrativos ficam após a guarda (D-41), e escrita
// nova já nasce com o exigirOrigem
orcamentoRoutes.use(origemNasEscritas, autenticar, exigirAdmin)
orcamentoRoutes.get('/', orcamentoController.listar)
// Escrita administrativa: o exigirOrigem (CSRF) já rodou na guarda acima (origemNasEscritas)
orcamentoRoutes.patch('/:id', orcamentoController.atualizarStatus)
