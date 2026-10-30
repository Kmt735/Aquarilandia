import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import WhatsAppFloat from '../atoms/WhatsAppFloat'
import Carregando from '../molecules/Carregando'
import AviseMeModal from '../organisms/AviseMeModal'
import CartDrawer from '../organisms/CartDrawer'
import Footer from '../organisms/Footer'
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
  const noCheckout = pathname.startsWith('/checkout') || pathname.startsWith('/pagamento')

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  // H3 · Esc fecha qualquer painel  ·  H7 · "/" abre a busca
  useEffect(() => {
    const teclar = (e) => {
      if (e.key === 'Escape') fecharPaineis()
      const digitando = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable
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
      <SiteNav />
      <main id="conteudo" tabIndex={-1} key={pathname} className="animate-fade outline-none">
        <Suspense fallback={<Carregando />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />

      <CartDrawer />
      {painel === 'busca' && <SearchBox />}
      {painel === 'orcamento' && <QuoteModal />}
      {painel === 'avise-me' && <AviseMeModal />}
      <ToastStack />
      {/* No checkout o WhatsApp sai do caminho: a atenção fica na compra (item 29) */}
      {!noCheckout && <WhatsAppFloat onClick={() => abrirWhatsApp()} />}
    </>
  )
}
