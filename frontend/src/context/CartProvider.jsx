import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useToast from '../hooks/useToast'
import useUI from '../hooks/useUI'
import { obterProduto } from '../services/catalogo'
import { aplicarConferencia, CHAVE_CARRINHO, conferirCarrinho, estoqueConhecido, formatoParaSalvar, lerCarrinhoSalvo, LIMITE_QUANTIDADE, planejarAdicao } from '../services/carrinho'
import { precoEmCentavos } from '../utils/dinheiro'
import { plural } from '../utils/format'
import { CartContext } from './contexts'

const AVISO_FALHA = 'Não conseguimos conferir todos os produtos. Eles foram preservados para tentar novamente, sem usar preços salvos.'
// Rede de segurança: qualquer formato inesperado vira lista vazia em vez de derrubar a página.
const lista = (valor) => (Array.isArray(valor) ? valor : [])
const chaveConferencia =(registros, revisao, aberto) => JSON.stringify([registros.map((r) => r.id), revisao, aberto])
function estadoInicial() {
  let lido
  try { lido = lerCarrinhoSalvo(localStorage.getItem(CHAVE_CARRINHO)) } catch {
    lido = { registros: [], avisos: ['Não foi possível ler o carrinho neste navegador.'], bloqueado: false }
  }
  return { registros: lista(lido?.registros), avisos: lista(lido?.avisos), bloqueado: lido?.bloqueado === true, revisao: 0, conferida: null }
}

// Problema do item recém-adicionado encontrado na conferência: título curto + o que aconteceu com o carrinho
function problemaDaAdicao(resultado, qtdPedida, nome) {
  if (resultado.estado === 'removido') {
    return resultado.motivo === 'esgotado'
      ? { titulo: 'Esse produto esgotou', mensagem: `Tiramos ${nome} do carrinho. Use "Avise-me quando chegar" na página do produto.` }
      : { titulo: 'Esse produto saiu do catálogo', mensagem: `Tiramos ${nome} do carrinho.` }
  }
  const estoque = estoqueConhecido(resultado.item)
  if (resultado.estado === 'valido' && estoque !== null && qtdPedida > estoque) {
    return { titulo: `Só temos ${plural(estoque, 'unidade')} em estoque`, mensagem: `Ajustamos a quantidade de ${nome} no carrinho para ${estoque}.` }
  }
  return null
}

export default function CartProvider({ children }) {
  const [estado, setEstado] = useState(estadoInicial)
  const [bump, setBump] = useState(0)
  const { toast, dispensar } = useToast()
  // Último "Adicionado ao carrinho": se a conferência no catálogo achar problema com ESSE item,
  // o aviso de sucesso é trocado por um erro claro (itens 1, 28 e 38)
  const ultimaAdicao = useRef(null)
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
    const conferidos = estado.registros
    conferirCarrinho(conferidos, obterProduto).then((resultados) => {
      if (!atual) return
      const ultima = ultimaAdicao.current
      const doUltimo = ultima && resultados.find((r) => r.id === ultima.id)
      const problemaUltimo = doUltimo && problemaDaAdicao(doUltimo, conferidos.find((r) => r.id === ultima.id)?.qtd ?? 0, ultima.nome)
      if (doUltimo) ultimaAdicao.current = null
      if (problemaUltimo) {
        dispensar(ultima.toastId)
        toast(problemaUltimo.mensagem, { tipo: 'erro', titulo: problemaUltimo.titulo, acao: 'Ver carrinho', onAcao: () => abrirPainel('carrinho') })
      }
      // Os avisos gerais não repetem o problema do item que acabou de ganhar aviso próprio
      const outros = problemaUltimo ? resultados.filter((r) => r.id !== ultima.id) : resultados
      const avisos = [
        outros.some((r) => r.estado === 'removido') && 'Produtos que saíram do catálogo ou estão esgotados foram removidos do carrinho.',
        outros.some((r) => r.estado === 'valido' && estoqueConhecido(r.item) !== null && (conferidos.find((c) => c.id === r.id)?.qtd ?? 0) > r.item.estoque)
          && 'Algumas quantidades passaram do estoque e foram ajustadas.',
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
  }, [conferindo, chave, estado.registros, aberto, toast, dispensar, abrirPainel])

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
    const verCarrinho = { acao: 'Ver carrinho', onAcao: () => abrirPainel('carrinho') }
    if (item.emEstoque === false) {
      toast(`${item.nome} não pode ser adicionado agora. Use "Avise-me quando chegar".`, { tipo: 'erro', titulo: 'Esse produto esgotou' }); return
    }
    // Estoque conhecido (dados de demonstração) ou o teto de 99 por produto, descontando o que já está no carrinho
    const estoque = estoqueConhecido(item)
    const teto = estoque !== null && estoque < LIMITE_QUANTIDADE ? estoque : LIMITE_QUANTIDADE
    const noCarrinho = estado.registros.find((r) => r.id === item.id)?.qtd ?? 0
    const quantidade = Math.min(qtd, teto - noCarrinho)
    const tituloLimite = teto === estoque ? `Só temos ${plural(teto, 'unidade')} em estoque` : `Limite de ${LIMITE_QUANTIDADE} por produto`
    if (quantidade <= 0) {
      toast(`Todas as unidades de ${item.nome} já estão no seu carrinho.`, { tipo: 'erro', titulo: tituloLimite, ...verCarrinho }); return
    }
    // O item entra na hora (o contador do cabeçalho anima); a conferência no catálogo segue em segundo plano
    setEstado((e) => {
      const existe = e.registros.some((r) => r.id === item.id)
      const registros = existe ? e.registros.map((r) => r.id === item.id ? { ...r, qtd: Math.min(r.qtd + quantidade, LIMITE_QUANTIDADE) } : r)
        : [...e.registros, { id: item.id, qtd: quantidade, item: null, erro: false }]
      return { ...e, registros, revisao: e.revisao + 1 }
    })
    setBump((b) => b + 1)
    const toastId = quantidade < qtd
      ? toast(`Adicionamos ${quantidade} de ${item.nome} ao carrinho.`, { tipo: 'info', titulo: tituloLimite, ...verCarrinho })
      : toast(quantidade > 1 ? `${quantidade} × ${item.nome}` : item.nome, { tipo: 'sucesso', titulo: 'Adicionado ao carrinho', ...verCarrinho })
    ultimaAdicao.current = { id: item.id, nome: item.nome, toastId }
  }, [estado.bloqueado, estado.registros, toast, abrirPainel])

  // Vários itens numa ação só (ex.: "Monte seu Aquário"). Não mostra toast: quem chama decide a mensagem
  // com o resultado ({ adicionados, limitados, ignorados } ou { bloqueado: true }).
  const adicionarVarios = useCallback((pedidos) => {
    if (estado.bloqueado) return { bloqueado: true, adicionados: [], limitados: [], ignorados: [] }
    const plano = planejarAdicao(lista(estado.registros), lista(pedidos))
    if (plano.adicionados.length) {
      setEstado((e) => ({ ...e, registros: planejarAdicao(lista(e.registros), plano.adicionados).registros, revisao: e.revisao + 1 }))
      setBump((b) => b + 1)
    }
    const { adicionados, limitados, ignorados } = plano
    return { bloqueado: false, adicionados, limitados, ignorados }
  }, [estado.bloqueado, estado.registros])

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
    const registros = lista(estado.registros)
    const linhas = registros.filter((r) => r?.item?.emEstoque && !r.erro)
    const pendentes = registros.filter((r) => !r?.item || r.erro).length
    return {
      linhas, bump, conferindo, pendentes, avisos: lista(estado.avisos), bloqueado: estado.bloqueado,
      podeContinuar: !conferindo && !estado.bloqueado && !pendentes && linhas.length > 0,
      quantidade: registros.reduce((s, r) => s + (r?.qtd || 0), 0),
      // Apresentação/frete do protótipo ainda recebem reais; itens e somas usam centavos.
      total: linhas.reduce((s, l) => s + (precoEmCentavos(l.item) || 0) * l.qtd, 0) / 100,
      temPeixe: linhas.some((l) => l.item.tipo === 'peixe'),
      qtdNoCarrinho: (id) => registros.find((r) => r?.id === id)?.qtd ?? 0,
      adicionar, adicionarVarios, definirQtd, remover, limpar, revalidar,
    }
  }, [estado, bump, conferindo, adicionar, adicionarVarios, definirQtd, remover, limpar, revalidar])
  return <CartContext value={value}>{children}</CartContext>
}
