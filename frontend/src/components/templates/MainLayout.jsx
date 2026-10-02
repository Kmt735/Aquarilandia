import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import Overlay from '../atoms/Overlay'
import WhatsAppFloat from '../atoms/WhatsAppFloat'
import CartDrawer from '../organisms/CartDrawer'
import PrototypeSwitcher from '../organisms/PrototypeSwitcher'
import QuoteModal from '../organisms/QuoteModal'
import SearchBox from '../organisms/SearchBox'
import SiteNav from '../organisms/SiteNav'
import ToastStack from '../organisms/ToastStack'
import useUI from '../../hooks/useUI'
import useWhatsApp from '../../hooks/useWhatsApp'

export default function MainLayout() {
  const { pathname } = useLocation()
  const { painel, abrirPainel, fecharPaineis } = useUI()
  const abrirWhatsApp = useWhatsApp()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  // H3 · Esc fecha qualquer painel  ·  H7 · "/" abre a busca
  useEffect(() => {
    const teclar = (e) => {
      if (e.key === 'Escape') fecharPaineis()
      const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if (e.key === '/' && !digitando) {
        e.preventDefault()
        abrirPainel('busca')
      }
    }
    document.addEventListener('keydown', teclar)
    return () => document.removeEventListener('keydown', teclar)
  }, [abrirPainel, fecharPaineis])

  return (
    <>
      <PrototypeSwitcher />
      <SiteNav />
      <main key={pathname} className="animate-fade">
        <Outlet />
      </main>

      {painel && <Overlay onClick={fecharPaineis} />}
      <CartDrawer />
      {painel === 'busca' && <SearchBox />}
      {painel === 'orcamento' && <QuoteModal />}
      <ToastStack />
      <WhatsAppFloat onClick={() => abrirWhatsApp()} />
    </>
  )
}
