import { CircleHelp } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { termos } from '../../data/glossario'

// "O que é isso?": abre no toque, no clique e no teclado (Enter/Espaço); Esc fecha — itens 2, 10, 32
export default function Termo({ id, children, mostrarRotulo = true }) {
  const t = termos[id]
  if (!t) return children ?? null
  return (
    <span className="inline-flex items-center gap-1">
      {mostrarRotulo && (children ?? t.termo)}
      <Popover>
        <PopoverTrigger
          aria-label={`O que é ${t.termo}?`}
          className="alvo-toque inline-flex size-6 items-center justify-center rounded-full text-primary-text transition-colors hover:bg-surface-tint"
        >
          <CircleHelp aria-hidden="true" className="size-4" />
        </PopoverTrigger>
        <PopoverContent>
          <p className="mb-1 font-display text-corpo font-extrabold">{t.termo}</p>
          <p className="text-pequeno text-text-muted">{t.texto}</p>
        </PopoverContent>
      </Popover>
    </span>
  )
}
