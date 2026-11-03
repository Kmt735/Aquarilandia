import Preco from '../atoms/Preco'
import { formatarPreco } from '../../utils/format'

// Estimativa de preço da montagem: subtotal por etapa + total (centavos → R$ via Intl, em formatarPreco)
export default function PriceEstimate({ etapas, totais }) {
  return (
    <div className="rounded-xl bg-surface-tint p-4">
      <dl className="space-y-1 text-pequeno">
        {etapas.map((e) => (
          <div key={e.id} className="flex justify-between gap-3 text-text-muted">
            <dt>{e.rotulo}</dt>
            <dd className="tabular-nums">{totais.porEtapa[e.id] ? formatarPreco(totais.porEtapa[e.id], { centavos: true }) : '—'}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-border-strong pt-2">
          <dt className="font-bold text-foreground">Total estimado</dt>
          <dd><Preco valor={totais.total} centavos tamanho="md" /></dd>
        </div>
      </dl>
      <p className="mt-2 text-legenda text-text-muted">
        O frete é calculado no carrinho. Peixes vivos dependem da região de entrega.
      </p>
    </div>
  )
}
