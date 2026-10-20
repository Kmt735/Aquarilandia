import { Link } from 'react-router'
import Eyebrow from '../atoms/Eyebrow'

// tom="claro": títulos e link em branco, para fundos azuis
export default function SectionHead({ eyebrow, titulo, link, tom = 'padrao', className = 'mb-10' }) {
  const claro = tom === 'claro'
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div>
        <Eyebrow tom={tom}>{eyebrow}</Eyebrow>
        <h2 className={`mt-3 text-[30px] leading-tight desk:text-[38px] ${claro ? 'text-white' : 'text-primary-dark dark:text-foreground'}`}>
          {titulo}
        </h2>
      </div>
      {link && (
        <Link
          to={link.to}
          className={`shrink-0 rounded-full text-[14.5px] font-bold underline decoration-transparent decoration-2 underline-offset-4 transition-colors hover:decoration-accent ${claro ? 'text-white focus-visible:outline-white' : 'text-primary-text'}`}
        >
          {link.rotulo}
        </Link>
      )}
    </div>
  )
}
