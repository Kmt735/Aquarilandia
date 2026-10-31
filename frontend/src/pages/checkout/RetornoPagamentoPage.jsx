import { CircleCheck, CircleX, Clock, LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router'
import Button from '../../components/atoms/Button'
import Stepper from '../../components/molecules/Stepper'
import { ETAPAS_CHECKOUT } from '../../utils/checkout'
import useCart from '../../hooks/useCart'
import useCheckoutRascunho from '../../hooks/useCheckoutRascunho'
import useTituloPagina from '../../hooks/useTituloPagina'
import useWhatsApp from '../../hooks/useWhatsApp'
import { consultarStatus } from '../../services/pedidos'
import { ROTAS, urlCompra, urlEtapaCheckout } from '../../utils/rotas'

const TENTATIVAS = 6

// Retorno do gateway: /pagamento/sucesso | falha | pendente.
// A de sucesso NÃO confia na URL: mostra "Confirmando seu pagamento…" até o status real chegar.
export default function RetornoPagamentoPage() {
  const { resultado } = useParams()
  const [params] = useSearchParams()
  const pedidoId = params.get('pedido')
  useTituloPagina('Confirmação da compra')

  if (!['sucesso', 'falha', 'pendente'].includes(resultado)) return <Navigate to={ROTAS.inicio} replace />

  return (
    <>
      <div className="border-b border-border bg-surface-tint">
        <div className="mx-auto max-w-[860px] px-4 py-6 sm:px-6">
          <Stepper rotulo="Etapas da compra" etapas={ETAPAS_CHECKOUT} atual={resultado === 'falha' ? 2 : 3} />
        </div>
      </div>
      <div className="mx-auto max-w-[640px] px-4 py-12 text-center sm:px-6">
        {resultado === 'sucesso' && <Sucesso pedidoId={pedidoId} />}
        {resultado === 'falha' && <Falha />}
        {resultado === 'pendente' && <Pendente pedidoId={pedidoId} />}
      </div>
    </>
  )
}

function Sucesso({ pedidoId }) {
  const [estado, setEstado] = useState({ fase: 'confirmando', pedido: null })
  const { limpar } = useCart()
  const { limpar: limparRascunho } = useCheckoutRascunho()

  // INTEGRAÇÃO: GET /api/vendas/:id até sair de "aguardando_pagamento" (o webhook do gateway confirma)
  useEffect(() => {
    let ativo = true
    const verificar = async (n) => {
      try {
        const pedido = await consultarStatus(pedidoId)
        if (!ativo) return
        if (pedido.status !== 'aguardando_pagamento') {
          setEstado({ fase: pedido.status === 'paga' ? 'paga' : 'outro', pedido })
          if (pedido.status === 'paga') {
            limpar()
            limparRascunho()
          }
        } else if (n < TENTATIVAS) verificar(n + 1)
        else setEstado({ fase: 'demorando', pedido })
      } catch {
        if (ativo) setEstado({ fase: 'erro', pedido: null })
      }
    }
    verificar(1)
    return () => {
      ativo = false
    }
  }, [pedidoId, limpar, limparRascunho])

  if (estado.fase === 'confirmando') {
    return (
      <div role="status" aria-live="polite">
        <LoaderCircle aria-hidden="true" className="mx-auto mb-4 size-12 animate-spin text-primary-text motion-reduce:animate-none" />
        <h1 className="text-h2">Confirmando seu pagamento…</h1>
        <p className="mt-2 text-corpo text-text-muted">Isso leva alguns segundos. Não feche esta página.</p>
      </div>
    )
  }
  if (estado.fase === 'paga') {
    return (
      <div role="status">
        <CircleCheck aria-hidden="true" className="mx-auto mb-4 size-14 text-success-text" />
        <h1 className="text-h2">Pagamento aprovado!</h1>
        <p className="mt-2 text-corpo text-text-muted">
          Sua compra <strong className="text-foreground">{estado.pedido.id}</strong> foi confirmada. Você acompanha cada etapa em Minhas compras.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild tamanho="lg">
            <Link to={urlCompra(estado.pedido.id)}>Acompanhar a compra</Link>
          </Button>
          <Button asChild tamanho="lg" variant="secundario">
            <Link to={ROTAS.inicio}>Voltar para a Início</Link>
          </Button>
        </div>
      </div>
    )
  }
  return (
    <div role="status">
      <Clock aria-hidden="true" className="mx-auto mb-4 size-12 text-warning-text" />
      <h1 className="text-h2">{estado.fase === 'erro' ? 'Não conseguimos confirmar agora' : 'A confirmação está demorando'}</h1>
      <p className="mt-2 text-corpo text-text-muted">
        Se o pagamento foi feito, ele aparece em Minhas compras assim que o parceiro de pagamentos confirmar. Não pague de novo.
      </p>
      <Button asChild tamanho="lg" className="mt-6">
        <Link to={ROTAS.minhaConta}>Ver minhas compras</Link>
      </Button>
    </div>
  )
}

function Falha() {
  const abrirWhatsApp = useWhatsApp()
  return (
    <div role="alert">
      <CircleX aria-hidden="true" className="mx-auto mb-4 size-14 text-danger-text" />
      <h1 className="text-h2">Pagamento não aprovado</h1>
      <p className="mt-2 text-corpo text-text-muted">
        Nada foi cobrado. Seu carrinho continua salvo: tente de novo com outro cartão ou pague com PIX.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild tamanho="lg">
          <Link to={urlEtapaCheckout('pagamento')}>Tentar de novo</Link>
        </Button>
        <Button tamanho="lg" variant="secundario" onClick={() => abrirWhatsApp('um problema no pagamento')}>
          Falar com a loja
        </Button>
      </div>
    </div>
  )
}

function Pendente({ pedidoId }) {
  return (
    <div role="status">
      <Clock aria-hidden="true" className="mx-auto mb-4 size-14 text-warning-text" />
      <h1 className="text-h2">Pagamento em análise</h1>
      <p className="mt-2 text-corpo text-text-muted">
        {pedidoId ? `A compra ${pedidoId} está aguardando a confirmação do pagamento.` : 'Sua compra está aguardando a confirmação do pagamento.'} Se você escolheu PIX, conclua o pagamento no app do seu banco. O status atualizado aparece em Minhas compras.
      </p>
      <Button asChild tamanho="lg" className="mt-6">
        <Link to={pedidoId ? urlCompra(pedidoId) : ROTAS.minhaConta}>Acompanhar a compra</Link>
      </Button>
    </div>
  )
}
