import FilterGroup from '../molecules/FilterGroup'
import { categorias, disponibilidades } from '../../data/categorias'

const itensCategoria = [
  { valor: '', rotulo: 'Todos os produtos' },
  ...categorias.map((c) => ({ valor: c.nome, rotulo: c.nome, dica: c.dica })),
]

export default function ShopFilters({ categoria, disponibilidade, onCategoria, onDisponibilidade }) {
  return (
    <aside className="w-full shrink-0 rounded-card border border-line bg-panel p-[22px] desk:sticky desk:top-[66px] desk:w-[220px]">
      <FilterGroup
        titulo="Categorias"
        itens={itensCategoria}
        ativo={categoria ?? ''}
        onSelecionar={(valor) => onCategoria(valor || null)}
      />
      <FilterGroup
        titulo="Disponibilidade"
        itens={disponibilidades}
        ativo={disponibilidade}
        onSelecionar={(valor) => onDisponibilidade(valor === disponibilidade ? null : valor)}
      />
    </aside>
  )
}
