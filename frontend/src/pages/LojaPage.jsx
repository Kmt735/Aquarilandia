import { useNavigate } from 'react-router'
import FilterGroup from '../components/molecules/FilterGroup'
import Paginacao from '../components/molecules/Paginacao'
import CatalogoLayout from '../components/organisms/CatalogoLayout'
import GradeItens from '../components/organisms/GradeItens'
import PageTemplate from '../components/templates/PageTemplate'
import { faixasPreco } from '../data/categorias'
import { descricaoCategoria } from '../data/glossario'
import useConsulta from '../hooks/useConsulta'
import useDestaque from '../hooks/useDestaque'
import useFiltrosUrl from '../hooks/useFiltrosUrl'
import { listarProdutos } from '../services/catalogo'
import useCategorias from '../hooks/useCategorias'
import CategoriasStatus from '../components/molecules/CategoriasStatus'
import { ROTAS, urlCategoria } from '../utils/rotas'

const POR_PAGINA = 9
const DISPONIBILIDADE = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'in', rotulo: 'Disponível' },
  { valor: 'out', rotulo: 'Esgotado' },
]

export default function LojaPage() {
  const [f, aplicar, limpar] = useFiltrosUrl(['categoria', 'disponibilidade', 'preco', 'ordem', 'busca', 'pagina'])
  const { dados, carregando, erro, recarregar } = useConsulta(() => listarProdutos({ ...f, limite: POR_PAGINA }), [JSON.stringify(f)])
  const consultaCategorias = useCategorias()
  const categorias = consultaCategorias.dados ?? []
  const categoria = categorias.find((c) => c.slug === f.categoria || c.nome === f.categoria)
  const categoriaNome = categoria?.nome ?? f.categoria
  const navigate = useNavigate()
  useDestaque()

  const faixa = faixasPreco.find((x) => x.valor === f.preco)
  const { pagina = 1, totalPaginas = 1, itens = [], total = 0 } = dados ?? {}

  const ativos = [
    categoriaNome,
    DISPONIBILIDADE.find((d) => d.valor === f.disponibilidade && d.valor)?.rotulo,
    faixa?.rotulo,
    f.busca.trim() && `“${f.busca.trim()}”`,
  ].filter(Boolean)

  const filtros = (
    <>
      <CategoriasStatus {...consultaCategorias} />
      <FilterGroup
        titulo="Categoria"
        nome="categoria"
        itens={[{ valor: '', rotulo: 'Todas as categorias' }, ...categorias.map((c) => ({ valor: c.slug, rotulo: c.nome }))]}
        descricoes={Object.fromEntries(categorias.map((c) => [c.slug, descricaoCategoria[c.nome]]))}
        ativo={categoria?.slug ?? f.categoria}
        // Peixes têm página própria, com os filtros da ficha técnica
        onSelecionar={(v) => (v === 'peixes' ? navigate(urlCategoria(v)) : aplicar({ categoria: v }))}
      />
      <FilterGroup titulo="Disponibilidade" nome="disponibilidade" itens={DISPONIBILIDADE} ativo={f.disponibilidade} onSelecionar={(v) => aplicar({ disponibilidade: v })} />
      <FilterGroup
        titulo="Preço"
        nome="preco"
        itens={[{ valor: '', rotulo: 'Qualquer preço' }, ...faixasPreco]}
        ativo={f.preco}
        onSelecionar={(v) => aplicar({ preco: v })}
      />
    </>
  )

  return (
    <PageTemplate
      titulo={categoriaNome || 'Loja'}
      descricao={f.categoria ? descricaoCategoria[categoriaNome] : 'Tudo para montar e cuidar do seu aquário.'}
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, ...(f.categoria ? [{ rotulo: 'Loja', to: ROTAS.loja }, { rotulo: categoriaNome }] : [{ rotulo: 'Loja' }])]}
    >
      <CatalogoLayout
        busca={f.busca}
        onBusca={(v) => aplicar({ busca: v }, { replace: true })}
        rotuloBusca="Buscar na loja"
        ordem={f.ordem || null}
        onOrdem={(v) => aplicar({ ordem: v })}
        filtros={filtros}
        ativos={ativos}
        onLimpar={limpar}
        total={erro ? 0 : total}
        carregando={carregando}
        unidade={{ singular: 'produto', plural: 'produtos' }}
      >
        <GradeItens itens={itens} carregando={carregando} erro={erro} onRecarregar={recarregar} onLimpar={limpar} assuntoWhatsApp={f.busca || f.categoria || 'um produto'} />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={(n) => aplicar({ pagina: String(n) })} />
      </CatalogoLayout>
    </PageTemplate>
  )
}
