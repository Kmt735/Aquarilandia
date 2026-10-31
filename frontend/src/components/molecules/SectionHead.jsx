import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import Eyebrow from '../atoms/Eyebrow'

// Cabeçalho de seção: H2 por padrão (hierarquia correta: um H1 por página, seções em H2)
export default function SectionHead({ eyebrow, titulo, descricao, link, nivel = 2, id, className = 'mb-8' }) {
  const Titulo = `h${nivel}`
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${className}`}>
      <div className="max-w-[640px]">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <Titulo id={id} className={`${eyebrow ? 'mt-3' : ''} text-h2 text-primary-dark dark:text-foreground`}>
          {titulo}
        </Titulo>
        {descricao && <p className="mt-2 text-corpo text-text-muted">{descricao}</p>}
      </div>
      {link && (
        <Link
          to={link.to}
          className="alvo-toque inline-flex shrink-0 items-center gap-1.5 rounded-full text-pequeno font-bold text-primary-text underline decoration-transparent decoration-2 underline-offset-4 transition-colors hover:decoration-accent"
        >
          {link.rotulo}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  )
}
