import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../components/atoms/Button'
import Preco from '../../components/atoms/Preco'
import StatusPedidoBadge from '../../components/atoms/StatusPedidoBadge'
import CampoOpcoes from '../../components/molecules/CampoOpcoes'
import EmptyState from '../../components/molecules/EmptyState'
import ErroAdmin from '../../components/molecules/ErroAdmin'
import Paginacao from '../../components/molecules/Paginacao'
import useConsulta from '../../hooks/useConsulta'
import { listarPedidosAdmin } from '../../services/admin-pedidos'
import { formatarDataHora, plural } from '../../utils/format'
import { ROTAS } from '../../utils/rotas'
import { STATUS_PEDIDO } from '../../utils/statusPedido'

export default function AdminPedidosPage() {
  const [status, setStatus] = useState(''), [pagina, setPagina] = useState(1)
  const { dados, erro, carregando, recarregar } = useConsulta(() => listarPedidosAdmin({ status, pagina }), [status, pagina])
  return <section aria-labelledby="titulo-pedidos">
    <h2 id="titulo-pedidos" className="mb-3 text-h3">Pedidos</h2>
    <p className="mb-5 text-pequeno text-text-muted">Consulte os pedidos e abra um deles para acompanhar o pagamento, a preparação e a entrega.</p>
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <label htmlFor="pedido-status" className="font-semibold">Situação
        <CampoOpcoes id="pedido-status" className="mt-1" placeholder="Todas as situações"
          opcoes={Object.entries(STATUS_PEDIDO).map(([valor, info]) => [valor, info.rotulo])} value={status}
          onChange={(e) => { setStatus(e.target.value); setPagina(1) }} />
      </label>
      <Button variant="secundario" onClick={recarregar}>Atualizar pedidos</Button>
    </div>
    {carregando ? <p role="status">Carregando pedidos…</p>
      : erro ? <ErroAdmin erro={erro} recarregar={recarregar} />
        : <><p role="status" className="mb-4">{plural(dados.total, 'pedido')}</p>
          {!dados.itens.length ? <EmptyState titulo="Nenhum pedido encontrado">Não há pedidos para esta consulta.</EmptyState>
            : <ul className="flex flex-col gap-3">{dados.itens.map(p => <li key={p.id}>
              <Link to={`${ROTAS.adminPedidos}/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-strong p-5 hover:border-primary-text">
                <div><strong>Pedido {p.id} · {p.clienteNome}</strong><p className="text-pequeno text-text-muted">{formatarDataHora(p.criadoEm)} · {plural(p.quantidadeItens, 'item', 'itens')}</p></div>
                <Preco valor={p.total} centavos tamanho="sm" /><StatusPedidoBadge status={p.status} />
              </Link>
            </li>)}</ul>}
          <Paginacao pagina={dados.pagina} totalPaginas={dados.totalPaginas} onMudar={setPagina} />
        </>}
  </section>
}
