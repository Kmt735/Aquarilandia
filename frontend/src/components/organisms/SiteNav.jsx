import { ChevronRight, Menu, Moon, Search, ShoppingCart, Sun } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import IconButton from '../atoms/IconButton'
import Logo from '../atoms/Logo'
import SublinhadoNav from '../atoms/SublinhadoNav'
import CartButton from '../molecules/CartButton'
import NavDropdown from '../molecules/NavDropdown'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import useCart from '../../hooks/useCart'
import useTema from '../../hooks/useTema'
import useUI from '../../hooks/useUI'
import { ROTAS } from '../../utils/rotas'

const links = [
  { to: ROTAS.inicio, rotulo: 'Início', end: true },
  { to: ROTAS.loja, rotulo: 'Loja' },
  { to: ROTAS.peixes, rotulo: 'Peixes' },
  { to: ROTAS.primeiroAquario, rotulo: 'Primeiro Aquário' },
  { to: ROTAS.servicos, rotulo: 'Serviços' },
]

// Link do menu: marinho → azul, com traço azul no hover/foco e na página ativa
const classeLink = ({ isActive }) =>
  `group/link relative py-2 text-[15px] font-bold whitespace-nowrap transition-colors ${isActive ? 'text-primary-text' : 'text-foreground hover:text-primary-text'}`

function BotaoTema({ escuro, onClick }) {
  const rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro'
  return (
    <IconButton aria-label={rotulo} title={rotulo} aria-pressed={escuro} onClick={onClick}>
      {escuro ? <Sun /> : <Moon />}
    </IconButton>
  )
}

export default function SiteNav() {
  const { pathname } = useLocation()
  const { abrirPainel } = useUI()
  const { quantidade, bump } = useCart()
  const [tema, alternarTema] = useTema()
  const [menuAberto, setMenuAberto] = useState(false)
  const escuro = tema === 'dark'

  return (
    <header className="sticky top-0 z-[150] border-b border-border bg-surface">
      <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 desk:px-10">
        <Logo />

        <nav aria-label="Principal" className="hidden items-center gap-5 desk:flex xl:gap-7">
          {links.map((l) =>
            l.to === ROTAS.loja ? (
              <NavDropdown key={l.to} ativo={pathname === ROTAS.loja} />
            ) : (
              <NavLink key={l.to} to={l.to} end={l.end} className={classeLink}>
                {({ isActive }) => (
                  <>
                    {l.rotulo}
                    <SublinhadoNav ativo={isActive} />
                  </>
                )}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <IconButton
            className="max-sm:hidden"
            aria-label="Buscar (atalho: tecla /)"
            title="Buscar — atalho: tecla /"
            onClick={() => abrirPainel('busca')}
          >
            <Search />
          </IconButton>
          <IconButton
            className="desk:hidden"
            aria-label="Abrir carrinho"
            title="Carrinho"
            badge={quantidade}
            badgeKey={bump}
            onClick={() => abrirPainel('carrinho')}
          >
            <ShoppingCart />
          </IconButton>
          <BotaoTema escuro={escuro} onClick={alternarTema} />
          <CartButton compacto className="ml-1 max-desk:hidden" onClick={() => abrirPainel('carrinho')} />

          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild>
              <IconButton className="desk:hidden" aria-label="Abrir menu">
                <Menu />
              </IconButton>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] gap-0 border-border bg-surface p-0 sm:max-w-sm">
              <SheetHeader className="border-b border-border px-5 py-4">
                <SheetTitle className="text-left">
                  <Logo />
                </SheetTitle>
                <SheetDescription className="sr-only">Navegação do site</SheetDescription>
              </SheetHeader>
              <nav aria-label="Menu" className="px-3 py-2">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    end={l.end}
                    onClick={() => setMenuAberto(false)}
                    className={({ isActive }) =>
                      `flex items-center justify-between rounded-xl px-3 py-3.5 text-[16px] font-bold transition-colors hover:bg-surface-tint ${isActive ? 'bg-surface-tint text-primary-text' : 'text-foreground'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className="flex items-center gap-2.5">
                          <span aria-hidden="true" className={`size-1.5 rounded-full ${isActive ? 'bg-primary-text' : 'bg-transparent'}`} />
                          {l.rotulo}
                        </span>
                        <ChevronRight aria-hidden="true" className="size-4 text-text-muted" />
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-auto grid gap-2 border-t border-border p-5">
                <Button
                  variant="outline"
                  onClick={() => {
                    setMenuAberto(false)
                    abrirPainel('busca')
                  }}
                >
                  <Search />
                  Buscar
                </Button>
                <CartButton
                  onClick={() => {
                    setMenuAberto(false)
                    abrirPainel('carrinho')
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
