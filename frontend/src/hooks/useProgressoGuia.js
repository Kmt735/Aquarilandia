import { useCallback, useState } from 'react'

const CHAVE = 'aquarilandia:guia-entendidos'

function ler() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE))
    return Array.isArray(salvo) ? salvo : []
  } catch {
    return []
  }
}

function gravar(ids) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(ids))
  } catch {
    // Sem armazenamento (aba anônima, cota cheia): o progresso vale só até recarregar
  }
}

// Passos marcados como "Entendi", lembrados neste navegador
export default function useProgressoGuia() {
  const [entendidos, setEntendidos] = useState(ler)

  const alternar = useCallback((id) => {
    setEntendidos((atuais) => {
      const proximos = atuais.includes(id) ? atuais.filter((x) => x !== id) : [...atuais, id]
      gravar(proximos)
      return proximos
    })
  }, [])

  return [entendidos, alternar]
}
