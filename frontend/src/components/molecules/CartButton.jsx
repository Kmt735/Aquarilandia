import { ShoppingCart } from 'lucide-react'
import Badge from '../atoms/Badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import useCart from '../../hooks/useCart'
import { formatarPreco } from '../../utils/format'

// Carrinho no cabeçalho (amarelo = atalho persistente): mostra o total e o contador (item 1).
// O contador fica fora do botão (é visual); a quantidade vai no texto para leitores de tela.
export default function CartButton({ onClick, className = '' }) {
  const { quantidade, total, bump, conferindo, pendentes } = useCart()

  return (
    <span className={cn('relative inline-flex', className)}>
      <Button variant="accent" onClick={onClick}>
        <ShoppingCart aria-hidden="true" />
        <span className="sr-only">
          Carrinho, {quantidade} {quantidade === 1 ? 'item' : 'itens'}, total
        </span>
        <span className="tabular-nums">{conferindo ? 'Conferindo carrinho' : pendentes ? 'Revisar carrinho' : formatarPreco(total)}</span>
      </Button>
      {quantidade > 0 && (
        <Badge key={bump} animar={bump > 0}>
          {quantidade}
        </Badge>
      )}
    </span>
  )
}
