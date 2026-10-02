import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { destacarElemento } from '../utils/destacar'

// Destaca o card indicado em location.state.destaque (vindo da busca)
export default function useDestaque() {
  const { state, key } = useLocation()
  const destaque = state?.destaque

  useEffect(() => {
    if (!destaque) return
    const timer = destacarElemento(destaque)
    return () => clearTimeout(timer)
  }, [destaque, key])
}
