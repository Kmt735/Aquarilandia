import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { setTimeout as esperar } from 'node:timers/promises'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'

const urlTeste = process.env.TEST_DATABASE_URL
describe('Vendas — mudarStatus com trava otimista e histórico no PostgreSQL (#29)', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para verificar o mudarStatus no PostgreSQL.',
}, () => {
  const schema = `teste_vendas_status_${randomUUID().replaceAll('-', '')}`
  let cliente, pool, vendaRepository, comTransacao, schemaCriado = false
  let clienteId, adminId

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    const inserir = (nome, papel) => cliente.query(
      'INSERT INTO clientes (nome, email, senha_hash, papel) VALUES ($1, $2, $3, $4) RETURNING id',
      [nome, `${nome}@teste.example`, 'hash-fixture-sem-login', papel])
    clienteId = (await inserir('comprador', 'cliente')).rows[0].id
    adminId = (await inserir('gerente', 'admin')).rows[0].id

    const urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlAplicacao.toString()
    ;({ vendaRepository } = await import('../../src/modulos/vendas/venda.repository.ts'))
    ;({ comTransacao } = await import('../../src/utils/transacao.ts'))
    pool = (await import('../../src/config/db.ts')).db
  })
  after(async () => {
    try {
      if (pool) await pool.end()
    } finally {
      if (cliente) {
        try { if (schemaCriado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`) }
        finally { await cliente.end() }
      }
    }
  })

  // Venda mínima válida: retirada na loja (sem endereço e sem frete)
  async function novaVenda(status = 'aguardando_pagamento') {
    const { rows } = await cliente.query(
      `INSERT INTO vendas (cliente_id, status, subtotal, frete, total, tipo_entrega, entrega_destinatario,
                           entrega_telefone, prazo_entrega_dias)
       VALUES ($1, $2, 1000, 0, 1000, 'retirada', 'Pessoa Fictícia', '32999999999', 1) RETURNING id`,
      [clienteId, status])
    return rows[0].id
  }
  const statusDa = async (id) => (await cliente.query('SELECT status FROM vendas WHERE id = $1', [id])).rows[0].status
  const historicoDa = async (id) => (await cliente.query(
    `SELECT status_anterior, status_novo, origem, alterado_por_id, observacao
       FROM historico_status_venda WHERE venda_id = $1 ORDER BY id`, [id])).rows

  it('muda o status e grava uma linha de histórico com a autoria certa (gateway e admin)', async () => {
    const id = await novaVenda()
    const antes = (await cliente.query('SELECT atualizado_em FROM vendas WHERE id = $1', [id])).rows[0].atualizado_em
    await esperar(5)

    assert.equal(await comTransacao((tx) => vendaRepository.mudarStatus(
      id, 'aguardando_pagamento', 'paga', { ator: 'gateway', clienteId: null }, tx)), true)
    assert.equal(await statusDa(id), 'paga')
    const depois = (await cliente.query('SELECT atualizado_em FROM vendas WHERE id = $1', [id])).rows[0].atualizado_em
    assert.ok(depois > antes, 'atualizado_em avança')

    assert.equal(await comTransacao((tx) => vendaRepository.mudarStatus(
      id, 'paga', 'em_separacao', { ator: 'admin', clienteId: adminId, observacao: 'Separando os itens' }, tx)), true)
    assert.deepEqual(await historicoDa(id), [
      { status_anterior: 'aguardando_pagamento', status_novo: 'paga', origem: 'gateway', alterado_por_id: null, observacao: null },
      { status_anterior: 'paga', status_novo: 'em_separacao', origem: 'admin', alterado_por_id: adminId, observacao: 'Separando os itens' },
    ])
  })

  it('com o "de" errado devolve false e não grava histórico', async () => {
    const id = await novaVenda('paga')
    assert.equal(await comTransacao((tx) => vendaRepository.mudarStatus(
      id, 'aguardando_pagamento', 'cancelada', { ator: 'cliente', clienteId }, tx)), false)
    assert.equal(await statusDa(id), 'paga')
    assert.deepEqual(await historicoDa(id), [])
  })

  it('venda inexistente devolve false sem histórico', async () => {
    assert.equal(await comTransacao((tx) => vendaRepository.mudarStatus(
      999999, 'aguardando_pagamento', 'cancelada', { ator: 'sistema', clienteId: null }, tx)), false)
    const { rows } = await cliente.query('SELECT count(*)::int AS n FROM historico_status_venda WHERE venda_id = 999999')
    assert.equal(rows[0].n, 0)
  })

  it('UPDATE e histórico estão na transação de quem chama: erro depois desfaz os dois', async () => {
    const id = await novaVenda()
    await assert.rejects(comTransacao(async (tx) => {
      assert.equal(await vendaRepository.mudarStatus(id, 'aguardando_pagamento', 'cancelada',
        { ator: 'sistema', clienteId: null, observacao: 'Expirou' }, tx), true)
      throw new Error('falha depois da mudança')
    }), /falha depois da mudança/)
    assert.equal(await statusDa(id), 'aguardando_pagamento')
    assert.deepEqual(await historicoDa(id), [])
  })

  it('autoria fora do CHECK do banco (admin sem id) é recusada e nada fica gravado', async () => {
    const id = await novaVenda()
    await assert.rejects(comTransacao((tx) => vendaRepository.mudarStatus(
      id, 'aguardando_pagamento', 'cancelada', { ator: 'admin', clienteId: null }, tx)),
    (err) => err.constraint === 'ck_historico_status_venda_alterado_por')
    assert.equal(await statusDa(id), 'aguardando_pagamento')
    assert.deepEqual(await historicoDa(id), [])
  })

  it('duas mudanças em paralelo a partir do mesmo status: só uma devolve true', async () => {
    for (let rodada = 0; rodada < 3; rodada++) {
      const id = await novaVenda()
      // Uma transação externa segura a linha para as duas chamadas ficarem esperando juntas o mesmo lock
      const bloqueio = new pg.Client({ connectionString: urlTeste }); await bloqueio.connect()
      try {
        await bloqueio.query(`SET search_path TO ${schema}`)
        await bloqueio.query('BEGIN')
        await bloqueio.query('SELECT id FROM vendas WHERE id = $1 FOR UPDATE', [id])

        const mudar = (para, autoria) => comTransacao((tx) =>
          vendaRepository.mudarStatus(id, 'aguardando_pagamento', para, autoria, tx))
        const corrida = Promise.all([
          mudar('cancelada', { ator: 'cliente', clienteId }),
          mudar('paga', { ator: 'gateway', clienteId: null }),
        ])

        // Espera ver as duas no pg_stat_activity aguardando lock, sem pressupor tempo fixo.
        // Consulta pelo client de fora: dentro da transação do bloqueio o pg_stat_activity fica congelado
        for (let tentativa = 0; ; tentativa++) {
          const { rows } = await cliente.query(
            `SELECT count(*)::int AS n FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE 'UPDATE vendas SET status%'`)
          if (rows[0].n === 2) break
          assert.ok(tentativa < 200, 'as duas mudanças deviam estar esperando o lock')
          await esperar(10)
        }
        await bloqueio.query('COMMIT')

        const resultados = await corrida
        assert.equal(resultados.filter(Boolean).length, 1, `rodada ${rodada}: exatamente uma vence`)
        const vencedor = resultados[0] ? 'cancelada' : 'paga'
        assert.equal(await statusDa(id), vencedor)
        const historico = await historicoDa(id)
        assert.equal(historico.length, 1)
        assert.equal(historico[0].status_novo, vencedor)
      } finally {
        await bloqueio.query('ROLLBACK').catch(() => {})
        await bloqueio.end()
      }
    }
  })
})
