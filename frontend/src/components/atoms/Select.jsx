import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { classeCampo } from './campo'

// Mantém a API do <select> nativo (value + onChange com e.target.value) sobre o Select do shadcn/ui
export default function Select({ id, estado, opcoes, placeholder = 'Selecione…', value, onChange, onBlur }) {
  return (
    <UISelect
      value={value || undefined}
      onValueChange={(v) => onChange?.({ target: { value: v } })}
      onOpenChange={(aberto) => !aberto && onBlur?.()}
    >
      <SelectTrigger id={id} aria-invalid={estado === 'erro' || undefined} className={cn(classeCampo(estado), 'h-11! w-full')}>
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
