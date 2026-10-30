import { X } from 'lucide-react'
import Button from '../atoms/Button'

// H3 · Controle do usuário: mostra os filtros aplicados e permite limpar
export default function ActiveFilter({ partes, onLimpar }) {
  if (!partes.length) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 text-pequeno text-text-muted">
      <span>Filtrando por:</span>
      {partes.map((p) => (
        <span key={p} className="rounded-full bg-primary-soft px-2.5 py-1 text-legenda font-semibold text-primary-text">
          {p}
        </span>
      ))}
      <Button variant="terciario" tamanho="sm" onClick={onLimpar}>
        <X aria-hidden="true" />
        Limpar filtros
      </Button>
    </div>
  )
}
