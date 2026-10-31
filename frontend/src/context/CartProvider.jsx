import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useToast from '../hooks/useToast'
import useUI from '../hooks/useUI'
import { obterProduto } from '../services/catalogo'
import { aplicarConferencia, CHAVE_CARRINHO, conferirCarrinho, formatoParaSalvar, lerCarrinhoSalvo, LIMITE_QUANTIDADE } from '../services/carrinho'
import { precoEmCentavos } from '../utils/dinheiro'
import { CartContext } from './contexts'

const AVISO_FALHA = 'Não conseguimos conferir todos os produtos. Eles foram preservados para tentar novamente, sem usar preços salvos.'
const chaveConferencia = (registros, revisao, aberto) => JSON.stringify([registros.map((r) => r.id), revisao, aberto])
function estadoInicial() {
  let lido
  try { lido = lerCarrinhoSalvo(localStorage.getItem(CHAVE_CARRINHO)) } catch {
    lido = { registros: [], avisos: ['Não foi possível ler o carrinho neste navegador.'], bloqueado: false }
  }
  return { ...lido, revisao: 0, conferida: null }
}

export default function CartProvider({ children }) {
  const [estado, setEstado] = useState(estadoInicial)
  const [bump, setBump] = useState(0)
  const { toast } = useToast()
  const notificacaoInicial = useRef({ avisos: estado.avisos, enviada: false })
  const { abrirPainel, painel } = useUI()
  const aberto = painel === 'carrinho'
  const chave = chaveConferencia(estado.registros, estado.revisao, aberto)
  const conferindo = !estado.bloqueado && estado.registros.length > 0 && estado.conferida !== chave

  useEffect(() => {
    const aviso = notificacaoInicial.current
    if (!aviso.enviada && aviso.avisos.length) { aviso.enviada = true; toast(aviso.avisos.join(' '), { tipo: 'info' }) }
  }, [toast])

  useEffect(() => {
    if (estado.bloqueado) return // não destrói versões futuras/desconhecidas
    try { localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(formatoParaSalvar(estado.registros))) } catch {
      // Armazenamento bloqueado: o carrinho desta aba continua funcionando.
    }
  }, [estado.registros, estado.bloqueado])

  useEffect(() => {
    if (!conferindo) return
    let atual = true
    conferirCarrinho(estado.registros, obterProduto).then((resultados) => {
      if (!atual) return
      const avisos = [
        resultados.some((r) => r.estado === 'removido') && 'Produtos que saíram do catálogo ou estão esgotados foram removidos do carrinho.',
        resultados.some((r) => r.estado === 'erro') && AVISO_FALHA,
        resultados.some((r) => r.precoAlterado) && 'Os preços do carrinho foram atualizados conforme o catálogo.',
      ].filter(Boolean)
      setEstado((anterior) => {
        const registros = aplicarConferencia(anterior.registros, resultados)
        return { ...anterior, registros, conferida: chaveConferencia(registros, anterior.revisao, aberto),
          avisos: [...new Set([...anterior.avisos.filter((a) => a !== AVISO_FALHA), ...avisos])].slice(-5) }
      })
      if (avisos.length) toast(avisos.join(' '), { tipo: 'info' })
    })
    return () => { atual = false }
  }, [conferindo, chave, estado.registros, aberto, toast])

  const revalidar = useCallback(() => setEstado((e) => ({ ...e, revisao: e.revisao + 1 })), [])
  useEffect(() => {
    const aoVoltar = () => { if (document.visibilityState === 'visible') revalidar() }
    window.addEventListener('focus', revalidar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.removeEventListener('focus', revalidar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [revalidar])

  const adicionar = useCallback((item, qtd = 1) => {
    if (estado.bloqueado) { toast('Limpe o carrinho de formato desconhecido antes de adicionar produtos.', { tipo: 'erro' }); return }
    if (!Number.isInteger(item?.id) || item.id < 1 || item.id > 2147483647 || !Number.isSafeInteger(qtd) || qtd < 1) {
      toast('Não foi possível identificar este produto. Escolha-o no catálogo atual.', { tipo: 'erro' }); return
    }
    setEstado((e) => {
      const existe = e.registros.some((r) => r.id === item.id)
      const registros = existe ? e.registros.map((r) => r.id === item.id ? { ...r, qtd: Math.min(r.qtd + qtd, LIMITE_QUANTIDADE) } : r)
        : [...e.registros, { id: item.id, qtd: Math.min(qtd, LIMITE_QUANTIDADE), item: null, erro: false }]
      return { ...e, registros, revisao: e.revisao + 1 }
    })
    setBump((b) => b + 1)
    toast('Conferindo o produto no catálogo para atualizar seu carrinho.', { tipo: 'info', acao: 'Ver carrinho', onAcao: () => abrirPainel('carrinho') })
  }, [estado.bloqueado, toast, abrirPainel])

  const definirQtd = useCallback((id, qtd) => {
    if (!Number.isSafeInteger(qtd) || qtd < 1) return
    setEstado((e) => ({ ...e, registros: e.registros.map((r) => r.id === id ? { ...r, qtd: Math.min(qtd, LIMITE_QUANTIDADE) } : r) }))
  }, [])
  const remover = useCallback((id) => {
    const indice = estado.registros.findIndex((r) => r.id === id)
    if (indice < 0) return
    const removido = estado.registros[indice]
    setEstado((e) => ({ ...e, registros: e.registros.filter((r) => r.id !== id) }))
    toast(`${removido.item?.nome ?? 'Produto'} removido do carrinho.`, { tipo: 'info', acao: 'Desfazer', onAcao: () => {
      setEstado((e) => e.registros.some((r) => r.id === id) ? e : { ...e,
        registros: [...e.registros.slice(0, indice), { ...removido, item: null }, ...e.registros.slice(indice)], revisao: e.revisao + 1 })
      setBump((b) => b + 1)
    } })
  }, [estado.registros, toast])
  const limpar = useCallback(() => setEstado({ registros: [], avisos: [], bloqueado: false, revisao: 0, conferida: null }), [])

  const value = useMemo(() => {
    const linhas = estado.registros.filter((r) => r.item?.emEstoque && !r.erro)
    const pendentes = estado.registros.filter((r) => !r.item || r.erro).length
    return {
      linhas, bump, conferindo, pendentes, avisos: estado.avisos, bloqueado: estado.bloqueado,
      podeContinuar: !conferindo && !estado.bloqueado && !pendentes && linhas.length > 0,
      quantidade: estado.registros.reduce((s, r) => s + r.qtd, 0),
      // Apresentação/frete do protótipo ainda recebem reais; itens e somas usam centavos.
      total: linhas.reduce((s, l) => s + precoEmCentavos(l.item) * l.qtd, 0) / 100,
      temPeixe: linhas.some((l) => l.item.tipo === 'peixe'),
      qtdNoCarrinho: (id) => estado.registros.find((r) => r.id === id)?.qtd ?? 0,
      adicionar, definirQtd, remover, limpar, revalidar,
    }
  }, [estado, bump, conferindo, adicionar, definirQtd, remover, limpar, revalidar])
  return <CartContext value={value}>{children}</CartContext>
}
