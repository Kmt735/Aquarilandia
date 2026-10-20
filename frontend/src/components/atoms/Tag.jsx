import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Status com ponto: azul quando positivo, neutro quando não
export default function Tag({ children, positivo = true, className = '', ...props }) {
  return (
    <Badge variant={positivo ? 'soft' : 'secondary'} className={cn('gap-1.5 px-2.5 py-1 text-[11.5px]', className)} {...props}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${positivo ? 'bg-primary-text' : 'bg-current'}`} />
      {children}
    </Badge>
  )
}
