import { ChevronRight, Menu, Moon, Search, ShoppingCart, Sun, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router'
import IconButton from '../atoms/IconButton'
import Logo from '../atoms/Logo'
import SublinhadoNav from '../atoms/SublinhadoNav'
import WhatsAppIcon from '../icons/WhatsAppIcon'
import CartButton from '../molecules/CartButton'
import NavDropdown from '../molecules/NavDropdown'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { iconeCategoria } from '@/lib/icones'
import { categoriasMenu } from '../../data/categorias'
import useAuth from '../../hooks/useAuth'
import useCart from '../../hooks/useCart'
import useTema from '../../hooks/useTema'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'
import { formatarPreco } from '../../utils/format'
import { ROTAS, urlCategoria } from '../../utils/rotas'

const links = [
  { to: ROTAS.inicio, rotulo: 'Início', end: true },
  { to: ROTAS.loja, rotulo: 'Loja' },
  { to: ROTAS.primeiroAquario, rotulo: 'Meu Primeiro Aquário' },
  { to: ROTAS.servicos, rotulo: 'Serviços' },
]

const classeLink = ({ isActive }) =>
  `group/link relative flex min-h-11 items-center text-pequeno font-bold whitespace-nowrap transition-colors ${isActive ? 'text-primary-text' : 'text-foreground hover:text-primary-text'}`

const classeLinkMobile = ({ isActive }) =>
  `flex min-h-12 items-center justify-between rounded-xl px-3 text-corpo font-bold transition-colors hover:bg-surface-tint ${isActive ? 'bg-surface-tint text-primary-text' : 'text-foreground'}`

function BotaoTema({ escuro, onClick, className }) {
  const rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro'
  return (
    <IconButton aria-label={rotulo} title={rotulo} onClick={onClick} className={className}>
      {escuro ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </IconButton>
  )
}

export default function SiteNav() {
  const { pathname } = useLocation()
  const { abrirPainel } = useUI()
  const { usuario } = useAuth()
  const { quantidade, total, bump } = useCart()
  const [tema, alternarTema] = useTema()
  const abrirWhatsApp = useWhatsApp()
  const [menuAberto, setMenuAberto] = useState(false)
  const escuro = tema === 'dark'
  const fechar = () => setMenuAberto(false)
  const conta = usuario ? { rotulo: 'Minha conta', to: ROTAS.minhaConta } : { rotulo: 'Entrar', to: ROTAS.entrar }

  return (
    <header className="sticky top-0 z-(--z-header) border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <a
        href="#conteudo"
        className="sr-only z-(--z-toast) rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-3 px-4 sm:px-6 desk:h-[72px] desk:px-10">
        <Logo />

        <nav aria-label="Principal" className="hidden items-center gap-5 desk:flex xl:gap-7">
          {links.map((l) =>
            l.to === ROTAS.loja ? (
              <NavDropdown key={l.to} ativo={pathname.startsWith(ROTAS.loja) || pathname.startsWith(ROTAS.peixes)} />
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

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Item 33 · a lupa fica sempre visível, em todas as larguras */}
          <IconButton aria-label="Buscar (atalho: tecla /)" title="Buscar — atalho: tecla /" onClick={() => abrirPainel('busca')}>
            <Search aria-hidden="true" />
          </IconButton>
          <BotaoTema escuro={escuro} onClick={alternarTema} className="max-desk:hidden" />
          <Link
            to={conta.to}
            className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-pequeno font-bold text-foreground transition-colors hover:bg-surface-tint hover:text-primary-text max-desk:hidden"
          >
            <UserRound aria-hidden="true" className="size-[18px]" />
            {usuario ? `Olá, ${usuario.nome.split(' ')[0]}` : conta.rotulo}
          </Link>
          <CartButton className="max-desk:hidden" onClick={() => abrirPainel('carrinho')} />
          <IconButton
            className="border-accent bg-accent text-accent-foreground hover:bg-accent-hover hover:text-accent-foreground desk:hidden"
            classeExterna="desk:hidden"
            aria-label={`Abrir carrinho, ${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`}
            title="Carrinho"
            badge={quantidade}
            badgeKey={bump}
            onClick={() => abrirPainel('carrinho')}
          >
            <ShoppingCart aria-hidden="true" />
          </IconButton>

          <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
            <SheetTrigger asChild>
              <IconButton className="desk:hidden" aria-label="Abrir menu">
                <Menu aria-hidden="true" />
              </IconButton>
            </SheetTrigger>
            <SheetContent side="right" className="w-[320px] max-w-[88vw] gap-0 overflow-y-auto border-border bg-surface p-0">
              <SheetHeader className="border-b border-border px-5 py-3.5">
                <SheetTitle className="text-left">Menu</SheetTitle>
                <SheetDescription className="sr-only">Navegação do site, conta e preferências</SheetDescription>
              </SheetHeader>
              <nav aria-label="Menu" className="px-3 py-2">
                {links.map((l) =>
                  l.to === ROTAS.loja ? (
                    <Accordion key={l.to} type="single" collapsible>
                      <AccordionItem value="loja" className="border-0">
                        <AccordionTrigger className="min-h-12 items-center rounded-xl px-3 py-0 text-corpo font-bold hover:bg-surface-tint hover:no-underline">
                          Loja
                        </AccordionTrigger>
                        <AccordionContent className="pb-1">
                          <ul className="ml-3 border-l border-border-strong pl-2">
                            <li>
                              <NavLink to={ROTAS.loja} end onClick={fechar} className={classeLinkMobile}>
                                Ver loja completa
                              </NavLink>
                            </li>
                            {categoriasMenu.map((c) => {
                              const Icone = iconeCategoria[c.nome]
                              return (
                                <li key={c.nome}>
                                  <Link to={urlCategoria(c.nome)} onClick={fechar} className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-pequeno font-semibold hover:bg-surface-tint hover:text-primary-text">
                                    <Icone aria-hidden="true" className="size-4 text-primary-text" />
                                    {c.nome}
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : (
                    <NavLink key={l.to} to={l.to} end={l.end} onClick={fechar} className={classeLinkMobile}>
                      {l.rotulo}
                      <ChevronRight aria-hidden="true" className="size-4 text-text-muted" />
                    </NavLink>
                  ),
                )}
              </nav>
              <div className="mt-auto grid gap-2 border-t border-border p-4">
                <NavLink to={conta.to} onClick={fechar} className={classeLinkMobile}>
                  <span className="flex items-center gap-2.5">
                    <UserRound aria-hidden="true" className="size-5 text-primary-text" />
                    {conta.rotulo}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-4 text-text-muted" />
                </NavLink>
                <button type="button" onClick={alternarTema} className={classeLinkMobile({ isActive: false })}>
                  <span className="flex items-center gap-2.5">
                    {escuro ? <Sun aria-hidden="true" className="size-5 text-primary-text" /> : <Moon aria-hidden="true" className="size-5 text-primary-text" />}
                    {escuro ? 'Usar tema claro' : 'Usar tema escuro'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    fechar()
                    abrirWhatsApp()
                  }}
                  className={classeLinkMobile({ isActive: false })}
                >
                  <span className="flex items-center gap-2.5">
                    <WhatsAppIcon className="size-5 text-primary-text" />
                    Tirar dúvida no WhatsApp
                  </span>
                </button>
                <p className="px-3 pt-1 text-legenda text-text-muted">
                  Carrinho: {quantidade} {quantidade === 1 ? 'item' : 'itens'}
                  {quantidade > 0 && ` · ${formatarPreco(total)}`}
                </p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
