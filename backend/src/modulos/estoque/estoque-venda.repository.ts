import type { PoolClient } from 'pg'
import type { ItemMovimento } from '../../types/index.js'

type OperacaoVenda = { id: string; tipo: 'baixa_venda' | 'estorno_venda' }
export interface BaixaPersistida extends ItemMovimento { movimentoId: string }

// Todas as consultas usam exclusivamente o PoolClient do chamador, inclusive leituras e locks.
export const estoqueVendaRepository = {
  async exigirTransacao(client: PoolClient): Promise<void> {
    // PostgreSQL recusa SAVEPOINT fora de BEGIN (25P01), antes de qualquer escrita de negócio.
    // É só uma verificação de contexto, não abre/fecha a transação do chamador.
    await client.query('SAVEPOINT estoque_venda_contexto')
    await client.query('RELEASE SAVEPOINT estoque_venda_contexto')
  },
  async bloquearVenda(vendaId: number, client: PoolClient): Promise<{ status: string } | null> {
    const { rows } = await client.query<{ status: string }>('SELECT status FROM vendas WHERE id = $1 FOR NO KEY UPDATE', [vendaId])
    return rows[0] ?? null
  },
  async foiEnviada(vendaId: number, client: PoolClient): Promise<boolean> {
    const { rows } = await client.query<{ existe: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM historico_status_venda WHERE venda_id = $1 AND status_novo IN ('enviada', 'entregue')) AS existe", [vendaId],
    )
    return rows[0].existe
  },
  async buscarOperacao(vendaId: number, tipo: OperacaoVenda['tipo'], client: PoolClient): Promise<OperacaoVenda | null> {
    const { rows } = await client.query<OperacaoVenda>('SELECT id, tipo_venda AS tipo FROM operacoes_estoque WHERE venda_id = $1 AND tipo_venda = $2', [vendaId, tipo])
    return rows[0] ?? null
  },
  async buscarBaixas(operacaoId: string, client: PoolClient): Promise<BaixaPersistida[]> {
    const { rows } = await client.query<BaixaPersistida>(
      `SELECT id::text AS "movimentoId", produto_id AS "produtoId", quantidade
         FROM movimentacoes_estoque WHERE operacao_id = $1 AND tipo = 'baixa_venda' ORDER BY produto_id`, [operacaoId],
    )
    return rows
  },
  async buscarItens(vendaId: number, client: PoolClient): Promise<ItemMovimento[]> {
    const { rows } = await client.query<ItemMovimento>(
      'SELECT produto_id AS "produtoId", quantidade FROM itens_venda WHERE venda_id = $1 ORDER BY produto_id FOR NO KEY UPDATE', [vendaId],
    )
    return rows
  },
  async bloquearProduto(produtoId: number, client: PoolClient): Promise<{ estoque: number; ativo: boolean } | null> {
    const { rows } = await client.query<{ estoque: number; ativo: boolean }>(
      'SELECT estoque, ativo FROM produtos WHERE id = $1 FOR NO KEY UPDATE', [produtoId],
    )
    return rows[0] ?? null
  },
  async criarOperacao(id: string, vendaId: number, tipo: OperacaoVenda['tipo'], originalId: string | null, client: PoolClient): Promise<void> {
    await client.query(`INSERT INTO operacoes_estoque(id, origem, venda_id, tipo_venda, operacao_original_id)
      VALUES ($1, 'venda', $2, $3, $4)`, [id, vendaId, tipo, originalId])
  },
  async alterarSaldo(item: ItemMovimento, tipo: OperacaoVenda['tipo'], client: PoolClient): Promise<{ anterior: number; atual: number } | null> {
    // Somente fragmentos internos fechados; nenhuma entrada do usuário compõe SQL.
    const baixar = tipo === 'baixa_venda'
    const { rows } = await client.query<{ anterior: number; atual: number }>(baixar
      ? `UPDATE produtos SET estoque = estoque - $2, atualizado_em = now() WHERE id = $1 AND ativo AND estoque >= $2
         RETURNING estoque + $2 AS anterior, estoque AS atual`
      : `UPDATE produtos SET estoque = estoque + $2, atualizado_em = now() WHERE id = $1 AND estoque <= 2147483647 - $2
         RETURNING estoque - $2 AS anterior, estoque AS atual`, [item.produtoId, item.quantidade])
    return rows[0] ?? null
  },
  async inserirMovimento(operacaoId: string, item: ItemMovimento, tipo: OperacaoVenda['tipo'], saldo: { anterior: number; atual: number }, original: string | null, client: PoolClient): Promise<void> {
    const delta = tipo === 'baixa_venda' ? -item.quantidade : item.quantidade
    await client.query(`INSERT INTO movimentacoes_estoque
      (operacao_id, produto_id, tipo, quantidade, delta, saldo_anterior, saldo_atual, motivo, movimento_original_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [operacaoId, item.produtoId, tipo, item.quantidade, delta,
      saldo.anterior, saldo.atual, tipo === 'baixa_venda' ? 'Baixa na criação da venda.' : 'Devolução da baixa da venda.', original])
  },
}
