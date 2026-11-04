import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import type { ItemMovimento } from '../../types/index.js'
import { AppError } from '../../utils/AppError.js'
import { estoqueVendaRepository as repository } from './estoque-venda.repository.js'
import { consolidarItens, ItensIndisponiveisError, validarVendaId } from './estoque-venda.validacao.js'

function mesmosItens(a: readonly ItemMovimento[], b: readonly ItemMovimento[]): boolean {
  return a.length === b.length && a.every((item, i) => item.produtoId === b[i].produtoId && item.quantidade === b[i].quantidade)
}

export const estoqueVendaService = {
  async baixarParaVenda(vendaId: number, itens: ItemMovimento[], client: PoolClient): Promise<void> {
    validarVendaId(vendaId)
    const consolidados = consolidarItens(itens)
    await repository.exigirTransacao(client)
    const venda = await repository.bloquearVenda(vendaId, client)
    if (!venda) throw new AppError('Venda não encontrada', 404)
    const anterior = await repository.buscarOperacao(vendaId, 'baixa_venda', client)
    if (anterior) {
      if (!mesmosItens(consolidados, await repository.buscarBaixas(anterior.id, client))) {
        throw new AppError('Venda já baixada com itens diferentes', 409)
      }
      return // Retry não baixa novamente, inclusive depois de pagamento/cancelamento.
    }
    if (venda.status !== 'aguardando_pagamento') throw new AppError('Estado da venda não permite baixa de estoque', 409)
    const persistidos = await repository.buscarItens(vendaId, client)
    const indisponiveis: ItemMovimento[] = []
    // Valida TODOS antes de escrever; a ordenação também vale para os locks.
    for (const item of consolidados) {
      const produto = await repository.bloquearProduto(item.produtoId, client)
      if (!produto || !produto.ativo || produto.estoque < item.quantidade) indisponiveis.push(item)
    }
    if (indisponiveis.length) throw new ItensIndisponiveisError(indisponiveis)
    if (!mesmosItens(consolidados, persistidos)) throw new AppError('Itens incompatíveis com a venda persistida', 409)
    const operacaoId = randomUUID()
    await repository.criarOperacao(operacaoId, vendaId, 'baixa_venda', null, client)
    for (const item of consolidados) {
      const saldo = await repository.alterarSaldo(item, 'baixa_venda', client)
      if (!saldo) throw new ItensIndisponiveisError([item])
      await repository.inserirMovimento(operacaoId, item, 'baixa_venda', saldo, null, client)
    }
  },

  async estornarVenda(vendaId: number, client: PoolClient): Promise<void> {
    validarVendaId(vendaId)
    await repository.exigirTransacao(client)
    const venda = await repository.bloquearVenda(vendaId, client)
    if (!venda) throw new AppError('Venda não encontrada', 404)
    if (venda.status !== 'cancelada' || await repository.foiEnviada(vendaId, client)) {
      throw new AppError('Estado da venda não permite devolução de estoque', 409)
    }
    if (await repository.buscarOperacao(vendaId, 'estorno_venda', client)) return
    const baixa = await repository.buscarOperacao(vendaId, 'baixa_venda', client)
    if (!baixa) throw new AppError('Venda sem baixa original de estoque', 409)
    // Não consulta itens_venda: devolve exclusivamente as quantidades imutáveis da baixa.
    const itens = await repository.buscarBaixas(baixa.id, client)
    if (!itens.length) throw new AppError('Baixa original inconsistente', 409)
    for (const item of itens) {
      const produto = await repository.bloquearProduto(item.produtoId, client)
      if (!produto || produto.estoque > 2147483647 - item.quantidade) {
        throw new AppError('Limite de estoque excedido na devolução', 409, { [`itens.${item.produtoId}.quantidade`]: `Quantidade a devolver: ${item.quantidade}.` })
      }
    }
    const operacaoId = randomUUID()
    await repository.criarOperacao(operacaoId, vendaId, 'estorno_venda', baixa.id, client)
    for (const item of itens) {
      const saldo = await repository.alterarSaldo(item, 'estorno_venda', client)
      if (!saldo) throw new AppError('Devolução de estoque não pôde ser concluída', 409)
      await repository.inserirMovimento(operacaoId, item, 'estorno_venda', saldo, item.movimentoId, client)
    }
  },
}
