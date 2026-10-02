import { useState } from 'react'
import { useLocation } from 'react-router'
import Button from '../components/atoms/Button'
import EmptyState from '../components/molecules/EmptyState'
import FishFilterChips from '../components/organisms/FishFilterChips'
import FishGrid from '../components/organisms/FishGrid'
import PageTemplate from '../components/templates/PageTemplate'
import { atendeFiltro, peixes } from '../data/peixes'
import useDestaque from '../hooks/useDestaque'
import useWhatsApp from '../hooks/useWhatsApp'

export default function PeixesPage() {
  // Nova navegação (ex.: vinda da busca) reinicia os filtros
  const { key } = useLocation()
  return <CatalogoPeixes key={key} />
}

function CatalogoPeixes() {
  const [filtros, setFiltros] = useState(() => new Set())
  const abrirWhatsApp = useWhatsApp()
  useDestaque()

  const alternar = (filtro) =>
    setFiltros((atual) => {
      const novo = new Set(atual)
      if (novo.has(filtro)) novo.delete(filtro)
      else novo.add(filtro)
      return novo
    })
  const limpar = () => setFiltros(new Set())

  const visiveis = peixes.filter((p) => [...filtros].every((f) => atendeFiltro(p, f)))

  return (
    <PageTemplate eyebrow="Catálogo" titulo="Peixes disponíveis">
      <FishFilterChips ativos={filtros} onAlternar={alternar} onLimpar={limpar} />
      <FishGrid peixes={visiveis} />
      {visiveis.length === 0 && (
        <EmptyState
          icone="🐟"
          acoes={
            <>
              <Button variant="ghost" onClick={limpar}>
                Limpar filtros
              </Button>
              <Button onClick={() => abrirWhatsApp('perguntar sobre peixes disponíveis')}>
                💬 Perguntar o que chegou
              </Button>
            </>
          }
        >
          Nenhum peixe combina com todos esses filtros no momento.
        </EmptyState>
      )}
    </PageTemplate>
  )
}
