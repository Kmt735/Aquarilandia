import { ShoppingCart } from 'lucide-react'
import Badge from '../atoms/Badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import useCart from '../../hooks/useCart'
import { formatarPreco } from '../../utils/format'

// Ação principal da loja no cabeçalho: abre o carrinho e mostra o total; o contador vermelho fica no canto
// `compacto`: esconde o total em telas médias, onde o cabeçalho fica apertado
export default function CartButton({ onClick, compacto = false, className = '' }) {
  const { quantidade, total, bump } = useCart()
  const itens = `${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`

  return (
    <Button
      variant="accent"
      aria-label={`Abrir carrinho, ${itens}, ${formatarPreco(total)}`}
      className={cn('relative', className)}
      onClick={onClick}
    >
      <ShoppingCart aria-hidden="true" />
      <span>Carrinho</span>
      <span aria-hidden="true" className={cn('border-l border-accent-foreground/25 pl-2 tabular-nums', compacto && 'max-xl:hidden')}>
        {formatarPreco(total)}
      </span>
      {quantidade > 0 && (
        <Badge key={bump} animar={bump > 0}>
          {quantidade}
        </Badge>
      )}
    </Button>
  )
}
