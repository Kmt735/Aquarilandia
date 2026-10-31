import { useCallback, useMemo, useRef, useState } from 'react'
import { UIContext } from './contexts'

// Controla os painéis globais: carrinho, busca, orçamento e "Avise-me quando chegar".
// Guarda quem abriu o painel para devolver o foco a ele quando o painel fecha (teclado, item 25).
export default function UIProvider({ children }) {
  const [painel, setPainel] = useState(null)
  const origem = useRef(null)
  const lembrarOrigem = () => {
    origem.current = document.activeElement
  }
  const [servicoOrcamento, setServicoOrcamento] = useState('')
  const [itemAviseMe, setItemAviseMe] = useState(null)

  const abrirPainel = useCallback((nome) => {
    lembrarOrigem()
    setPainel(nome)
  }, [])
  const fecharPaineis = useCallback(() => setPainel(null), [])
  const abrirOrcamento = useCallback((servico = '') => {
    lembrarOrigem()
    setServicoOrcamento(servico)
    setPainel('orcamento')
  }, [])
  const abrirAviseMe = useCallback((item) => {
    lembrarOrigem()
    setItemAviseMe(item)
    setPainel('avise-me')
  }, [])

  // Use em onCloseAutoFocus dos painéis: devolve o foco ao botão que abriu (se ele ainda estiver na tela)
  const devolverFoco = useCallback((e) => {
    const alvo = origem.current
    if (alvo?.isConnected && alvo !== document.body) {
      e.preventDefault()
      alvo.focus()
    }
  }, [])

  const value = useMemo(
    () => ({ painel, servicoOrcamento, itemAviseMe, abrirPainel, fecharPaineis, abrirOrcamento, abrirAviseMe, devolverFoco }),
    [painel, servicoOrcamento, itemAviseMe, abrirPainel, fecharPaineis, abrirOrcamento, abrirAviseMe, devolverFoco],
  )

  return <UIContext value={value}>{children}</UIContext>
}
