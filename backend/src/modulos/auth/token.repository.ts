import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'

export const tokenRepository = {
  async excluirDoCliente(clienteId: number, executor: Queryable = db): Promise<void> {
    await executor.query('DELETE FROM tokens_recuperacao_senha WHERE cliente_id = $1', [clienteId])
  },
}
