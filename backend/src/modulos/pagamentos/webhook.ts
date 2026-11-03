import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Request } from 'express'
import { env } from '../../config/env.js'

// Chave PÚBLICA publicada pela AbacatePay, igual para todas as contas; não é segredo. Ela só prova que o corpo
// não foi alterado: quem prova que o pedido veio da AbacatePay é o webhookSecret, e quem decide se o pagamento
// existe é a reconsulta (#47). Copiada de https://docs.abacatepay.com/pages/webhooks/security
const chavePublicaAbacatePay =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4' +
  'L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4' +
  'IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiD' +
  'kMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'

let avisouSemSegredo = false

function sha256(valor: string): Buffer {
  return createHash('sha256').update(valor, 'utf8').digest()
}

// Camadas 1 e 2 do webhook (D-21). A terceira, a reconsulta do pagamento na AbacatePay, fica na #47.
export function verificarWebhook(req: Request): boolean {
  // a) Sem segredo configurado, recusa tudo (e avisa uma vez só, sem repetir a cada notificação)
  const segredo = env.gatewayWebhookSecret
  if (!segredo) {
    if (!avisouSemSegredo) console.error('[webhook] GATEWAY_WEBHOOK_SECRET ausente')
    avisouSemSegredo = true
    return false
  }

  // b) ?webhookSecret= uma única vez (repetido chega como array). Compara os SHA-256 dos dois: os buffers
  // têm sempre 32 bytes, então o timingSafeEqual nunca recusa por tamanho e o tempo não revela nada do segredo
  const recebido = req.query.webhookSecret
  if (typeof recebido !== 'string') return false
  if (!timingSafeEqual(sha256(recebido), sha256(segredo))) return false

  // c) Corpo cru (guardado pelo verify do express.json, em app.ts) e o header da assinatura
  const corpo = req.rawBody
  const assinatura = req.get('x-webhook-signature')
  if (!Buffer.isBuffer(corpo) || typeof assinatura !== 'string' || assinatura === '') return false

  // d) HMAC-SHA256 dos bytes exatamente como chegaram, em base64, comparado em tempo constante
  const esperada = Buffer.from(createHmac('sha256', chavePublicaAbacatePay).update(corpo).digest('base64'), 'utf8')
  const enviada = Buffer.from(assinatura, 'utf8')
  if (esperada.length !== enviada.length) return false
  return timingSafeEqual(esperada, enviada)
}
