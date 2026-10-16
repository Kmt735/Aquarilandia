import Tip from '../atoms/Tip'

export default function FilterGroup({ titulo, itens, ativo, onSelecionar }) {
  return (
    <div className="mb-7 last:mb-0">
      <h5 className="mb-2.5 font-sans text-[11.5px] font-semibold tracking-[.14em] text-text-muted uppercase">{titulo}</h5>
      <ul>
        {itens.map((item) => {
          const selecionado = ativo === item.valor
          return (
            <li key={item.valor} className="flex items-center">
              <button
                type="button"
                aria-pressed={selecionado}
                onClick={() => onSelecionar(item.valor)}
                className={`relative -mx-2 rounded-md px-2 py-1.5 text-left text-[14px] transition-colors ${
                  selecionado ? 'font-semibold text-primary-text' : 'text-foreground hover:text-primary-text'
                }`}
              >
                {selecionado && <span aria-hidden="true" className="neon-line absolute top-2 bottom-2 -left-1 w-0.5 rounded-full" />}
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
