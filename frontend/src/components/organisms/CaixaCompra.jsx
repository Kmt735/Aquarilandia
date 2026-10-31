import { Bell, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import Button from '../atoms/Button'
import Preco from '../atoms/Preco'
import StatusBadge from '../atoms/StatusBadge'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import AvisoEntregaPeixe from '../molecules/AvisoEntregaPeixe'
import SeletorQuantidade from '../molecules/SeletorQuantidade'
import useCart from '../../hooks/useCart'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { plural } from '../../utils/format'

// Bloco de compra da ficha/detalhe: preço, disponibilidade, estoque, quantidade (máx. = estoque, item 5),
// ação primária "Adicionar ao carrinho" e secundária "Tirar dúvida no WhatsApp".
export default function CaixaCompra({ item }) {
  const { adicionar, qtdNoCarrinho } = useCart()
  const { abrirAviseMe } = useUI()
  const abrirWhatsApp = useWhatsApp()
  const [qtd, setQtd] = useState(1)
  const esgotado = item.disponibilidade === 'esgotado'
  const restante = item.estoque == null ? null : Math.max(item.estoque - qtdNoCarrinho(item.id), 0)
  const qtdValida = Math.max(1, Math.min(qtd, restante || 1))

  return (
    <div className="rounded-card border border-border-strong bg-surface p-5">
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge tipo={item.disponibilidade} />
        {item.entregaLocal && <StatusBadge tipo="entrega-local" />}
      </div>
      <div className="mt-3">
        <Preco valor={item.preco} tamanho="lg" />
      </div>
      <p className="mt-1 text-pequeno text-text-muted">
        {esgotado
          ? 'Esgotado no momento.'
          : item.disponibilidade === 'encomenda'
            ? `Sob encomenda · prazo: ${item.prazoEncomenda}`
            : item.estoque != null && `${plural(item.estoque, 'unidade')} em estoque (exemplo)`}
      </p>

      {item.entregaLocal && <AvisoEntregaPeixe compacto className="mt-4" />}

      {esgotado ? (
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button tamanho="lg" disabled className="sm:flex-1">
            Esgotado
          </Button>
          <Button tamanho="lg" variant="secundario" className="sm:flex-1" onClick={() => abrirAviseMe(item)}>
            <Bell aria-hidden="true" />
            Avise-me quando chegar
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <span className="text-pequeno font-semibold" aria-hidden="true">
              Quantidade
            </span>
            <SeletorQuantidade valor={qtdValida} max={restante ?? undefined} onChange={setQtd} rotulo={`Quantidade de ${item.nome}`} />
          </div>
          {restante === 0 ? (
            <p className="mt-3 text-pequeno font-semibold text-warning-text">Todas as unidades disponíveis já estão no seu carrinho.</p>
          ) : null}
          <Button tamanho="lg" largo className="mt-4" disabled={restante === 0} onClick={() => adicionar(item, qtdValida)}>
            <ShoppingCart aria-hidden="true" />
            Adicionar ao carrinho
          </Button>
        </>
      )}
      <Button variant="secundario" tamanho="lg" largo className="mt-2" onClick={() => abrirWhatsApp(item.nome)}>
        <WhatsAppIcon className="size-[18px]" />
        Tirar dúvida no WhatsApp
      </Button>
    </div>
  )
}
