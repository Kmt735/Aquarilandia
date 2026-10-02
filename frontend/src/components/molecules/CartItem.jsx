import { formatarPreco } from '../../utils/format'

export default function CartItem({ produto, qtd, onIncrementar, onDecrementar, onRemover }) {
  const botaoQtd = 'size-[26px] rounded-md border border-line bg-abyss text-ink'

  return (
    <div className="flex items-center gap-3 border-b border-dashed border-line py-3.5">
      <div className="flex size-[46px] shrink-0 items-center justify-center rounded-[10px] bg-abyss text-xl">
        {produto.icone}
      </div>
      <div className="flex-1">
        <h5 className="font-display text-[13px] font-bold">{produto.nome}</h5>
        <div className="font-mono text-xs text-gold">{formatarPreco(produto.preco * qtd)}</div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button type="button" className={botaoQtd} onClick={onDecrementar} aria-label="Diminuir quantidade">
            −
          </button>
          <span className="min-w-4 text-center font-mono text-xs">{qtd}</span>
          <button type="button" className={botaoQtd} onClick={onIncrementar} aria-label="Aumentar quantidade">
            +
          </button>
        </div>
      </div>
      <button type="button" onClick={onRemover} className="text-[11.5px] text-ink-soft underline">
        Remover
      </button>
    </div>
  )
}
