import { useCallback, useEffect, useState } from 'react'

const CHAVE = 'aquarilandia-tema'
const COR_BARRA = { light: '#f6f8fc', dark: '#070b14' }

// Primeira visita segue o sistema (aplicado no index.html); depois vale a escolha salva
export default function useTema() {
  const [tema, setTema] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COR_BARRA[tema])
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
