// INTEGRAÇÃO: rotas de vendas e pagamentos. O pagamento acontece na página HOSPEDADA do gateway
// (cartão e PIX) — o site nunca tem campos de cartão. Hoje tudo é simulado com mocks/pedidos.js.
// Os pedidos de demonstração ficam no localStorage, para o painel do administrador (em outra aba)
// enxergar o que o cliente comprou. Com o backend de vendas, tudo isso passa a vir do servidor.
import { PEDIDOS_EXEMPLO } from '../mocks/pedidos'
import { podeCancelar } from '../utils/statusPedido'
import { sessaoAtual } from './conta'
import { ErroApi, simularRede } from './http'

const CHAVE = 'aquarilandia-pedidos-exemplo'

const pagamentoPadrao = (status) => (['aguardando_pagamento', 'cancelada'].includes(status) ? 'pendente' : 'pago')
const situacaoPadrao = (status, tipo) => {
  if (tipo === 'retirada') return status === 'entregue' ? 'retirado' : 'aguardando_retirada'
  return status === 'entregue' ? 'entregue' : status === 'enviada' ? 'a_caminho' : 'a_enviar'
}

// Garante os campos novos (cliente, pagamento e situação da entrega) em pedidos antigos
export const completar = (pedido) => ({
  cliente: null,
  pagamento: pagamentoPadrao(pedido.status),
  ...pedido,
  entrega: { situacao: situacaoPadrao(pedido.status, pedido.entrega.tipo), ...pedido.entrega },
})

export function lerPedidos() {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return (bruto ? JSON.parse(bruto) : structuredClone(PEDIDOS_EXEMPLO)).map(completar)
  } catch {
    return structuredClone(PEDIDOS_EXEMPLO).map(completar)
  }
}

export function gravarPedidos(lista) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista))
  } catch {
    // armazenamento bloqueado: vale só enquanto a página estiver aberta
  }
}

export async function listarPedidos() {
  await simularRede()
  return lerPedidos()
}

export async function obterPedido(id) {
  await simularRede()
  const pedido = lerPedidos().find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Compra não encontrada.', {}, 404)
  return pedido
}

// Cria o pedido e devolve a URL da página de pagamento do gateway.
// No protótipo, a "página do gateway" é simulada: voltamos direto para /pagamento/sucesso.
export async function criarPedido({ linhas, entrega }) {
  await simularRede(800)
  const id = `EX-${Math.floor(1000 + Math.random() * 9000)}`
  const usuario = sessaoAtual()
  const agora = new Date().toISOString()
  const pedido = {
    id,
    criadoEm: agora,
    status: 'aguardando_pagamento',
    cliente: usuario ? { nome: usuario.nome, email: usuario.email, telefone: usuario.telefone } : null,
    pagamento: 'pendente',
    entrega: { ...entrega, situacao: entrega.tipo === 'retirada' ? 'aguardando_retirada' : 'a_enviar' },
    itens: linhas.map((l) => ({ id: l.id, nome: l.item.nome, tipo: l.item.tipo, categoria: l.item.categoria, preco: l.item.preco, centavos: l.item.centavos, qtd: l.qtd })),
    historico: [{ status: 'aguardando_pagamento', em: agora }],
    rastreio: null,
  }
  gravarPedidos([pedido, ...lerPedidos()])
  return { pedido, urlPagamento: `/pagamento/sucesso?pedido=${id}` }
}

// A página de sucesso NÃO confia na URL: consulta o status real até ele sair de "aguardando_pagamento".
// INTEGRAÇÃO: GET /api/vendas/:id (o backend confirma o pagamento pelo webhook do gateway).
export async function consultarStatus(id) {
  await simularRede(1200)
  const lista = lerPedidos()
  const pedido = lista.find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Compra não encontrada.', {}, 404)
  if (pedido.status === 'aguardando_pagamento') {
    // Simulação: na segunda consulta o "webhook" já confirmou
    pedido.consultas = (pedido.consultas ?? 0) + 1
    if (pedido.consultas >= 2) {
      pedido.status = 'paga'
      pedido.pagamento = 'pago'
      pedido.historico.push({ status: 'paga', em: new Date().toISOString() })
    }
    gravarPedidos(lista)
  }
  return pedido
}

export async function cancelarPedido(id) {
  await simularRede(700)
  const lista = lerPedidos()
  const pedido = lista.find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Compra não encontrada.', {}, 404)
  if (!podeCancelar(pedido.status)) throw new ErroApi('Esta compra já foi enviada e não pode mais ser cancelada pelo site.', {}, 409)
  // Sem pagamento: cancela direto. Com pagamento: o estorno é pedido ao gateway (aqui, simulado como pendente).
  pedido.status = pedido.status === 'aguardando_pagamento' ? 'cancelada' : 'cancelamento_solicitado'
  pedido.historico.push({ status: pedido.status, em: new Date().toISOString() })
  gravarPedidos(lista)
  return pedido
}