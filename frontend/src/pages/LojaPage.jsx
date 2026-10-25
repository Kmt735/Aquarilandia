import { useSearchParams } from 'react-router'
import { MessageCircle, SearchX } from 'lucide-react'
import Button from '../components/atoms/Button'
import ActiveFilter from '../components/molecules/ActiveFilter'
import CampoBuscaLoja from '../components/molecules/CampoBuscaLoja'
import EmptyState from '../components/molecules/EmptyState'
import OrdenarPor from '../components/molecules/OrdenarPor'
import ProductGrid from '../components/organisms/ProductGrid'
import ShopFilters from '../components/organisms/ShopFilters'
import PageTemplate from '../components/templates/PageTemplate'
import { disponibilidades, faixasPreco } from '../data/categorias'
import { produtos } from '../data/produtos'
import useDestaque from '../hooks/useDestaque'
import useWhatsApp from '../hooks/useWhatsApp'
import { normalizar } from '../utils/format'

const ordenadores = {
  'menor-preco': (a, b) => a.preco - b.preco,
  'maior-preco': (a, b) => b.preco - a.preco,
  'a-z': (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
}

export default function LojaPage() {
  const [params, setParams] = useSearchParams()
  const abrirWhatsApp = useWhatsApp()
  useDestaque()

  // Tudo vive na URL (/loja?categoria=Filtros&preco=ate-50&ordem=menor-preco&busca=bomba)
  const categoria = params.get('categoria')
  const disponibilidade = params.get('disponibilidade')
  const preco = params.get('preco')
  const ordem = ordenadores[params.get('ordem')] ? params.get('ordem') : null
  const busca = params.get('busca') ?? ''
  const termo = busca.trim()

  const aplicarFiltro = (mudanca, opcoes) => {
    const proximo = { categoria, disponibilidade, preco, ordem, busca, ...mudanca }
    setParams(Object.fromEntries(Object.entries(proximo).filter(([, v]) => v)), opcoes)
  }
  // Ao digitar, troca a entrada do histórico em vez de criar uma por letra
  const mudarBusca = (texto) => aplicarFiltro({ busca: texto }, { replace: true })
  const limpar = () => setParams({})

  const faixa = faixasPreco.find((f) => f.valor === preco)

  const filtrados = produtos.filter(
    (p) =>
      (!categoria || p.categoria === categoria) &&
      (!disponibilidade || (disponibilidade === 'in') === p.emEstoque) &&
      (!faixa || (p.preco >= faixa.min && p.preco < faixa.max)) &&
      (!termo || normalizar(`${p.nome} ${p.categoria} ${p.descricao ?? ''}`).includes(normalizar(termo))),
  )
  const visiveis = ordem ? [...filtrados].sort(ordenadores[ordem]) : filtrados

  const partes = [
    categoria,
    disponibilidades.find((d) => d.valor === disponibilidade)?.rotulo,
    faixa?.rotulo,
    termo && `“${termo}”`,
  ].filter(Boolean)
  const total = `${visiveis.length} ${visiveis.length === 1 ? 'produto' : 'produtos'}`

  return (
    <PageTemplate eyebrow="Loja" titulo="Tudo pro seu aquário">
      <div className="mx-auto my-12 flex max-w-[1200px] flex-col items-start gap-10 px-4 sm:px-6 desk:my-16 desk:flex-row desk:px-10">
        <ShopFilters
          categoria={categoria}
          disponibilidade={disponibilidade}
          preco={preco}
          onCategoria={(valor) => aplicarFiltro({ categoria: valor })}
          onDisponibilidade={(valor) => aplicarFiltro({ disponibilidade: valor })}
          onPreco={(valor) => aplicarFiltro({ preco: valor })}
        />

        <div className="w-full min-w-0 flex-1">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <CampoBuscaLoja valor={busca} onChange={mudarBusca} />
            <OrdenarPor valor={ordem} onChange={(valor) => aplicarFiltro({ ordem: valor })} />
          </div>
          {partes.length > 0 && <ActiveFilter rotulo={`Filtrando: ${partes.join(' · ')} — ${total}`} onLimpar={limpar} />}
          <ProductGrid produtos={visiveis} />
          {visiveis.length === 0 && (
            <EmptyState
              icone={<SearchX />}
              acoes={
                <>
                  <Button variant="ghost" onClick={limpar}>
                    Ver todos os produtos
                  </Button>
                  <Button onClick={() => abrirWhatsApp(`perguntar sobre ${termo || categoria || 'o produto'}`)}>
                    <MessageCircle aria-hidden="true" />
                    Perguntar no WhatsApp
                  </Button>
                </>
              }
            >
              {termo ? (
                <>
                  Não encontramos <strong>“{termo}”</strong>
                  {categoria && (
                    <>
                      {' '}
                      em <strong>{categoria}</strong>
                    </>
                  )}
                  . Confira a grafia ou tente algo mais geral. A loja física pode ter o item.
                </>
              ) : (
                <>
                  Ainda não temos produtos de <strong>{categoria || 'esse filtro'}</strong> cadastrados no site, mas a
                  loja física pode ter.
                </>
              )}
            </EmptyState>
          )}
        </div>
      </div>
    </PageTemplate>
  )
}