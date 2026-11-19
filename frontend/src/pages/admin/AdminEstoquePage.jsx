import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { ROTAS } from '../../utils/rotas'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import Aviso from '../../components/molecules/Aviso'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import useConsulta from '../../hooks/useConsulta'
import { historicoEstoque, listarEstoque, movimentarEstoque } from '../../services/admin-operacoes'
import { formatarDataHora } from '../../utils/format'

const tipos = { entrada: 'Entrada', saida: 'Saída', ajuste_positivo: 'Ajuste positivo', ajuste_negativo: 'Ajuste negativo' }
export default function AdminEstoquePage() {
  const [busca, setBusca] = useState(''), [pagina, setPagina] = useState(1)
  const consulta = useConsulta(() => listarEstoque({ busca, pagina, limite: 20 }), [busca, pagina])
  return <section>
    <h2 className="text-h2">Estoque</h2>
    <p className="mb-5 mt-2 text-text-muted">Controle as quantidades e consulte o histórico de entradas e saídas. Para editar nome, preço, fotos ou descrição, abra <Link className="font-semibold underline" to={ROTAS.adminProdutos}>Produtos</Link>.</p>
    <label className="mb-5 block">Buscar produto<Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} /></label>
    {consulta.carregando && !consulta.dados ? <p role="status">Carregando estoque…</p> : consulta.erro ? <ErroCompacto onTentar={consulta.recarregar}>{consulta.erro.message}</ErroCompacto> : <>
      <p className="mb-3">{consulta.dados.total} produto(s)</p>
      {!consulta.dados.total && <p className="py-6">Nenhum produto encontrado. Tente outra busca.</p>}
      <div className="overflow-x-auto rounded-card border border-border-strong"><table className="w-full text-left"><caption className="sr-only">Saldos de estoque</caption>
        <thead><tr><th className="p-3">Produto</th><th className="p-3">Saldo</th><th className="p-3">Situação</th><th className="p-3">Ações</th></tr></thead>
        <tbody>{consulta.dados.itens.map((p) => <tr key={p.produtoId} className="border-t"><td className="p-3">{p.nome}</td><td className="p-3">{p.saldoAtual}</td><td className="p-3">{p.ativo ? 'Na loja' : 'Fora da loja'}</td><td className="p-3"><JanelaEstoque produto={p} aoSalvar={consulta.recarregar} /></td></tr>)}</tbody>
      </table></div>
      <div className="my-4 flex items-center gap-4"><Button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button><span>Página {pagina}</span><Button disabled={pagina * 20 >= consulta.dados.total} onClick={() => setPagina(pagina + 1)}>Próxima</Button></div>
    </>}
  </section>
}

function JanelaEstoque({ produto, aoSalvar }) {
  const [ocupado, setOcupado] = useState(false)
  const [aberto, setAberto] = useState(false)
  return <Dialog open={aberto} onOpenChange={(valor) => { if (!ocupado) setAberto(valor) }}>
    <DialogTrigger asChild><Button variant="secundario">Ajustar quantidade</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!ocupado}>
      <DialogHeader><DialogTitle>Estoque: {produto.nome}</DialogTitle><DialogDescription>Saldo atual: {produto.saldoAtual} unidade(s). Registre uma entrada, saída ou correção de quantidade.</DialogDescription></DialogHeader>
      <Movimentacao produto={produto} aoSalvar={aoSalvar} aoOcupar={setOcupado} />
    </DialogContent>
  </Dialog>
}

function Movimentacao({ produto, aoSalvar, aoOcupar }) {
  const [tipo, setTipo] = useState('entrada'), [quantidade, setQuantidade] = useState('1'), [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false), [erro, setErro] = useState(null), [sucesso, setSucesso] = useState(null), [pagina, setPagina] = useState(1)
  const tentativa = useRef(null)
  const historico = useConsulta(() => historicoEstoque(produto.produtoId, pagina), [produto.produtoId, pagina])
  return <section aria-label="Movimentação e histórico">
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); if (ocupado) return
      setOcupado(true); aoOcupar(true); setErro(null); setSucesso(null)
      const corpo = { produtoId: produto.produtoId, tipo, quantidade: Number(quantidade), motivo: motivo.trim() }
      const assinatura = JSON.stringify(corpo)
      if (tentativa.current?.assinatura !== assinatura) tentativa.current = { assinatura, chave: crypto.randomUUID() }
      try {
        const r = await movimentarEstoque(corpo, tentativa.current.chave)
        setSucesso(`Movimentação registrada. Saldo atual: ${r.saldoAtual}.`); setMotivo(''); tentativa.current = null
        aoSalvar(); historico.recarregar()
      } catch (err) { setErro(err) } finally { setOcupado(false); aoOcupar(false) }
    }}>
      {erro && <Aviso tipo="erro" role="alert">{erro.message} {Object.values(erro.detalhes ?? {}).join(' ')}</Aviso>}
      {sucesso && <Aviso tipo="sucesso" role="status">{sucesso}</Aviso>}
      <fieldset disabled={ocupado} className="space-y-4"><legend className="sr-only">Registrar movimentação</legend>
      <label className="block">Tipo de movimentação<select className="ml-3 rounded-lg border p-3" value={tipo} onChange={(e) => setTipo(e.target.value)}>{Object.entries(tipos).map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}</select></label>
      <label className="block">Quantidade<Input type="number" min="1" max="2147483647" step="1" required value={quantidade} onChange={(e) => setQuantidade(e.target.value)} /></label>
      <label className="block">Motivo<Input required maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      </fieldset>
      <Button type="submit" disabled={ocupado}>{ocupado ? 'Registrando…' : 'Registrar movimentação'}</Button>
    </form>
    <h4 className="mb-3 mt-6 text-h4">Histórico do produto</h4>
    {historico.carregando ? <p role="status">Carregando histórico…</p> : historico.erro ? <ErroCompacto onTentar={historico.recarregar}>{historico.erro.message}</ErroCompacto> : <>
      <ul className="space-y-2">{historico.dados.itens.map((m) => <li key={m.operacaoId} className="rounded-lg border p-3">{formatarDataHora(m.criadoEm)} · {tipos[m.tipo] ?? m.tipo} · {m.quantidade} unidade(s) · saldo {m.saldoAnterior} → {m.saldoPosterior}<p>{m.motivo}</p></li>)}</ul>
      {!historico.dados.total && <p>Nenhuma movimentação.</p>}
      <div className="mt-4 flex gap-3"><Button disabled={pagina === 1} onClick={() => setPagina(pagina - 1)}>Histórico anterior</Button><Button disabled={pagina * 10 >= historico.dados.total} onClick={() => setPagina(pagina + 1)}>Próximo histórico</Button></div>
    </>}
  </section>
}
