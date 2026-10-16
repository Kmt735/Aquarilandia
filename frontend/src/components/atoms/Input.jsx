import { Input as UIInput } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { classeCampo } from './campo'

export default function Input({ estado, className = '', ...props }) {
  return <UIInput aria-invalid={estado === 'erro' || undefined} className={cn(classeCampo(estado), 'h-11', className)} {...props} />
}
