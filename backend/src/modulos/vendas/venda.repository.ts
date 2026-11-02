import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { StatusVenda } from './venda.types.js'

export const vendaRepository = {
  async contarEmAndamentoDoCliente(
    clienteId: number,
    status: readonly StatusVenda[],
    executor: Queryable = db,
  ): Promise<number> {
    const { rows } = await executor.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM vendas WHERE cliente_id = $1 AND status = ANY($2)',
      [clienteId, status],
    )
    return rows[0].total
  },
}
