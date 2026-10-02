import { Link } from 'react-router'
import Eyebrow from '../atoms/Eyebrow'

export default function SectionHead({ eyebrow, titulo, link, className = 'mb-8' }) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div>
        <Eyebrow tom="cyan">{eyebrow}</Eyebrow>
        <h2 className="mt-1.5 text-[27px]">{titulo}</h2>
      </div>
      {link && (
        <Link to={link.to} className="shrink-0 text-[13px] font-bold text-gold">
          {link.rotulo}
        </Link>
      )}
    </div>
  )
}
