import { NavLink, useLocation } from 'react-router'
import Button from '../atoms/Button'
import IconButton from '../atoms/IconButton'
import Logo from '../atoms/Logo'
import NavDropdown from '../molecules/NavDropdown'
import useCart from '../../hooks/useCart'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { ROTAS } from '../../utils/rotas'

const classeLink = ({ isActive }) => (isActive ? 'text-white' : 'text-ink-muted hover:text-white')

export default function SiteNav() {
  const { pathname } = useLocation()
  const { abrirPainel } = useUI()
  const { quantidade, bump } = useCart()
  const abrirWhatsApp = useWhatsApp()

  return (
    <nav className="relative z-[150] flex items-center justify-between gap-4 border-b border-line bg-night px-4 py-4 text-white desk:px-10">
      <Logo />

      <div className="hidden items-center gap-[26px] text-sm desk:flex">
        <NavLink to={ROTAS.inicio} end className={classeLink}>
          Início
        </NavLink>
        <NavDropdown ativo={pathname === ROTAS.loja} />
        <NavLink to={ROTAS.peixes} className={classeLink}>
          Peixes
        </NavLink>
        <NavLink to={ROTAS.primeiroAquario} className={classeLink}>
          Primeiro Aquário
        </NavLink>
        <NavLink to={ROTAS.servicos} className={classeLink}>
          Serviços
        </NavLink>
      </div>

      <div className="flex items-center gap-2.5">
        <IconButton
          aria-label="Buscar (atalho: tecla /)"
          title="Buscar — atalho: tecla /"
          onClick={() => abrirPainel('busca')}
          data-h="H4 · H7 Lupa + atalho “/”"
        >
          🔍
        </IconButton>
        <IconButton
          aria-label="Abrir carrinho"
          title="Carrinho"
          badge={quantidade}
          badgeKey={bump}
          onClick={() => abrirPainel('carrinho')}
          data-h="H1 · H6 Carrinho sempre visível"
        >
          🛒
        </IconButton>
        <Button variant="cta" className="hidden sm:inline-block" onClick={() => abrirWhatsApp()}>
          Falar no WhatsApp
        </Button>
      </div>
    </nav>
  )
}
