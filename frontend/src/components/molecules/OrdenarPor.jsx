import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ordenacoes } from '../../data/categorias'

export default function OrdenarPor({ valor, onChange }) {
  return (
    <Select value={valor ?? 'padrao'} onValueChange={(v) => onChange(v === 'padrao' ? null : v)}>
      <SelectTrigger
        aria-label="Ordenar por"
        className="h-12! w-full rounded-full border-border-control bg-surface px-5 text-corpo text-foreground sm:w-[220px]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ordenacoes.map((o) => (
          <SelectItem key={o.valor} value={o.valor}>
            {o.rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
