import { Link } from 'react-router'
import logoImage from '../../assets/Aquarilandia_Logo.jpeg'

export default function Logo() {
  return (
    <Link to="/" aria-label="Aquarilândia - página inicial" className="flex shrink-0 items-center">
      <img src={logoImage} alt="Aquarilândia" className="size-16 object-contain" />
    </Link>
  )
}
