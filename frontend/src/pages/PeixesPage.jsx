import { useState } from 'react'
import Checkbox from '../components/atoms/Checkbox'
import FilterGroup from '../components/molecules/FilterGroup'
import Paginacao from '../components/molecules/Paginacao'
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
import { ROTAS } from '../utils/rotas'

const POR_PAGINA = 9
const AGUA = [
  { valor: '', rotulo: 'Todos os tipos' },
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
  const [f, aplicar, limpar] = useFiltrosUrl(['agua', 'temperamento', 'dificuldade', 'disponibilidade', 'preco', 'ordem', 'busca', 'pagina'])
  const { dados, carregando, erro, recarregar } = useConsulta(() => listarPeixes({ ...f, limite: POR_PAGINA }), [JSON.stringify(f)])
  const [comparar, setComparar] = useState([])
  useDestaque()

  const faixa = faixasPreco.find((x) => x.valor === f.preco)
  const { pagina = 1, totalPaginas = 1, itens = [], total = 0 } = dados ?? {}
  const opcao = (valores, todosRotulo) => [{ valor: '', rotulo: todosRotulo }, ...Object.entries(valores).map(([valor, rotulo]) => ({ valor, rotulo }))]

  const ativos = [
    AGUA.find((a) => a.valor === f.agua && a.valor)?.rotulo,
    TEMPERAMENTO[f.temperamento],
    DIFICULDADE[f.dificuldade],
    DISPONIBILIDADE.find((d) => d.valor === f.disponibilidade && d.valor)?.rotulo,
    faixa?.rotulo,
    f.busca.trim() && `“${f.busca.trim()}”`,
  ].filter(Boolean)

  const filtros = (
    <>
      <FilterGroup titulo="Tipo de água" nome="agua" itens={AGUA} ativo={f.agua} onSelecionar={(v) => aplicar({ agua: v })} />
      <FilterGroup titulo="Temperamento" nome="temperamento" itens={opcao(TEMPERAMENTO, 'Todos')} ativo={f.temperamento} onSelecionar={(v) => aplicar({ temperamento: v })} />
      <FilterGroup titulo="Dificuldade" nome="dificuldade" itens={opcao(DIFICULDADE, 'Todas')} ativo={f.dificuldade} onSelecionar={(v) => aplicar({ dificuldade: v })} />
      <FilterGroup titulo="Disponibilidade" nome="disponibilidade" itens={DISPONIBILIDADE} ativo={f.disponibilidade} onSelecionar={(v) => aplicar({ disponibilidade: v })} />
      <FilterGroup titulo="Preço" nome="preco" itens={[{ valor: '', rotulo: 'Qualquer preço' }, ...faixasPreco]} ativo={f.preco} onSelecionar={(v) => aplicar({ preco: v })} />
    </>
  )

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
