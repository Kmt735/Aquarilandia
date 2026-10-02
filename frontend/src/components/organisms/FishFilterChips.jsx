import Chip from '../atoms/Chip'
import { filtrosPeixe } from '../../data/peixes'

// H7 · Flexibilidade: filtros rápidos combináveis
export default function FishFilterChips({ ativos, onAlternar, onLimpar }) {
  return (
    <div className="mx-auto mt-7 flex max-w-[1180px] flex-wrap gap-2.5 px-4 desk:px-10" data-h="H7 Filtros rápidos">
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
