import { cn } from '@/lib/utils'

// Bloco de carregamento. Envolva o grupo com aria-busy="true" e um texto sr-only "Carregando…".
export default function Skeleton({ className = '' }) {
  return <div aria-hidden="true" className={cn('animate-pulso rounded-lg bg-surface-muted', className)} />
}
