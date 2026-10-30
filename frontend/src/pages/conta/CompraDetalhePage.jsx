import { ArrowLeft, PackageSearch, RotateCcw, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import Button from '../../components/atoms/Button'
import Skeleton from '../../components/atoms/Skeleton'
import StatusPedidoBadge from '../../components/atoms/StatusPedidoBadge'
import WhatsAppIcon from '../../components/icons/WhatsAppIcon'
import Aviso from '../../components/molecules/Aviso'
import EmptyState from '../../components/molecules/EmptyState'
import LinhaDoTempoPedido from '../../components/organisms/LinhaDoTempoPedido'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import useCart from '../../hooks/useCart'
import useConsulta from '../../hooks/useConsulta'
import useTituloPagina from '../../hooks/useTituloPagina'
import useToast from '../../hooks/useToast'
import useWhatsApp from '../../hooks/useWhatsApp'
import { encontrarItem } from '../../services/catalogo'
import { cancelarPedido, obterPedido } from '../../services/pedidos'
import { formatarData } from '../../utils/format'
import { ROTAS } from '../../utils/rotas'
import { podeCancelar, STATUS_PEDIDO } from '../../utils/statusPedido'

export default function CompraDetalhePage() {
  const { id } = useParams()
  const { dados, carregando, erro } = useConsulta(() => obterPedido(id), [id])
  const [atualizado, setAtualizado] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const [cancelando, setCancelando] = useState(false)
  const { adicionar } = useCart()
  const { toast } = useToast()
  const abrirWhatsApp = useWhatsApp()
  useTituloPagina(`Compra ${id}`)

  const pedido = atualizado ?? dados
  const voltar = (
    <Link to={ROTAS.minhaConta} className="alvo-toque mb-6 inline-flex items-center gap-1.5 text-pequeno font-semibold text-primary-text underline-offset-4 hover:underline">
      <ArrowLeft aria-hidden="true" className="size-4" />
      Voltar para minhas compras
    </Link>
  )

  if (carregando) return <Skeleton className="h-96 rounded-card" />
  if (erro) {
    return (
      <>
        {voltar}
        <EmptyState icone={<PackageSearch />} titulo="Compra não encontrada">
          Confira o número da compra em Minhas compras.
        </EmptyState>
      </>
    )
  }

  const cancelar = async () => {
    setCancelando(true)
    try {
      const novo = await cancelarPedido(pedido.id)
      setAtualizado({ ...novo })
      setConfirmar(false)
      toast(novo.status === 'cancelada' ? 'Compra cancelada.' : STATUS_PEDIDO.cancelamento_solicitado.descricao, { tipo: 'sucesso' })
    } catch (e) {
      toast(e.erro ?? 'Não foi possível cancelar agora. Tente de novo.', { tipo: 'erro' })
    } finally {
      setCancelando(false)
    }
  }

  // Item 7 · "comprar novamente": devolve ao carrinho os itens que ainda existem no catálogo
  const comprarNovamente = () => {
    pedido.itens.forEach((i) => {
      const item = encontrarItem(i.id)
      if (item && item.disponibilidade !== 'esgotado') adicionar(item, i.qtd)
    })
  }

  return (
    <article aria-labelledby="titulo-compra">
      {voltar}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 id="titulo-compra" className="text-h2">
          Compra {pedido.id}
        </h2>
        <StatusPedidoBadge status={pedido.status} />
      </div>
      <p className="-mt-4 mb-6 text-pequeno text-text-muted">Feita em {formatarData(pedido.criadoEm)}</p>

      {pedido.status === 'cancelamento_solicitado' && (
        <Aviso tipo="aviso" className="mb-6">
          {STATUS_PEDIDO.cancelamento_solicitado.descricao}
        </Aviso>
      )}

      <div className="grid items-start gap-6 desk:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-6">
          <section aria-labelledby="titulo-andamento" className="rounded-card border border-border-strong bg-surface p-5">
            <h3 id="titulo-andamento" className="mb-4 text-h4">
              Andamento
            </h3>
            <LinhaDoTempoPedido pedido={pedido} />
            {pedido.rastreio && (
              <p className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-surface-tint px-4 py-3 text-pequeno">
                <Truck aria-hidden="true" className="size-4 text-primary-text" />
                Código de rastreio: <strong className="font-mono tracking-wide">{pedido.rastreio}</strong>
              </p>
            )}
          </section>
          <section aria-labelledby="titulo-entrega-compra" className="rounded-card border border-border-strong bg-surface p-5">
            <h3 id="titulo-entrega-compra" className="mb-1 text-h4">
              Entrega
            </h3>
            <p className="text-pequeno text-text-muted">{pedido.entrega.resumo}</p>
          </section>
        </div>

        <ResumoPedido itens={pedido.itens} frete={pedido.entrega.frete}>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="secundario" largo onClick={comprarNovamente}>
              <RotateCcw aria-hidden="true" />
              Comprar novamente
            </Button>
            {podeCancelar(pedido.status) && (
              <Button variant="secundario" largo className="text-danger-text hover:border-danger-text hover:text-danger-text" onClick={() => setConfirmar(true)}>
                Cancelar compra
              </Button>
            )}
            <Button variant="terciario" largo onClick={() => abrirWhatsApp(`a compra ${pedido.id}`)}>
              <WhatsAppIcon className="size-[18px]" />
              Ajuda com esta compra
            </Button>
          </div>
          {!podeCancelar(pedido.status) && !['cancelada', 'cancelamento_solicitado'].includes(pedido.status) && (
            <p className="mt-3 text-legenda text-text-muted">Depois do envio, trocas e devoluções são pedidas pelo atendimento.</p>
          )}
        </ResumoPedido>
      </div>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="rounded-[20px] border-border-strong bg-surface-elevated p-6 sm:max-w-[440px]">
          <DialogHeader className="pr-10 text-left">
            <DialogTitle className="font-display text-h3 font-extrabold">Cancelar a compra {pedido.id}?</DialogTitle>
            <DialogDescription className="text-corpo text-text-muted">
              {pedido.status === 'aguardando_pagamento'
                ? 'A compra ainda não foi paga e será cancelada na hora.'
                : 'Vamos pedir a devolução do pagamento. Isso pode levar alguns dias, dependendo da forma de pagamento.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2">
            <Button variant="secundario" onClick={() => setConfirmar(false)}>
              Manter compra
            </Button>
            <Button variant="perigo" onClick={cancelar} disabled={cancelando}>
              {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  )
}
