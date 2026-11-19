import { useState } from 'react'
import { Link, useParams } from 'react-router'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import StatusPedidoBadge from '../../components/atoms/StatusPedidoBadge'
import Aviso from '../../components/molecules/Aviso'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import LinhaDoTempoPedido from '../../components/organisms/LinhaDoTempoPedido'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import useConsulta from '../../hooks/useConsulta'
import { atualizarPedidoAdmin, concluirEstorno, obterPedidoAdmin, simularPix } from '../../services/admin-pedidos'
import { cancelarPedido } from '../../services/pedidos'
import { ROTAS } from '../../utils/rotas'
import { STATUS_PEDIDO, podeCancelar } from '../../utils/statusPedido'

export default function AdminPedidoDetalhePage() {
  const { id } = useParams()
  const { dados, erro, carregando, recarregar } = useConsulta(() => obterPedidoAdmin(id), [id])
  if (carregando) return <p role="status">Carregando pedido…</p>
  if (erro) return <ErroCompacto onTentar={recarregar}>{erro.message}</ErroCompacto>
  return <Detalhe key={dados.id} pedido={dados} recarregar={recarregar} />
}
function Detalhe({ pedido, recarregar }) {
  const [erro, setErro] = useState(null), [ocupado, setOcupado] = useState(false)
  const [rastreio, setRastreio] = useState(''), [motivo, setMotivo] = useState('')
  const executar = async (acao) => {
    setOcupado(true); setErro(null)
    try { await acao(); recarregar() }
    catch (e) { setErro(e.message) }
    finally { setOcupado(false) }
  }
  const proximo = { paga: 'em_separacao', em_separacao: pedido.tipoEntrega === 'retirada' ? 'pronta_retirada' : 'enviada',
    enviada: 'entregue', pronta_retirada: 'entregue' }[pedido.status]
  return <article className="flex flex-col gap-5">
    <Link to={ROTAS.adminPedidos} className="font-semibold underline">Voltar aos pedidos</Link>
    <div className="flex gap-4"><h2 className="text-h2">Pedido {pedido.id}</h2><StatusPedidoBadge status={pedido.status} /></div>
    {erro && <Aviso tipo="erro" role="alert">{erro}</Aviso>}
    <section className="rounded-card border p-5"><h3 className="text-h3">Cliente e entrega</h3>
      <p>{pedido.cliente?.nome} · {pedido.cliente?.email} · {pedido.cliente?.telefone}</p><p>{pedido.entrega.resumo}</p>
    </section>
    <ResumoPedido itens={pedido.itens} frete={pedido.entrega.frete} subtotalCentavos={pedido.subtotal} totalCentavos={pedido.total} />
    <section className="rounded-card border p-5"><h3 className="text-h3">Pagamento</h3>
      <p>{pedido.financeiro?.mensagem ?? 'Nenhum pagamento gerado.'}</p>
      <ul>{pedido.pagamentos.map((p) => <li className="mt-3" key={p.id}>
        Pagamento {p.id}: {p.status} · {p.estornoTentativas} tentativa(s) de estorno
        {p.estornoUltimoErro && <p>{p.estornoUltimoErro}</p>}
        {p.status === 'aprovado' && p.estornoSolicitadoEm && p.estornoTentativas >= 5 && p.statusDetalhe === 'pagamento indevido'
          && <Button disabled={ocupado || !motivo.trim()} onClick={() => executar(() => concluirEstorno(p.id, motivo))}>Confirmar estorno no gateway</Button>}
        {import.meta.env.VITE_SIMULACAO_PIX === 'true' && p.status === 'pendente'
          && <Button disabled={ocupado} onClick={() => executar(() => simularPix(p.id))}>Simular Pix de teste</Button>}
      </li>)}</ul>
    </section>
    {proximo && <section className="rounded-card border p-5">
      {proximo === 'enviada' && pedido.tipoEntrega === 'correios' && <label>Código de rastreio<Input value={rastreio} onChange={(e) => setRastreio(e.target.value)} /></label>}
      <Button disabled={ocupado} onClick={() => executar(() => atualizarPedidoAdmin(pedido.id, {
        status: proximo, ...(proximo === 'enviada' && pedido.tipoEntrega === 'correios' ? { rastreio } : {}),
      }))}>Avançar para: {STATUS_PEDIDO[proximo].rotulo}</Button>
    </section>}
    <section className="rounded-card border p-5"><label>Motivo ou observação<textarea className="block w-full rounded-lg border p-3" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></label>
      {(podeCancelar(pedido.status) || pedido.status === 'cancelamento_solicitado') && <Button disabled={ocupado || (pedido.status === 'cancelamento_solicitado' && !motivo.trim())}
        onClick={() => executar(() => cancelarPedido(pedido.id, motivo))}>
        {pedido.status === 'cancelamento_solicitado' ? 'Conferir estorno e concluir cancelamento' : 'Cancelar pedido'}
      </Button>}
    </section>
    <LinhaDoTempoPedido pedido={pedido} />
  </article>
}
