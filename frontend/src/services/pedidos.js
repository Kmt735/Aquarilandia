// INTEGRAÇÃO: rotas de vendas e pagamentos. O pagamento acontece na página HOSPEDADA do gateway
// (cartão e PIX) — o site nunca tem campos de cartão. Hoje tudo é simulado com mocks/pedidos.js.
import { PEDIDOS_EXEMPLO } from '../mocks/pedidos'
import { podeCancelar } from '../utils/statusPedido'
import { ErroApi, gravarSessao, lerSessao, simularRede } from './http'

const CHAVE = 'aquarilandia-pedidos-exemplo'
const lerTodos = () => lerSessao(CHAVE, PEDIDOS_EXEMPLO)
const gravarTodos = (lista) => gravarSessao(CHAVE, lista)

export async function listarPedidos() {
  await simularRede()
  return lerTodos()
}

export async function obterPedido(id) {
  await simularRede()
  const pedido = lerTodos().find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Compra não encontrada.', {}, 404)
  return pedido
}

// Cria o pedido e devolve a URL da página de pagamento do gateway.
// No protótipo, a "página do gateway" é simulada: voltamos direto para /pagamento/sucesso.
export async function criarPedido({ linhas, entrega }) {
  await simularRede(800)
  const id = `EX-${Math.floor(1000 + Math.random() * 9000)}`
  const pedido = {
    id,
    criadoEm: new Date().toISOString(),
    status: 'aguardando_pagamento',
    entrega,
    itens: linhas.map((l) => ({ id: l.id, nome: l.item.nome, tipo: l.item.tipo, categoria: l.item.categoria, preco: l.item.preco, qtd: l.qtd })),
    historico: [{ status: 'aguardando_pagamento', em: new Date().toISOString() }],
    rastreio: null,
  }
  gravarTodos([pedido, ...lerTodos()])
  return { pedido, urlPagamento: `/pagamento/sucesso?pedido=${id}` }
}

// A página de sucesso NÃO confia na URL: consulta o status real até ele sair de "aguardando_pagamento".
// INTEGRAÇÃO: GET /api/vendas/:id (o backend confirma o pagamento pelo webhook do gateway).
export async function consultarStatus(id) {
  await simularRede(1200)
  const lista = lerTodos()
  const pedido = lista.find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Compra não encontrada.', {}, 404)
  if (pedido.status === 'aguardando_pagamento') {
    // Simulação: na segunda consulta o "webhook" já confirmou
    pedido.consultas = (pedido.consultas ?? 0) + 1
    if (pedido.consultas >= 2) {
      pedido.status = 'paga'
      pedido.historico.push({ status: 'paga', em: new Date().toISOString() })
    }
    gravarTodos(lista)
  }
  return pedido
}

export async function cancelarPedido(id) {
  await simularRede(700)
  const lista = lerTodos()
  const pedido = lista.find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Compra não encontrada.', {}, 404)
  if (!podeCancelar(pedido.status)) throw new ErroApi('Esta compra já foi enviada e não pode mais ser cancelada pelo site.', {}, 409)
  // Sem pagamento: cancela direto. Com pagamento: o estorno é pedido ao gateway (aqui, simulado como pendente).
  pedido.status = pedido.status === 'aguardando_pagamento' ? 'cancelada' : 'cancelamento_solicitado'
  pedido.historico.push({ status: pedido.status, em: new Date().toISOString() })
  gravarTodos(lista)
  return pedido
}
