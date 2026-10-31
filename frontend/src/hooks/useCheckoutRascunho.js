import { useCallback, useState } from 'react'
import { gravarSessao, lerSessao } from '../services/http'

const CHAVE = 'aquarilandia-checkout'

// Dados do checkout guardados na sessão: dá para voltar entre as etapas sem perder nada (item 3)
export default function useCheckoutRascunho() {
  const [rascunho, setRascunho] = useState(() => lerSessao(CHAVE, {}))
  const salvar = useCallback((parcial) => {
    setRascunho((atual) => {
      const novo = { ...atual, ...parcial }
      gravarSessao(CHAVE, novo)
      return novo
    })
  }, [])
  const limpar = useCallback(() => {
    gravarSessao(CHAVE, {})
    setRascunho({})
  }, [])
  return { rascunho, salvar, limpar }
}
