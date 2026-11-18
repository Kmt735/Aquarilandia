import { useState } from 'react'
import { Link } from 'react-router'
import Button from '../../components/atoms/Button'
import Input from '../../components/atoms/Input'
import StatusPedidoBadge from '../../components/atoms/StatusPedidoBadge'
import ErroCompacto from '../../components/molecules/ErroCompacto'
import useConsulta from '../../hooks/useConsulta'
import { listarPedidosAdmin } from '../../services/admin-pedidos'
import { formatarDataHora, formatarPreco } from '../../utils/format'
import { ROTAS } from '../../utils/rotas'

export default function AdminPedidosPage() {
  const [filtro, setFiltro] = useState('todos'), [busca, setBusca] = useState(''), [pagina, setPagina] = useState(1)
  const { dados, erro, carregando, recarregar } = useConsulta(() => listarPedidosAdmin({ filtro, busca, pagina }), [filtro, busca, pagina])
  return <section>
    <h2 className="mb-4 text-h2">Pedidos</h2>
    <div className="mb-5 flex flex-wrap gap-3">
      <label>Buscar pedido ou cliente<Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1) }} /></label>
      <label>Situação<select className="block rounded-lg border p-3" value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(1) }}>
        {[['todos', 'Todos'], ['abertos', 'Em andamento'], ['pagamento_pendente', 'Aguardando pagamento'], ['concluidos', 'Entregues'], ['cancelados', 'Cancelamentos']].map(([v, texto]) => <option key={v} value={v}>{texto}</option>)}
      </select></label>
      <Button onClick={recarregar}>Atualizar</Button>
    </div>
    {carregando ? <p role="status">Carregando pedidos…</p> : erro ? <ErroCompacto onTentar={recarregar}>{erro.message}</ErroCompacto>
      : <><p className="mb-3">{dados.total} pedido(s)</p><ul className="flex flex-col gap-3">
        {dados.itens.map((p) => <li key={p.id}><Link to={`${ROTAS.adminPedidos}/${p.id}`} className="flex flex-wrap justify-between gap-3 rounded-card border border-border-strong p-5">
          <span><strong>Pedido {p.id} · {p.clienteNome}</strong><br />{formatarDataHora(p.criadoEm)} · {formatarPreco(p.total, { centavos: true })}</span>
          <StatusPedidoBadge status={p.status} />
        </Link></li>)}
      </ul><div className="mt-5 flex items-center gap-4">
        <Button disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
        <span>Página {pagina} de {dados.totalPaginas}</span>
        <Button disabled={pagina >= dados.totalPaginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
      </div></>}
  </section>
}
