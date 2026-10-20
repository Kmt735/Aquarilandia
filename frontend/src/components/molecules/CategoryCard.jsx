import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

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
      </span>
    </Link>
  )
}
