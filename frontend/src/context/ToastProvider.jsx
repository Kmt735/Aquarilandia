import { useCallback, useMemo, useRef, useState } from 'react'
import { ToastContext } from './contexts'

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const proximoId = useRef(0)

  const dispensar = useCallback((id) => {
    setToasts((lista) => lista.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    (mensagem, { acao, onAcao, duracao = 3200, carregando = false } = {}) => {
      const id = ++proximoId.current
      setToasts((lista) => [...lista, { id, mensagem, acao, onAcao, carregando }])
      setTimeout(() => dispensar(id), duracao)
    },
    [dispensar],
  )

  const value = useMemo(() => ({ toasts, toast, dispensar }), [toasts, toast, dispensar])

  return <ToastContext value={value}>{children}</ToastContext>
}
