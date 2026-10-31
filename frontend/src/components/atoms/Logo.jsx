import { Link } from 'react-router'
import marca from '../../assets/logo-marca.png'
import marca2x from '../../assets/logo-marca@2x.png'

// Marca (golfinhos) num círculo branco fixo — os golfinhos são pretos e sumiriam no tema escuro
export default function Logo({ className = '' }) {
  return (
    <Link to="/" className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-full ${className}`}>
      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-logo-tile">
        <img src={marca} srcSet={`${marca} 1x, ${marca2x} 2x`} alt="" width="34" height="34" className="size-[34px]" />
      </span>
      <span className="font-display text-h3 font-extrabold tracking-[-0.01em] text-primary-dark dark:text-foreground">Aquarilândia</span>
    </Link>
  )
}
