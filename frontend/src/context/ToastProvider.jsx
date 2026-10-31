import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from './contexts'

// tipo: 'sucesso' | 'erro' | 'info' | 'carregando' — o ícone e o texto dizem o estado (não só a cor)
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const proximoId = useRef(0)

  const dispensar = useCallback((id) => {
    setToasts((lista) => lista.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (mensagem, { tipo = 'info', acao, onAcao, duracao, carregando = false } = {}) => {
      const id = ++proximoId.current
      const tipoFinal = carregando ? 'carregando' : tipo
      // Erros ficam mais tempo na tela; toasts com ação também (dá tempo de clicar)
      const tempo = duracao ?? (tipoFinal === 'erro' || acao ? 6000 : 3500)
      setToasts((lista) => [...lista.slice(-2), { id, mensagem, tipo: tipoFinal, acao, onAcao }])
      setTimeout(() => dispensar(id), tempo)
      return id
    },
    [dispensar],
  )

  const value = useMemo(() => ({ toasts, toast, dispensar }), [toasts, toast, dispensar])

  return <ToastContext value={value}>{children}</ToastContext>
}
