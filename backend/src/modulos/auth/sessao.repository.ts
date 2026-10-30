import { db } from '../../config/db.js'
import type { NovaSessao } from './auth.types.js'
import type { UsuarioLogado } from '../../types/index.js'
import type { Queryable } from '../../utils/transacao.js'

const colunasUsuario = 'c.id, c.papel'
export const sessaoRepository = {
    async criar(dados: NovaSessao): Promise<void>{
        await db.query(
            'INSERT INTO sessoes ( token_hash, cliente_id, expira_em, ip, user_agent )VALUES ($1,$2,$3,$4,$5)',
            [dados.tokenHash,dados.clienteId,dados.expiraEm,dados.ip,dados.userAgent]
        )
    },

    async buscarUsuarioPorTokenHash(tokenHash: string): Promise<UsuarioLogado | null> {
    const { rows } = await db.query<UsuarioLogado>(
      `SELECT ${colunasUsuario}
       FROM sessoes s
       JOIN clientes c ON c.id = s.cliente_id
       WHERE s.token_hash = $1
         AND s.expira_em > now()
         AND c.ativo`,
      [tokenHash],
    )
    return rows[0] ?? null
  },

  async excluirPorTokenHash(tokenHash: string): Promise<void>{
    await db.query(`DELETE FROM sessoes WHERE token_hash = $1 `,[tokenHash])
  },

  // Troca de senha: derruba os outros navegadores e mantém a sessão de quem trocou (D-07)
  async excluirOutrasDoCliente(clienteId: number, tokenHashAtual: string, executor: Queryable = db): Promise<void> {
    await executor.query('DELETE FROM sessoes WHERE cliente_id = $1 AND token_hash <> $2', [clienteId, tokenHashAtual])
  },

}