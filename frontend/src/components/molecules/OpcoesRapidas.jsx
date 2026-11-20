import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// Escolha única em "chips" (rádios nativos com aparência de botão). Selecionado: azul + ✓ (não só cor).
// Opções no formato [[valor, rótulo], ...]
export default function OpcoesRapidas({ id, legenda, opcoes, valor, onChange }) {
  return (
    <fieldset>
      <legend className="mb-2 text-corpo font-bold text-foreground">
        {legenda} <span className="text-pequeno font-normal text-text-muted">(opcional)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([v, rotulo]) => {
          const marcado = valor === v
          return (
            <label
              key={v}
              className={cn(
                'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-pequeno font-semibold transition-[color,background-color,border-color] duration-(--dur-rapida)',
                'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-primary dark:has-[input:focus-visible]:outline-primary-text',
                marcado
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border-control bg-surface text-foreground hover:border-primary-text hover:text-primary-text',
              )}
            >
              <input type="radio" name={id} value={v} checked={marcado} onChange={() => onChange(v)} className="sr-only" />
              {marcado && <Check aria-hidden="true" className="-ml-1 size-4" />}
              {rotulo}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
