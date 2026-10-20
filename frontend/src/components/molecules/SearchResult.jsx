import { Search } from 'lucide-react'
import { iconeBusca } from '@/lib/icones'

export default function SearchResult({ resultado, selecionado, onClick }) {
  const Icone = iconeBusca[resultado.tipo] ?? Search
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-surface-tint ${selecionado ? 'bg-surface-tint' : ''}`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-tint text-primary-text">
        <Icone aria-hidden="true" className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px]">{resultado.rotulo}</span>
        <small className="block truncate text-[12px] text-text-muted">{resultado.sub}</small>
      </span>
      <span className="ml-auto text-[11px] font-bold tracking-[.08em] text-text-muted uppercase">{resultado.tipo}</span>
    </button>
  )
}
