import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import { definicoesFicha } from './ficha.definicoes.js'
import type { FichaTecnica } from './ficha.types.js'

export const fichaRepository = {
  async inserir(produtoId: number, ficha: FichaTecnica, executor: Queryable = db): Promise<void> {
    const campos = Object.entries(definicoesFicha[ficha.tipo])
    const dados = ficha.dados as unknown as Record<string, unknown>
    // Tabela e colunas vêm somente das definições fechadas; todos os valores são parâmetros.
    await executor.query(
      `INSERT INTO ${ficha.tipo} (produto_id, ${campos.map(([, regra]) => regra.coluna).join(', ')})
       VALUES ($1, ${campos.map((_, i) => `$${i + 2}`).join(', ')})`,
      [produtoId, ...campos.map(([campo]) => dados[campo])],
    )
  },
}
