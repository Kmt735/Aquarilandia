import { requisitarApi } from './api'

const query = (filtros) => new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v !== undefined)).toString()
export const listarEstoque = (filtros) => requisitarApi(`/estoque?${query(filtros)}`)
export const historicoEstoque = (produtoId, pagina = 1) => requisitarApi(`/estoque/movimentacoes?${query({ produtoId, pagina, limite: 10 })}`)
export const movimentarEstoque = (dados, chave) => requisitarApi('/estoque/movimentacoes', {
  metodo: 'POST', corpo: dados, headers: { 'Idempotency-Key': chave },
})
export const listarOrcamentos = (filtros) => requisitarApi(`/orcamentos?${query(filtros)}`)
export const atualizarOrcamento = (id, dados) => requisitarApi(`/orcamentos/${id}`, { metodo: 'PATCH', corpo: dados })
export const listarClientes = (filtros) => requisitarApi(`/clientes?${query(filtros)}`)
export const definirClienteAtivo = (id, ativo) => requisitarApi(`/clientes/${id}`, { metodo: 'PATCH', corpo: { ativo } })
