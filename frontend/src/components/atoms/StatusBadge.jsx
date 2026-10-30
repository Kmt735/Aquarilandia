import { CircleCheck, CircleSlash, Clock, MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Estado com ícone + texto (nada depende só da cor — item 25)
const TIPOS = {
  disponivel: { variant: 'sucesso', Icone: CircleCheck, rotulo: 'Disponível' },
  encomenda: { variant: 'aviso', Icone: Clock, rotulo: 'Sob encomenda' },
  esgotado: { variant: 'secondary', Icone: CircleSlash, rotulo: 'Esgotado' },
  'entrega-local': { variant: 'info', Icone: MapPin, rotulo: 'Entrega só em São João del Rei' },
}

export default function StatusBadge({ tipo, children, className = '' }) {
  const { variant, Icone, rotulo } = TIPOS[tipo]
  return (
    <Badge variant={variant} className={cn('whitespace-normal text-left', className)}>
      <Icone aria-hidden="true" />
      {children ?? rotulo}
    </Badge>
  )
}
