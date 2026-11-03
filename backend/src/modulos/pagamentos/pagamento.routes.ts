import { Router } from 'express'
import { pagamentoController } from './pagamento.controller.js'

export const pagamentoRoutes = Router()

// Sem autenticar, sem exigirOrigem e sem rate limit: quem chama é a AbacatePay, que não manda Origin nem cookie.
// A proteção é o webhookSecret na URL e a assinatura do corpo (verificarWebhook), e depois a reconsulta (#47).
pagamentoRoutes.post('/webhook', pagamentoController.receberWebhook)
