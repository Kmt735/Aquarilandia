import { Check } from 'lucide-react'
import { ETAPAS_ENTREGA, ETAPAS_RETIRADA, STATUS_PEDIDO } from '../../utils/statusPedido'
import { formatarDataHora } from '../../utils/format'

// Linha do tempo de status (item 1): o que já aconteceu, com data, e as próximas etapas
export default function LinhaDoTempoPedido({ pedido }) {
  const cancelado = ['cancelada', 'cancelamento_solicitado'].includes(pedido.status)
  const roteiro = pedido.entrega.tipo === 'retirada' ? ETAPAS_RETIRADA : ETAPAS_ENTREGA
  const feitos = Object.fromEntries(pedido.historico.map((h) => [h.status, h.em]))
  const etapas = cancelado ? pedido.historico.map((h) => h.status) : roteiro

  return (
    <ol className="flex flex-col">
      {etapas.map((status, i) => {
        const em = feitos[status]
        const atual = status === pedido.status
        const ultimo = i === etapas.length - 1
        return (
          <li key={status} aria-current={atual ? 'step' : undefined} className={`relative flex gap-4 ${ultimo ? '' : 'pb-6'}`}>
            {!ultimo && <span aria-hidden="true" className={`absolute top-8 bottom-0 left-[13px] w-0.5 ${em ? 'bg-primary-text' : 'bg-border-strong'}`} />}
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 ${
                atual ? 'border-primary bg-primary text-primary-foreground shadow-glow' : em ? 'border-primary-text bg-primary-soft text-primary-text' : 'border-border-control bg-surface'
              }`}
            >
              {em && <Check aria-hidden="true" className="size-3.5" />}
            </span>
            <div className="pt-0.5">
              <p className={`text-pequeno ${atual ? 'font-bold' : em ? 'font-semibold' : 'text-text-muted'}`}>
                {STATUS_PEDIDO[status].rotulo}
                {atual && <span className="sr-only"> (status atual)</span>}
              </p>
              <p className="text-legenda text-text-muted">{em ? formatarDataHora(em) : 'Próxima etapa'}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
