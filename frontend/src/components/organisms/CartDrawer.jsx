import { ArrowRight, ShoppingCart, Truck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../atoms/Button'
import Input from '../atoms/Input'
import Preco from '../atoms/Preco'
import Aviso from '../molecules/Aviso'
import AvisoEntregaPeixe from '../molecules/AvisoEntregaPeixe'
import CartItem from '../molecules/CartItem'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { calcularFrete } from '../../services/frete'
import useCart from '../../hooks/useCart'
import useCheckoutRascunho from '../../hooks/useCheckoutRascunho'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { analisarCompatibilidade } from '../../utils/compatibilidade'
import { mascararCep } from '../../utils/cep'
import { formatarPreco, plural } from '../../utils/format'
import { ROTAS, urlEtapaCheckout } from '../../utils/rotas'

// Gaveta do carrinho: foco preso, Esc fecha e o foco volta ao botão que abriu (Radix Dialog).
export default function CartDrawer() {
  const { painel, fecharPaineis, devolverFoco } = useUI()
  const { linhas, total, quantidade, temPeixe, definirQtd, remover } = useCart()
  const navigate = useNavigate()
  const abrirWhatsApp = useWhatsApp()
  const compatibilidade = analisarCompatibilidade(linhas)

  const ir = (rota) => {
    fecharPaineis()
    navigate(rota)
  }

  return (
    <Sheet open={painel === 'carrinho'} onOpenChange={(aberto) => !aberto && fecharPaineis()}>
      <SheetContent side="right" onCloseAutoFocus={devolverFoco} className="w-[420px] max-w-full gap-0 border-border-strong bg-surface p-0 sm:max-w-[420px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2.5 font-display text-h3 font-extrabold">
            <ShoppingCart aria-hidden="true" className="size-5 text-primary-text" />
            Seu carrinho
            {quantidade > 0 && <span className="text-pequeno font-semibold text-text-muted">({plural(quantidade, 'item', 'itens')})</span>}
          </SheetTitle>
          <SheetDescription className="sr-only">Revise os itens, calcule o frete e finalize a compra.</SheetDescription>
        </SheetHeader>

        {linhas.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center">
            <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-surface-tint text-primary-text">
              <ShoppingCart aria-hidden="true" className="size-7" />
            </span>
            <p className="font-display text-h4 font-extrabold">Seu carrinho está vazio</p>
            <p className="mt-1 text-pequeno text-text-muted">Que tal começar pelos peixes ou pelos itens da loja?</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button onClick={() => ir(ROTAS.loja)}>Ver produtos</Button>
              <Button variant="secundario" onClick={() => ir(ROTAS.peixes)}>
                Ver peixes
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto px-5 pb-4">
              <ul aria-label="Itens do carrinho">
                {linhas.map((l) => (
                  <CartItem key={l.id} linha={l} onQtd={(q) => definirQtd(l.id, q)} onRemover={() => remover(l.id)} onNavegar={fecharPaineis} />
                ))}
              </ul>
              {temPeixe && <AvisoEntregaPeixe compacto className="mt-4" />}
              {compatibilidade && (
                <Aviso tipo={compatibilidade.tipo} className="mt-3">
                  {compatibilidade.texto}
                </Aviso>
              )}
              <CalculoFrete linhas={linhas} />
            </div>

            <div className="border-t border-border px-5 py-4">
              <div className="mb-1 flex justify-between text-pequeno text-text-muted">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatarPreco(total)}</span>
              </div>
              <div className="mb-4 flex items-baseline justify-between">
                <span className="font-bold">Total sem frete</span>
                <Preco valor={total} />
              </div>
              <Button tamanho="lg" largo onClick={() => ir(urlEtapaCheckout('carrinho'))}>
                Finalizar compra
                <ArrowRight aria-hidden="true" />
              </Button>
              <p className="mt-3 text-center text-legenda text-text-muted">
                Prefere tirar uma dúvida?{' '}
                <button type="button" onClick={() => abrirWhatsApp('o meu carrinho')} className="alvo-toque font-bold text-primary-text underline underline-offset-4">
                  Fale no WhatsApp
                </button>
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// Frete por CEP no próprio carrinho (item 19). O CEP fica guardado para a etapa de entrega.
function CalculoFrete({ linhas }) {
  const { rascunho, salvar } = useCheckoutRascunho()
  const [cep, setCep] = useState(rascunho.cep ?? '')
  const [estado, setEstado] = useState({ carregando: false, erro: null, resultado: null })

  const calcular = async (e) => {
    e.preventDefault()
    setEstado({ carregando: true, erro: null, resultado: null })
    try {
      const resultado = await calcularFrete(cep, linhas)
      salvar({ cep })
      setEstado({ carregando: false, erro: null, resultado })
    } catch (erro) {
      setEstado({ carregando: false, erro: erro.detalhes?.cep ?? erro.erro, resultado: null })
    }
  }

  return (
    <section aria-labelledby="titulo-frete" className="mt-5 rounded-xl border border-border-strong p-4">
      <h3 id="titulo-frete" className="mb-2 flex items-center gap-2 font-display text-corpo font-extrabold">
        <Truck aria-hidden="true" className="size-5 text-primary-text" />
        Calcular frete
      </h3>
      <form onSubmit={calcular} noValidate className="flex gap-2">
        <label htmlFor="cep-carrinho" className="sr-only">
          CEP
        </label>
        <Input
          id="cep-carrinho"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          value={cep}
          erro={estado.erro}
          aria-describedby={estado.erro ? 'cep-carrinho-erro' : undefined}
          onChange={(e) => setCep(mascararCep(e.target.value))}
          className="flex-1"
        />
        <Button type="submit" variant="secundario" disabled={estado.carregando}>
          {estado.carregando ? 'Calculando…' : 'Calcular'}
        </Button>
      </form>
      {estado.erro && (
        <p id="cep-carrinho-erro" className="mt-1.5 text-legenda font-semibold text-danger-text">
          {estado.erro}
        </p>
      )}
      <div aria-live="polite">
        {estado.resultado && (
          <ul className="mt-3 flex flex-col gap-2 text-pequeno">
            {estado.resultado.opcoes.map((o) => (
              <li key={o.id} className={`rounded-lg px-3 py-2 ${o.disponivel ? 'bg-surface-tint' : 'bg-danger-soft'}`}>
                <div className="flex justify-between gap-2 font-semibold">
                  <span>{o.rotulo}</span>
                  <span>{o.disponivel ? (o.valor == null ? 'a definir' : o.valor === 0 ? 'Grátis' : formatarPreco(o.valor)) : 'Indisponível'}</span>
                </div>
                {o.prazo && <p className="text-legenda text-text-muted">Prazo: {o.prazo}</p>}
                {o.pendente && <p className="text-legenda text-text-muted">{o.pendente}</p>}
                {o.motivo && <p className="mt-1 text-legenda text-foreground">{o.motivo}</p>}
              </li>
            ))}
            <li className="text-legenda text-text-muted">Valores provisórios de exemplo, até a loja confirmar.</li>
          </ul>
        )}
      </div>
    </section>
  )
}
