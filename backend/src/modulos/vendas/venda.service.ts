import type { Queryable } from '../../utils/transacao.js'
import { vendaRepository } from './venda.repository.js'
import type { StatusVenda } from './venda.types.js'

// Venda que ainda pode gerar entrega, cobrança ou estorno (só entregue e cancelada são finais)
const statusEmAndamento: readonly StatusVenda[] = [
  'aguardando_pagamento',
  'paga',
  'em_separacao',
  'enviada',
  'pronta_retirada',
  'cancelamento_solicitado',
]

// Vendas que contam no total gasto: pagamento confirmado e sem cancelamento. cancelamento_solicitado fica fora
// porque o estorno já está em andamento (o dinheiro vai voltar), e aguardando_pagamento ainda não foi pago.
const statusPagos: readonly StatusVenda[] = [
  'paga',
  'em_separacao',
  'enviada',
  'pronta_retirada',
  'entregue',
]

export const vendaService = {
  async temCompraEmAndamento(clienteId: number, executor: Queryable): Promise<boolean> {
    return (await vendaRepository.contarEmAndamentoDoCliente(clienteId, statusEmAndamento, executor)) > 0
  },

  // Quantidade de vendas de cada cliente da página, numa query só (evita o N+1: uma query por cliente)
  async contarPorClientes(ids: number[]): Promise<Map<number, number>> {
    if (!ids.length) return new Map()
    const linhas = await vendaRepository.contarPorClientes(ids)
    return new Map(linhas.map((linha) => [linha.clienteId, linha.quantidade]))
  },

  // totalVendas conta todas as vendas; totalGasto soma, em centavos, só as de statusPagos
  async resumoDoCliente(clienteId: number): Promise<{ totalVendas: number; totalGasto: number }> {
    return vendaRepository.resumirDoCliente(clienteId, statusPagos)
  },
}
