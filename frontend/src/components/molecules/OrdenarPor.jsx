import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ordenacoes } from '../../data/categorias'

// Lista para ordenar os produtos (preço ou nome)
export default function OrdenarPor({ valor, onChange }) {
  return (
    <Select value={valor ?? 'padrao'} onValueChange={(v) => onChange(v === 'padrao' ? null : v)}>
      <SelectTrigger
        aria-label="Ordenar produtos"
        className="h-12! w-full rounded-full border-border-strong bg-surface px-5 text-[15px] text-foreground sm:w-[210px]"
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