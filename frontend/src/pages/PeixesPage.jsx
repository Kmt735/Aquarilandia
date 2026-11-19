import { useState } from 'react'
import Checkbox from '../components/atoms/Checkbox'
import FilterGroup from '../components/molecules/FilterGroup'
import FiltroPreco from '../components/molecules/FiltroPreco'
import Paginacao from '../components/molecules/Paginacao'
import SecaoFiltro from '../components/molecules/SecaoFiltro'
import CatalogoLayout from '../components/organisms/CatalogoLayout'
import CompareBar, { MAX_COMPARAR } from '../components/organisms/CompareBar'
import GradeItens from '../components/organisms/GradeItens'
import PageTemplate from '../components/templates/PageTemplate'
import { faixasPreco } from '../data/categorias'
import useConsulta from '../hooks/useConsulta'
import useDestaque from '../hooks/useDestaque'
import useFiltrosUrl from '../hooks/useFiltrosUrl'
import { listarPeixes } from '../services/catalogo'
import { TEMPERAMENTO, DIFICULDADE } from '../services/catalogo-mapeamento'
import { rotuloPreco } from '../utils/catalogo'
import { ROTAS } from '../utils/rotas'

const POR_PAGINA = 9
const AGUA = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'doce', rotulo: 'Água doce' },
  { valor: 'marinho', rotulo: 'Água salgada' },
  { valor: 'salobra', rotulo: 'Água salobra' },
]
const DISPONIBILIDADE = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'disponivel', rotulo: 'Disponível' },
  { valor: 'esgotado', rotulo: 'Esgotado' },
]

export default function PeixesPage() {
  const [f, aplicar, limpar] = useFiltrosUrl(['agua', 'temperamento', 'dificuldade', 'disponibilidade', 'min', 'max', 'preco', 'ordem', 'busca', 'pagina'])
  const { dados, carregando, erro, recarregar } = useConsulta(() => listarPeixes({ ...f, limite: POR_PAGINA }), [JSON.stringify(f)])
  const [comparar, setComparar] = useState([])
  useDestaque()

  const { pagina = 1, totalPaginas = 1, itens = [], total = 0 } = dados ?? {}
  const opcao = (valores, todosRotulo) => [{ valor: '', rotulo: todosRotulo }, ...Object.entries(valores).map(([valor, rotulo]) => ({ valor, rotulo }))]
  const agua = AGUA.find((a) => a.valor === f.agua && a.valor)?.rotulo
  const preco = rotuloPreco(f, faixasPreco)
  const disponibilidade = DISPONIBILIDADE.find((d) => d.valor === f.disponibilidade && d.valor)?.rotulo

  const ativos = [
    agua && { id: 'agua', rotulo: agua, onRemover: () => aplicar({ agua: '' }) },
    TEMPERAMENTO[f.temperamento] && { id: 'temperamento', rotulo: TEMPERAMENTO[f.temperamento], onRemover: () => aplicar({ temperamento: '' }) },
    DIFICULDADE[f.dificuldade] && { id: 'dificuldade', rotulo: DIFICULDADE[f.dificuldade], onRemover: () => aplicar({ dificuldade: '' }) },
    disponibilidade && { id: 'disponibilidade', rotulo: disponibilidade, onRemover: () => aplicar({ disponibilidade: '' }) },
    preco && { id: 'preco', rotulo: preco, onRemover: () => aplicar({ min: '', max: '', preco: '' }) },
    f.busca.trim() && { id: 'busca', rotulo: `Busca: “${f.busca.trim()}”`, onRemover: () => aplicar({ busca: '' }) },
  ].filter(Boolean)

  const filtros = (
    <>
      <SecaoFiltro valor="agua" titulo="Tipo de água" resumo={agua}>
        <FilterGroup titulo="Tipo de água" legendaOculta nome="agua" variante="pilulas" itens={AGUA} ativo={f.agua} onSelecionar={(v) => aplicar({ agua: v })} />
      </SecaoFiltro>
      <SecaoFiltro valor="temperamento" titulo="Temperamento" resumo={TEMPERAMENTO[f.temperamento]}>
        <FilterGroup titulo="Temperamento" legendaOculta nome="temperamento" itens={opcao(TEMPERAMENTO, 'Todos')} ativo={f.temperamento} onSelecionar={(v) => aplicar({ temperamento: v })} />
      </SecaoFiltro>
      <SecaoFiltro valor="dificuldade" titulo="Dificuldade" resumo={DIFICULDADE[f.dificuldade]}>
        <FilterGroup titulo="Dificuldade" legendaOculta nome="dificuldade" itens={opcao(DIFICULDADE, 'Todas')} ativo={f.dificuldade} onSelecionar={(v) => aplicar({ dificuldade: v })} />
      </SecaoFiltro>
      <SecaoFiltro valor="preco" titulo="Preço" resumo={preco}>
        <FiltroPreco min={f.min} max={f.max} preco={f.preco} onAplicar={(v) => aplicar(v)} />
      </SecaoFiltro>
      <SecaoFiltro valor="disponibilidade" titulo="Disponibilidade" resumo={disponibilidade}>
        <FilterGroup titulo="Disponibilidade" legendaOculta nome="disponibilidade" variante="pilulas" itens={DISPONIBILIDADE} ativo={f.disponibilidade} onSelecionar={(v) => aplicar({ disponibilidade: v })} />
      </SecaoFiltro>
    </>
  )
  const secoesAbertas = ['agua', 'temperamento', ...['dificuldade', 'preco', 'disponibilidade'].filter((c) => ativos.some((a) => a.id === c))]

  const alternarComparar = (id) =>
    setComparar((lista) => (lista.includes(id) ? lista.filter((x) => x !== id) : lista.length < MAX_COMPARAR ? [...lista, id] : lista))

  return (
    <PageTemplate
      titulo="Peixes"
      descricao="Cada peixe mostra temperamento, aquário mínimo e temperatura. Peixes vivos são entregues só em São João del Rei."
      trilha={[{ rotulo: 'Início', to: ROTAS.inicio }, { rotulo: 'Loja', to: ROTAS.loja }, { rotulo: 'Peixes' }]}
    >
      <CatalogoLayout
        busca={f.busca}
        onBusca={(v) => aplicar({ busca: v }, { replace: true })}
        rotuloBusca="Buscar peixes"
        ordem={f.ordem || null}
        onOrdem={(v) => aplicar({ ordem: v })}
        filtros={filtros}
        secoesAbertas={secoesAbertas}
        ativos={ativos}
        onLimpar={limpar}
        total={erro ? 0 : total}
        carregando={carregando}
        unidade={{ singular: 'peixe', plural: 'peixes' }}
      >
        <GradeItens
          itens={itens}
          carregando={carregando}
          erro={erro}
          onRecarregar={recarregar}
          onLimpar={limpar}
          assuntoWhatsApp={f.busca || 'os peixes disponíveis'}
          renderExtra={(item) => {
            const marcado = comparar.includes(item.id)
            return (
              <div className="mt-1 px-1">
                <Checkbox
                  id={`comparar-${item.id}`}
                  checked={marcado}
                  disabled={!marcado && comparar.length >= MAX_COMPARAR}
                  onChange={() => alternarComparar(item.id)}
                >
                  Comparar {item.nome}
                </Checkbox>
              </div>
            )
          }}
        />
        <Paginacao pagina={pagina} totalPaginas={totalPaginas} onMudar={(n) => aplicar({ pagina: String(n) })} />
      </CatalogoLayout>
      <CompareBar selecionados={comparar} onLimpar={() => setComparar([])} />
    </PageTemplate>
  )
}
