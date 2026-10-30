import { Button as UIButton } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Hierarquia de botões (STYLEGUIDE.md › Botões). No máximo 1 `primario` por bloco (item 29 · atenção).
const variantes = {
  primario: 'default', // azul preenchido — a ação principal, sempre a mesma cor no site todo
  secundario: 'outline', // contorno
  terciario: 'ghost', // texto azul
  link: 'link',
  perigo: 'destructive',
  destaque: 'accent', // amarelo — só carrinho do cabeçalho e WhatsApp flutuante
}
const tamanhos = { sm: 'sm', md: 'default', lg: 'lg' }

export default function Button({ variant = 'primario', tamanho = 'md', largo = false, type = 'button', className = '', ...props }) {
  return (
    <UIButton
      type={type}
      variant={variantes[variant] ?? variant}
      size={tamanhos[tamanho] ?? tamanho}
      className={cn(largo && 'w-full', className)}
      {...props}
    />
  )
}
