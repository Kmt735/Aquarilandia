// INTEGRAÇÃO ADMIN — PROPOSTA de rotas (alinhar com o Backend 2, módulo de vendas):
//   GET   /api/admin/vendas?filtro=&busca=&pagina=   lista, mais recentes primeiro
//   GET   /api/admin/vendas/:id                      detalhe (itens, cliente, entrega, histórico)
//   PATCH /api/admin/vendas/:id                      { status?, pagamento?, entregaSituacao?, rastreio? }
// Exigem sessão de administrador. Hoje tudo roda sobre os pedidos de demonstração (localStorage).
import { normalizar } from '../utils/format'
import { ANDAMENTO_ADMIN, ENTREGA_ADMIN, PAGAMENTO_ADMIN } from '../utils/statusAdminPedido'
import { ErroApi, simularRede } from './http'
import { gravarPedidos, lerPedidos } from './pedidos'

const FILTROS = {
  todos: () => true,
  abertos: (p) => !['entregue', 'cancelada'].includes(p.status),
  pagamento_pendente: (p) => p.pagamento === 'pendente' && p.status !== 'cancelada',
  concluidos: (p) => p.status === 'entregue',
  cancelados: (p) => ['cancelada', 'cancelamento_solicitado'].includes(p.status),
}

const valido = (lista, valor) => lista.some((o) => o.valor === valor)

export async function listarPedidosAdmin({ filtro = 'todos', busca = '', pagina = 1, limite = 20 } = {}) {
  await simularRede(200)
  const termo = normalizar(busca.trim())
  const lista = lerPedidos()
    .filter(FILTROS[filtro] ?? FILTROS.todos)
    .filter((p) => !termo || normalizar(`${p.id} ${p.cliente?.nome ?? ''}`).includes(termo))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  return {
    itens: lista.slice((pagina - 1) * limite, pagina * limite),
    total: lista.length,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(lista.length / limite)),
  }
}

export async function obterPedidoAdmin(id) {
  await simularRede(200)
  const pedido = lerPedidos().find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Pedido não encontrado.', {}, 404)
  return pedido
}

export async function atualizarPedidoAdmin(id, { status, pagamento, entregaSituacao, rastreio }) {
  await simularRede(350)
  const lista = lerPedidos()
  const pedido = lista.find((p) => p.id === id)
  if (!pedido) throw new ErroApi('Pedido não encontrado.', {}, 404)

  if (status && !valido(ANDAMENTO_ADMIN, status)) throw new ErroApi('Andamento inválido.', { status: 'Escolha uma das opções.' }, 400)
  if (pagamento && !valido(PAGAMENTO_ADMIN, pagamento)) throw new ErroApi('Pagamento inválido.', { pagamento: 'Escolha uma das opções.' }, 400)
  if (entregaSituacao && !valido(ENTREGA_ADMIN[pedido.entrega.tipo], entregaSituacao)) {
    throw new ErroApi('Situação da entrega inválida.', { entregaSituacao: 'Escolha uma das opções.' }, 400)
  }

  const agora = new Date().toISOString()
  if (pagamento && pagamento !== pedido.pagamento) {
    pedido.pagamento = pagamento
    // Pagamento aprovado tira o pedido de "aguardando pagamento", se o admin não escolheu outro andamento
    if (pagamento === 'pago' && pedido.status === 'aguardando_pagamento' && status === pedido.status) status = 'paga'
  }
  if (status && status !== pedido.status) {
    pedido.status = status
    pedido.historico.push({ status, em: agora })
  }
  if (entregaSituacao) pedido.entrega = { ...pedido.entrega, situacao: entregaSituacao }
  if (rastreio !== undefined) pedido.rastreio = rastreio.trim() || null
  pedido.atualizadoEm = agora

  gravarPedidos(lista)
  return structuredClone(pedido)
}