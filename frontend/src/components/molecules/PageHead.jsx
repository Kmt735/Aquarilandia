import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import Eyebrow from '../atoms/Eyebrow'

// Cabeçalho das páginas internas: trilha (breadcrumb) + H1 + descrição curta
export default function PageHead({ eyebrow, titulo, descricao, trilha, children }) {
  return (
    <div className="luz-luminaria border-b border-border bg-surface-tint">
      <div className="mx-auto max-w-[1200px] px-4 pt-8 pb-10 sm:px-6 desk:px-10 desk:pt-12 desk:pb-12">
        {trilha && <Trilha itens={trilha} />}
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className={`${eyebrow ? 'mt-4' : ''} text-h1 text-primary-dark dark:text-foreground`}>{titulo}</h1>
        {descricao && <p className="mt-3 max-w-[620px] text-corpo-lg text-text-muted">{descricao}</p>}
        {children}
      </div>
    </div>
  )
}

export function Trilha({ itens }) {
  return (
    <nav aria-label="Você está em" className="mb-5">
      <ol className="flex flex-wrap items-center gap-1 text-pequeno text-text-muted">
        {itens.map((item, i) => (
          <li key={item.rotulo} className="flex items-center gap-1">
            {item.to ? (
              <Link to={item.to} className="alvo-toque rounded-sm underline-offset-4 hover:text-primary-text hover:underline">
                {item.rotulo}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-foreground">
                {item.rotulo}
              </span>
            )}
            {i < itens.length - 1 && <ChevronRight aria-hidden="true" className="size-4" />}
          </li>
        ))}
      </ol>
    </nav>
  )
}
