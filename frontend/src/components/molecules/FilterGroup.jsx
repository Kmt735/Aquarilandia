import Tip from '../atoms/Tip'

export default function FilterGroup({ titulo, itens, ativo, onSelecionar }) {
  return (
    <div className="mb-7 last:mb-0">
      <h5 className="mb-2.5 font-sans text-[11.5px] font-bold tracking-[.12em] text-text-muted uppercase">{titulo}</h5>
      <ul>
        {itens.map((item) => {
          const selecionado = ativo === item.valor
          return (
            <li key={item.valor} className="flex items-center">
              <button
                type="button"
                aria-pressed={selecionado}
                onClick={() => onSelecionar(item.valor)}
                className={`relative -mx-2 rounded-full px-3 py-1.5 text-left text-[14.5px] transition-colors ${
                  selecionado ? 'bg-primary-soft font-bold text-primary-text' : 'text-foreground hover:bg-surface-tint hover:text-primary-text'
                }`}
              >
                {item.rotulo}
              </button>
              {item.dica && <Tip texto={item.dica} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
