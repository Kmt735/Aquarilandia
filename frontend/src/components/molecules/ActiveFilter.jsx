import { X } from 'lucide-react'
import Button from '../atoms/Button'

// H3 · Controle do usuário: cada filtro aplicado vira um chip que se remove sozinho, mais "Limpar filtros".
// `filtros`: [{ id, rotulo, onRemover }]. Os chips quebram linha (nunca são cortados).
export default function ActiveFilter({ filtros, onLimpar }) {
  if (!filtros.length) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="text-pequeno text-text-muted" id="rotulo-filtros-ativos">
        Filtros aplicados:
      </span>
      <ul aria-labelledby="rotulo-filtros-ativos" className="contents">
        {filtros.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={f.onRemover}
              aria-label={`Remover filtro: ${f.rotulo}`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary-text/40 bg-primary-soft py-1 pr-2.5 pl-3.5 text-pequeno font-semibold text-primary-text transition-colors hover:border-primary-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-text"
            >
              {f.rotulo}
              <X aria-hidden="true" className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="terciario" className="min-h-11" onClick={onLimpar}>
        Limpar filtros
      </Button>
    </div>
  )
}
