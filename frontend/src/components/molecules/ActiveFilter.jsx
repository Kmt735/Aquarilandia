// H3 · Controle do usuário: mostra o filtro atual e permite desfazer
export default function ActiveFilter({ rotulo, onLimpar }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-[13px] text-ink-soft" data-h="H3 Desfazer filtro">
      <span>{rotulo}</span>
      <button type="button" onClick={onLimpar} className="rounded-full bg-cyan px-3 py-1.5 text-xs font-bold text-bg">
        ✕ Limpar filtros
      </button>
    </div>
  )
}
