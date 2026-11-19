import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

// Filtros, busca, ordem e página vivem na URL: dá para voltar, compartilhar e recarregar sem perder (item 3)
export default function useFiltrosUrl(chaves) {
  const [params, setParams] = useSearchParams()
  const valores = Object.fromEntries(chaves.map((c) => [c, params.get(c) ?? '']))

  const aplicar = useCallback(
    (mudanca, { manterPagina = false, replace = false } = {}) => {
      // Lê a URL de AGORA (não a do último render): dois filtros seguidos (ex.: clicar em "Doce" e logo
      // o preço aplicar sozinho) não podem um apagar o outro
      const atuais = typeof window === 'undefined' ? params : new URLSearchParams(window.location.search)
      const proximo = { ...Object.fromEntries(atuais), ...mudanca }
      if (!manterPagina && !('pagina' in mudanca)) delete proximo.pagina
      setParams(Object.fromEntries(Object.entries(proximo).filter(([, v]) => v)), { replace })
    },
    [params, setParams],
  )

  const limpar = useCallback(() => setParams({}), [setParams])
  return [valores, aplicar, limpar]
}
