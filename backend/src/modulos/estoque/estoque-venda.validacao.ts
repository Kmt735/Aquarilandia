import type { ItemMovimento } from '../../types/index.js'
import { AppError } from '../../utils/AppError.js'

export function validarVendaId(id: unknown): asserts id is number {
  if (typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new AppError('Dados de estoque inválidos', 400, { vendaId: 'Informe um ID inteiro positivo até 2147483647.' })
  }
}

export function consolidarItens(itens: unknown): ItemMovimento[] {
  if (!Array.isArray(itens) || !itens.length) throw new AppError('Dados de estoque inválidos', 400, { itens: 'Informe ao menos um item.' })
  const totais = new Map<number, number>()
  for (const [indice, item] of itens.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || !Object.hasOwn(item, 'produtoId') || !Object.hasOwn(item, 'quantidade')
      || Object.keys(item).some((campo) => !['produtoId', 'quantidade'].includes(campo))
      || ![item.produtoId, item.quantidade].every((n) => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 2147483647)) {
      throw new AppError('Dados de estoque inválidos', 400, { [`itens.${indice}`]: 'Informe produtoId e quantidade como inteiros positivos até 2147483647.' })
    }
    const quantidade = (totais.get(item.produtoId) ?? 0) + item.quantidade
    if (quantidade > 2147483647) throw new AppError('Dados de estoque inválidos', 400, { [`itens.${indice}.quantidade`]: 'Quantidade consolidada excede 2147483647.' })
    totais.set(item.produtoId, quantidade)
  }
  return [...totais].sort(([a], [b]) => a - b).map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
}

export class ItensIndisponiveisError extends AppError {
  readonly itensIndisponiveis: readonly ItemMovimento[]
  constructor(itens: ItemMovimento[]) {
    super('Estoque insuficiente', 409, Object.fromEntries(itens.map(({ produtoId, quantidade }) =>
      [`itens.${produtoId}.quantidade`, `Produto ${produtoId} indisponível para a quantidade solicitada: ${quantidade}.`],
    )))
    this.name = 'ItensIndisponiveisError'
    this.itensIndisponiveis = itens.map((item) => ({ ...item }))
  }
}
