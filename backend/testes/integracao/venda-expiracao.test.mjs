import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// #32: expiração das vendas não pagas e limpeza de sessões/links vencidos, com PostgreSQL real e descartável.
// As vendas são criadas pelo POST /api/vendas (com a baixa real do Dev 2); o vencimento é simulado mudando o
// expira_em no schema exclusivo. Cada caso usa clientes e produtos próprios.
const url = process.env.TEST_DATABASE_URL
describe('Expiração de vendas (#32) — PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `venda_expiracao_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, api, origem, estoque, tarefas, repo, tx, adminId, criado = false

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '21_vendas_idempotencia.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    adminId = (await c.query("INSERT INTO clientes (nome, email, senha_hash, papel) VALUES ('Admin', 'admin@expiracao.example', 'hash', 'admin') RETURNING id")).rows[0].id
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    origem = (await import('../../src/config/env.ts')).env.corsOrigin
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    tarefas = await import('../../src/modulos/vendas/venda.tarefas.ts')
    repo = (await import('../../src/modulos/vendas/venda.repository.ts')).vendaRepository
    tx = (await import('../../src/utils/transacao.ts')).comTransacao
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  // ---------- fixtures (só no schema descartável) ----------
  async function produto(saldo = 10, preco = 1000) {
    const id = (await c.query("INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $1, $2, true FROM categorias WHERE slug = 'acessorios' RETURNING id",
      [`Produto ${randomUUID().slice(0, 8)}`, preco])).rows[0].id
    await estoque.registrarMovimentacao(adminId, { produtoId: id, tipo: 'entrada', quantidade: saldo, motivo: 'Saldo de teste' }, randomUUID(), {})
    return id
  }
  async function cliente() {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES ($1, $2, 'hash', '32999990000') RETURNING id",
      [`Comprador ${randomUUID().slice(0, 6)}`, `${randomUUID()}@expiracao.example`])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token }
  }
  // Retirada na loja: frete 0, então o totalEsperado é a soma dos preços (1000 por unidade)
  async function comprar(quem, pares) {
    const itens = pares.map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
    const totalEsperado = pares.reduce((soma, [, q]) => soma + q * 1000, 0)
    const r = await fetch(`${api}/vendas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origem, Cookie: `sid=${quem.token}`, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ itens, retirada: true, totalEsperado }),
    })
    const corpo = await r.json()
    assert.equal(r.status, 201, JSON.stringify(corpo))
    return corpo.id
  }
  const vencer = (id, minutos) => c.query(`UPDATE vendas SET expira_em = now() - make_interval(mins => $2) WHERE id = $1`, [id, minutos])
  const status = async (id) => (await c.query('SELECT status FROM vendas WHERE id = $1', [id])).rows[0].status
  const saldo = async (id) => (await c.query('SELECT estoque FROM produtos WHERE id = $1', [id])).rows[0].estoque
  const estornos = async (id) => (await c.query("SELECT count(*)::int AS n FROM operacoes_estoque WHERE venda_id = $1 AND tipo_venda = 'estorno_venda'", [id])).rows[0].n
  const cancelamentos = async (id) => (await c.query("SELECT count(*)::int AS n FROM historico_status_venda WHERE venda_id = $1 AND status_novo = 'cancelada'", [id])).rows[0].n
  const silenciarLog = () => mock.method(console, 'error', () => {})

  it('1. vencida há mais de 5 min → cancelada pelo sistema com a observação, estoque de volta, 1 operação de estorno', async () => {
    const quem = await cliente(), p = await produto(10)
    const id = await comprar(quem, [[p, 3]])
    assert.equal(await saldo(p), 7)
    await vencer(id, 10)

    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 1, erros: 0 })
    assert.equal(await status(id), 'cancelada')
    assert.equal(await saldo(p), 10)
    assert.equal(await estornos(id), 1)
    const ultimo = (await c.query(`SELECT status_anterior, status_novo, origem, alterado_por_id, observacao FROM historico_status_venda
      WHERE venda_id = $1 ORDER BY id DESC LIMIT 1`, [id])).rows[0]
    assert.deepEqual(ultimo, { status_anterior: 'aguardando_pagamento', status_novo: 'cancelada', origem: 'sistema',
      alterado_por_id: null, observacao: 'Pagamento não recebido no prazo.' })
  })

  it('2. vencida há 2 min (dentro da folga) → continua aguardando_pagamento', async () => {
    const quem = await cliente(), p = await produto(10)
    const id = await comprar(quem, [[p, 2]])
    await vencer(id, 2)
    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 0, erros: 0 })
    assert.equal(await status(id), 'aguardando_pagamento')
    assert.equal(await saldo(p), 8)
    // Fora da folga a rodada pega; deixa o schema sem vencidas para os próximos casos
    await vencer(id, 6)
    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 1, erros: 0 })
  })

  it('3. paga "no último segundo" (antes da rodada) → a rodada não mexe nela', async () => {
    const quem = await cliente(), p = await produto(10)
    const id = await comprar(quem, [[p, 4]])
    await vencer(id, 10)
    await tx((client) => repo.mudarStatus(id, 'aguardando_pagamento', 'paga', { ator: 'gateway', clienteId: null }, client))

    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 0, erros: 0 })
    assert.equal(await status(id), 'paga')
    assert.equal(await saldo(p), 6)
    assert.equal(await estornos(id), 0)
  })

  it('4. corrida: duas rodadas em paralelo com 3 vencidas → cada uma cancelada e devolvida uma vez só', async () => {
    const p = await produto(30)
    const ids = []
    for (const q of [1, 2, 3]) ids.push(await comprar(await cliente(), [[p, q]]))
    assert.equal(await saldo(p), 24)
    for (const id of ids) await vencer(id, 10)

    const [a, b] = await Promise.all([tarefas.executarExpiracao(), tarefas.executarExpiracao()])
    assert.equal(a.canceladas + b.canceladas, 3)
    assert.equal(a.erros + b.erros, 0)
    for (const id of ids) {
      assert.equal(await status(id), 'cancelada')
      assert.equal(await cancelamentos(id), 1, `venda ${id} cancelada mais de uma vez`)
      assert.equal(await estornos(id), 1, `venda ${id} com estoque devolvido mais de uma vez`)
    }
    assert.equal(await saldo(p), 30)
  })

  it('5. uma venda que falha não impede as outras: erros = 1, log só com o código, e a próxima rodada a pega', async () => {
    const p = await produto(30)
    const [boa1, ruim, boa2] = [await comprar(await cliente(), [[p, 1]]), await comprar(await cliente(), [[p, 1]]), await comprar(await cliente(), [[p, 1]])]
    for (const id of [boa1, ruim, boa2]) await vencer(id, 10)
    await c.query(`CREATE FUNCTION falhar_expiracao() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.id = ${ruim} AND NEW.status = 'cancelada' THEN RAISE EXCEPTION 'DADO_SINTETICO_NAO_PUBLICAR'; END IF; RETURN NEW; END $$`)
    await c.query('CREATE TRIGGER falhar_expiracao BEFORE UPDATE ON vendas FOR EACH ROW EXECUTE FUNCTION falhar_expiracao()')
    const log = silenciarLog()
    try {
      assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 2, erros: 1 })
      assert.deepEqual([await status(boa1), await status(ruim), await status(boa2)], ['cancelada', 'aguardando_pagamento', 'cancelada'])
      assert.equal(await estornos(ruim), 0)
      assert.deepEqual(log.mock.calls.map((chamada) => chamada.arguments), [[`[expiracao] venda ${ruim}: P0001`]])
    } finally {
      await c.query('DROP TRIGGER falhar_expiracao ON vendas'); await c.query('DROP FUNCTION falhar_expiracao()')
    }
    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 1, erros: 0 })
    assert.equal(await status(ruim), 'cancelada')
    assert.equal(await saldo(p), 30)
  })

  it('6. vencida sem baixa (inserida à mão) → cancelada, o erro vai para o log e a rodada continua', async () => {
    const quem = await cliente(), p = await produto(10)
    const semBaixa = (await c.query(`INSERT INTO vendas (cliente_id, subtotal, frete, total, tipo_entrega, entrega_destinatario,
      entrega_telefone, prazo_entrega_dias, expira_em) VALUES ($1, 1000, 0, 1000, 'retirada', 'Fulano', '32999990000', 0,
      now() - interval '10 minutes') RETURNING id`, [quem.id])).rows[0].id
    const normal = await comprar(await cliente(), [[p, 2]])
    await vencer(normal, 10)
    const log = silenciarLog()

    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 2, erros: 0 })
    assert.equal(await status(semBaixa), 'cancelada')
    assert.equal(await cancelamentos(semBaixa), 1)
    assert.equal(await status(normal), 'cancelada')
    assert.equal(await saldo(p), 10)
    assert.deepEqual(log.mock.calls.map((chamada) => chamada.arguments), [[`[expiracao] venda ${semBaixa} sem baixa de estoque`]])
  })

  it('7. limpezas: sessões e links de recuperação vencidos somem; os válidos ficam', async () => {
    const quem = await cliente()
    // token_hash é CHAR(64): os hashes têm o formato real (SHA-256 em hex de um token qualquer)
    const hashes = { sessaoVencida: hashToken(randomUUID()), sessaoValida: hashToken(randomUUID()),
      tokenVencido: hashToken(randomUUID()), tokenValido: hashToken(randomUUID()) }
    await c.query(`INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES
      ($1, $3, now() - interval '1 minute'), ($2, $3, now() + interval '1 hour')`, [hashes.sessaoVencida, hashes.sessaoValida, quem.id])
    // O CHECK ck_tokens_recuperacao_senha_expira_depois exige expira_em > criado_em: o vencido nasceu há 31 minutos
    await c.query(`INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, criado_em, expira_em) VALUES
      ($3, $1, now() - interval '31 minutes', now() - interval '1 minute'), ($3, $2, now(), now() + interval '30 minutes')`,
    [hashes.tokenVencido, hashes.tokenValido, quem.id])

    await tarefas.executarLimpezas()
    const sessoes = (await c.query('SELECT token_hash FROM sessoes WHERE token_hash = ANY($1)', [[hashes.sessaoVencida, hashes.sessaoValida]])).rows
    const tokens = (await c.query('SELECT token_hash FROM tokens_recuperacao_senha WHERE token_hash = ANY($1)', [[hashes.tokenVencido, hashes.tokenValido]])).rows
    assert.deepEqual(sessoes.map((l) => l.token_hash), [hashes.sessaoValida])
    assert.deepEqual(tokens.map((l) => l.token_hash), [hashes.tokenValido])
    // A sessão do cliente da fixture (válida por 1 hora) continua
    assert.equal((await c.query('SELECT count(*)::int AS n FROM sessoes WHERE cliente_id = $1', [quem.id])).rows[0].n, 2)
  })
})
