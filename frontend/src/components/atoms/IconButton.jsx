import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Badge from './Badge'

export default function IconButton({ children, badge, badgeKey = 0, className = '', ...props }) {
  return (
    <Button variant="outline" size="icon" className={cn('relative', className)} {...props}>
      {children}
      {badge !== undefined && (
        <Badge key={badgeKey} animar={badgeKey > 0}>
          {badge}
        </Badge>
      )}
    </Button>
  )
}
