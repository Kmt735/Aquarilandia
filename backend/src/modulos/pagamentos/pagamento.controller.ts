import type { Request, Response } from 'express'
import { verificarWebhook } from './webhook.js'

// Eventos que a #46/#47 vão processar; qualquer outro é só confirmado com 200
const eventosTratados = new Set(['transparent.completed', 'transparent.refunded'])

export const pagamentoController = {
  receberWebhook(req: Request, res: Response): void {
    // 401 e não 5xx: a AbacatePay não reenvia 4xx, e um pedido com segredo ou assinatura errados não vai ficar
    // certo numa nova tentativa. Nada do payload vai para o log.
    if (!verificarWebhook(req)) {
      console.error('[webhook] assinatura ou segredo inválido')
      res.status(401).json({ erro: 'Não autorizado.' })
      return
    }

    // Só id e event são lidos; o resto (dados do cliente, valores) fica para a reconsulta
    const corpo: unknown = req.body
    const { id, event } = (typeof corpo === 'object' && corpo !== null ? corpo : {}) as Record<string, unknown>
    if (typeof event === 'string' && eventosTratados.has(event)) {
      // id só entra no log se tiver o formato de id (evita quebra de linha ou texto arbitrário no log)
      console.info('[webhook] recebido', typeof id === 'string' && /^[A-Za-z0-9_]{1,100}$/.test(id) ? id : '-', event)
    }
    // Processamento na #46 e na #47: aqui nada é gravado e nenhuma venda muda
    res.status(200).json({ recebido: true })
  },
}
