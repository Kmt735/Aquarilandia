import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// Lote 13, PASSO 3: POST /api/pagamentos/:id/simular com a aplicação real e PostgreSQL descartável. O gateway é o
// falso (gatewayPix e simuladorPix): nenhuma chamada real à AbacatePay. As chaves são fictícias; só o prefixo importa.
const url = process.env.TEST_DATABASE_URL
describe('Simulação de Pix da demonstração (Lote 13) — PostgreSQL real e gateway falso', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `simulacao_pix_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, api, origem, env, estoque, gatewayPix, simuladorPix, limites, admin, criado = false
  const cobrancas = new Map()
  let simulados = [], bloqueados = []

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '35_entrega_logistica.sql', '21_vendas_idempotencia.sql', '22_pagamentos_estorno.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlApp.toString()
    delete process.env.GATEWAY_ACCESS_TOKEN
    delete process.env.PERMITIR_SIMULACAO_PIX
    delete process.env.EMAIL_API_KEY
    delete process.env.EMAIL_REMETENTE
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    env = (await import('../../src/config/env.ts')).env
    origem = env.corsOrigin
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    ;({ gatewayPix, simuladorPix } = await import('../../src/modulos/pagamentos/gateway.ts'))
    limites = await import('../../src/middlewares/rateLimit.ts')
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
    admin = await conta('admin')
  })
  beforeEach(() => {
    simulados = []; bloqueados = []
    Object.assign(env, { permitirSimulacaoPix: true, gatewayAccessToken: 'abc_dev_FICTICIA_DE_TESTE' })
    const fetchOriginal = globalThis.fetch
    mock.method(globalThis, 'fetch', (alvo, opcoes) => {
      if (!String(alvo).startsWith(api)) { bloqueados.push(String(alvo)); throw new Error('fetch para fora bloqueado no teste') }
      return fetchOriginal(alvo, opcoes)
    })
    mock.method(gatewayPix, 'criarCobrancaPix', async ({ pagamentoId, vendaId, valor, expiraEm }) => {
      const id = `pix_char_SIM${pagamentoId}`
      if (!cobrancas.has(id)) cobrancas.set(id, { status: 'pendente', valor, vendaId, pagamentoId })
      return { cobrancaId: id, status: 'pendente', codigoPix: 'CODIGO', qrCodeImagem: 'data:image/png;base64,QR', expiraEm }
    })
    mock.method(gatewayPix, 'consultarCobranca', async (id) => {
      const cob = cobrancas.get(id)
      return { cobrancaId: id, status: cob.status, valor: cob.valor, externalId: null, vendaId: cob.vendaId, pagamentoId: cob.pagamentoId }
    })
    mock.method(simuladorPix, 'simularPagamentoPix', async (id) => { simulados.push(id); cobrancas.get(id).status = 'aprovado' })
    for (const nome of ['error', 'info', 'log']) mock.method(console, nome, () => {})
    limites.limitePagamento.resetKey('127.0.0.1')
  })
  afterEach(() => {
    mock.restoreAll()
    Object.assign(env, { permitirSimulacaoPix: false, gatewayAccessToken: undefined })
    assert.deepEqual(bloqueados, [])
  })
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  async function conta(papel = 'cliente') {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone, papel) VALUES ($1, $2, 'hash', '32999990000', $3) RETURNING id",
      [`Conta ${randomUUID().slice(0, 6)}`, `${randomUUID()}@simulacao.example`, papel])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token }
  }
  async function comPix() {
    const dono = await conta()
    const p = (await c.query("INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $1, 1000, true FROM categorias WHERE slug = 'acessorios' RETURNING id", [`Produto ${randomUUID().slice(0, 8)}`])).rows[0].id
    await estoque.registrarMovimentacao(admin.id, { produtoId: p, tipo: 'entrada', quantidade: 5, motivo: 'Saldo de teste' }, randomUUID(), {})
    const venda = await fetch(`${api}/vendas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origem, Cookie: `sid=${dono.token}`, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ itens: [{ produtoId: p, quantidade: 1 }], retirada: true, unidadeRetirada: 'matosinhos', totalEsperado: 1000 }),
    }).then((r) => r.json())
    const pix = await fetch(`${api}/vendas/${venda.id}/pagamentos`, { method: 'POST', headers: { Origin: origem, Cookie: `sid=${dono.token}` } }).then((r) => r.json())
    return { vendaId: venda.id, pagamentoId: pix.pagamentoId, dono }
  }
  async function simular(quem, pagamentoId, { semOrigem = false } = {}) {
    const r = await fetch(`${api}/pagamentos/${pagamentoId}/simular`, {
      method: 'POST', headers: { ...(semOrigem ? {} : { Origin: origem }), ...(quem ? { Cookie: `sid=${quem.token}` } : {}) },
    })
    return { status: r.status, corpo: await r.json() }
  }
  const statusVenda = async (id) => (await c.query('SELECT status FROM vendas WHERE id = $1', [id])).rows[0].status

  it('sem PERMITIR_SIMULACAO_PIX → 404 igual ao de uma rota que não existe (nem o login é conferido)', async () => {
    const { pagamentoId, vendaId } = await comPix()
    env.permitirSimulacaoPix = false
    for (const quem of [admin, null]) {
      const r = await simular(quem, pagamentoId)
      assert.deepEqual([r.status, r.corpo], [404, { erro: `Rota não encontrada: POST /api/pagamentos/${pagamentoId}/simular` }])
    }
    assert.deepEqual(simulados, [])
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')
  })

  it('com a variável e uma chave "de produção" (fictícia) → 404', async () => {
    const { pagamentoId, vendaId } = await comPix()
    env.gatewayAccessToken = 'abc_prod_FICTICIA_DE_PRODUCAO'
    const r = await simular(admin, pagamentoId)
    assert.equal(r.status, 404)
    assert.deepEqual(simulados, [])
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')
  })

  it('cliente → 403; sem login → 401; sem Origin → 403', async () => {
    const { pagamentoId, dono } = await comPix()
    assert.equal((await simular(dono, pagamentoId)).status, 403)
    assert.equal((await simular(null, pagamentoId)).status, 401)
    assert.equal((await simular(admin, pagamentoId, { semOrigem: true })).status, 403)
    assert.deepEqual(simulados, [])
  })

  it('admin com tudo certo → simula e a venda fica paga na hora (histórico de origem gateway)', async () => {
    const { pagamentoId, vendaId } = await comPix()
    const r = await simular(admin, pagamentoId)
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.deepEqual(r.corpo, { pagamentoId, vendaId, resultado: 'confirmado' })
    assert.deepEqual(simulados, [`pix_char_SIM${pagamentoId}`])
    assert.equal(await statusVenda(vendaId), 'paga')
    const ultimo = (await c.query('SELECT status_novo, origem FROM historico_status_venda WHERE venda_id = $1 ORDER BY id DESC LIMIT 1', [vendaId])).rows[0]
    assert.deepEqual(ultimo, { status_novo: 'paga', origem: 'gateway' })
  })

  it('pagamento que não está pendente → 409; inexistente → 404', async () => {
    const { pagamentoId } = await comPix()
    assert.equal((await simular(admin, pagamentoId)).status, 200)
    const deNovo = await simular(admin, pagamentoId)
    assert.deepEqual([deNovo.status, deNovo.corpo], [409, { erro: 'Só um Pix pendente, já gerado, pode ter o pagamento simulado.' }])
    assert.deepEqual((await simular(admin, 2147483000)).corpo, { erro: 'Pagamento não encontrado.' })
    assert.equal(simulados.length, 1)
  })
  async function simularDoCliente(quem, vendaId, { semOrigem = false } = {}) {
    const r = await fetch(`${api}/vendas/${vendaId}/simular-pagamento`, {
      method: 'POST', headers: { ...(semOrigem ? {} : { Origin: origem }), ...(quem ? { Cookie: `sid=${quem.token}` } : {}) },
    })
    return { status: r.status, corpo: await r.json() }
  }
  it('cliente conclui seu próprio Pix sem admin e a repetição não duplica confirmação nem baixa', async () => {
    const { vendaId, pagamentoId, dono } = await comPix()
    const r = await simularDoCliente(dono, vendaId)
    assert.equal(r.status, 200); assert.equal(r.corpo.status, 'paga')
    assert.equal(r.corpo.pagamento.status, 'aprovado')
    assert.deepEqual(simulados, [`pix_char_SIM${pagamentoId}`])
    assert.equal((await simularDoCliente(dono, vendaId)).status, 200)
    assert.equal(simulados.length, 1)
    assert.equal((await c.query("SELECT count(*)::int AS n FROM historico_status_venda WHERE venda_id=$1 AND status_novo='paga'", [vendaId])).rows[0].n, 1)
    assert.equal((await c.query('SELECT p.estoque FROM produtos p JOIN itens_venda i ON i.produto_id=p.id WHERE i.venda_id=$1', [vendaId])).rows[0].estoque, 4)
  })
  it('simulação do cliente exige sessão e Origin e recusa pedidos de outra conta', async () => {
    const { vendaId, dono } = await comPix()
    assert.equal((await simularDoCliente(null, vendaId)).status, 401)
    assert.equal((await simularDoCliente(dono, vendaId, { semOrigem: true })).status, 403)
    assert.equal((await simularDoCliente(await conta(), vendaId)).status, 404)
    assert.equal((await simularDoCliente(dono, 2147483000)).status, 404)
    assert.equal((await simularDoCliente(dono, 'invalido')).status, 400)
    assert.deepEqual(simulados, [])
  })
  it('capacidade e rota do cliente são desativadas sem chave Dev ou sem permissão de simular', async () => {
    const { vendaId, dono } = await comPix()
    for (const configuracao of [
      { permitirSimulacaoPix: false, gatewayAccessToken: 'abc_dev_FICTICIA' },
      { permitirSimulacaoPix: true, gatewayAccessToken: 'abc_prod_FICTICIA' },
      { permitirSimulacaoPix: true, gatewayAccessToken: undefined },
    ]) {
      Object.assign(env, configuracao)
      assert.equal((await simularDoCliente(dono, vendaId)).status, 404)
      assert.equal((await simularDoCliente(null, vendaId)).status, 404)
      const resposta = await fetch(`${api}/pagamentos/configuracao`)
      assert.equal(resposta.headers.get('cache-control'), 'no-store')
      assert.deepEqual(await resposta.json(), { simulacaoPix: false })
    }
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento'); assert.deepEqual(simulados, [])
  })
  it('pedido vencido ou cancelado não pode ser simulado pelo cliente', async () => {
    const { vendaId, dono } = await comPix()
    await c.query("UPDATE vendas SET expira_em=now()-interval '1 minute' WHERE id=$1", [vendaId])
    assert.equal((await simularDoCliente(dono, vendaId)).status, 409)
    await c.query("UPDATE vendas SET status='cancelada' WHERE id=$1", [vendaId])
    assert.equal((await simularDoCliente(dono, vendaId)).status, 409)
    assert.deepEqual(simulados, [])
  })
  it('solicitar a simulação não confirma se a consulta ao gateway continuar pendente', async () => {
    const { vendaId, dono } = await comPix()
    mock.method(simuladorPix, 'simularPagamentoPix', async () => {})
    const r = await simularDoCliente(dono, vendaId)
    assert.equal(r.status, 200); assert.equal(r.corpo.status, 'aguardando_pagamento')
    assert.equal(r.corpo.pagamento.status, 'pendente'); assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')
  })
  it('falha do gateway devolve erro e não aprova a compra', async () => {
    const { vendaId, dono } = await comPix()
    mock.method(simuladorPix, 'simularPagamentoPix', async () => { throw new Error('Falha sintética') })
    assert.equal((await simularDoCliente(dono, vendaId)).status, 500)
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')
  })

})
