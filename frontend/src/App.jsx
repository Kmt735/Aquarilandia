import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import MainLayout from './components/templates/MainLayout'
import { TooltipProvider } from '@/components/ui/tooltip'
import AuthProvider from './context/AuthProvider'
import CartProvider from './context/CartProvider'
import ToastProvider from './context/ToastProvider'
import UIProvider from './context/UIProvider'
import HomePage from './pages/HomePage'
import LojaPage from './pages/LojaPage'
import PeixeDetalhePage from './pages/PeixeDetalhePage'
import PeixesPage from './pages/PeixesPage'
import PrimeiroAquarioPage from './pages/PrimeiroAquarioPage'
import ProdutoDetalhePage from './pages/ProdutoDetalhePage'
import ServicosPage from './pages/ServicosPage'
import { ROTAS } from './utils/rotas'

// Telas de conta, checkout e ajuda carregam sob demanda (bundle inicial menor)
const CompararPeixesPage = lazy(() => import('./pages/CompararPeixesPage'))
const MonteSeuAquarioPage = lazy(() => import('./pages/MonteSeuAquarioPage'))
const NaoEncontradaPage = lazy(() => import('./pages/NaoEncontradaPage'))
const PerguntasFrequentesPage = lazy(() => import('./pages/PerguntasFrequentesPage'))
const PoliticaPage = lazy(() => import('./pages/PoliticaPage'))
const EtapaCarrinhoPage = lazy(() => import('./pages/checkout/EtapaCarrinhoPage'))
const EtapaEntregaPage = lazy(() => import('./pages/checkout/EtapaEntregaPage'))
const EtapaPagamentoPage = lazy(() => import('./pages/checkout/EtapaPagamentoPage'))
const RetornoPagamentoPage = lazy(() => import('./pages/checkout/RetornoPagamentoPage'))
const CompraDetalhePage = lazy(() => import('./pages/conta/CompraDetalhePage'))
const CriarContaPage = lazy(() => import('./pages/conta/CriarContaPage'))
const EnderecosPage = lazy(() => import('./pages/conta/EnderecosPage'))
const EntrarPage = lazy(() => import('./pages/conta/EntrarPage'))
const EsqueciSenhaPage = lazy(() => import('./pages/conta/EsqueciSenhaPage'))
const MeusDadosPage = lazy(() => import('./pages/conta/MeusDadosPage'))
const MinhasComprasPage = lazy(() => import('./pages/conta/MinhasComprasPage'))
const RedefinirSenhaPage = lazy(() => import('./pages/conta/RedefinirSenhaPage'))
const CheckoutLayout = lazy(() => import('./components/templates/CheckoutLayout'))
const ContaLayout = lazy(() => import('./components/templates/ContaLayout'))
const AdminLayout = lazy(() => import('./components/templates/AdminLayout'))
const AdminInicioPage = lazy(() => import('./pages/admin/AdminInicioPage'))
const AdminProdutosPage = lazy(() => import('./pages/admin/AdminProdutosPage'))

// Endereço antigo do guia: quem já tinha o link cai no novo, mantendo a âncora
function RedirecionarPrimeiroAquario() {
  const { hash } = useLocation()
  return <Navigate to={{ pathname: ROTAS.primeiroAquario, hash }} replace />
}

// As URLs antigas continuam iguais (ex.: /peixes/acara-disco); as novas só se somam a elas
export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={150}>
        <ToastProvider>
          <UIProvider>
            <AuthProvider>
              <CartProvider>
                <Routes>
                  <Route element={<MainLayout />}>
                    <Route index element={<HomePage />} />
                    <Route path={ROTAS.loja} element={<LojaPage />} />
                    <Route path={`${ROTAS.loja}/:id`} element={<ProdutoDetalhePage />} />
                    <Route path={ROTAS.peixes} element={<PeixesPage />} />
                    <Route path={ROTAS.compararPeixes} element={<CompararPeixesPage />} />
                    <Route path={`${ROTAS.peixes}/:id`} element={<PeixeDetalhePage />} />
                    <Route path={ROTAS.primeiroAquario} element={<PrimeiroAquarioPage />} />
                    <Route path={ROTAS.primeiroAquarioAntigo} element={<RedirecionarPrimeiroAquario />} />
                    <Route path={ROTAS.monteSeuAquario} element={<MonteSeuAquarioPage />} />
                    <Route path={ROTAS.servicos} element={<ServicosPage />} />
                    <Route path={ROTAS.perguntas} element={<PerguntasFrequentesPage />} />
                    <Route path={`${ROTAS.politicas}/:tipo`} element={<PoliticaPage />} />

                    <Route path={ROTAS.entrar} element={<EntrarPage />} />
                    <Route path={ROTAS.criarConta} element={<CriarContaPage />} />
                    <Route path={ROTAS.esqueciSenha} element={<EsqueciSenhaPage />} />
                    <Route path={ROTAS.redefinirSenha} element={<RedefinirSenhaPage />} />
                    <Route path={ROTAS.minhaConta} element={<ContaLayout />}>
                      <Route index element={<MinhasComprasPage />} />
                      <Route path="compras/:id" element={<CompraDetalhePage />} />
                      <Route path="dados" element={<MeusDadosPage />} />
                      <Route path="enderecos" element={<EnderecosPage />} />
                    </Route>

                    <Route path={ROTAS.checkout} element={<CheckoutLayout />}>
                      <Route index element={<Navigate to="carrinho" replace />} />
                      <Route path="carrinho" element={<EtapaCarrinhoPage />} />
                      <Route path="entrega" element={<EtapaEntregaPage />} />
                      <Route path="pagamento" element={<EtapaPagamentoPage />} />
                    </Route>
                    <Route path={`${ROTAS.pagamento}/:resultado`} element={<RetornoPagamentoPage />} />
                   <Route path={ROTAS.admin} element={<AdminLayout />}>
                   <Route index element={<AdminInicioPage />} />
                    <Route path="produtos" element={<AdminProdutosPage />} />
                    </Route>
                    <Route path="*" element={<NaoEncontradaPage />} />
                  </Route>
                </Routes>
              </CartProvider>
            </AuthProvider>
          </UIProvider>
        </ToastProvider>
      </TooltipProvider>
    </BrowserRouter>
  )
}
