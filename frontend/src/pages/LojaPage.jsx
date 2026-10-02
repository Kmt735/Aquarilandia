import { useSearchParams } from 'react-router'
import Button from '../components/atoms/Button'
import ActiveFilter from '../components/molecules/ActiveFilter'
import EmptyState from '../components/molecules/EmptyState'
import ProductGrid from '../components/organisms/ProductGrid'
import ShopFilters from '../components/organisms/ShopFilters'
import PageTemplate from '../components/templates/PageTemplate'
import { disponibilidades } from '../data/categorias'
import { produtos } from '../data/produtos'
import useDestaque from '../hooks/useDestaque'
import useWhatsApp from '../hooks/useWhatsApp'

export default function LojaPage() {
  const [params, setParams] = useSearchParams()
  const abrirWhatsApp = useWhatsApp()
  useDestaque()

  // O filtro vive na URL (/loja?categoria=Filtros&disponibilidade=in)
  const categoria = params.get('categoria')
  const disponibilidade = params.get('disponibilidade')

  const aplicarFiltro = (mudanca) => {
    const proximo = { categoria, disponibilidade, ...mudanca }
    setParams(Object.fromEntries(Object.entries(proximo).filter(([, v]) => v)))
  }
  const limpar = () => setParams({})

  const visiveis = produtos.filter(
    (p) =>
      (!categoria || p.categoria === categoria) &&
      (!disponibilidade || (disponibilidade === 'in') === p.emEstoque),
  )

  const partes = [categoria, disponibilidades.find((d) => d.valor === disponibilidade)?.rotulo].filter(Boolean)
  const total = `${visiveis.length} ${visiveis.length === 1 ? 'produto' : 'produtos'}`

  return (
    <PageTemplate eyebrow="Loja" titulo="Tudo pro seu aquário">
      <div className="mx-auto my-10 flex max-w-[1180px] flex-col items-start gap-9 px-4 desk:flex-row desk:px-10">
        <ShopFilters
          categoria={categoria}
          disponibilidade={disponibilidade}
          onCategoria={(valor) => aplicarFiltro({ categoria: valor })}
          onDisponibilidade={(valor) => aplicarFiltro({ disponibilidade: valor })}
        />

        <div className="w-full min-w-0 flex-1">
          {partes.length > 0 && <ActiveFilter rotulo={`Filtrando: ${partes.join(' · ')} — ${total}`} onLimpar={limpar} />}
          <ProductGrid produtos={visiveis} />
          {visiveis.length === 0 && (
            <EmptyState
              icone="🔎"
              data-h="H9 Vazio com solução"
              acoes={
                <>
                  <Button variant="ghost" onClick={limpar}>
                    Ver todos os produtos
                  </Button>
                  <Button onClick={() => abrirWhatsApp(`perguntar sobre ${categoria || 'o produto'}`)}>
                    💬 Perguntar no WhatsApp
                  </Button>
                </>
              }
            >
              Ainda não temos produtos de <strong>{categoria || 'esse filtro'}</strong> cadastrados no site, mas a
              loja física pode ter.
            </EmptyState>
          )}
        </div>
      </div>
    </PageTemplate>
  )
}
