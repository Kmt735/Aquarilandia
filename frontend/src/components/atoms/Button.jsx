import { Button as UIButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Mantém os nomes de variante usados pelo site, sobre o Button do shadcn/ui
const variantes = {
  primary: { variant: 'default', size: 'lg' },
  ghost: { variant: 'outline', size: 'lg' },
  cta: { variant: 'default', size: 'default' },
  buy: { variant: 'default', size: 'sm', className: 'flex-1' },
  quote: { variant: 'default', size: 'default', className: 'w-full' },
  submit: { variant: 'default', size: 'lg', className: 'w-full' },
  whatsapp: { variant: 'default', size: 'lg', className: 'w-full' },
  guide: { variant: 'outline', size: 'sm' },
  guidePrimary: { variant: 'default', size: 'sm' },
}

export default function Button({ variant = 'primary', type = 'button', className = '', ...props }) {
  const v = variantes[variant]
  return <UIButton type={type} variant={v.variant} size={v.size} className={cn(v.className, className)} {...props} />
}
