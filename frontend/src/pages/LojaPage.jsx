import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import Checkbox from '../components/atoms/Checkbox'
import FilterGroup from '../components/molecules/FilterGroup'
import FiltroPreco from '../components/molecules/FiltroPreco'
import Paginacao from '../components/molecules/Paginacao'
import SecaoFiltro from '../components/molecules/SecaoFiltro'
import CatalogoLayout from '../components/organisms/CatalogoLayout'
import GradeItens from '../components/organisms/GradeItens'
import PageTemplate from '../components/templates/PageTemplate'
import { CATEGORIAS_COM_AGUA, faixasPreco, tiposAgua } from '../data/categorias'
import { descricaoCategoria } from '../data/glossario'
import useConsulta from '../hooks/useConsulta'
import useDestaque from '../hooks/useDestaque'
import useFiltrosUrl from '../hooks/useFiltrosUrl'
import { listarProdutos } from '../services/catalogo'
import useCategorias from '../hooks/useCategorias'
import CategoriasStatus from '../components/molecules/CategoriasStatus'
import { rotuloPreco } from '../utils/catalogo'
import { ROTAS, urlCategoria } from '../utils/rotas'

const POR_PAGINA = 9
const CHAVES = ['categoria', 'agua', 'min', 'max', 'preco', 'disponibilidade', 'ordem', 'busca', 'pagina']

// Filtros da Loja (itens 6, 7 e 37): categoria, tipo de água, preço e "só em estoque", tudo na URL.
// Links antigos continuam valendo: ?preco=ate-50, ?disponibilidade=out e ?ordem=z-a.
export default function LojaPage() {
  const [f, aplicar, limpar] = useFiltrosUrl(CHAVES)
  const { dados, carregando, erro, recarregar } = useConsulta(() => listarProdutos({ ...f, limite: POR_PAGINA }), [JSON.stringify(f)])
  const consultaCategorias = useCategorias()
  const categorias = consultaCategorias.dados ?? []
  const categoria = categorias.find((c) => c.slug === f.categoria || c.nome === f.categoria)
  const categoriaNome = categoria?.nome ?? f.categoria
  useDestaque()

  const { pagina = 1, totalPaginas = 1, itens = [], total = 0 } = dados ?? {}
  // Tipo de água só existe na ficha de algumas categorias; nas outras o filtro some (e sai da URL ao trocar)
  const aguaSeAplica = !f.categoria || CATEGORIAS_COM_AGUA.includes(categoria?.slug ?? f.categoria)
  const agua = tiposAgua.find((a) => a.valor === f.agua || (f.agua === 'marinho' && a.valor === 'salgada'))
  const preco = rotuloPreco(f, faixasPreco)
  const disponibilidade = { in: 'Em estoque', out: 'Esgotados' }[f.disponibilidade]

  const ativos = [
    categoriaNome && { id: 'categoria', rotulo: categoriaNome, onRemover: () => aplicar({ categoria: '' }) },
    agua && { id: 'agua', rotulo: agua.rotulo, onRemover: () => aplicar({ agua: '' }) },
    preco && { id: 'preco', rotulo: preco, onRemover: () => aplicar({ min: '', max: '', preco: '' }) },
    disponibilidade && { id: 'disponibilidade', rotulo: disponibilidade, onRemover: () => aplicar({ disponibilidade: '' }) },
    f.busca.trim() && { id: 'busca', rotulo: `Busca: “${f.busca.trim()}”`, onRemover: () => aplicar({ busca: '' }) },
  ].filter(Boolean)

  // Peixes têm página própria (filtros da ficha técnica). Por isso NÃO são uma opção do grupo: com as setas do
  // teclado, passar pela opção mudaria de página sem o usuário pedir (WCAG 3.2.2). Viram um link abaixo da lista.
  const opcoesCategoria = categorias.filter((c) => c.slug !== 'peixes' || f.categoria === 'peixes')
  const temPeixes = categorias.some((c) => c.slug === 'peixes')
  const escolherCategoria = (v) => {
    aplicar({ categoria: v, ...(v && !CATEGORIAS_COM_AGUA.includes(v) ? { agua: '' } : {}) })
  }

  const filtros = (
    <>
      <SecaoFiltro valor="categoria" titulo="Categoria" resumo={categoriaNome}>
        <CategoriasStatus {...consultaCategorias} />
        <FilterGroup
          titulo="Categoria"
          legendaOculta
          nome="categoria"
          limite={6}
          itens={[{ valor: '', rotulo: 'Todas as categorias' }, ...opcoesCategoria.map((c) => ({ valor: c.slug, rotulo: c.nome }))]}
          ativo={categoria?.slug ?? f.categoria}
          onSelecionar={escolherCategoria}
        />
        {temPeixes && (
          <Link
            to={urlCategoria('peixes')}
            className="mt-2 flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border px-3 text-pequeno font-semibold text-primary-text hover:bg-surface-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-text"
          >
            <span>
              Procurando peixes?
              <span className="block text-legenda font-normal text-text-muted">Veja a página de peixes, com filtros por temperamento e dificuldade.</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
          </Link>
        )}
      </SecaoFiltro>
      {aguaSeAplica && (
        <SecaoFiltro valor="agua" titulo="Tipo de água" resumo={agua?.rotulo}>
          <FilterGroup
            titulo="Tipo de água"
            legendaOculta
            nome="agua"
            variante="pilulas"
            itens={[{ valor: '', rotulo: 'Todas' }, ...tiposAgua.map((a) => ({ valor: a.valor, rotulo: a.curto }))]}
            ativo={agua?.valor ?? ''}
            onSelecionar={(v) => aplicar({ agua: v })}
          />
          <p className="mt-2 text-legenda text-text-muted">
            Vale para peixes, aquários, rações, condicionadores e decorações. Água salobra: só peixes.
          </p>
        </SecaoFiltro>
      )}
      <SecaoFiltro valor="preco" titulo="Preço" resumo={preco}>
        <FiltroPreco min={f.min} max={f.max} preco={f.preco} onAplicar={(v) => aplicar(v)} />
      </SecaoFiltro>
      <SecaoFiltro valor="disponibilidade" titulo="Disponibilidade" resumo={disponibilidade}>
        <EstoqueCheckbox ativo={f.disponibilidade === 'in'} onMudar={(sim) => aplicar({ disponibilidade: sim ? 'in' : '' })} />
      </SecaoFiltro>
    </>
  )

  // Seções abertas de início: categoria, água (só pílulas) e preço; disponibilidade abre se já tiver filtro (ex.: link compartilhado)
  const secoesAbertas = ['categoria', 'agua', 'preco', ...(disponibilidade ? ['disponibilidade'] : [])]

  const dica = agua && f.categoria
    ? `Nem todo produto de ${categoriaNome} tem tipo de água informado: tente tirar o filtro “${agua.rotulo}”.`
    : preco
      ? 'Tente uma faixa de preço maior ou remova o filtro de preço.'
      : f.disponibilidade === 'in'
        ? 'Desmarque “Só em estoque” para ver também os esgotados (você pode pedir aviso quando chegar).'
        : undefined

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
        secoesAbertas={secoesAbertas}
        ativos={ativos}
        onLimpar={limpar}
        total={erro ? 0 : total}
        carregando={carregando}
        unidade={{ singular: 'produto', plural: 'produtos' }}
      >
        <GradeItens itens={itens} carregando={carregando} erro={erro} onRecarregar={recarregar} onLimpar={limpar} dica={dica} assuntoWhatsApp={f.busca || f.categoria || 'um produto'} />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={(n) => aplicar({ pagina: String(n) })} />
      </CatalogoLayout>
    </PageTemplate>
  )
}

function EstoqueCheckbox({ ativo, onMudar }) {
  // id próprio por instância: o mesmo controle aparece na lateral e na gaveta do celular
  const id = `estoque-${useId()}`
  return (
    <Checkbox id={id} checked={ativo} onChange={(e) => onMudar(e.target.checked)}>
      Só em estoque
      <span className="block text-legenda text-text-muted">Esconde os itens esgotados.</span>
    </Checkbox>
  )
}
