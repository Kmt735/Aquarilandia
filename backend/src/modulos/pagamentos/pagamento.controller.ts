import type { Request, Response } from 'express'
import { idParam } from '../../utils/validacao.js'
import { pagamentoService } from './pagamento.service.js'
import { verificarWebhook } from './webhook.js'

// Eventos processados (#46/#47); qualquer outro é só confirmado com 200
const eventosTratados = new Set(['transparent.completed', 'transparent.refunded', 'transparent.disputed', 'transparent.lost'])
// O id do aviso (log_...) vira gateway_notificacao_id (VARCHAR(100)); o da cobrança, gateway_cobranca_id (VARCHAR(100))
const padraoEventoId = /^log_[A-Za-z0-9]{1,96}$/
const padraoCobrancaId = /^pix_char_[A-Za-z0-9]{1,91}$/

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

// data.transparent.id, se tiver o formato de id de cobrança Pix; senão null
function lerCobrancaId(data: unknown): string | null {
  if (!ehObjeto(data) || !ehObjeto(data.transparent)) return null
  const { id } = data.transparent
  return typeof id === 'string' && padraoCobrancaId.test(id) ? id : null
}

export const pagamentoController = {
  // POST /api/pagamentos/:id/simular (admin, só na demonstração: a trava está na rota e no service)
  async simular(req: Request<{ id: string }>, res: Response): Promise<void> {
    const resultado = await pagamentoService.simularPagamento(req.usuario!.id, idParam(req.params.id))
    res.set('Cache-Control', 'no-store')
    res.status(200).json(resultado)
  },

  // POST /api/pagamentos/:id/concluir-estorno (admin; a rota passa antes pelo autenticar e pelo exigirAdmin)
  async concluirEstorno(req: Request<{ id: string }>, res: Response): Promise<void> {
    const resultado = await pagamentoService.concluirEstornoManual(req.usuario!.id, idParam(req.params.id), req.body)
    res.set('Cache-Control', 'no-store')
    res.status(200).json(resultado)
  },

  async receberWebhook(req: Request, res: Response): Promise<void> {
    // 401 e não 5xx: a AbacatePay não reenvia 4xx, e um pedido com segredo ou assinatura errados não vai ficar
    // certo numa nova tentativa. Nada do payload vai para o log.
    if (!verificarWebhook(req)) {
      console.error('[webhook] assinatura ou segredo inválido')
      res.status(401).json({ erro: 'Não autorizado.' })
      return
    }

    // Do corpo, só três coisas são lidas: o tipo do evento, o id do evento e o id da cobrança. O resto (status,
    // valor, nome, e-mail, CPF mascarado) é ignorado: o que vale é a consulta ao gateway (D-21, camada 3)
    const corpo: Record<string, unknown> = ehObjeto(req.body) ? req.body : {}
    const { id, event, data } = corpo
    if (typeof event !== 'string' || !eventosTratados.has(event)) {
      res.status(200).json({ recebido: true })
      return
    }
    const eventoId = typeof id === 'string' && padraoEventoId.test(id) ? id : null
    const cobrancaId = lerCobrancaId(data)
    // 200 e não 4xx/5xx: reenviar o mesmo corpo não o deixaria certo. Os ids não vão para o log
    if (!eventoId || !cobrancaId) {
      console.error(`[webhook] ${event} sem o id do evento ou da cobrança; ignorado`)
      res.status(200).json({ recebido: true })
      return
    }

    // Falha nossa ou do gateway → o service lança e o errorHandler responde 500: a AbacatePay reenvia
    await pagamentoService.processarAviso(eventoId, event, cobrancaId)
    res.status(200).json({ recebido: true })
  },
}
