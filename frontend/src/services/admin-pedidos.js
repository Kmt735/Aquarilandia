// Consulta paginada e operações administrativas protegidas pela API.
import { requisitarApi } from './api.js'
import { mapearPedido } from './pedidos.js'
import { ErroApi } from './http.js'
import { STATUS_PEDIDO } from '../utils/statusPedido.js'

const resumoValido = (p) => Number.isSafeInteger(p?.id) && p.id > 0 && Object.hasOwn(STATUS_PEDIDO, p.status)
  && typeof p.clienteNome === 'string' && Number.isSafeInteger(p.total) && p.total >= 0
  && Number.isSafeInteger(p.quantidadeItens) && p.quantidadeItens >= 0
  && ['retirada', 'propria', 'correios'].includes(p.tipoEntrega) && Number.isFinite(Date.parse(p.criadoEm))

export async function listarPedidosAdmin({ status = '', pagina = 1, limite = 20 } = {}) {
  const query = new URLSearchParams({ pagina, limite })
  if (status) query.set('status', status)
  const resposta = await requisitarApi(`/vendas?${query}`)
  if (!Array.isArray(resposta?.dados) || !resposta.dados.every(resumoValido)
    || !Number.isSafeInteger(resposta.total) || resposta.total < 0
    || resposta.pagina !== pagina || resposta.limite !== limite || resposta.total < resposta.dados.length) {
    throw new ErroApi('O servidor enviou uma lista de pedidos inválida. Tente novamente.', {}, 502)
  }
  return { itens: resposta.dados, total: resposta.total, pagina,
    totalPaginas: Math.max(1, Math.ceil(resposta.total / limite)) }
}

export async function obterPedidoAdmin(id) {
  const pedido = await requisitarApi(`/vendas/${encodeURIComponent(id)}`)
  if (!Number.isSafeInteger(pedido?.id) || !Object.hasOwn(STATUS_PEDIDO, pedido.status)
    || !Array.isArray(pedido.itens) || !Number.isSafeInteger(pedido.total)
    || !pedido.itens.every(i => Number.isSafeInteger(i.produtoId) && typeof i.nomeProduto === 'string'
      && Number.isSafeInteger(i.quantidade) && Number.isSafeInteger(i.subtotal))) {
    throw new ErroApi('O servidor enviou um pedido inválido.', {}, 502)
  }
  return mapearPedido(pedido)
}

export async function atualizarPedidoAdmin(id, { status, rastreio, observacao }) {
  return mapearPedido(await requisitarApi(`/vendas/${encodeURIComponent(id)}/status`, {
    metodo: 'POST', corpo: { status, observacao, ...(rastreio?.trim() ? { codigoRastreio: rastreio.trim() } : {}) },
  }))
}
export const concluirEstorno = (id, motivo) => requisitarApi(`/pagamentos/${encodeURIComponent(id)}/concluir-estorno`, {
  metodo: 'POST', corpo: { motivo },
})
export const simularPix = (id) => requisitarApi(`/pagamentos/${encodeURIComponent(id)}/simular`, { metodo: 'POST' })
