import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { AutoriaVenda } from './venda.transicoes.js'
import type { NovaVenda, NovoItemVenda, StatusVenda, VendaInserida } from './venda.types.js'

export const vendaRepository = {
  // status e expira_em ficam com o DEFAULT do banco ('aguardando_pagamento' e now() + 30 minutos).
  // Na retirada, todos os entrega_* de endereço vão NULL (CHECK ck_vendas_endereco_entrega)
  async inserir(dados: NovaVenda, executor: Queryable): Promise<VendaInserida> {
    const endereco = dados.endereco
    const { rows } = await executor.query<VendaInserida>(
      `INSERT INTO vendas
         (cliente_id, subtotal, frete, total, tipo_entrega, prazo_entrega_dias, entrega_destinatario, entrega_telefone,
          entrega_cep, entrega_logradouro, entrega_numero, entrega_complemento, entrega_bairro, entrega_cidade, entrega_uf)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING id, status, expira_em AS "expiraEm", criado_em AS "criadoEm"`,
      [
        dados.clienteId,
        dados.subtotal,
        dados.frete,
        dados.total,
        dados.tipoEntrega,
        dados.prazoEntregaDias,
        dados.destinatario,
        dados.telefone,
        endereco?.cep ?? null,
        endereco?.logradouro ?? null,
        endereco?.numero ?? null,
        endereco?.complemento ?? null,
        endereco?.bairro ?? null,
        endereco?.cidade ?? null,
        endereco?.uf ?? null,
      ],
    )
    return rows[0]
  },

  // Um INSERT só para todos os itens: cada array é uma coluna, e o unnest junta as posições em linhas
  async inserirItens(vendaId: number, itens: readonly NovoItemVenda[], executor: Queryable): Promise<void> {
    await executor.query(
      `INSERT INTO itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal)
       SELECT $1, i.produto_id, i.nome_produto, i.preco_unitario, i.quantidade, i.subtotal
         FROM unnest($2::integer[], $3::text[], $4::integer[], $5::integer[], $6::integer[])
           AS i (produto_id, nome_produto, preco_unitario, quantidade, subtotal)`,
      [
        vendaId,
        itens.map((item) => item.produtoId),
        itens.map((item) => item.nomeProduto),
        itens.map((item) => item.precoUnitario),
        itens.map((item) => item.quantidade),
        itens.map((item) => item.subtotal),
      ],
    )
  },

  // Primeiro registro do histórico: sem status anterior, feito pelo próprio cliente
  async registrarCriacao(vendaId: number, clienteId: number, executor: Queryable): Promise<void> {
    await executor.query(
      `INSERT INTO historico_status_venda (venda_id, status_anterior, status_novo, origem, alterado_por_id)
       VALUES ($1, NULL, 'aguardando_pagamento', 'cliente', $2)`,
      [vendaId, clienteId],
    )
  },

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

  // Uma query só para a página inteira; cliente sem venda não aparece no resultado (quem chama usa ?? 0)
  async contarPorClientes(ids: readonly number[]): Promise<{ clienteId: number; quantidade: number }[]> {
    const { rows } = await db.query<{ clienteId: number; quantidade: number }>(
      `SELECT cliente_id AS "clienteId", count(*)::int AS quantidade
         FROM vendas
        WHERE cliente_id = ANY($1)
        GROUP BY cliente_id`,
      [ids],
    )
    return rows
  },

  async resumirDoCliente(
    clienteId: number,
    statusPagos: readonly StatusVenda[],
  ): Promise<{ totalVendas: number; totalGasto: number }> {
    // sum(integer) devolve bigint, que o pg entrega como string: converte aqui (centavos cabem no Number)
    const { rows } = await db.query<{ totalVendas: number; totalGasto: string }>(
      `SELECT count(*)::int AS "totalVendas",
              COALESCE(sum(total) FILTER (WHERE status = ANY($2)), 0)::bigint AS "totalGasto"
         FROM vendas
        WHERE cliente_id = $1`,
      [clienteId, statusPagos],
    )
    return { totalVendas: rows[0].totalVendas, totalGasto: Number(rows[0].totalGasto) }
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
