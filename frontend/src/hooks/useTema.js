import { useCallback, useEffect, useState } from 'react'

const CHAVE = 'aquarilandia-tema'

// Primeira visita segue o sistema (aplicado no index.html); depois vale a escolha salva.
// A cor da barra do navegador vem do token --background.
export default function useTema() {
  const [tema, setTema] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark')
    const fundo = getComputedStyle(document.documentElement).getPropertyValue('--background').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', fundo)
  }, [tema])

  const alternar = useCallback(() => {
    setTema((atual) => {
      const novo = atual === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(CHAVE, novo)
      } catch {
        // armazenamento bloqueado: o tema vale só para esta visita
      }
      return novo
    })
  }, [])

  return [tema, alternar]
}
