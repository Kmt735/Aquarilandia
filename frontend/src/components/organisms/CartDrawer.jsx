import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import CloseButton from '../atoms/CloseButton'
import CartItem from '../molecules/CartItem'
import Hint from '../molecules/Hint'
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
  const aberto = painel === 'carrinho'
  const compatibilidade = analisarCompatibilidade(linhas)

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Carrinho"
      inert={!aberto}
      className={`fixed top-0 right-0 z-[310] flex h-full w-[380px] max-w-full flex-col border-l border-line bg-panel transition-transform duration-250 ${
        aberto ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-line p-5">
        <h3 className="text-lg">🛒 Seu carrinho</h3>
        <CloseButton onClick={fecharPaineis} />
      </div>

      <div className="flex-1 overflow-auto px-5 pt-2 pb-4">
        {linhas.length === 0 ? (
          <div className="px-2.5 py-12 text-center text-sm text-ink-soft">
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

      <div className="border-t border-line px-5 py-[18px]">
        <div className="mb-3 flex justify-between font-bold">
          <span>Total</span>
          <span className="font-mono text-gold">{formatarPreco(total)}</span>
        </div>
        <Button variant="whatsapp" disabled={!linhas.length} onClick={() => abrirWhatsApp('enviando seu pedido')}>
          💬 Finalizar pedido pelo WhatsApp
        </Button>
      </div>
    </aside>
  )
}
