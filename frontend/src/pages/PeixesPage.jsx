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
import { opcoesDe, ordenarItens, paginar } from '../utils/catalogo'
import { normalizar } from '../utils/format'
import { ROTAS } from '../utils/rotas'

const POR_PAGINA = 9
const AGUA = [
  { valor: '', rotulo: 'Doce e salgada' },
  { valor: 'doce', rotulo: 'Água doce' },
  { valor: 'salgada', rotulo: 'Água salgada' },
]
const DISPONIBILIDADE = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'disponivel', rotulo: 'Disponível' },
  { valor: 'esgotado', rotulo: 'Esgotado' },
]

export default function PeixesPage() {
  const [f, aplicar, limpar] = useFiltrosUrl(['agua', 'temperamento', 'dificuldade', 'disponibilidade', 'preco', 'ordem', 'busca', 'pagina'])
  const { dados, carregando, erro, recarregar } = useConsulta(listarPeixes)
  const [comparar, setComparar] = useState([])
  useDestaque()

  const todos = dados ?? []
  const faixa = faixasPreco.find((x) => x.valor === f.preco)
  const termo = normalizar(f.busca.trim())
  const filtrados = todos.filter(
    (p) =>
      (!f.agua || p.filtros.agua === f.agua) &&
      (!f.temperamento || p.filtros.temperamento === f.temperamento) &&
      (!f.dificuldade || p.filtros.dificuldade === f.dificuldade) &&
      (!f.disponibilidade || p.disponibilidade === f.disponibilidade) &&
      (!faixa || (p.preco >= faixa.min && p.preco < faixa.max)) &&
      (!termo || normalizar(`${p.nome} ${p.cientifico} ${p.combinaCom.join(' ')}`).includes(termo)),
  )
  const { pagina, totalPaginas, itens } = paginar(ordenarItens(filtrados, f.ordem), f.pagina, POR_PAGINA)

  const opcao = (valores, todosRotulo) => [{ valor: '', rotulo: todosRotulo }, ...valores.map((v) => ({ valor: v, rotulo: v }))]
  const ativos = [
    AGUA.find((a) => a.valor === f.agua && a.valor)?.rotulo,
    f.temperamento,
    f.dificuldade,
    DISPONIBILIDADE.find((d) => d.valor === f.disponibilidade && d.valor)?.rotulo,
    faixa?.rotulo,
    f.busca.trim() && `“${f.busca.trim()}”`,
  ].filter(Boolean)

  const filtros = (
    <>
      <FilterGroup titulo="Tipo de água" nome="agua" itens={AGUA} ativo={f.agua} onSelecionar={(v) => aplicar({ agua: v })} />
      <FilterGroup titulo="Temperamento" nome="temperamento" itens={opcao(opcoesDe(todos, (p) => p.filtros.temperamento), 'Todos')} ativo={f.temperamento} onSelecionar={(v) => aplicar({ temperamento: v })} />
      <FilterGroup titulo="Dificuldade" nome="dificuldade" itens={opcao(opcoesDe(todos, (p) => p.filtros.dificuldade), 'Todas')} ativo={f.dificuldade} onSelecionar={(v) => aplicar({ dificuldade: v })} />
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
        total={filtrados.length}
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
