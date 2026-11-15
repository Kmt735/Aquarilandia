import { Router } from 'express'
import type { RequestHandler } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { simulacaoPixPermitida } from './gateway.js'
import { pagamentoController } from './pagamento.controller.js'

export const pagamentoRoutes = Router()

// Sem autenticar, sem exigirOrigem e sem rate limit: quem chama é a AbacatePay, que não manda Origin nem cookie.
// A proteção é o webhookSecret na URL e a assinatura do corpo (verificarWebhook), e depois a reconsulta (#47).
pagamentoRoutes.post('/webhook', pagamentoController.receberWebhook)
// Lote 12: o admin registra a devolução manual de um pagamento indevido, depois das 5 tentativas automáticas
pagamentoRoutes.post('/:id/concluir-estorno', exigirOrigem, autenticar, exigirAdmin, pagamentoController.concluirEstorno)

// Lote 13: a simulação de Pix da demonstração. A trava vem ANTES de tudo: desligada (sem PERMITIR_SIMULACAO_PIX=true
// ou sem a chave de teste), next('route') pula a rota e o pedido cai no 404 do notFound, igual ao de uma rota que não
// existe (nem o login é conferido, para não revelar que ela existe). Ligada: exigirOrigem, autenticar e exigirAdmin
const somenteNaDemonstracao: RequestHandler = (_req, _res, next) => {
  next(simulacaoPixPermitida() ? undefined : 'route')
}
pagamentoRoutes.post(
  '/:id/simular',
  somenteNaDemonstracao,
  exigirOrigem,
  autenticar,
  exigirAdmin,
  pagamentoController.simular,
)
