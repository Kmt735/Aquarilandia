import { useSyncExternalStore } from 'react'

const CONSULTA = '(prefers-reduced-motion: reduce)'

function assinar(avisar) {
  const mq = window.matchMedia(CONSULTA)
  mq.addEventListener('change', avisar)
  return () => mq.removeEventListener('change', avisar)
}

// true quando o sistema pede menos movimento (acompanha mudanças ao vivo)
export default function useReducedMotion() {
  return useSyncExternalStore(assinar, () => window.matchMedia(CONSULTA).matches)
}
