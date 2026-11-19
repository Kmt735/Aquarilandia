import { useId } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ordenacoes } from '../../data/categorias'

// Ordenação com rótulo visível. O nome acessível junta rótulo e valor: "Ordenar por, Relevância".
// Valores antigos fora do menu (ex.: ?ordem=z-a) continuam funcionando e aparecem no botão.
export default function OrdenarPor({ valor, onChange }) {
  const id = useId()
  const opcoes = valor && !ordenacoes.some((o) => o.valor === valor) ? [...ordenacoes, { valor, rotulo: valor === 'z-a' ? 'Nome (Z a A)' : valor }] : ordenacoes
  return (
    <div className="flex items-center gap-2">
      <span id={`${id}-rotulo`} className="shrink-0 text-pequeno font-semibold text-text-muted">
        Ordenar por
      </span>
      <Select value={valor ?? 'padrao'} onValueChange={(v) => onChange(v === 'padrao' ? null : v)}>
        <SelectTrigger
          id={`${id}-botao`}
          aria-labelledby={`${id}-rotulo ${id}-botao`}
          className="h-11! w-full min-w-0 rounded-full border-border-control bg-surface px-4 text-pequeno text-foreground sm:w-[190px]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o) => (
            <SelectItem key={o.valor} value={o.valor} className="min-h-11">
              {o.rotulo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
