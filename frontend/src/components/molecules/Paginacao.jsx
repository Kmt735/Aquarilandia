import { ChevronLeft, ChevronRight } from 'lucide-react'

// Paginação (item 7). Some quando há uma página só.
export default function Paginacao({ pagina, totalPaginas, onMudar }) {
  if (totalPaginas <= 1) return null
  const base = 'flex size-11 items-center justify-center rounded-full text-pequeno font-bold transition-colors'
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-center">
      <ul className="flex items-center gap-1">
        <li>
          <button type="button" className={`${base} hover:bg-surface-tint disabled:opacity-40`} disabled={pagina === 1} onClick={() => onMudar(pagina - 1)} aria-label="Página anterior">
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
        </li>
        {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
          <li key={n}>
            <button
              type="button"
              onClick={() => onMudar(n)}
              aria-current={n === pagina ? 'page' : undefined}
              aria-label={`Página ${n}`}
              className={`${base} ${n === pagina ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-tint'}`}
            >
              {n}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={`${base} hover:bg-surface-tint disabled:opacity-40`} disabled={pagina === totalPaginas} onClick={() => onMudar(pagina + 1)} aria-label="Próxima página">
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
