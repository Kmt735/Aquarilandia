import { Search } from 'lucide-react'
import { iconeBusca } from '@/lib/icones'

// Opção da lista de sugestões (role="option"; a navegação por setas fica no SearchBox)
export default function SearchResult({ id, resultado, selecionado, onClick }) {
  const Icone = iconeBusca[resultado.tipo] ?? Search
  return (
    <li
      id={id}
      role="option"
      aria-selected={selecionado}
      onClick={onClick}
      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-surface-tint ${selecionado ? 'bg-surface-tint ring-1 ring-primary-text/40' : ''}`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-text">
        <Icone aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-pequeno font-semibold">{resultado.rotulo}</span>
        <span className="block truncate text-legenda text-text-muted">{resultado.sub}</span>
      </span>
      <span className="ml-auto text-micro font-bold tracking-[.06em] text-text-muted uppercase">{resultado.tipo}</span>
    </li>
  )
}
