import { ArrowLeft, CreditCard, Lock, QrCode } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import Button from '../../components/atoms/Button'
import Aviso from '../../components/molecules/Aviso'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import { AVISO_PAGAMENTO } from '../../data/loja'
import useCart from '../../hooks/useCart'
import useCheckout from '../../hooks/useCheckout'
import useTituloPagina from '../../hooks/useTituloPagina'
import { criarPedido } from '../../services/pedidos'
import { urlEtapaCheckout } from '../../utils/rotas'

// Etapa 3 · revisão final antes de pagar (item 5) e saída para a página SEGURA do gateway.
// O site NUNCA tem campos de cartão.
export default function EtapaPagamentoPage() {
  useTituloPagina('Pagamento · Finalizar compra')
  const { linhas } = useCart()
  const { rascunho } = useCheckout()
  const navigate = useNavigate()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState(null)

  if (!rascunho.entrega?.tipo) return <Navigate to={urlEtapaCheckout('entrega')} replace />
  const { entrega } = rascunho
  const itens = linhas.map((l) => ({ id: l.id, nome: l.item.nome, preco: l.item.preco, centavos: l.item.centavos, qtd: l.qtd }))

  const pagar = async () => {
    setEnviando(true)
    setErro(null)
    try {
      const { urlPagamento } = await criarPedido({ linhas, entrega })
      // INTEGRAÇÃO: window.location.href = urlPagamento (página do gateway). No protótipo, volta direto.
      navigate(urlPagamento)
    } catch {
      setErro('Não conseguimos abrir o pagamento agora. Seu carrinho continua salvo; tente de novo em alguns segundos.')
      setEnviando(false)
    }
  }

  return (
    <div className="grid items-start gap-8 desk:grid-cols-[1fr_360px]">
      <section aria-labelledby="titulo-etapa" className="flex flex-col gap-4">
        <h2 id="titulo-etapa" className="text-h2">
          Revise e pague
        </h2>

        <div className="rounded-card border border-border-strong bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-h4">Entrega</h3>
              <p className="mt-1 text-pequeno text-text-muted">{entrega.resumo}</p>
              {entrega.prazo && <p className="text-pequeno text-text-muted">Prazo: {entrega.prazo}</p>}
            </div>
            <Link to={urlEtapaCheckout('entrega')} className="alvo-toque shrink-0 text-pequeno font-bold text-primary-text underline underline-offset-4">
              Alterar
            </Link>
          </div>
        </div>

        <div className="rounded-card border border-border-strong bg-surface p-5">
          <h3 className="flex items-center gap-2 text-h4">
            <Lock aria-hidden="true" className="size-5 text-success-text" />
            Pagamento seguro
          </h3>
          <p className="mt-2 text-corpo text-text-muted">{AVISO_PAGAMENTO}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-pequeno font-semibold">
              <CreditCard aria-hidden="true" className="size-4 text-primary-text" />
              Cartão
            </li>
            <li className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong px-3 py-1.5 text-pequeno font-semibold">
              <QrCode aria-hidden="true" className="size-4 text-primary-text" />
              PIX
            </li>
          </ul>
        </div>

        {erro && (
          <Aviso tipo="erro" role="alert">
            {erro}
          </Aviso>
        )}

        <div>
          <Button variant="secundario" tamanho="lg" onClick={() => navigate(urlEtapaCheckout('entrega'))}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
        </div>
      </section>

      <ResumoPedido itens={itens} frete={entrega.frete} titulo="Resumo da compra">
        <Button tamanho="lg" largo className="mt-5" onClick={pagar} disabled={enviando}>
          <Lock aria-hidden="true" />
          {enviando ? 'Abrindo o pagamento…' : 'Ir para o pagamento seguro'}
        </Button>
        <p className="mt-2 text-center text-legenda text-text-muted">Você será levado à página do parceiro de pagamentos.</p>
      </ResumoPedido>
    </div>
  )
}
