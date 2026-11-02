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

export const vendaService = {
  async temCompraEmAndamento(clienteId: number, executor: Queryable): Promise<boolean> {
    return (await vendaRepository.contarEmAndamentoDoCliente(clienteId, statusEmAndamento, executor)) > 0
  },
}
