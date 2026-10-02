import { useCallback, useEffect, useMemo, useState } from 'react'
import { UIContext } from './contexts'

// Controla os painéis globais (carrinho, busca, orçamento) e o modo heurísticas
export default function UIProvider({ children }) {
  const [painel, setPainel] = useState(null)
  const [servicoOrcamento, setServicoOrcamento] = useState('')
  const [mostrarHeuristicas, setMostrarHeuristicas] = useState(false)

  useEffect(() => {
    document.body.classList.toggle('show-h', mostrarHeuristicas)
  }, [mostrarHeuristicas])

  const abrirPainel = useCallback((nome) => setPainel(nome), [])
  const fecharPaineis = useCallback(() => setPainel(null), [])
  const abrirOrcamento = useCallback((servico = '') => {
    setServicoOrcamento(servico)
    setPainel('orcamento')
  }, [])
  const alternarHeuristicas = useCallback(() => setMostrarHeuristicas((v) => !v), [])

  const value = useMemo(
    () => ({
      painel,
      servicoOrcamento,
      mostrarHeuristicas,
      abrirPainel,
      fecharPaineis,
      abrirOrcamento,
      alternarHeuristicas,
    }),
    [painel, servicoOrcamento, mostrarHeuristicas, abrirPainel, fecharPaineis, abrirOrcamento, alternarHeuristicas],
  )

  return <UIContext value={value}>{children}</UIContext>
}
