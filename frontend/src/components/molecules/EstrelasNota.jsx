import { Star } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { NOTAS, ROTULO_NOTA } from '../../data/avaliacao-site'

// Nota de 1 a 5 com rádios nativos: Tab entra no grupo, setas trocam a nota, cada estrela diz "4 de 5".
// Estrela cheia: amarelo com contorno âmbar (contraste ≥ 3:1 nos dois temas); vazia: contorno de controle.
// O texto ao lado ("4 de 5 · Boa") garante que a nota não dependa só da cor.
export default function EstrelasNota({ id, legenda, valor, onChange }) {
  const [previa, setPrevia] = useState(0)
  const mostrada = previa || valor

  return (
    <fieldset>
      <legend id={`${id}-legenda`} className="mb-2 text-corpo font-bold text-foreground">
        {legenda}
      </legend>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="-ml-1.5 flex" onMouseLeave={() => setPrevia(0)}>
          {NOTAS.map((n) => {
            const cheia = n <= mostrada
            return (
              <label
                key={n}
                onMouseEnter={() => setPrevia(n)}
                className="flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors duration-(--dur-rapida) hover:bg-surface-muted has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-0 has-[input:focus-visible]:outline-primary dark:has-[input:focus-visible]:outline-primary-text"
              >
                <input
                  type="radio"
                  name={id}
                  value={n}
                  checked={valor === n}
                  onChange={() => onChange(n)}
                  aria-label={`${n} de 5`}
                  className="sr-only"
                />
                <Star
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className={cn(
                    'size-8 transition-[color,fill,transform] duration-(--dur-rapida)',
                    cheia ? 'scale-105 fill-accent text-warning-text' : 'fill-transparent text-border-control',
                  )}
                />
              </label>
            )
          })}
        </div>
        <p className="min-h-6 text-pequeno font-semibold text-text-muted" aria-hidden="true">
          {mostrada ? `${mostrada} de 5 · ${ROTULO_NOTA[mostrada]}` : 'Escolha de 1 a 5 estrelas'}
        </p>
      </div>
    </fieldset>
  )
}
