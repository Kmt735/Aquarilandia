import { db } from '../../config/db.js'
import type { FiltrosOrcamento, NovoOrcamento, Orcamento } from './orcamento.types.js'

const colunas = `id, nome, telefone, servico, mensagem, status,
  criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`

export const orcamentoRepository = {
  async inserir(dados: NovoOrcamento): Promise<Orcamento> {
    const { rows } = await db.query<Orcamento>(
      `INSERT INTO orcamentos (nome, telefone, servico, mensagem) VALUES ($1, $2, $3, $4) RETURNING ${colunas}`,
      [dados.nome, dados.telefone, dados.servico, dados.mensagem],
    )
    return rows[0]
  },

  async listar(filtro: FiltrosOrcamento): Promise<{ dados: Orcamento[]; total: number }> {
    // O filtro de status entra só se vier, sempre como parâmetro; o count usa o mesmo WHERE da página
    const valores: unknown[] = []
    let where = ''
    if (filtro.status) {
      valores.push(filtro.status)
      where = `WHERE status = $${valores.length}`
    }

    const { rows: contagem } = await db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM orcamentos ${where}`,
      valores,
    )
    const { rows } = await db.query<Orcamento>(
      `SELECT ${colunas} FROM orcamentos ${where}
       ORDER BY criado_em DESC, id DESC
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, filtro.limite, filtro.offset],
    )
    return { dados: rows, total: contagem[0].total }
  },

  async buscarPorId(id: number): Promise<Orcamento | null> {
    const { rows } = await db.query<Orcamento>(`SELECT ${colunas} FROM orcamentos WHERE id = $1`, [id])
    return rows[0] ?? null
  },
}
