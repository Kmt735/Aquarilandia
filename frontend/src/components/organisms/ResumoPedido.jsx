import { subtotalEmCentavos } from '../../utils/dinheiro'
import Preco from '../atoms/Preco'
import { formatarPreco } from '../../utils/format'

// Resumo de valores, usado no checkout e no detalhe da compra (item 31 · decisão com tudo visível)
export default function ResumoPedido({ itens, frete, titulo = 'Resumo', children }) {
  const subtotal = subtotalEmCentavos(itens) / 100
  const freteTexto = frete === undefined ? 'calculado na entrega' : frete === null ? 'a definir com a loja' : frete === 0 ? 'Grátis' : formatarPreco(frete)
  const total = subtotal + (frete ?? 0)

  return (
    <section aria-labelledby="titulo-resumo" className="rounded-card border border-border-strong bg-surface p-5">
      <h2 id="titulo-resumo" className="mb-3 text-h4">
        {titulo}
      </h2>
      <ul className="mb-3 flex flex-col gap-2 border-b border-border pb-3 text-pequeno">
        {itens.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span>
              {i.qtd} × {i.nome}
            </span>
            <span className="shrink-0 tabular-nums">{formatarPreco(i.preco * i.qtd, { centavos: i.centavos })}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-1 text-pequeno">
        <div className="flex justify-between">
          <dt className="text-text-muted">Subtotal</dt>
          <dd className="tabular-nums">{formatarPreco(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-text-muted">Frete</dt>
          <dd>{freteTexto}</dd>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
          <dt className="font-bold">Total{frete == null ? ' sem frete' : ''}</dt>
          <dd>
            <Preco valor={total} />
          </dd>
        </div>
      </dl>
      {children}
    </section>
  )
}
