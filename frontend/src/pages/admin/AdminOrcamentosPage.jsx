import { useState } from 'react'
import { Pencil, Phone, Search } from 'lucide-react'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import Aviso from '../../components/molecules/Aviso'
import EmptyState from '../../components/molecules/EmptyState'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import Paginacao from '../../components/molecules/Paginacao'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { opcoesServico } from '../../data/servicos'
import useConsulta from '../../hooks/useConsulta'
import useToast from '../../hooks/useToast'
import { atualizarOrcamento, listarOrcamentos } from '../../services/admin-operacoes'
import { formatarDataHora } from '../../utils/format'

const situacoes = { novo: 'Novo', em_atendimento: 'Em atendimento', concluido: 'Concluído' }
const classeSelect = 'mt-2 block h-11 w-full rounded-lg border border-border-control bg-surface px-3 text-base'

export default function AdminOrcamentosPage() {
  const [status, setStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [termo, setTermo] = useState('')
  const [pagina, setPagina] = useState(1)
  const consulta = useConsulta(() => listarOrcamentos({ status, busca: termo, pagina, limite: 20 }), [status, termo, pagina])
  return <section aria-labelledby="titulo-orcamentos">
    <h2 id="titulo-orcamentos" className="text-h2">Orçamentos</h2>
    <p className="mb-6 mt-2 text-text-muted">Consulte as solicitações de serviço, atualize os dados e acompanhe cada atendimento.</p>
    <form role="search" className="mb-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); setTermo(busca.trim()); setPagina(1) }}>
      <label htmlFor="busca-orcamentos" className="sr-only">Buscar orçamento</label>
      <Input id="busca-orcamentos" type="search" maxLength={120} placeholder="Buscar por cliente, telefone ou serviço" value={busca} onChange={(e) => setBusca(e.target.value)} />
      <Button type="submit" variant="secundario"><Search aria-hidden="true" />Buscar</Button>
    </form>
    <div role="group" aria-label="Situação do orçamento" className="mb-5 flex flex-wrap gap-2">
      {Object.entries({ '': 'Todos', ...situacoes }).map(([valor, texto]) => <button key={valor} type="button" aria-pressed={status === valor} onClick={() => { setStatus(valor); setPagina(1) }} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-bold ${status === valor ? 'border-primary bg-primary text-primary-foreground' : 'border-border-control hover:bg-surface-tint'}`}>{texto}</button>)}
    </div>
    {consulta.carregando ? <p role="status">Carregando orçamentos…</p> : consulta.erro ? <ErroCompacto onTentar={consulta.recarregar}>{consulta.erro.message}</ErroCompacto> : <>
      <p className="mb-3 text-sm text-text-muted" aria-live="polite">{consulta.dados.total} orçamento(s) encontrado(s)</p>
      {consulta.dados.total === 0 ? <EmptyState titulo="Nenhum orçamento encontrado">Tente outra busca ou situação. As solicitações enviadas pela loja aparecem aqui.</EmptyState> :
        <ul className="grid gap-4 lg:grid-cols-2">{consulta.dados.dados.map((o) => <li key={o.id} className="flex flex-col rounded-card border border-border-strong bg-surface p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-text-muted">Solicitação #{o.id} · {formatarDataHora(o.criadoEm)}</span>
            <Badge variant={o.status === 'concluido' ? 'sucesso' : o.status === 'novo' ? 'default' : 'secondary'}>{situacoes[o.status]}</Badge>
          </div>
          <h3 className="text-h3 break-words">{o.nome}</h3>
          <p className="mt-1 font-semibold text-primary-text">{o.servico}</p>
          <a className="mt-3 inline-flex min-h-11 items-center gap-2 self-start underline" href={`tel:${o.telefone}`}><Phone className="size-4" aria-hidden="true" />{o.telefone}</a>
          <p className="my-4 line-clamp-3 whitespace-pre-wrap break-words text-text-muted">{o.mensagem || 'Nenhuma mensagem informada.'}</p>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-text-muted">Atualizado em {formatarDataHora(o.atualizadoEm)}</span>
            <FichaOrcamento orcamento={o} aoSalvar={consulta.recarregar} />
          </div>
        </li>)}</ul>}
      <Paginacao pagina={pagina} totalPaginas={Math.ceil(consulta.dados.total / 20)} onMudar={setPagina} />
    </>}
  </section>
}

function FichaOrcamento({ orcamento, aoSalvar }) {
  const [aberto, setAberto] = useState(false)
  const [dados, setDados] = useState(orcamento)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState(null)
  const { toast } = useToast()
  const alterado = ['nome', 'telefone', 'servico', 'mensagem', 'status'].some((campo) => (dados[campo] ?? '') !== (orcamento[campo] ?? ''))
  const definir = (campo) => (e) => setDados((atual) => ({ ...atual, [campo]: e.target.value }))
  const mudarAberto = (valor) => {
    if (ocupado) return
    if (!valor && alterado && !window.confirm('Descartar as alterações deste orçamento?')) return
    setDados(orcamento); setErro(null); setAberto(valor)
  }
  return <Dialog open={aberto} onOpenChange={mudarAberto}>
    <DialogTrigger asChild><Button variant="secundario" tamanho="sm"><Pencil aria-hidden="true" />Ver e editar</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!ocupado}>
      <DialogHeader>
        <DialogTitle>Orçamento #{orcamento.id}</DialogTitle>
        <DialogDescription>Solicitado em {formatarDataHora(orcamento.criadoEm)}. Edite os dados e salve para atualizar o atendimento.</DialogDescription>
      </DialogHeader>
      <form className="space-y-5" onSubmit={async (e) => {
        e.preventDefault(); if (ocupado) return
        setOcupado(true); setErro(null)
        try {
          const { nome, telefone, servico, mensagem, status } = dados
          await atualizarOrcamento(orcamento.id, { nome, telefone, servico, mensagem, status })
          toast('Orçamento atualizado.', { tipo: 'sucesso' }); setAberto(false); aoSalvar()
        } catch (err) { setErro(err) } finally { setOcupado(false) }
      }}>
        {erro && <Aviso tipo="erro" role="alert">{erro.message} {Object.values(erro.detalhes ?? {}).join(' ')}</Aviso>}
        <fieldset disabled={ocupado} className="grid gap-4 sm:grid-cols-2">
          <legend className="sr-only">Dados do orçamento</legend>
          <label className="block">Nome do cliente<Input className="mt-2" required minLength={2} maxLength={120} value={dados.nome} onChange={definir('nome')} /></label>
          <label className="block">Telefone<Input className="mt-2" type="tel" required maxLength={20} value={dados.telefone} onChange={definir('telefone')} /></label>
          <div><label htmlFor={`orcamento-servico-${orcamento.id}`}>Serviço</label><select id={`orcamento-servico-${orcamento.id}`} className={classeSelect} value={dados.servico} onChange={definir('servico')}>{opcoesServico.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label htmlFor={`orcamento-status-${orcamento.id}`}>Andamento</label><select id={`orcamento-status-${orcamento.id}`} className={classeSelect} value={dados.status} onChange={definir('status')}>{Object.entries(situacoes).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          <div className="sm:col-span-2"><label htmlFor={`orcamento-mensagem-${orcamento.id}`}>Mensagem e detalhes da solicitação</label><textarea id={`orcamento-mensagem-${orcamento.id}`} aria-describedby={`orcamento-contagem-${orcamento.id}`} className="mt-2 block min-h-36 w-full rounded-lg border border-border-control bg-surface p-3 text-base" maxLength={1000} value={dados.mensagem ?? ''} onChange={definir('mensagem')} /><span id={`orcamento-contagem-${orcamento.id}`} className="mt-1 block text-sm text-text-muted">{(dados.mensagem ?? '').length}/1000 caracteres</span></div>
        </fieldset>
        <DialogFooter><Button variant="terciario" disabled={ocupado} onClick={() => mudarAberto(false)}>Cancelar</Button><Button type="submit" disabled={ocupado || !alterado}>{ocupado ? 'Salvando…' : 'Salvar alterações'}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
