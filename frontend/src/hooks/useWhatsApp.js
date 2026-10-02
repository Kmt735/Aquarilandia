import { useCallback } from 'react'
import useToast from './useToast'

// H1 · Visibilidade do status: mostra feedback ao abrir o WhatsApp
export default function useWhatsApp() {
  const { toast } = useToast()
  return useCallback(
    (contexto) => toast(`Abrindo WhatsApp${contexto ? ` — ${contexto}` : ''}…`, { carregando: true }),
    [toast],
  )
}
