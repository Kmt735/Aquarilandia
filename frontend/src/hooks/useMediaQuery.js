import { useSyncExternalStore } from 'react'

// true enquanto a media query casar (acompanha mudanças de largura ao vivo)
export default function useMediaQuery(consulta) {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(consulta)
      mq.addEventListener('change', avisar)
      return () => mq.removeEventListener('change', avisar)
    },
    () => window.matchMedia(consulta).matches,
  )
}
