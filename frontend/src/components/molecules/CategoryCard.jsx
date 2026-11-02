import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import IlustracaoCategoria from './IlustracaoCategoria'
import { cn } from '@/lib/utils'

<<<<<<< Updated upstream
export default function CategoryCard({ icone: Icone, rotulo, to }) {
  return (
    <Link
      to={to}
      className="group flex min-h-[132px] flex-col justify-between gap-4 rounded-card bg-surface p-4 text-foreground transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-white sm:p-5"
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-surface-tint text-primary-text transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
        {Icone && <Icone aria-hidden="true" className="size-6" />}
      </span>
      <span className="flex items-center justify-between gap-2 font-display text-[16px] leading-tight font-extrabold text-primary-dark dark:text-foreground">
        {rotulo}
        <ArrowRight
          aria-hidden="true"
          className="size-4 shrink-0 text-primary-text transition-transform max-sm:hidden duration-200 group-hover:translate-x-0.5"
        />
=======
// Categoria da loja: `destaque` = bloco grande com ilustração; sem ele, bloco compacto (ícone + nome).
// A descrição só aparece em hover/foco no desktop, sem mudar o tamanho do bloco. No celular e nas telas
// sem hover ela fica `sr-only`: some da tela, mas continua sendo lida (itens 2, 22, 32).
export default function CategoryCard({ icone: Icone, rotulo, descricao, to, destaque = false, grande = false }) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex h-full overflow-hidden rounded-card transition-[transform,box-shadow,background-color] duration-(--dur-media) ease-saida hover:-translate-y-1 hover:shadow-pop motion-reduce:hover:translate-y-0',
        destaque ? 'min-h-36 flex-col justify-end bg-surface-tint p-4 desk:p-5' : 'min-h-14 items-center gap-3 bg-surface-muted px-4 py-2.5',
      )}
    >
      {destaque && <IlustracaoCategoria nome={rotulo} className={cn('absolute top-3 right-3 h-auto transition-opacity duration-(--dur-media)', grande ? 'w-24 md:top-5 md:right-6 md:w-52 desk:w-72' : 'w-20 md:max-desk:group-hover:opacity-0 md:max-desk:group-focus-visible:opacity-0')} />}
      {Icone && <Icone aria-hidden="true" className={cn('size-5 shrink-0 text-text-muted transition-colors group-hover:text-primary-text group-focus-visible:text-primary-text', destaque && 'absolute top-4 left-4 desk:top-5 desk:left-5')} />}
      <span className="min-w-0">
        <span className={cn('block font-display font-extrabold text-foreground transition-colors group-hover:text-primary-text', destaque ? 'text-h4' : 'text-pequeno')}>{rotulo}</span>
        {descricao && (
          <span className="block transition-[grid-template-rows] duration-(--dur-media) ease-saida md:grid md:grid-rows-[0fr] md:group-hover:grid-rows-[1fr] md:group-focus-visible:grid-rows-[1fr]">
            <span className="block min-h-0 overflow-hidden text-legenda text-text-muted transition-opacity duration-(--dur-media) group-hover:opacity-100 group-focus-visible:opacity-100 max-md:sr-only md:opacity-0 [@media(hover:none)]:sr-only">
              {descricao}
            </span>
          </span>
        )}
>>>>>>> Stashed changes
      </span>
      <ArrowRight
        aria-hidden="true"
        className={cn(
          'size-4 shrink-0 -translate-x-1 text-primary-text opacity-0 transition-[opacity,transform] duration-(--dur-media) group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100',
          destaque ? 'absolute right-4 bottom-4' : 'ml-auto',
        )}
      />
    </Link>
  )
}
