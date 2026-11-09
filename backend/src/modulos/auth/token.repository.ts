import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'

// Só o hash do token entra no banco; o token inteiro existe apenas no link do e-mail
export const tokenRepository = {
  async excluirDoCliente(clienteId: number, executor: Queryable = db): Promise<void> {
    await executor.query('DELETE FROM tokens_recuperacao_senha WHERE cliente_id = $1', [clienteId])
  },

  // Os 30 minutos são contados pelo relógio do banco, o mesmo que o travarValido usa para conferir
  async inserir(clienteId: number, tokenHash: string, executor: Queryable = db): Promise<void> {
    await executor.query(
      `INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
       VALUES ($1, $2, now() + interval '30 minutes')`,
      [clienteId, tokenHash],
    )
  },

  async excluirVencidos(): Promise<void> {
    await db.query('DELETE FROM tokens_recuperacao_senha WHERE expira_em < now()')
  },

  // Sem trava e sem olhar a validade: só descobre de quem é o token, para o service travar o cliente antes
  async buscarClientePorHash(tokenHash: string): Promise<number | null> {
    const { rows } = await db.query<{ clienteId: number }>(
      'SELECT cliente_id AS "clienteId" FROM tokens_recuperacao_senha WHERE token_hash = $1',
      [tokenHash],
    )
    return rows[0]?.clienteId ?? null
  },

  // Trava o token (com o cliente já travado) e confere, na mesma consulta, se é desse cliente e se não venceu
  async travarValido(tokenHash: string, clienteId: number, executor: Queryable): Promise<boolean> {
    const { rows } = await executor.query(
      `SELECT id FROM tokens_recuperacao_senha
       WHERE token_hash = $1 AND cliente_id = $2 AND expira_em > now()
       FOR UPDATE`,
      [tokenHash, clienteId],
    )
    return rows.length > 0
  },
}
