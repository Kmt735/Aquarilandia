import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import Preco from '../../components/atoms/Preco'
import StatusPedidoBadge from '../../components/atoms/StatusPedidoBadge'
import ErroAdmin from '../../components/molecules/ErroAdmin'
import useConsulta from '../../hooks/useConsulta'
import { obterPedidoAdmin } from '../../services/admin-pedidos'
import { marcarVisto } from '../../utils/pedidosVistos'
import { ROTAS } from '../../utils/rotas'

export default function AdminPedidoDetalhePage() {
  const { id } = useParams()
  const { dados, erro, carregando, recarregar } = useConsulta(() => obterPedidoAdmin(id), [id])
  useEffect(() => { if (dados) marcarVisto(String(dados.id)) }, [dados])
  return <section aria-labelledby="titulo-pedido">
    <Link to={ROTAS.adminPedidos} className="alvo-toque mb-5 inline-flex items-center text-primary-text underline">Voltar para os pedidos</Link>
    <h2 id="titulo-pedido" className="mb-4 text-h3">Pedido {id}</h2>
    {carregando ? <p role="status">Carregando pedido…</p> : erro ? <ErroAdmin erro={erro} recarregar={recarregar} /> : <>
      <StatusPedidoBadge status={dados.status} />
      <p className="my-4">Cliente: {dados.cliente?.nome ?? 'Não informado'}</p>
      <ul className="mb-4 flex flex-col gap-2">{dados.itens.map(i => <li key={i.produtoId} className="flex flex-wrap justify-between gap-3 rounded-lg border border-border p-3">
        <span>{i.quantidade} × {i.nomeProduto}</span><Preco valor={i.subtotal} centavos tamanho="sm" />
      </li>)}</ul>
      <p>Total: <Preco valor={dados.total} centavos tamanho="sm" /></p>
      <p className="mt-4 text-pequeno text-text-muted">Consulta apenas. Nenhuma ação de pagamento ou alteração de pedido está disponível nesta tela.</p>
    </>}
  </section>
}
