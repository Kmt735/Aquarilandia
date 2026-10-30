import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { classeCampo } from './campo'

// Mantém a API do <select> nativo (value + onChange com e.target.value) sobre o Select do shadcn/ui
export default function Select({ id, name, erro, opcoes, placeholder = 'Selecione…', value, onChange, onBlur, ...props }) {
  return (
    <UISelect
      name={name}
      value={value || undefined}
      onValueChange={(v) => onChange?.({ target: { value: v } })}
      onOpenChange={(aberto) => !aberto && onBlur?.()}
    >
      <SelectTrigger
        id={id}
        name={name}
        aria-invalid={Boolean(erro) || undefined}
        className={cn(classeCampo(erro), 'h-11! w-full')}
        {...props}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((opcao) => (
          <SelectItem key={opcao} value={opcao}>
            {opcao}
          </SelectItem>
        ))}
      </SelectContent>
    </UISelect>
  )
}
