import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'

// Só o hash do token entra no banco; o token inteiro existe apenas no link do e-mail
export const tokenRepository = {
  async excluirDoCliente(clienteId: number, executor: Queryable = db): Promise<void> {
    await executor.query('DELETE FROM tokens_recuperacao_senha WHERE cliente_id = $1', [clienteId])
  },

  // Os 30 minutos são contados pelo relógio do banco
  async inserir(clienteId: number, tokenHash: string, executor: Queryable = db): Promise<void> {
    await executor.query(
      `INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
       VALUES ($1, $2, now() + interval '30 minutes')`,
      [clienteId, tokenHash],
    )
  },
}
