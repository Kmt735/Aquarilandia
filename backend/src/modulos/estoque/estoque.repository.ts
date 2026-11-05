import type { PoolClient } from 'pg'
import { db } from '../../config/db.js'
import type { FiltrosHistoricoEstoque, HistoricoEstoque, NovoMovimentoAdmin, OperacaoPersistida, ResultadoMovimento, SaldoProdutoAdmin } from './estoque.types.js'

// Executor obrigatório: nenhuma escrita escapa da transação de quem chama.
export const estoqueRepository = {
  async buscarSaldo(produtoId: number): Promise<SaldoProdutoAdmin | null> {
    const { rows } = await db.query<SaldoProdutoAdmin>(
      'SELECT id AS "produtoId", nome, ativo, estoque AS "saldoAtual" FROM produtos WHERE id = $1', [produtoId],
    )
    return rows[0] ?? null
  },

  async listarHistorico(filtros: FiltrosHistoricoEstoque): Promise<HistoricoEstoque | null> {
    const { rows } = await db.query<HistoricoEstoque & { existe: boolean }>(
      `WITH filtrados AS (
         SELECT m.id, m.operacao_id AS "operacaoId", m.produto_id AS "produtoId", m.tipo, m.quantidade,
                m.delta, m.saldo_anterior AS "saldoAnterior", m.saldo_atual AS "saldoPosterior",
                m.criado_em AS "criadoEm", m.motivo, o.origem, o.autor_id AS "autorId",
                o.venda_id AS "vendaId", o.operacao_original_id AS "operacaoOriginalId"
           FROM movimentacoes_estoque m JOIN operacoes_estoque o ON o.id = m.operacao_id
          WHERE m.produto_id = $1
       )
       SELECT EXISTS (SELECT 1 FROM produtos WHERE id = $1) AS existe,
              (SELECT count(*)::int FROM filtrados) AS total,
              COALESCE((SELECT json_agg(json_build_object(
                'operacaoId', p."operacaoId", 'produtoId', p."produtoId", 'tipo', p.tipo,
                'quantidade', p.quantidade, 'delta', p.delta, 'saldoAnterior', p."saldoAnterior",
                'saldoPosterior', p."saldoPosterior", 'criadoEm', p."criadoEm", 'motivo', p.motivo,
                'origem', p.origem, 'autorId', p."autorId")::jsonb
                  || CASE WHEN p.origem = 'venda' THEN jsonb_build_object('vendaId', p."vendaId", 'operacaoOriginalId', p."operacaoOriginalId") ELSE '{}'::jsonb END
                ORDER BY p."criadoEm" DESC, p.id DESC)
                FROM (SELECT id, "operacaoId", "produtoId", tipo, quantidade, delta, "saldoAnterior", "saldoPosterior",
                             "criadoEm", motivo, origem, "autorId", "vendaId", "operacaoOriginalId"
                        FROM filtrados ORDER BY "criadoEm" DESC, id DESC LIMIT $2 OFFSET $3) p), '[]'::json) AS itens`,
      [filtros.produtoId, filtros.limite, (filtros.pagina - 1) * filtros.limite],
    )
    const resultado = rows[0]
    if (!resultado.existe) return null
    // JSON do PostgreSQL preserva microssegundos/offset; a API mantém o ISO UTC do restante do projeto.
    return { total: resultado.total, itens: resultado.itens.map((m) => ({ ...m, criadoEm: new Date(m.criadoEm).toISOString() })) }
  },

  async criarOperacao(id: string, autorId: number, chave: string, hash: string, tx: PoolClient): Promise<boolean> {
    const { rowCount } = await tx.query(
      `INSERT INTO operacoes_estoque (id, autor_id, chave_idempotencia, hash_requisicao)
       VALUES ($1, $2, $3, $4) ON CONFLICT (autor_id, chave_idempotencia) DO NOTHING`,
      [id, autorId, chave, hash],
    )
    return rowCount === 1
  },

  async buscarOperacao(autorId: number, chave: string, tx: PoolClient): Promise<OperacaoPersistida> {
    const { rows } = await tx.query<OperacaoPersistida>(
      `SELECT o.hash_requisicao AS "hashRequisicao", o.id AS "operacaoId", m.produto_id AS "produtoId",
              m.tipo, m.quantidade, m.saldo_anterior AS "saldoAnterior", m.saldo_atual AS "saldoAtual", m.criado_em AS "criadoEm"
         FROM operacoes_estoque o JOIN movimentacoes_estoque m ON m.operacao_id = o.id
        WHERE o.autor_id = $1 AND o.chave_idempotencia = $2`, [autorId, chave],
    )
    if (rows.length !== 1) throw new Error('Operação administrativa sem resultado íntegro.')
    return rows[0]
  },

  async bloquearProduto(id: number, tx: PoolClient): Promise<{ estoque: number } | null> {
    const { rows } = await tx.query<{ estoque: number }>(
      'SELECT estoque FROM produtos WHERE id = $1 FOR NO KEY UPDATE', [id],
    )
    return rows[0] ?? null
  },

  async atualizarSaldo(id: number, anterior: number, atual: number, tx: PoolClient): Promise<void> {
    const { rowCount } = await tx.query(
      'UPDATE produtos SET estoque = $2, atualizado_em = now() WHERE id = $1 AND estoque = $3', [id, atual, anterior],
    )
    if (rowCount !== 1) throw new Error('Saldo mudou apesar do lock da operação.')
  },

  async inserirMovimento(operacaoId: string, dados: NovoMovimentoAdmin, anterior: number, atual: number, tx: PoolClient): Promise<ResultadoMovimento> {
    const { rows } = await tx.query<ResultadoMovimento>(
      `INSERT INTO movimentacoes_estoque
         (operacao_id, produto_id, tipo, quantidade, delta, saldo_anterior, saldo_atual, motivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING operacao_id AS "operacaoId", produto_id AS "produtoId", tipo, quantidade,
                 saldo_anterior AS "saldoAnterior", saldo_atual AS "saldoAtual", criado_em AS "criadoEm"`,
      [operacaoId, dados.produtoId, dados.tipo, dados.quantidade, atual - anterior, anterior, atual, dados.motivo],
    )
    return rows[0]
  },
}
