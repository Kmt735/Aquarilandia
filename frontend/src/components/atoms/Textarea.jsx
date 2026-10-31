import { Textarea as UITextarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { classeCampo } from './campo'

export default function Textarea({ erro, className = '', ...props }) {
  return <UITextarea aria-invalid={Boolean(erro) || undefined} className={cn(classeCampo(erro), className)} {...props} />
}
