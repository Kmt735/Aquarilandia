import { CircleCheck, CircleX, Clock, Package, Store, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { STATUS_PEDIDO } from '../../utils/statusPedido'

const ICONES = { check: CircleCheck, relogio: Clock, caixa: Package, caminhao: Truck, loja: Store, x: CircleX }
const VARIANTES = { sucesso: 'sucesso', aviso: 'aviso', info: 'info', neutro: 'secondary' }

// Status da compra: ícone + texto, nunca só cor
export default function StatusPedidoBadge({ status }) {
  const s = STATUS_PEDIDO[status]
  const Icone = ICONES[s.icone]
  return (
    <Badge variant={VARIANTES[s.tom]}>
      <Icone aria-hidden="true" />
      {s.rotulo}
    </Badge>
  )
}
