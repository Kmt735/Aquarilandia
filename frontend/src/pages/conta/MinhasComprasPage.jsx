import { PackageOpen, ReceiptText } from 'lucide-react'
import { Link } from 'react-router'
import Button from '../../components/atoms/Button'
import Skeleton from '../../components/atoms/Skeleton'
import StatusPedidoBadge from '../../components/atoms/StatusPedidoBadge'
import EmptyState from '../../components/molecules/EmptyState'
import useConsulta from '../../hooks/useConsulta'
import useTituloPagina from '../../hooks/useTituloPagina'
import { listarPedidos } from '../../services/pedidos'
import { formatarData, formatarPreco, plural } from '../../utils/format'
import { ROTAS, urlCompra } from '../../utils/rotas'

export default function MinhasComprasPage() {
  useTituloPagina('Minhas compras')
  const { dados, carregando, erro, recarregar } = useConsulta(listarPedidos)

  return (
    <section aria-labelledby="titulo-compras">
      <h2 id="titulo-compras" className="mb-1 text-h2">
        Minhas compras
      </h2>
      <p className="mb-6 text-pequeno text-text-muted">Dados de exemplo enquanto a conta não está ligada ao sistema da loja.</p>
      {carregando ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          <span className="sr-only">Carregando…</span>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : erro ? (
        <EmptyState tom="erro" icone={<ReceiptText />} titulo="Não conseguimos carregar suas compras" acoes={<Button onClick={recarregar}>Tentar de novo</Button>}>
          Confira sua conexão e tente de novo.
        </EmptyState>
      ) : dados.length === 0 ? (
        <EmptyState icone={<PackageOpen />} titulo="Você ainda não fez compras" acoes={<Button asChild><Link to={ROTAS.loja}>Ver produtos</Link></Button>}>
          Quando você comprar, o pedido e o status aparecem aqui.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {dados.map((p) => {
            const total = p.itens.reduce((s, i) => s + i.preco * i.qtd, 0) + (p.entrega.frete ?? 0)
            const qtd = p.itens.reduce((s, i) => s + i.qtd, 0)
            return (
              <li key={p.id}>
                <Link
                  to={urlCompra(p.id)}
                  className="flex flex-col gap-3 rounded-card border border-border-strong bg-surface p-5 transition-[border-color,box-shadow] hover:border-primary-text/50 hover:shadow-glow sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-display text-h4 font-extrabold">Compra {p.id}</p>
                    <p className="text-pequeno text-text-muted">
                      {formatarData(p.criadoEm)} · {plural(qtd, 'item', 'itens')} · {formatarPreco(total)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusPedidoBadge status={p.status} />
                    <span className="text-pequeno font-bold text-primary-text underline underline-offset-4">Ver detalhes</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
