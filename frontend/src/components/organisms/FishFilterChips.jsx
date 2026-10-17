import Chip from '../atoms/Chip'
import { filtrosPeixe } from '../../data/peixes'

// H7 · Flexibilidade: filtros rápidos combináveis
export default function FishFilterChips({ ativos, onAlternar, onLimpar }) {
  return (
    <div role="group" aria-label="Filtrar peixes" className="mx-auto mt-10 flex max-w-[1200px] flex-wrap gap-2 px-4 sm:px-6 desk:px-10">
      <Chip ativo={ativos.size === 0} onClick={onLimpar}>
        Todos
      </Chip>
      {filtrosPeixe.map((f) => (
        <Chip key={f.valor} ativo={ativos.has(f.valor)} onClick={() => onAlternar(f.valor)}>
          {f.rotulo}
        </Chip>
      ))}
    </div>
  )
}
