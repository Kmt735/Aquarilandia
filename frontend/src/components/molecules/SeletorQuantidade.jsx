import { Minus, Plus } from 'lucide-react'

// −/+ com mínimo 1 e máximo = estoque (item 5). O valor é anunciado (aria-live) a cada mudança.
export default function SeletorQuantidade({ valor, max, onChange, rotulo = 'Quantidade', compacto = false, id }) {
  const limite = max ?? 99
  const tam = compacto ? 'size-9 alvo-toque' : 'size-11'
  const botao = `flex ${tam} items-center justify-center rounded-full border border-border-control text-foreground transition-colors hover:border-primary-text hover:text-primary-text disabled:pointer-events-none disabled:opacity-40`

  return (
    <div role="group" aria-label={rotulo} className="inline-flex items-center gap-2">
      <button type="button" className={botao} onClick={() => onChange(valor - 1)} disabled={valor <= 1} aria-label="Diminuir quantidade">
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <output id={id} aria-live="polite" className="min-w-7 text-center font-bold tabular-nums">
        {valor}
      </output>
      <button type="button" className={botao} onClick={() => onChange(valor + 1)} disabled={valor >= limite} aria-label="Aumentar quantidade">
        <Plus aria-hidden="true" className="size-4" />
      </button>
      {max != null && valor >= limite && <span className="text-legenda text-text-muted">Máximo: {limite}</span>}
    </div>
  )
}
