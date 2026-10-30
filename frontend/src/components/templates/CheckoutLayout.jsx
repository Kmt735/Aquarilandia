import { ShoppingCart } from 'lucide-react'
import { Link, Outlet, useLocation } from 'react-router'
import Button from '../atoms/Button'
import EmptyState from '../molecules/EmptyState'
import Stepper from '../molecules/Stepper'
import { CheckoutContext } from '../../context/contexts'
import useCart from '../../hooks/useCart'
import useCheckoutRascunho from '../../hooks/useCheckoutRascunho'
import { ETAPAS_CHECKOUT } from '../../utils/checkout'
import { ROTAS, urlEtapaCheckout } from '../../utils/rotas'

// Checkout em 4 etapas com progresso visível (item 1) e volta sem perder dados (item 3)
export default function CheckoutLayout() {
  const { pathname } = useLocation()
  const { linhas } = useCart()
  const rascunho = useCheckoutRascunho()
  const atual = Math.max(0, ETAPAS_CHECKOUT.findIndex((e) => pathname.endsWith(e.id)))

  return (
    <CheckoutContext value={rascunho}>
      <div className="border-b border-border bg-surface-tint">
        <div className="mx-auto max-w-[860px] px-4 py-6 sm:px-6">
          <h1 className="sr-only">Finalizar compra</h1>
          <Stepper
            rotulo="Etapas da compra"
            etapas={ETAPAS_CHECKOUT}
            atual={atual}
            renderLink={(etapa, i, conteudo) => (
              <Link to={urlEtapaCheckout(etapa.id)} className="flex min-h-11 min-w-0 flex-col items-center gap-1.5 rounded-lg text-center hover:text-primary-text sm:flex-row sm:text-left">
                {conteudo}
                <span className="sr-only"> — voltar para esta etapa</span>
              </Link>
            )}
          />
        </div>
      </div>
      <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 desk:py-12">
        {linhas.length === 0 ? (
          <EmptyState
            icone={<ShoppingCart />}
            titulo="Seu carrinho está vazio"
            acoes={
              <Button asChild>
                <Link to={ROTAS.loja}>Ver produtos</Link>
              </Button>
            }
          >
            Adicione itens para continuar a compra.
          </EmptyState>
        ) : (
          <Outlet />
        )}
      </div>
    </CheckoutContext>
  )
}
