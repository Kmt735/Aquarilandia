import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// H3 · Controle do usuário: mostra o filtro atual e permite desfazer
export default function ActiveFilter({ rotulo, onLimpar }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 text-[13.5px] text-text-muted">
      <span>{rotulo}</span>
      <Button variant="secondary" size="xs" className="rounded-full px-3" onClick={onLimpar}>
        <X aria-hidden="true" />
        Limpar filtros
      </Button>
    </div>
  )
}
