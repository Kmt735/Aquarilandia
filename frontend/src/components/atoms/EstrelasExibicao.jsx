import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

// Estrelas só para mostrar uma nota (não são clicáveis). O desenho é decorativo: quem usa este átomo
// escreve a nota em texto ao lado (ex.: "4,5 de 5"), então a leitura não depende das estrelas.
export default function EstrelasExibicao({ nota, className = 'size-5' }) {
  const cheias = Math.round(nota)
  return (
    <span aria-hidden="true" className="inline-flex shrink-0">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          strokeWidth={1.75}
          className={cn(className, n <= cheias ? 'fill-accent text-warning-text' : 'fill-transparent text-border-control')}
        />
      ))}
    </span>
  )
}
