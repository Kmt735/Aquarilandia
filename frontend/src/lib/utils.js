import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// O tailwind-merge precisa conhecer a escala tipográfica do site (index.css › --text-*):
// sem isso ele confunde `text-pequeno` (tamanho) com uma cor e apaga a cor do texto.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'legenda', 'pequeno', 'corpo', 'corpo-lg', 'h4', 'h3', 'h2', 'h1', 'display'] }],
    },
  },
})

// Junta classes e resolve conflitos do Tailwind (padrão do shadcn/ui)
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
