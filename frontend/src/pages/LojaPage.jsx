import FilterGroup from '../components/molecules/FilterGroup'
import Paginacao from '../components/molecules/Paginacao'
import CatalogoLayout from '../components/organisms/CatalogoLayout'
import GradeItens from '../components/organisms/GradeItens'
import PageTemplate from '../components/templates/PageTemplate'
import { categorias, faixasPreco } from '../data/categorias'
import { descricaoCategoria } from '../data/glossario'
import useConsulta from '../hooks/useConsulta'
import useDestaque from '../hooks/useDestaque'
import useFiltrosUrl from '../hooks/useFiltrosUrl'
import { listarProdutos } from '../services/catalogo'
import { ordenarItens, paginar } from '../utils/catalogo'
import { normalizar } from '../utils/format'
import { ROTAS } from '../utils/rotas'

const POR_PAGINA = 9
const DISPONIBILIDADE = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'in', rotulo: 'Disponível' },
  { valor: 'out', rotulo: 'Sob encomenda' },
]

export default function LojaPage() {
  const [f, aplicar, limpar] = useFiltrosUrl(['categoria', 'disponibilidade', 'preco', 'ordem', 'busca', 'pagina'])
  const { dados, carregando, erro, recarregar } = useConsulta(listarProdutos)
  useDestaque()

  const faixa = faixasPreco.find((x) => x.valor === f.preco)
  const termo = normalizar(f.busca.trim())
  const filtrados = (dados ?? []).filter(
    (p) =>
      (!f.categoria || p.categoria === f.categoria) &&
      (!f.disponibilidade || (f.disponibilidade === 'in') === (p.disponibilidade === 'disponivel')) &&
      (!faixa || (p.preco >= faixa.min && p.preco < faixa.max)) &&
      (!termo || normalizar(`${p.nome} ${p.categoria} ${p.descricao ?? ''}`).includes(termo)),
  )
  const { pagina, totalPaginas, itens } = paginar(ordenarItens(filtrados, f.ordem), f.pagina, POR_PAGINA)

  const ativos = [
    f.categoria,
    DISPONIBILIDADE.find((d) => d.valor === f.disponibilidade && d.valor)?.rotulo,
    faixa?.rotulo,
    f.busca.trim() && `“${f.busca.trim()}”`,
  ].filter(Boolean)

  const filtros = (
    <>
      <FilterGroup
        titulo="Categoria"
        nome="categoria"
        itens={[{ valor: '', rotulo: 'Todas as categorias' }, ...categorias.map((c) => ({ valor: c.nome, rotulo: c.nome }))]}
        descricoes={descricaoCategoria}
        ativo={f.categoria}
        onSelecionar={(v) => aplicar({ categoria: v })}
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
      titulo={f.categoria || 'Loja'}
      descricao={f.categoria ? descricaoCategoria[f.categoria] : 'Tudo para montar e cuidar do seu aquário.'}
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, ...(f.categoria ? [{ rotulo: 'Loja', to: ROTAS.loja }, { rotulo: f.categoria }] : [{ rotulo: 'Loja' }])]}
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
        total={filtrados.length}
        carregando={carregando}
        unidade={{ singular: 'produto', plural: 'produtos' }}
      >
        <GradeItens itens={itens} carregando={carregando} erro={erro} onRecarregar={recarregar} onLimpar={limpar} assuntoWhatsApp={f.busca || f.categoria || 'um produto'} />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={(n) => aplicar({ pagina: String(n) })} />
      </CatalogoLayout>
    </PageTemplate>
  )
}
