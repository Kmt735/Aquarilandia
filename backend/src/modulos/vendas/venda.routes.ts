import { Router } from 'express'
import type { RequestHandler } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limitePagamento } from '../../middlewares/rateLimit.js'
import { vendaController } from './venda.controller.js'

export const vendaRoutes = Router()

// exigirOrigem antes do autenticar: recusa o pedido de outro site sem consultar a sessão no banco
vendaRoutes.post('/', exigirOrigem, autenticar, vendaController.criar)
// #44: gera o Pix da compra (o controller chama o pagamentoService). O limite vem depois do login, então pedido sem
// Origin ou sem sessão não gasta a cota
vendaRoutes.post('/:id/pagamentos', exigirOrigem, autenticar, limitePagamento, vendaController.gerarPix)
// #35: cliente (só a própria venda) e admin (qualquer uma). Fica ACIMA de qualquer guarda de admin
vendaRoutes.post('/:id/cancelar', exigirOrigem, autenticar, vendaController.cancelar)

// R-06 (Lote 14a): nas escritas de admin o exigirOrigem vem ANTES da guarda, como em toda escrita da API: um pedido de
// outro site é recusado sem nem consultar a sessão no banco. As leituras de admin continuam sem Origin
const origemNasEscritas: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }
  exigirOrigem(req, res, next)
}

// Daqui para baixo, só admin; rota nova já nasce protegida (D-41, o mesmo padrão do clienteRoutes), e escrita nova já
// nasce com o exigirOrigem. Por isso qualquer rota nova de CLIENTE em /api/vendas precisa ficar ACIMA desta linha.
vendaRoutes.use(origemNasEscritas, autenticar, exigirAdmin)
vendaRoutes.get('/', vendaController.listarParaAdmin)
vendaRoutes.get('/:id', vendaController.buscarParaAdmin)
vendaRoutes.get('/:id/historico', vendaController.listarHistoricoParaAdmin)
// Escrita de admin: o exigirOrigem (CSRF) já rodou na guarda acima (origemNasEscritas)
vendaRoutes.post('/:id/status', vendaController.mudarStatusPeloAdmin)
