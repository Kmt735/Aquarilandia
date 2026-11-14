import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { pagamentoController } from './pagamento.controller.js'

export const pagamentoRoutes = Router()

// Sem autenticar, sem exigirOrigem e sem rate limit: quem chama é a AbacatePay, que não manda Origin nem cookie.
// A proteção é o webhookSecret na URL e a assinatura do corpo (verificarWebhook), e depois a reconsulta (#47).
pagamentoRoutes.post('/webhook', pagamentoController.receberWebhook)
// Lote 12: o admin registra a devolução manual de um pagamento indevido, depois das 5 tentativas automáticas
pagamentoRoutes.post('/:id/concluir-estorno', exigirOrigem, autenticar, exigirAdmin, pagamentoController.concluirEstorno)
