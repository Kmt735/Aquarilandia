import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { LinhaPagamento, PagamentoAdmin, StatusPagamento } from '../vendas/venda.types.js'

// A marca do pagamento indevido no status_detalhe (a mesma constante do pagamento.service)
export const detalheIndevido = 'pagamento indevido'

// Todo o SQL de pagamentos e eventos_webhook (db/init/20_vendas.sql e 22_pagamentos_estorno.sql).
// Os ids do gateway (gateway_cobranca_id, gateway_pagamento_id) só saem daqui para o pagamento.service, que os
// usa para falar com o gateway; nunca vão para a resposta do cliente nem para o log.

export interface PagamentoPendente {
  id: number
  valor: number
}

export interface PagamentoDaCobranca {
  id: number
  vendaId: number
}

export interface PagamentoTravado {
  id: number
  status: StatusPagamento
  valor: number
  estornoSolicitadoEm: Date | null
  statusDetalhe: string | null
  tentativas: number
}

export interface PagamentoParaEstorno {
  vendaId: number
  status: StatusPagamento
  cobrancaId: string | null
  tentativas: number
  estornoSolicitadoEm: Date | null
}

export interface EventoWebhook {
  id: number
  processadoEm: Date | null
  cobrancaId: string | null
}

export const pagamentoRepository = {
  // Detalhe da compra (#34, #48). Só o que a escolha do pagamento e a mensagem precisam: nenhum id do gateway,
  // valor, status_detalhe ou erro de estorno sai do banco
  async listarPorVenda(vendaId: number): Promise<LinhaPagamento[]> {
    const { rows } = await db.query<LinhaPagamento>(
      `SELECT id, status, metodo, criado_em AS "criadoEm", estorno_solicitado_em AS "estornoSolicitadoEm"
         FROM pagamentos
        WHERE venda_id = $1
        ORDER BY criado_em DESC, id DESC`,
      [vendaId],
    )
    return rows
  },

  // #40, admin: todos os pagamentos da venda, do mais antigo ao mais novo. O id da cobrança sai daqui CORTADO (o
  // prefixo pix_char_ e mais 6 caracteres, o bastante para achar no painel da AbacatePay): o inteiro nunca sai
  async listarParaAdmin(vendaId: number): Promise<PagamentoAdmin[]> {
    const { rows } = await db.query<PagamentoAdmin>(
      `SELECT id, status, metodo, valor,
              CASE WHEN gateway_cobranca_id IS NULL THEN NULL
                   WHEN gateway_cobranca_id LIKE 'pix\_char\_%' THEN left(gateway_cobranca_id, 15) || '…'
                   ELSE left(gateway_cobranca_id, 6) || '…' END AS "cobrancaInicio",
              estorno_solicitado_em AS "estornoSolicitadoEm", estorno_tentativas AS "estornoTentativas",
              estorno_ultimo_erro AS "estornoUltimoErro", status_detalhe AS "statusDetalhe", criado_em AS "criadoEm"
         FROM pagamentos
        WHERE venda_id = $1
        ORDER BY criado_em, id`,
      [vendaId],
    )
    return rows
  },

  // ---------- #44 gerar o Pix ----------

  // Quem chama já travou a venda (FOR UPDATE): nenhum outro pedido cria ou muda pagamento desta venda até o COMMIT
  async buscarPendente(vendaId: number, executor: Queryable): Promise<PagamentoPendente | null> {
    const { rows } = await executor.query<PagamentoPendente>(
      `SELECT id, valor FROM pagamentos
        WHERE venda_id = $1 AND status = 'pendente'
        ORDER BY id DESC
        LIMIT 1`,
      [vendaId],
    )
    return rows[0] ?? null
  },

  // Sem cobrança ainda (gateway_cobranca_id NULL): ela só é gravada depois da chamada ao gateway, fora da transação
  async inserirPendente(vendaId: number, valor: number, gateway: string, executor: Queryable): Promise<number> {
    const { rows } = await executor.query<{ id: number }>(
      `INSERT INTO pagamentos (venda_id, gateway, metodo, valor, status)
       VALUES ($1, $2, 'pix', $3, 'pendente')
       RETURNING id`,
      [vendaId, gateway, valor],
    )
    return rows[0].id
  },

  // Grava a cobrança só se o pagamento ainda não tem uma, ou já tem ESTA. false = já tinha outra (nunca sobrescreve)
  async gravarCobranca(pagamentoId: number, cobrancaId: string): Promise<boolean> {
    const { rowCount } = await db.query(
      `UPDATE pagamentos SET gateway_cobranca_id = $1, atualizado_em = now()
        WHERE id = $2 AND (gateway_cobranca_id IS NULL OR gateway_cobranca_id = $1)`,
      [cobrancaId, pagamentoId],
    )
    return rowCount === 1
  },

  // ---------- #46/#47 processar a cobrança ----------

  async buscarPorCobranca(cobrancaId: string): Promise<PagamentoDaCobranca | null> {
    const { rows } = await db.query<PagamentoDaCobranca>(
      'SELECT id, venda_id AS "vendaId" FROM pagamentos WHERE gateway_cobranca_id = $1',
      [cobrancaId],
    )
    return rows[0] ?? null
  },

  // A etapa C do #44 que não chegou a gravar: só vincula o pagamento sem cobrança da MESMA venda e do MESMO valor
  async vincularCobranca(
    pagamentoId: number,
    vendaId: number,
    valor: number,
    cobrancaId: string,
  ): Promise<PagamentoDaCobranca | null> {
    const { rows } = await db.query<PagamentoDaCobranca>(
      `UPDATE pagamentos SET gateway_cobranca_id = $4, atualizado_em = now()
        WHERE id = $1 AND venda_id = $2 AND valor = $3 AND gateway_cobranca_id IS NULL
        RETURNING id, venda_id AS "vendaId"`,
      [pagamentoId, vendaId, valor, cobrancaId],
    )
    return rows[0] ?? null
  },

  // Quem chama já travou a venda: a ordem é sempre venda → pagamento (ver pagamento.service.ts)
  async travar(pagamentoId: number, client: Queryable): Promise<PagamentoTravado | null> {
    const { rows } = await client.query<PagamentoTravado>(
      `SELECT id, status, valor, estorno_solicitado_em AS "estornoSolicitadoEm", status_detalhe AS "statusDetalhe",
              estorno_tentativas AS tentativas
         FROM pagamentos
        WHERE id = $1
          FOR UPDATE`,
      [pagamentoId],
    )
    return rows[0] ?? null
  },

  // No Pix, o id do pagamento no gateway é o próprio id da cobrança. detalheIndevido preenchido = pagamento indevido
  // (venda já cancelada ou já paga): fica aprovado, com estorno_solicitado_em e esse status_detalhe, e a devolução é
  // tentada fora da transação. O status_detalhe é o que separa o indevido do pagamento que confirmou a venda (Lote 12)
  async marcarAprovado(
    pagamentoId: number,
    cobrancaId: string,
    detalheIndevido: string | null,
    client: Queryable,
  ): Promise<void> {
    await client.query(
      `UPDATE pagamentos
          SET status = 'aprovado', gateway_pagamento_id = $2, status_detalhe = $3::varchar,
              estorno_solicitado_em = CASE WHEN $3::varchar IS NOT NULL THEN now() ELSE estorno_solicitado_em END,
              atualizado_em = now()
        WHERE id = $1`,
      [pagamentoId, cobrancaId, detalheIndevido],
    )
  },

  // Trava otimista como a do vendaRepository.mudarStatus: só muda se o status atual for um dos de `de`
  async mudarStatus(
    pagamentoId: number,
    de: readonly StatusPagamento[],
    para: StatusPagamento,
    client: Queryable,
  ): Promise<boolean> {
    const { rowCount } = await client.query(
      'UPDATE pagamentos SET status = $2, atualizado_em = now() WHERE id = $1 AND status = ANY($3)',
      [pagamentoId, para, de],
    )
    return rowCount === 1
  },

  async marcarDetalhe(pagamentoId: number, detalhe: string, client: Queryable): Promise<void> {
    await client.query(
      'UPDATE pagamentos SET status_detalhe = $2, atualizado_em = now() WHERE id = $1',
      [pagamentoId, detalhe],
    )
  },

  // ---------- #35 cancelar a compra ----------

  // Venda não paga cancelada: o Pix pendente vira cancelado (sem chamar o gateway: ele vence sozinho). Quem chama já
  // travou a venda. Se o Pix for pago mesmo assim, o webhook acha a venda cancelada e devolve o dinheiro
  async cancelarPendentes(vendaId: number, client: Queryable): Promise<number> {
    const { rowCount } = await client.query(
      "UPDATE pagamentos SET status = 'cancelado', atualizado_em = now() WHERE venda_id = $1 AND status = 'pendente'",
      [vendaId],
    )
    return rowCount ?? 0
  },

  // Venda paga cancelada: o pagamento que confirmou a venda é o aprovado SEM estorno pedido (um pagamento em dobro já
  // nasce com o estorno pedido). Quem chama já travou a venda; este trava o pagamento (ordem venda → pagamento)
  async travarConfirmador(vendaId: number, client: Queryable): Promise<number | null> {
    const { rows } = await client.query<{ id: number }>(
      `SELECT id FROM pagamentos
        WHERE venda_id = $1 AND status = 'aprovado' AND estorno_solicitado_em IS NULL
        ORDER BY id
        LIMIT 1
          FOR UPDATE`,
      [vendaId],
    )
    return rows[0]?.id ?? null
  },

  async pedirEstorno(pagamentoId: number, client: Queryable): Promise<void> {
    await client.query(
      'UPDATE pagamentos SET estorno_solicitado_em = now(), atualizado_em = now() WHERE id = $1',
      [pagamentoId],
    )
  },

  // Conclusão manual (#35, admin): o pagamento que confirmou a venda em cancelamento_solicitado, com o estorno pedido.
  // O indevido (status_detalhe 'pagamento indevido') fica de fora: ele não é o pagamento da compra
  async travarConfirmadorEmEstorno(vendaId: number, client: Queryable): Promise<PagamentoTravado | null> {
    const { rows } = await client.query<PagamentoTravado>(
      `SELECT id, status, valor, estorno_solicitado_em AS "estornoSolicitadoEm", status_detalhe AS "statusDetalhe",
              estorno_tentativas AS tentativas
         FROM pagamentos
        WHERE venda_id = $1 AND status = 'aprovado' AND estorno_solicitado_em IS NOT NULL
          AND status_detalhe IS DISTINCT FROM $2
        ORDER BY id
        LIMIT 1
          FOR UPDATE`,
      [vendaId, detalheIndevido],
    )
    return rows[0] ?? null
  },

  async buscarVendaDoPagamento(pagamentoId: number): Promise<number | null> {
    const { rows } = await db.query<{ vendaId: number }>('SELECT venda_id AS "vendaId" FROM pagamentos WHERE id = $1', [
      pagamentoId,
    ])
    return rows[0]?.vendaId ?? null
  },

  // O admin devolveu o dinheiro pelo painel da AbacatePay depois das 5 tentativas: status_detalhe 'estorno manual'.
  // motivo (só no pagamento em dobro, que não tem histórico de venda) fica em estorno_ultimo_erro, o campo de
  // registro do estorno que o admin vê no detalhe; null mantém o último erro automático
  async marcarEstornoManual(pagamentoId: number, motivo: string | null, client: Queryable): Promise<void> {
    await client.query(
      `UPDATE pagamentos
          SET status = 'estornado', status_detalhe = 'estorno manual',
              estorno_ultimo_erro = COALESCE($2, estorno_ultimo_erro), atualizado_em = now()
        WHERE id = $1`,
      [pagamentoId, motivo],
    )
  },

  // ---------- rede de proteção (reconsulta) ----------

  // Expiração: a cobrança do pagamento pendente mais recente da venda, se já foi gravada
  async buscarCobrancaPendente(vendaId: number): Promise<string | null> {
    const { rows } = await db.query<{ cobrancaId: string }>(
      `SELECT gateway_cobranca_id AS "cobrancaId" FROM pagamentos
        WHERE venda_id = $1 AND status = 'pendente' AND gateway_cobranca_id IS NOT NULL
        ORDER BY id DESC
        LIMIT 1`,
      [vendaId],
    )
    return rows[0]?.cobrancaId ?? null
  },

  // Detalhe da compra: "reserva" a reconsulta. Um UPDATE só, que marca atualizado_em = now() e devolve a cobrança
  // apenas se a última atualização tem mais de 20 s. Dois pedidos ao mesmo tempo: o segundo espera a trava da linha
  // e, depois do COMMIT do primeiro, o WHERE já não casa. Assim há no máximo 1 consulta a cada 20 s por pagamento
  async reservarReconsulta(vendaId: number): Promise<string | null> {
    const { rows } = await db.query<{ cobrancaId: string }>(
      `UPDATE pagamentos SET atualizado_em = now()
        WHERE id = (
                SELECT id FROM pagamentos
                 WHERE venda_id = $1 AND status = 'pendente' AND gateway_cobranca_id IS NOT NULL
                 ORDER BY id DESC
                 LIMIT 1
              )
          AND status = 'pendente'
          AND atualizado_em < now() - interval '20 seconds'
        RETURNING gateway_cobranca_id AS "cobrancaId"`,
      [vendaId],
    )
    return rows[0]?.cobrancaId ?? null
  },

  // ---------- devolução de pagamento indevido (#49, parte mínima) ----------

  async buscarParaEstorno(pagamentoId: number): Promise<PagamentoParaEstorno | null> {
    const { rows } = await db.query<PagamentoParaEstorno>(
      `SELECT venda_id AS "vendaId", status, gateway_cobranca_id AS "cobrancaId", estorno_tentativas AS tentativas,
              estorno_solicitado_em AS "estornoSolicitadoEm"
         FROM pagamentos
        WHERE id = $1`,
      [pagamentoId],
    )
    return rows[0] ?? null
  },

  // Quem chama já travou a venda e o pagamento (pagamento.service, tentarEstornoPendente)
  async marcarEstornado(pagamentoId: number, client: Queryable): Promise<boolean> {
    const { rowCount } = await client.query(
      `UPDATE pagamentos SET status = 'estornado', estorno_ultimo_erro = NULL, atualizado_em = now()
        WHERE id = $1 AND status = 'aprovado' AND estorno_solicitado_em IS NOT NULL`,
      [pagamentoId],
    )
    return rowCount === 1
  },

  // Devolve o número de tentativas depois desta, ou null se o pagamento já não está esperando estorno (ou já tem 5:
  // o CHECK de estorno_tentativas vai até 5, e o WHERE não deixa passar disso)
  async registrarFalhaEstorno(pagamentoId: number, erro: string): Promise<number | null> {
    const { rows } = await db.query<{ tentativas: number }>(
      `UPDATE pagamentos
          SET estorno_tentativas = estorno_tentativas + 1, estorno_ultimo_erro = $2, atualizado_em = now()
        WHERE id = $1 AND status = 'aprovado' AND estorno_solicitado_em IS NOT NULL AND estorno_tentativas < 5
        RETURNING estorno_tentativas AS tentativas`,
      [pagamentoId, erro],
    )
    return rows[0]?.tentativas ?? null
  },

  // Usa o índice parcial idx_pagamentos_estorno_pendente; os mais antigos primeiro
  async listarEstornosPendentes(maxTentativas: number, limite: number): Promise<number[]> {
    const { rows } = await db.query<{ id: number }>(
      `SELECT id FROM pagamentos
        WHERE status = 'aprovado' AND estorno_solicitado_em IS NOT NULL AND estorno_tentativas < $1
        ORDER BY estorno_solicitado_em, id
        LIMIT $2`,
      [maxTentativas, limite],
    )
    return rows.map((linha) => linha.id)
  },

  // ---------- eventos_webhook (#46) ----------

  // null = o evento já existia (ON CONFLICT DO NOTHING não devolve linha)
  async inserirEvento(notificacaoId: string, tipo: string, payload: { cobrancaId: string }): Promise<number | null> {
    const { rows } = await db.query<{ id: number }>(
      `INSERT INTO eventos_webhook (gateway_notificacao_id, tipo, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (gateway_notificacao_id) DO NOTHING
       RETURNING id`,
      [notificacaoId, tipo, JSON.stringify(payload)],
    )
    return rows[0]?.id ?? null
  },

  async buscarEvento(notificacaoId: string): Promise<EventoWebhook | null> {
    const { rows } = await db.query<EventoWebhook>(
      `SELECT id, processado_em AS "processadoEm", payload->>'cobrancaId' AS "cobrancaId"
         FROM eventos_webhook
        WHERE gateway_notificacao_id = $1`,
      [notificacaoId],
    )
    return rows[0] ?? null
  },

  async marcarEventoProcessado(eventoId: number): Promise<void> {
    await db.query('UPDATE eventos_webhook SET processado_em = now(), ultimo_erro = NULL WHERE id = $1', [eventoId])
  },

  async registrarFalhaEvento(eventoId: number, erro: string): Promise<void> {
    await db.query(
      'UPDATE eventos_webhook SET tentativas = tentativas + 1, ultimo_erro = $2 WHERE id = $1',
      [eventoId, erro],
    )
  },
}
