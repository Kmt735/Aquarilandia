import { Link } from 'react-router'

export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3 font-display text-[19px] font-extrabold text-white">
      <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-ring p-[3px]">
        <span className="flex size-full items-center justify-center rounded-full bg-abyss text-[15px]">🐟</span>
      </span>
      Aquarilândia
    </Link>
  )
}
