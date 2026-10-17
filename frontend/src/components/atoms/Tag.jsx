import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Status com ponto: neon quando positivo, neutro quando não
export default function Tag({ children, positivo = true, className = '', ...props }) {
  return (
    <Badge variant={positivo ? 'neon' : 'secondary'} className={cn('gap-1.5 px-2.5 py-1 text-[11px]', className)} {...props}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${positivo ? 'neon-dot' : 'bg-current'}`} />
      {children}
    </Badge>
  )
}
