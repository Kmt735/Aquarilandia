import { useCallback } from 'react'
import { linkWhatsApp } from '../data/contato'
import useToast from './useToast'

// WhatsApp é canal de DÚVIDA (não fecha pedido): sempre ação secundária ou link
export default function useWhatsApp() {
  const { toast } = useToast()
  return useCallback(
    (contexto, mensagem) => {
      const texto = mensagem ?? `Olá! Vim pelo site da Aquarilândia${contexto ? ` e tenho uma dúvida sobre ${contexto}` : ''}.`
      toast('Abrindo o WhatsApp da loja…', { carregando: true })
      window.open(linkWhatsApp(texto), '_blank', 'noopener,noreferrer')
    },
    [toast],
  )
}
