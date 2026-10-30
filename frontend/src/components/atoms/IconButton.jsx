import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Badge from './Badge'

// Botão só de ícone: `aria-label` é obrigatório. Alvo de 44 × 44 px.
// O contador (badge) fica fora do botão, para não entrar no nome acessível.
export default function IconButton({ children, badge, badgeKey = 0, className = '', classeExterna = '', ...props }) {
  const botao = (
    <Button variant="outline" size="icon" className={cn('relative border-border-strong', className)} {...props}>
      {children}
    </Button>
  )
  if (!(badge > 0)) return botao
  return (
    <span className={cn('relative inline-flex', classeExterna)}>
      {botao}
      <Badge key={badgeKey} animar={badgeKey > 0}>
        {badge}
      </Badge>
    </span>
  )
}
