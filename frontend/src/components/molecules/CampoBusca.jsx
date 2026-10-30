import { Search, X } from 'lucide-react'

// Campo de busca das listagens: filtra a grade enquanto a pessoa digita
export default function CampoBusca({ valor, onChange, rotulo, placeholder }) {
  return (
    <div role="search" className="relative flex-1">
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-muted" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={rotulo}
        autoComplete="off"
        className="h-12 w-full rounded-full border border-border-control bg-surface pr-12 pl-11 text-corpo text-foreground outline-none placeholder:text-text-muted focus-visible:border-primary-text focus-visible:shadow-glow [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:text-primary-text"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}
