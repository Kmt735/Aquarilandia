import { Link } from 'react-router'

// Categoria com ícone consistente + uma linha que explica o termo (itens 2, 22, 32)
export default function CategoryCard({ icone: Icone, rotulo, descricao, to }) {
  return (
    <Link
      to={to}
      className="group flex h-full items-start gap-3.5 rounded-card border border-border-strong bg-surface p-4 transition-[border-color,box-shadow,transform] duration-(--dur-media) ease-saida hover:-translate-y-0.5 hover:border-primary-text/50 hover:shadow-glow"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        {Icone && <Icone aria-hidden="true" className="size-5" />}
      </span>
      <span className="min-w-0">
        <span className="block font-display text-corpo font-extrabold text-foreground group-hover:text-primary-text">{rotulo}</span>
        {descricao && <span className="mt-0.5 block text-legenda text-text-muted">{descricao}</span>}
      </span>
    </Link>
  )
}
