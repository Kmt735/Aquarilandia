export default function SearchResult({ resultado, selecionado, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-[10px] p-2.5 text-left hover:bg-panel-2 ${selecionado ? 'bg-panel-2' : ''}`}
    >
      <span className="w-7 text-center text-xl">{resultado.icone}</span>
      <div>
        <div>{resultado.rotulo}</div>
        <small className="block text-[11px] text-ink-soft">{resultado.sub}</small>
      </div>
      <span className="ml-auto font-mono text-[10px] text-cyan">{resultado.tipo}</span>
    </button>
  )
}
