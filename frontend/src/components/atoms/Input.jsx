import { Input as UIInput } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { classeCampo } from './campo'

// `erro` é a mensagem (string) — liga aria-invalid; o FormField liga aria-describedby
export default function Input({ erro, className = '', ...props }) {
  return <UIInput aria-invalid={Boolean(erro) || undefined} className={cn(classeCampo(erro), 'h-11', className)} {...props} />
}
