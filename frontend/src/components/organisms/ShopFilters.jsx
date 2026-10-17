import FilterGroup from '../molecules/FilterGroup'
import { categorias, disponibilidades } from '../../data/categorias'

const itensCategoria = [
  { valor: '', rotulo: 'Todos os produtos' },
  ...categorias.map((c) => ({ valor: c.nome, rotulo: c.nome, dica: c.dica })),
]

export default function ShopFilters({ categoria, disponibilidade, onCategoria, onDisponibilidade }) {
  return (
    <aside
      aria-label="Filtros"
      className="w-full shrink-0 rounded-card border border-border bg-surface p-6 desk:sticky desk:top-[96px] desk:w-[230px]"
    >
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
