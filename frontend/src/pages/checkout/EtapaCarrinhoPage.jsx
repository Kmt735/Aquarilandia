import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import Button from '../../components/atoms/Button'
import Aviso from '../../components/molecules/Aviso'
import AvisoEntregaPeixe from '../../components/molecules/AvisoEntregaPeixe'
import CartItem from '../../components/molecules/CartItem'
import ResumoPedido from '../../components/organisms/ResumoPedido'
import useCart from '../../hooks/useCart'
import useTituloPagina from '../../hooks/useTituloPagina'
import { analisarCompatibilidade } from '../../utils/compatibilidade'
import { ROTAS, urlEtapaCheckout } from '../../utils/rotas'

// Etapa 1 · revisar itens e quantidades
export default function EtapaCarrinhoPage() {
  useTituloPagina('Carrinho · Finalizar compra')
  const { linhas, temPeixe, definirQtd, remover } = useCart()
  const navigate = useNavigate()
  const compat = analisarCompatibilidade(linhas)
  const itens = linhas.map((l) => ({ id: l.id, nome: l.item.nome, preco: l.item.preco, qtd: l.qtd }))

  return (
    <div className="grid items-start gap-8 desk:grid-cols-[1fr_360px]">
      <section aria-labelledby="titulo-etapa">
        <h2 id="titulo-etapa" className="mb-4 text-h2">
          Revise seu carrinho
        </h2>
        <ul className="rounded-card border border-border-strong bg-surface px-5">
          {linhas.map((l) => (
            <CartItem key={l.id} linha={l} onQtd={(q) => definirQtd(l.id, q)} onRemover={() => remover(l.id)} />
          ))}
        </ul>
        {temPeixe && <AvisoEntregaPeixe className="mt-4" />}
        {compat && (
          <Aviso tipo={compat.tipo} className="mt-3">
            {compat.texto}
          </Aviso>
        )}
        <Link to={ROTAS.loja} className="alvo-toque mt-5 inline-block text-pequeno font-bold text-primary-text underline underline-offset-4">
          Continuar comprando
        </Link>
      </section>
      <ResumoPedido itens={itens}>
        <Button tamanho="lg" largo className="mt-5" onClick={() => navigate(urlEtapaCheckout('entrega'))}>
          Continuar para a entrega
          <ArrowRight aria-hidden="true" />
        </Button>
      </ResumoPedido>
    </div>
  )
}
