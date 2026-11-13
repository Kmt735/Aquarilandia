import { useCallback, useEffect, useRef, useState } from 'react'
import { listarPedidosAdmin } from '../services/admin-pedidos'
import { EVENTO_VISTOS, lerVistos } from '../utils/pedidosVistos'
import useToast from './useToast'

const INTERVALO_MS = 30000
// "Novo" = ainda não atendido (aguardando pagamento ou recém-pago) e que o admin não abriu
const aguardandoAtendimento = (p) => ['aguardando_pagamento', 'paga'].includes(p.status)

// Confere os pedidos de tempos em tempos e conta os novos. INTEGRAÇÃO: trocar a conferência por
// GET /api/admin/vendas (ou por uma conexão em tempo real) quando o backend de vendas existir.
export default function usePedidosNovos() {
  const { toast } = useToast()
  const [novos, setNovos] = useState(0)
  const conhecidos = useRef(null)

  const conferir = useCallback(async () => {
    try {
      const { itens } = await listarPedidosAdmin({ limite: 100 })
      const vistos = lerVistos()
      const pendentes = itens.filter((p) => aguardandoAtendimento(p) && !vistos.has(p.id))
      setNovos(pendentes.length)
      if (conhecidos.current) {
        const chegaram = pendentes.filter((p) => !conhecidos.current.has(p.id))
        if (chegaram.length) toast(chegaram.length === 1 ? 'Chegou um pedido novo!' : 'Chegaram pedidos novos!', { tipo: 'info' })
      }
      conhecidos.current = new Set(pendentes.map((p) => p.id))
    } catch {
      // tenta de novo na próxima conferência
    }
  }, [toast])

  useEffect(() => {
    conferir()
    const relogio = setInterval(conferir, INTERVALO_MS)
    const aoVoltar = () => document.visibilityState === 'visible' && conferir()
    window.addEventListener(EVENTO_VISTOS, conferir)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearInterval(relogio)
      window.removeEventListener(EVENTO_VISTOS, conferir)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [conferir])

  return { novos, conferir }
}