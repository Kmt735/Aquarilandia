import { Link } from 'react-router'
import Eyebrow from '../atoms/Eyebrow'

export default function SectionHead({ eyebrow, titulo, link, className = 'mb-10' }) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-3 text-[30px] leading-tight desk:text-[36px]">{titulo}</h2>
      </div>
      {link && (
        <Link
          to={link.to}
          className="shrink-0 text-[14px] font-semibold text-primary-text underline decoration-transparent underline-offset-4 transition-colors hover:decoration-neon"
        >
          {link.rotulo}
        </Link>
      )}
    </div>
  )
}
