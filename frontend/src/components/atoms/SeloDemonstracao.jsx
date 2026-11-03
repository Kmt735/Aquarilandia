import { FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'

// Aparece só com VITE_CATALOGO_MOCK=true: deixa claro que produtos, preços e estoque são de demonstração.
export default function SeloDemonstracao({ elevado = false }) {
  return (
    <p
      className={cn(
        'pointer-events-none fixed left-3 z-(--z-flutuante) inline-flex items-center gap-1.5 rounded-full border border-warning-text/40 bg-warning-soft px-2.5 py-1 text-micro font-bold text-warning-text shadow-soft',
        elevado ? 'bottom-24 desk:bottom-3' : 'bottom-3',
      )}
    >
      <FlaskConical aria-hidden="true" className="size-3.5" />
      Dados de demonstração
    </p>
  )
}
