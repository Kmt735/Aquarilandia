import { requisitarApi } from './api.js'
import { mapearPedido } from './pedidos.js'

const filtros = {
  todos: () => true, abertos: (p) => !['entregue', 'cancelada'].includes(p.status),
  pagamento_pendente: (p) => p.status === 'aguardando_pagamento', concluidos: (p) => p.status === 'entregue',
  cancelados: (p) => ['cancelada', 'cancelamento_solicitado'].includes(p.status),
}
export async function listarPedidosAdmin({ filtro = 'todos', busca = '', pagina = 1, limite = 20 } = {}) {
  const lista = []
  let atual = 1, total
  do {
    const resposta = await requisitarApi(`/vendas?pagina=${atual++}&limite=100`)
    lista.push(...resposta.dados)
    total = resposta.total
    if (!resposta.dados.length) break
  } while (lista.length < total)
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const filtrados = lista.filter(filtros[filtro] ?? filtros.todos)
    .filter((p) => !termo || `${p.id} ${p.clienteNome}`.toLocaleLowerCase('pt-BR').includes(termo))
  return { itens: filtrados.slice((pagina - 1) * limite, pagina * limite).map(mapearPedido), total: filtrados.length,
    pagina, totalPaginas: Math.max(1, Math.ceil(filtrados.length / limite)) }
}
export async function obterPedidoAdmin(id) { return mapearPedido(await requisitarApi(`/vendas/${encodeURIComponent(id)}`)) }
export async function atualizarPedidoAdmin(id, { status, rastreio, observacao }) {
  return mapearPedido(await requisitarApi(`/vendas/${encodeURIComponent(id)}/status`, {
    metodo: 'POST', corpo: { status, observacao, ...(rastreio?.trim() ? { codigoRastreio: rastreio.trim() } : {}) },
  }))
}
export const concluirEstorno = (id, motivo) => requisitarApi(`/pagamentos/${encodeURIComponent(id)}/concluir-estorno`, {
  metodo: 'POST', corpo: { motivo },
})
export const simularPix = (id) => requisitarApi(`/pagamentos/${encodeURIComponent(id)}/simular`, { metodo: 'POST' })
