import { MessageCircle, ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import CartItem from '../molecules/CartItem'
import Hint from '../molecules/Hint'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import useCart from '../../hooks/useCart'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { analisarCompatibilidade } from '../../utils/compatibilidade'
import { formatarPreco } from '../../utils/format'
import { ROTAS } from '../../utils/rotas'

export default function CartDrawer() {
  const { painel, fecharPaineis } = useUI()
  const { linhas, total, incrementar, decrementar, remover } = useCart()
  const navigate = useNavigate()
  const abrirWhatsApp = useWhatsApp()
  const compatibilidade = analisarCompatibilidade(linhas)

  return (
    <Sheet open={painel === 'carrinho'} onOpenChange={(aberto) => !aberto && fecharPaineis()}>
      <SheetContent side="right" className="w-[400px] max-w-full gap-0 border-border bg-surface p-0 sm:max-w-[400px]">
        <SheetHeader className="border-b border-border px-5 py-5">
          <SheetTitle className="flex items-center gap-2.5 font-display text-[20px]">
            <ShoppingCart aria-hidden="true" className="size-5 text-primary-text dark:text-neon" />
            Seu carrinho
          </SheetTitle>
          <SheetDescription className="sr-only">Itens do carrinho e finalização pelo WhatsApp</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-auto px-5 pt-1 pb-4">
          {linhas.length === 0 ? (
            <div className="py-14 text-center text-[15px] text-text-muted">
              Seu carrinho está vazio.
              <br />
              <br />
              <Button
                variant="ghost"
                onClick={() => {
                  fecharPaineis()
                  navigate(ROTAS.loja)
                }}
              >
                Ver produtos
              </Button>
            </div>
          ) : (
            <>
              {linhas.map((l) => (
                <CartItem
                  key={l.id}
                  produto={l.produto}
                  qtd={l.qtd}
                  onIncrementar={() => incrementar(l.id)}
                  onDecrementar={() => decrementar(l.id)}
                  onRemover={() => remover(l.id)}
                />
              ))}
              {compatibilidade && <Hint tipo={compatibilidade.tipo}>{compatibilidade.texto}</Hint>}
            </>
          )}
        </div>

        <div className="border-t border-border px-5 py-5">
          <div className="mb-4 flex justify-between text-[15px] font-semibold">
            <span>Total</span>
            <span className="tabular-nums dark:text-neon">{formatarPreco(total)}</span>
          </div>
          <Button variant="whatsapp" disabled={!linhas.length} onClick={() => abrirWhatsApp('enviando seu pedido')}>
            <MessageCircle aria-hidden="true" />
            Finalizar pedido pelo WhatsApp
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
