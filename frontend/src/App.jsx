import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import MainLayout from './components/templates/MainLayout'
import CartProvider from './context/CartProvider'
import ToastProvider from './context/ToastProvider'
import UIProvider from './context/UIProvider'
import HomePage from './pages/HomePage'
import LojaPage from './pages/LojaPage'
import PeixesPage from './pages/PeixesPage'
import PrimeiroAquarioPage from './pages/PrimeiroAquarioPage'
import ServicosPage from './pages/ServicosPage'
import { ROTAS } from './utils/rotas'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <UIProvider>
          <CartProvider>
            <Routes>
              <Route element={<MainLayout />}>
                <Route index element={<HomePage />} />
                <Route path={ROTAS.loja} element={<LojaPage />} />
                <Route path={ROTAS.peixes} element={<PeixesPage />} />
                <Route path={ROTAS.primeiroAquario} element={<PrimeiroAquarioPage />} />
                <Route path={ROTAS.servicos} element={<ServicosPage />} />
                <Route path="*" element={<Navigate to={ROTAS.inicio} replace />} />
              </Route>
            </Routes>
          </CartProvider>
        </UIProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
