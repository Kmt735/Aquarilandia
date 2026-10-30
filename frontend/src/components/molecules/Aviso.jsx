import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

// Caixa de mensagem com ícone + texto (o estado nunca depende só da cor)
const TIPOS = {
  info: { Icone: Info, classe: 'border-primary-text/30 bg-info-soft', cor: 'text-info-text' },
  sucesso: { Icone: CircleCheck, classe: 'border-success-text/40 bg-success-soft', cor: 'text-success-text' },
  aviso: { Icone: TriangleAlert, classe: 'border-warning-text/40 bg-warning-soft', cor: 'text-warning-text' },
  erro: { Icone: CircleAlert, classe: 'border-danger-text/40 bg-danger-soft', cor: 'text-danger-text' },
}

export default function Aviso({ tipo = 'info', titulo, children, acao, role, className = '', id }) {
  const { Icone, classe, cor } = TIPOS[tipo]
  return (
    <div id={id} role={role} className={cn('flex gap-3 rounded-xl border px-4 py-3 text-pequeno text-foreground', classe, className)}>
      <Icone aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', cor)} />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-bold">{titulo}</p>}
        <div>{children}</div>
        {acao && <div className="mt-2">{acao}</div>}
      </div>
    </div>
  )
}
