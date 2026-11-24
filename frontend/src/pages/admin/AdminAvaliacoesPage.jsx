import { useState } from 'react'
import { Link } from 'react-router'
import { Check, EyeOff, MessageSquareText, Trash2 } from 'lucide-react'
import Button from '../../components/atoms/Button'
import EstrelasExibicao from '../../components/atoms/EstrelasExibicao'
import Skeleton from '../../components/atoms/Skeleton'
import Aviso from '../../components/molecules/Aviso'
import EmptyState from '../../components/molecules/EmptyState'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import Paginacao from '../../components/molecules/Paginacao'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ENCONTROU, MOTIVOS_VISITA, ROTULO_NOTA, STATUS_AVALIACAO } from '../../data/avaliacao-site'
import useConsulta from '../../hooks/useConsulta'
import useToast from '../../hooks/useToast'
import { excluirAvaliacao, listarAvaliacoesAdmin, mudarStatusAvaliacao, resumoAvaliacoesAdmin } from '../../services/admin-avaliacoes'
import { formatarDataHora } from '../../utils/format'
import { urlPeixe, urlProduto } from '../../utils/rotas'

const POR_PAGINA = 20
const numero = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const FILTROS_STATUS = { pendente: 'Pendentes', aprovada: 'Aprovadas', oculta: 'Ocultas', '': 'Todas' }
const COR_STATUS = { pendente: 'aviso', aprovada: 'sucesso', oculta: 'secondary' }
const ORIGEM = { aba: 'Aba lateral', rodape: 'Rodapé', 'pos-compra': 'Depois da compra' }
const rotuloDe = (opcoes, v) => opcoes.find(([valor]) => valor === v)?.[1]
const classePilula = 'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold'
const classeSelect = 'block h-11 rounded-lg border border-border-control bg-surface px-3 text-base'

// Moderação das avaliações de produtos/peixes e do site. Nada aparece no site antes de "Aprovar"
// (o backend decide o status inicial: avaliacao.config.ts)
export default function AdminAvaliacoesPage() {
  const resumo = useConsulta(() => resumoAvaliacoesAdmin(), [])
  const [aba, setAba] = useState('produtos')

  return <section aria-labelledby="titulo-avaliacoes">
    <h2 id="titulo-avaliacoes" className="text-h2">Avaliações</h2>
    <p className="mb-6 mt-2 text-text-muted">Confira o que os visitantes escreveram. Só as avaliações aprovadas aparecem no site; ocultar tira do site sem apagar.</p>

    <ResumoAvaliacoes consulta={resumo} />

    <Tabs value={aba} onValueChange={setAba} className="mt-8">
      <TabsList aria-label="Tipo de avaliação" className="mb-5 flex-wrap gap-2">
        {[['produtos', 'Produtos e peixes', resumo.dados?.produtos?.pendentes], ['site', 'Site', resumo.dados?.site?.pendentes]].map(([valor, texto, pend]) => (
          <TabsTrigger key={valor} value={valor} className={`${classePilula} data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-border-control hover:bg-surface-tint`}>
            {texto}
            {pend > 0 && <Badge variant="aviso" className="px-1.5">{pend}<span className="sr-only"> pendentes</span></Badge>}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="produtos"><ListaAvaliacoes tipo="produtos" aoModerar={resumo.recarregar} /></TabsContent>
      <TabsContent value="site"><ListaAvaliacoes tipo="site" aoModerar={resumo.recarregar} /></TabsContent>
    </Tabs>
  </section>
}

function ResumoAvaliacoes({ consulta }) {
  const cartao = 'rounded-card border border-border-strong bg-surface p-5'
  if (consulta.carregando) return <div className="grid gap-4 sm:grid-cols-3" aria-busy="true"><span className="sr-only">Carregando resumo…</span>{[1, 2, 3].map((n) => <Skeleton key={n} className="h-32 rounded-card" />)}</div>
  if (consulta.erro) return <ErroCompacto onTentar={consulta.recarregar}>{consulta.erro.message}</ErroCompacto>
  const { site, produtos, pendentes } = consulta.dados
  return <ul className="grid gap-4 sm:grid-cols-3" aria-label="Resumo das avaliações">
    <li className={cartao}>
      <p className="text-pequeno font-semibold text-text-muted">Nota média do site</p>
      {site.total - site.ocultas > 0 ? <>
        <p className="font-display text-h1 font-extrabold tabular-nums">{numero.format(site.media)}<span className="text-h4 text-text-muted"> de 5</span></p>
        <EstrelasExibicao nota={site.media} />
        <p className="mt-1 text-legenda text-text-muted">Sem contar as ocultas</p>
      </> : <p className="mt-2 text-text-muted">Ainda sem avaliações do site.</p>}
    </li>
    <li className={cartao}>
      <p className="text-pequeno font-semibold text-text-muted">Avaliações recebidas</p>
      <p className="font-display text-h1 font-extrabold tabular-nums">{site.total + produtos.total}</p>
      <p className="text-pequeno text-text-muted">{produtos.total} de produtos e peixes · {site.total} do site</p>
    </li>
    <li className={cartao}>
      <p className="text-pequeno font-semibold text-text-muted">Esperando conferência</p>
      <p className={`font-display text-h1 font-extrabold tabular-nums ${pendentes ? 'text-warning-text' : ''}`}>{pendentes}</p>
      <p className="text-pequeno text-text-muted">{pendentes ? 'Aprove ou oculte para tirar da fila.' : 'Nenhuma pendente. Tudo em dia!'}</p>
    </li>
  </ul>
}

function ListaAvaliacoes({ tipo, aoModerar }) {
  const [status, setStatus] = useState('pendente')
  const [nota, setNota] = useState('')
  const [pagina, setPagina] = useState(1)
  const consulta = useConsulta(() => listarAvaliacoesAdmin(tipo, { status, nota, pagina, limite: POR_PAGINA }), [tipo, status, nota, pagina])
  const idNota = `filtro-nota-${tipo}`
  const depoisDeModerar = () => { consulta.recarregar(); aoModerar() }

  return <>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div role="group" aria-label="Situação da avaliação" className="flex flex-wrap gap-2">
        {Object.entries(FILTROS_STATUS).map(([valor, texto]) => <button key={valor} type="button" aria-pressed={status === valor}
          onClick={() => { setStatus(valor); setPagina(1) }}
          className={`${classePilula} ${status === valor ? 'border-primary bg-primary text-primary-foreground' : 'border-border-control hover:bg-surface-tint'}`}>{texto}</button>)}
      </div>
      <div>
        <label htmlFor={idNota} className="mb-1 block text-pequeno font-semibold">Nota</label>
        <select id={idNota} className={classeSelect} value={nota} onChange={(e) => { setNota(e.target.value); setPagina(1) }}>
          <option value="">Todas as notas</option>
          {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'estrela' : 'estrelas'} · {ROTULO_NOTA[n]}</option>)}
        </select>
      </div>
    </div>

    {consulta.carregando ? <p role="status">Carregando avaliações…</p>
      : consulta.erro ? <ErroCompacto onTentar={consulta.recarregar}>{consulta.erro.message}</ErroCompacto>
        : <>
          <p className="mb-3 text-sm text-text-muted" aria-live="polite">{consulta.dados.total} avaliação(ões) encontrada(s)</p>
          {consulta.dados.total === 0
            ? <EmptyState icone={<MessageSquareText aria-hidden="true" />} titulo={status === 'pendente' ? 'Nenhuma avaliação esperando' : 'Nenhuma avaliação encontrada'}>
              {status === 'pendente' ? 'Quando alguém avaliar, a avaliação aparece aqui para você conferir.' : 'Tente outra situação ou nota.'}
            </EmptyState>
            : <ul className="grid gap-4 lg:grid-cols-2">
              {consulta.dados.dados.map((a) => <CartaoAvaliacao key={a.id} tipo={tipo} avaliacao={a} aoModerar={depoisDeModerar} />)}
            </ul>}
          <Paginacao pagina={pagina} totalPaginas={Math.ceil(consulta.dados.total / POR_PAGINA)} onMudar={setPagina} />
        </>}
  </>
}

function CartaoAvaliacao({ tipo, avaliacao: a, aoModerar }) {
  const { toast } = useToast()
  const [ocupado, setOcupado] = useState(null)
  const [erro, setErro] = useState(null)
  const descricao = tipo === 'produtos' ? `a avaliação de ${a.produtoNome}` : 'a avaliação do site'

  const agir = async (acao) => {
    if (ocupado) return
    if (acao === 'excluir' && !window.confirm(`Excluir ${descricao}? Isso não pode ser desfeito.`)) return
    setOcupado(acao); setErro(null)
    try {
      if (acao === 'excluir') await excluirAvaliacao(tipo, a.id)
      else await mudarStatusAvaliacao(tipo, a.id, acao)
      toast({ excluir: 'Avaliação excluída.', aprovada: 'Avaliação aprovada: já aparece no site.', oculta: 'Avaliação oculta: saiu do site.' }[acao], { tipo: 'sucesso' })
      aoModerar()
    } catch (err) {
      setErro(err); setOcupado(null)
    }
  }

  return <li className="flex flex-col rounded-card border border-border-strong bg-surface p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <span className="inline-flex items-center gap-2">
        <EstrelasExibicao nota={a.nota} className="size-4" />
        <span className="text-pequeno font-bold">{a.nota} de 5<span className="sr-only">, {ROTULO_NOTA[a.nota]}</span></span>
      </span>
      <Badge variant={COR_STATUS[a.status]}>{STATUS_AVALIACAO[a.status]}</Badge>
    </div>

    {tipo === 'produtos' ? (
      <p className="font-semibold">
        <Link className="text-primary-text underline underline-offset-4" to={a.produtoCategoria === 'peixes' ? urlPeixe(a.produtoId) : urlProduto(a.produtoId)}>{a.produtoNome}</Link>
        <span className="font-normal text-text-muted"> · {a.produtoCategoria === 'peixes' ? 'Peixe' : 'Produto'}</span>
      </p>
    ) : (
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-pequeno text-text-muted">
        <span>Veio para: <strong className="text-foreground">{rotuloDe(MOTIVOS_VISITA, a.motivo) ?? 'não respondeu'}</strong></span>
        <span>Encontrou: <strong className="text-foreground">{rotuloDe(ENCONTROU, a.encontrou) ?? 'não respondeu'}</strong></span>
      </p>
    )}

    <p className="my-3 whitespace-pre-line break-words">{a.comentario || <span className="text-text-muted">Sem comentário.</span>}</p>
    <p className="mb-4 text-legenda text-text-muted">
      {tipo === 'produtos' ? (a.nome ?? 'Visitante') : `${ORIGEM[a.origem] ?? a.origem}${a.pagina ? ` · ${a.pagina}` : ''}`} · {formatarDataHora(a.criadaEm)}
    </p>

    {erro && <Aviso tipo="erro" role="alert" className="mb-3">{erro.message}</Aviso>}
    <div className="mt-auto flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      {a.status !== 'aprovada' && <Button tamanho="sm" disabled={Boolean(ocupado)} onClick={() => agir('aprovada')}><Check aria-hidden="true" />{ocupado === 'aprovada' ? 'Aprovando…' : 'Aprovar'}</Button>}
      {a.status !== 'oculta' && <Button tamanho="sm" variant="secundario" disabled={Boolean(ocupado)} onClick={() => agir('oculta')}><EyeOff aria-hidden="true" />{ocupado === 'oculta' ? 'Ocultando…' : 'Ocultar'}</Button>}
      <Button tamanho="sm" variant="terciario" disabled={Boolean(ocupado)} onClick={() => agir('excluir')} aria-label={`Excluir ${descricao}`}><Trash2 aria-hidden="true" />{ocupado === 'excluir' ? 'Excluindo…' : 'Excluir'}</Button>
    </div>
  </li>
}
