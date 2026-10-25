import { Search, X } from 'lucide-react'

// Campo de busca da página da loja: filtra a grade enquanto a pessoa digita
export default function CampoBuscaLoja({ valor, onChange }) {
  return (
    <div className="relative flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-text-muted"
      />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar produtos na loja…"
        aria-label="Buscar produtos na loja"
        autoComplete="off"
        className="w-full rounded-full border border-border-strong bg-surface py-3 pr-11 pl-11 text-[16px] text-foreground outline-none placeholder:text-text-muted focus:border-primary focus:ring-[3px] focus:ring-primary/20 dark:focus:border-primary-text [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-3 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-tint hover:text-primary-text"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  )
}