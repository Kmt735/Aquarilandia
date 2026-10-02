import Tip from '../atoms/Tip'

export default function FilterGroup({ titulo, itens, ativo, onSelecionar }) {
  return (
    <>
      <h5 className="mb-3 text-xs font-bold uppercase tracking-[.08em] text-ink-soft">{titulo}</h5>
      <ul className="mb-[22px]">
        {itens.map((item) => (
          <li key={item.valor} className="flex items-center border-b border-dashed border-line">
            <button
              type="button"
              onClick={() => onSelecionar(item.valor)}
              className={`py-[7px] text-left text-[13.5px] ${ativo === item.valor ? 'font-bold text-cyan' : 'text-ink'}`}
            >
              {item.rotulo}
            </button>
            {item.dica && <Tip texto={item.dica} data-h="H10 Ajuda" />}
          </li>
        ))}
      </ul>
    </>
  )
}
