import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Badge from './Badge'

export default function IconButton({ children, badge, badgeKey = 0, className = '', ...props }) {
  return (
    <Button variant="outline" size="icon" className={cn('relative border-border hover:bg-surface-tint', className)} {...props}>
      {children}
      {badge > 0 && (
        <Badge key={badgeKey} animar={badgeKey > 0}>
          {badge}
        </Badge>
      )}
    </Button>
  )
}
