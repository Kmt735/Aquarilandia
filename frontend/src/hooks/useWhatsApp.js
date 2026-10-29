import { useCallback } from 'react'
import { linkWhatsApp } from '../data/contato'
import useToast from './useToast'

export default function useWhatsApp() {
  const { toast } = useToast()
  return useCallback(
    (contexto, mensagem) => {
      const texto = mensagem ?? `Olá! Vim pelo site da Aquarilândia${contexto ? `. Assunto: ${contexto}` : ''}.`
      toast(`Abrindo WhatsApp${contexto ? ` — ${contexto}` : ''}…`, { carregando: true })
      window.open(linkWhatsApp(texto), '_blank', 'noopener,noreferrer')
    },
    [toast],
  )
}