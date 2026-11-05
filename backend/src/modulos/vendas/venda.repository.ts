import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { AutoriaVenda } from './venda.transicoes.js'
import type { NovaVenda, NovoItemVenda, StatusVenda, TipoEntrega, VendaCriada } from './venda.types.js'

// Linha de vendas lida pelo buscarCompleta: os entrega_* de endereço são NULL na retirada
interface LinhaVenda {
  id: number
  status: StatusVenda
  tipoEntrega: TipoEntrega
  subtotal: number
  frete: number
  total: number
  prazoEntregaDias: number
  expiraEm: Date
  criadoEm: Date
  destinatario: string
  telefone: string
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
}

export const vendaRepository = {
  // #31: só as vencidas ficam de fora (expira_em no passado), porque a tarefa da #32 ainda vai cancelá-las.
  // now() é o início da transação de quem chama: a mesma hora para todas as linhas
  async contarAguardandoPagamento(clienteId: number, executor: Queryable): Promise<number> {
    const { rows } = await executor.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM vendas
        WHERE cliente_id = $1 AND status = 'aguardando_pagamento' AND expira_em > now()`,
      [clienteId],
    )
    return rows[0].total
  },

  // status e expira_em ficam com o DEFAULT do banco ('aguardando_pagamento' e now() + 30 minutos).
  // Na retirada, todos os entrega_* de endereço vão NULL (CHECK ck_vendas_endereco_entrega)
  async inserir(dados: NovaVenda, executor: Queryable): Promise<number> {
    const endereco = dados.endereco
    const { rows } = await executor.query<{ id: number }>(
      `INSERT INTO vendas
         (cliente_id, subtotal, frete, total, tipo_entrega, prazo_entrega_dias, entrega_destinatario, entrega_telefone,
          entrega_cep, entrega_logradouro, entrega_numero, entrega_complemento, entrega_bairro, entrega_cidade, entrega_uf,
          chave_idempotencia, hash_requisicao)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING id`,
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
        dados.chaveIdempotencia,
        dados.hashRequisicao,
      ],
    )
    return rows[0].id
  },

  // Idempotência: a chave é procurada SEMPRE junto com o cliente, então a chave de um cliente nunca acha a venda
  // de outro (o UNIQUE uq_vendas_cliente_chave é o mesmo par)
  async buscarPorChave(
    clienteId: number,
    chave: string,
    executor: Queryable = db,
  ): Promise<{ id: number; hashRequisicao: string } | null> {
    const { rows } = await executor.query<{ id: number; hashRequisicao: string }>(
      'SELECT id, hash_requisicao AS "hashRequisicao" FROM vendas WHERE cliente_id = $1 AND chave_idempotencia = $2',
      [clienteId, chave],
    )
    return rows[0] ?? null
  },

  // A venda completa, como o cliente vê (resposta da criação, da repetição e, depois, do detalhe da #34).
  // Filtra por id E cliente_id: venda de outro cliente não é encontrada (quem chama responde 404)
  async buscarCompleta(id: number, clienteId: number, executor: Queryable = db): Promise<VendaCriada | null> {
    const { rows } = await executor.query<LinhaVenda>(
      `SELECT id, status, tipo_entrega AS "tipoEntrega", subtotal, frete, total, prazo_entrega_dias AS "prazoEntregaDias",
              expira_em AS "expiraEm", criado_em AS "criadoEm", entrega_destinatario AS destinatario,
              entrega_telefone AS telefone, entrega_cep AS cep, entrega_logradouro AS logradouro, entrega_numero AS numero,
              entrega_complemento AS complemento, entrega_bairro AS bairro, entrega_cidade AS cidade, entrega_uf AS uf
         FROM vendas
        WHERE id = $1 AND cliente_id = $2`,
      [id, clienteId],
    )
    const venda = rows[0]
    if (!venda) return null

    // ORDER BY id = a ordem em que os itens foram gravados (a da primeira aparição de cada produto no body)
    const { rows: itens } = await executor.query<NovoItemVenda>(
      `SELECT produto_id AS "produtoId", nome_produto AS "nomeProduto", preco_unitario AS "precoUnitario",
              quantidade, subtotal
         FROM itens_venda
        WHERE venda_id = $1
        ORDER BY id`,
      [id],
    )

    const { destinatario, telefone, cep, logradouro, numero, complemento, bairro, cidade, uf, ...resumo } = venda
    // Na retirada não há endereço: entrega null. Fora dela, o CHECK ck_vendas_endereco_entrega garante cep,
    // logradouro, numero, bairro, cidade e uf preenchidos (só o complemento pode ser NULL)
    const entrega = resumo.tipoEntrega === 'retirada'
      ? null
      : { cep, logradouro, numero, complemento, bairro, cidade, uf, destinatario, telefone } as VendaCriada['entrega']
    return { ...resumo, itens, entrega }
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
