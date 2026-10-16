import { useCallback, useMemo, useState } from 'react'
import { UIContext } from './contexts'

// Controla os painéis globais (carrinho, busca, orçamento)
export default function UIProvider({ children }) {
  const [painel, setPainel] = useState(null)
  const [servicoOrcamento, setServicoOrcamento] = useState('')

  const abrirPainel = useCallback((nome) => setPainel(nome), [])
  const fecharPaineis = useCallback(() => setPainel(null), [])
  const abrirOrcamento = useCallback((servico = '') => {
    setServicoOrcamento(servico)
    setPainel('orcamento')
  }, [])

  const value = useMemo(
    () => ({
      painel,
      servicoOrcamento,
      abrirPainel,
      fecharPaineis,
      abrirOrcamento,
    }),
    [painel, servicoOrcamento, abrirPainel, fecharPaineis, abrirOrcamento],
  )

  return <UIContext value={value}>{children}</UIContext>
}
