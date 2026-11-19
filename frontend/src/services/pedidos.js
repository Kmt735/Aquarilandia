import { requisitarApi } from './api.js'
import { textoEndereco } from '../utils/endereco.js'

export function mapearPedido(p) {
  const tipo = p.tipoEntrega === 'retirada' ? 'retirada' : 'endereco'
  return {
    ...p, id: String(p.id), pagamento: p.pagamento?.status === 'aprovado' ? 'pago' : p.pagamento?.status ?? 'pendente',
    financeiro: p.pagamento, entrega: {
      tipo, tipoEntrega: p.tipoEntrega, frete: (p.frete ?? 0) / 100,
      resumo: p.entrega ? `${textoEndereco(p.entrega)}${p.servicoFrete ? ` · ${p.servicoFrete.transportadora} · ${p.servicoFrete.nome}` : ''}` : tipo === 'retirada' ? (p.unidadeRetirada ? `${p.unidadeRetirada.nome} · ${p.unidadeRetirada.endereco}` : 'Retirada na loja — confirme a unidade com o atendimento') : 'Entrega no endereço cadastrado',
      situacao: tipo === 'retirada' ? (p.status === 'entregue' ? 'retirado' : 'aguardando_retirada')
        : p.status === 'entregue' ? 'entregue' : p.status === 'enviada' ? 'a_caminho' : 'a_enviar',
    },
    itens: (p.itens ?? []).map((i) => ({ id: i.produtoId, nome: i.nomeProduto, preco: i.precoUnitario, centavos: true, qtd: i.quantidade })),
    historico: (p.historico ?? []).map((h) => ({ status: h.status, em: h.data })), rastreio: p.codigoRastreio,
  }
}
export async function listarPedidos() {
  const resposta = await requisitarApi('/clientes/me/vendas?limite=100')
  return resposta.dados.map(mapearPedido)
}
export async function obterPedido(id) { return mapearPedido(await requisitarApi(`/clientes/me/vendas/${encodeURIComponent(id)}`)) }
export const consultarStatus = obterPedido
export const itensDaCompra = (linhas) => linhas.map((l) => ({ produtoId: Number(l.item.id), quantidade: l.qtd }))
export async function criarPedido({ linhas, entrega, totalEsperado, chave }) {
  return mapearPedido(await requisitarApi('/vendas', {
    metodo: 'POST', headers: { 'Idempotency-Key': chave }, corpo: {
      itens: itensDaCompra(linhas), totalEsperado,
      ...(entrega.tipo === 'retirada' ? { retirada: true, unidadeRetirada:entrega.unidadeRetirada } : { enderecoId: Number(entrega.escolha), ...(entrega.servicoFreteId ? {servicoFreteId:entrega.servicoFreteId} : {}) }),
    },
  }))
}
export const gerarPix = (id) => requisitarApi(`/vendas/${encodeURIComponent(id)}/pagamentos`, { metodo: 'POST' })
export async function cancelarPedido(id, motivo) {
  return mapearPedido(await requisitarApi(`/vendas/${encodeURIComponent(id)}/cancelar`, { metodo: 'POST', corpo: { motivo } }))
}
