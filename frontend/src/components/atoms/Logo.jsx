import { Link } from 'react-router'
<<<<<<< HEAD
import logoImage from '../../assets/Aquarilandia_Logo.jpeg'
=======
import marca from '../../assets/logo-marca.png'
import marca2x from '../../assets/logo-marca@2x.png'
>>>>>>> f96f46093f6c58082160359fd5f978a604ba4e65

// Marca (golfinhos) num círculo branco fixo — os golfinhos são pretos e sumiriam no tema escuro
export default function Logo({ className = '' }) {
  return (
<<<<<<< HEAD
    <Link to="/" aria-label="Aquarilândia - página inicial" className="flex shrink-0 items-center">
      <img src={logoImage} alt="Aquarilândia" className="size-16 object-contain" />
=======
    <Link to="/" className={`flex shrink-0 items-center gap-2.5 rounded-full ${className}`}>
      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-logo-tile">
        <img src={marca} srcSet={`${marca} 1x, ${marca2x} 2x`} alt="" width="34" height="34" className="size-[34px]" />
      </span>
      <span className="font-display text-[17px] font-semibold tracking-[-0.01em] text-foreground">Aquarilândia</span>
>>>>>>> f96f46093f6c58082160359fd5f978a604ba4e65
    </Link>
  )
}
