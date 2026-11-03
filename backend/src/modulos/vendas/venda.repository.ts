import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { AutoriaVenda } from './venda.transicoes.js'
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

  // O WHERE status = $2 é a trava otimista: se outra transação mudou o status entre a leitura de quem chama e
  // este UPDATE, nenhuma linha casa e a função devolve false (quem chama responde 409). Duas mudanças ao mesmo
  // tempo a partir do mesmo status: a segunda espera o lock da linha e, depois do COMMIT da primeira, o
  // PostgreSQL reavalia o WHERE com o status novo, então só uma passa. UPDATE e histórico usam o MESMO
  // executor (a transação de quem chama): ou os dois ficam, ou nenhum.
  async mudarStatus(
    vendaId: number,
    de: StatusVenda,
    para: StatusVenda,
    autoria: AutoriaVenda,
    executor: Queryable,
  ): Promise<boolean> {
    const { rowCount } = await executor.query(
      'UPDATE vendas SET status = $3, atualizado_em = now() WHERE id = $1 AND status = $2',
      [vendaId, de, para],
    )
    if (rowCount !== 1) return false

    await executor.query(
      `INSERT INTO historico_status_venda (venda_id, status_anterior, status_novo, origem, alterado_por_id, observacao)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [vendaId, de, para, autoria.ator, autoria.clienteId, autoria.observacao ?? null],
    )
    return true
  },
}
