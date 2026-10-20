import { Minus, Plus } from 'lucide-react'
import Midia from '../atoms/Midia'
import { Button } from '@/components/ui/button'
import { iconeCategoria } from '@/lib/icones'
import { formatarPreco } from '../../utils/format'

export default function CartItem({ produto, qtd, onIncrementar, onDecrementar, onRemover }) {
  return (
    <div className="flex items-start gap-3.5 border-b border-border py-4">
      <div className="w-14 shrink-0 overflow-hidden rounded-xl">
        <Midia proporcao="1/1" icone={iconeCategoria[produto.categoria]} className="[&>svg]:size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h5 className="text-[14.5px]">{produto.nome}</h5>
        <div className="mt-0.5 text-[14px] font-bold text-primary-text tabular-nums">
          {formatarPreco(produto.preco * qtd)}
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <Button variant="outline" size="icon-sm" className="size-8" onClick={onDecrementar} aria-label="Diminuir quantidade">
            <Minus />
          </Button>
          <span className="min-w-5 text-center text-[13px] tabular-nums">{qtd}</span>
          <Button variant="outline" size="icon-sm" className="size-8" onClick={onIncrementar} aria-label="Aumentar quantidade">
            <Plus />
          </Button>
        </div>
      </div>
      <Button variant="link" size="xs" className="text-text-muted hover:text-danger" onClick={onRemover}>
        Remover
      </Button>
    </div>
  )
}
