import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { format } from 'node:util'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// Lote 11: pagamento Pix completo (#44, #46, #47, #48, rede de proteção e devolução de pagamento indevido), com a
// aplicação real e PostgreSQL descartável. O gateway é SEMPRE o gatewayPix falso deste arquivo: nenhuma chamada
// real à AbacatePay (o token nem existe no ambiente de teste, e qualquer fetch para fora da aplicação é bloqueado).
const url = process.env.TEST_DATABASE_URL
describe('Pagamento Pix (Lote 11) — PostgreSQL real e gateway falso', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const sufixo = randomUUID().replaceAll('-', '')
  const schema = `pagamentos_${sufixo}`
  const tag = sufixo.slice(0, 8)
  const segredo = `segredo-teste-${randomUUID()}`
  const chavePublica = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
  // Dados do pagador que a AbacatePay manda no corpo do aviso: nenhum pode ser gravado nem ir para o log
  const pagador = { name: 'Maria Pagadora Ficticia', email: 'maria.pagadora@pix.example', taxId: '***.456.789-**' }
  const prefixoCodigoPix = `00020126PIXSEGREDO${tag}`
  const msg502 = 'Não foi possível falar com o pagamento agora. Tente de novo em instantes.'
  const motivoEstorno = 'Pagamento recebido para compra já cancelada ou paga.'
  let c, pool, server, api, origem, estoque, tarefas, repoVenda, tx, limites, gatewayPix, AppError, envApp, adminId, criado = false
  const tokens = []
  const saida = [] // tudo o que a aplicação escreveu no console, para a varredura do fim
  let bloqueados = []
  let n = 0
  const novoEvento = () => `log_${tag}E${++n}`

  // ---------- gateway falso (substitui as três funções do gatewayPix) ----------
  const gw = {}
  function zerarGateway() {
    Object.assign(gw, {
      cobrancas: new Map(), // cobrancaId → { status, valor, vendaId, pagamentoId, sequencia?, atraso? }
      porPagamento: new Map(),
      criar: [], consultar: [], estornar: [],
      falharCriar: false, foraConsulta: false, trocarCobranca: false,
      estorno: () => ({ aprovado: true, jaEstornado: false }),
    })
  }
  function instalarGateway() {
    mock.method(gatewayPix, 'criarCobrancaPix', async ({ pagamentoId, vendaId, valor, expiraEm }) => {
      gw.criar.push(pagamentoId)
      if (gw.falharCriar) throw new AppError(msg502, 502)
      let id = gw.porPagamento.get(pagamentoId)
      if (!id || gw.trocarCobranca) {
        id = `pix_char_${tag}P${pagamentoId}${gw.trocarCobranca ? 'X' : ''}`
        gw.porPagamento.set(pagamentoId, id)
        gw.cobrancas.set(id, { status: 'pendente', valor, vendaId, pagamentoId })
      }
      return { cobrancaId: id, status: gw.cobrancas.get(id).status, codigoPix: `${prefixoCodigoPix}${pagamentoId}`,
        qrCodeImagem: `data:image/png;base64,QR${tag}${pagamentoId}`, expiraEm }
    })
    mock.method(gatewayPix, 'consultarCobranca', async (id) => {
      gw.consultar.push(id)
      if (gw.foraConsulta) throw new AppError(msg502, 502)
      const cob = gw.cobrancas.get(id)
      if (!cob) throw new AppError(msg502, 502)
      if (cob.atraso) await new Promise((r) => setTimeout(r, Math.floor(Math.random() * cob.atraso)))
      const status = cob.sequencia?.length ? cob.sequencia.shift() : cob.status
      return { cobrancaId: id, status, valor: cob.valor, externalId: null, vendaId: cob.vendaId ?? null, pagamentoId: cob.pagamentoId ?? null }
    })
    mock.method(gatewayPix, 'estornar', async (id, motivo) => {
      gw.estornar.push([id, motivo])
      return gw.estorno(id)
    })
  }

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '21_vendas_idempotencia.sql', '22_pagamentos_estorno.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    adminId = (await c.query("INSERT INTO clientes (nome, email, senha_hash, papel) VALUES ('Admin', 'admin@pagamentos.example', 'hash', 'admin') RETURNING id")).rows[0].id
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    process.env.GATEWAY_WEBHOOK_SECRET = segredo
    delete process.env.GATEWAY_ACCESS_TOKEN
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    envApp = (await import('../../src/config/env.ts')).env
    origem = envApp.corsOrigin
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    tarefas = await import('../../src/modulos/vendas/venda.tarefas.ts')
    repoVenda = (await import('../../src/modulos/vendas/venda.repository.ts')).vendaRepository
    tx = (await import('../../src/utils/transacao.ts')).comTransacao
    limites = await import('../../src/middlewares/rateLimit.ts')
    gatewayPix = (await import('../../src/modulos/pagamentos/gateway.ts')).gatewayPix
    AppError = (await import('../../src/utils/AppError.ts')).AppError
    // Sem token, até o gateway real recusaria antes de qualquer fetch: segunda garantia de que nada sai daqui
    assert.equal(envApp.gatewayAccessToken, undefined)
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
  })
  beforeEach(() => {
    zerarGateway(); instalarGateway()
    bloqueados = []
    const fetchOriginal = globalThis.fetch
    mock.method(globalThis, 'fetch', (alvo, opcoes) => {
      if (!String(alvo).startsWith(api)) { bloqueados.push(String(alvo)); throw new Error('fetch para fora bloqueado no teste') }
      return fetchOriginal(alvo, opcoes)
    })
    for (const nome of ['error', 'info', 'log', 'warn']) mock.method(console, nome, (...args) => { saida.push(format(...args)) })
    limites.limitePagamento.resetKey('127.0.0.1')
  })
  afterEach(async () => {
    mock.restoreAll()
    assert.deepEqual(bloqueados, [], 'houve chamada de rede para fora da aplicação')
    // Nenhuma venda vencida sobra para o próximo caso (a expiração pega todas as do schema)
    await c.query("UPDATE vendas SET expira_em = now() + interval '1 day' WHERE status = 'aguardando_pagamento' AND expira_em < now() + interval '5 minutes'")
  })
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  // ---------- fixtures (só no schema descartável) ----------
  async function cliente() {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES ($1, $2, 'hash', '32999990000') RETURNING id",
      [`Comprador ${randomUUID().slice(0, 6)}`, `${randomUUID()}@pagamentos.example`])).rows[0].id
    const token = randomUUID(); tokens.push(token)
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token }
  }
  async function produto(saldo = 10, preco = 1000) {
    const id = (await c.query("INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $1, $2, true FROM categorias WHERE slug = 'acessorios' RETURNING id",
      [`Produto ${randomUUID().slice(0, 8)}`, preco])).rows[0].id
    await estoque.registrarMovimentacao(adminId, { produtoId: id, tipo: 'entrada', quantidade: saldo, motivo: 'Saldo de teste' }, randomUUID(), {})
    return id
  }
  // Compra de retirada (frete 0) pelo POST /api/vendas, com a baixa real do estoque. total = 1000 × quantidade
  async function comprar(quem = null, quantidade = 1) {
    const dono = quem ?? await cliente()
    const p = await produto(10)
    const r = await fetch(`${api}/vendas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origem, Cookie: `sid=${dono.token}`, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ itens: [{ produtoId: p, quantidade }], retirada: true, totalEsperado: 1000 * quantidade }),
    })
    const corpo = await r.json()
    assert.equal(r.status, 201, JSON.stringify(corpo))
    return { vendaId: corpo.id, produtoId: p, dono, total: corpo.total }
  }
  async function gerar(quem, vendaId, { semOrigem = false, semLogin = false } = {}) {
    const r = await fetch(`${api}/vendas/${vendaId}/pagamentos`, {
      method: 'POST',
      headers: { ...(semOrigem ? {} : { Origin: origem }), ...(semLogin ? {} : { Cookie: `sid=${quem.token}` }) },
    })
    const texto = await r.text()
    return { status: r.status, cache: r.headers.get('cache-control'), corpo: texto ? JSON.parse(texto) : null, texto }
  }
  async function detalhe(quem, vendaId) {
    const r = await fetch(`${api}/clientes/me/vendas/${vendaId}`, { headers: { Cookie: `sid=${quem.token}` } })
    const texto = await r.text()
    return { status: r.status, corpo: JSON.parse(texto), texto }
  }
  const assinar = (corpo) => createHmac('sha256', chavePublica).update(corpo).digest('base64')
  // O corpo traz, de propósito, um status e um valor que o backend NÃO pode usar, e os dados do pagador
  async function aviso(eventoId, cobrancaId, event = 'transparent.completed') {
    const corpo = JSON.stringify({
      id: eventoId, event, apiVersion: 2, devMode: true,
      data: { transparent: { id: cobrancaId, amount: 1, status: 'PAID', externalId: 'pagamento-999' }, customer: pagador },
    })
    const r = await fetch(`${api}/pagamentos/webhook?webhookSecret=${encodeURIComponent(segredo)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': assinar(corpo) }, body: corpo,
    })
    return { status: r.status, corpo: await r.json() }
  }
  // Compra com um Pix gerado pelo #44: devolve também o pagamento e a cobrança
  async function comPix(quantidade = 1) {
    const compra = await comprar(null, quantidade)
    const r = await gerar(compra.dono, compra.vendaId)
    assert.equal(r.status, 201, r.texto)
    return { ...compra, pagamentoId: r.corpo.pagamentoId, cobrancaId: gw.porPagamento.get(r.corpo.pagamentoId) }
  }
  const statusVenda = async (id) => (await c.query('SELECT status FROM vendas WHERE id = $1', [id])).rows[0].status
  const saldo = async (id) => (await c.query('SELECT estoque FROM produtos WHERE id = $1', [id])).rows[0].estoque
  const devolucoesEstoque = async (id) => (await c.query("SELECT count(*)::int AS n FROM operacoes_estoque WHERE venda_id = $1 AND tipo_venda = 'estorno_venda'", [id])).rows[0].n
  const pagamentos = async (vendaId) => (await c.query(`SELECT id, status, gateway, metodo, valor, gateway_cobranca_id, gateway_pagamento_id,
    status_detalhe, estorno_tentativas, estorno_ultimo_erro, estorno_solicitado_em FROM pagamentos WHERE venda_id = $1 ORDER BY id`, [vendaId])).rows
  const evento = async (eventoId) => (await c.query('SELECT id, tipo, payload, processado_em, tentativas, ultimo_erro FROM eventos_webhook WHERE gateway_notificacao_id = $1', [eventoId])).rows[0]
  const historico = async (id) => (await c.query('SELECT status_anterior, status_novo, origem, alterado_por_id FROM historico_status_venda WHERE venda_id = $1 ORDER BY id', [id])).rows
  const mudar = (id, de, para, autoria = { ator: 'sistema', clienteId: null }) => tx((client) => repoVenda.mudarStatus(id, de, para, autoria, client))
  const vencer = (id, minutos) => c.query('UPDATE vendas SET expira_em = now() - make_interval(mins => $2) WHERE id = $1', [id, minutos])
  const foto = async () => (await c.query(`
    SELECT (SELECT coalesce(json_agg(v ORDER BY id), '[]') FROM vendas v)::text AS vendas,
           (SELECT coalesce(json_agg(p ORDER BY id), '[]') FROM pagamentos p)::text AS pagamentos,
           (SELECT coalesce(json_agg(h ORDER BY id), '[]') FROM historico_status_venda h)::text AS historico,
           (SELECT coalesce(json_agg(e ORDER BY id), '[]') FROM eventos_webhook e)::text AS eventos`)).rows[0]

  // ======================= #44 POST /api/vendas/:id/pagamentos =======================

  it('1. #44 venda aguardando → 201 com o código e a imagem, no-store; 1 pagamento pendente com a cobrança gravada (o código não vai para o banco)', async () => {
    const { vendaId, dono, total } = await comprar()
    const r = await gerar(dono, vendaId)
    assert.equal(r.status, 201, r.texto)
    assert.equal(r.cache, 'no-store')
    assert.deepEqual(Object.keys(r.corpo).sort(), ['codigoPix', 'expiraEm', 'pagamentoId', 'qrCodeImagem'])
    assert.equal(r.corpo.codigoPix, `${prefixoCodigoPix}${r.corpo.pagamentoId}`)
    assert.match(r.corpo.qrCodeImagem, /^data:image\/png;base64,/)
    const expiraVenda = (await c.query('SELECT expira_em FROM vendas WHERE id = $1', [vendaId])).rows[0].expira_em
    assert.equal(r.corpo.expiraEm, expiraVenda.toISOString(), 'o Pix vence junto com a venda')
    const linhas = await pagamentos(vendaId)
    assert.equal(linhas.length, 1)
    assert.deepEqual([linhas[0].id, linhas[0].status, linhas[0].gateway, linhas[0].metodo, linhas[0].valor, linhas[0].gateway_cobranca_id],
      [r.corpo.pagamentoId, 'pendente', 'abacatepay', 'pix', total, gw.porPagamento.get(r.corpo.pagamentoId)])
    const banco = JSON.stringify(await foto())
    assert.equal(banco.includes(prefixoCodigoPix), false, 'o código Pix foi gravado')
    assert.equal(banco.includes(`QR${tag}`), false, 'a imagem do QR foi gravada')
  })

  it('2. #44 chamar de novo → o mesmo pagamentoId e a mesma cobrança, sem pagamento novo', async () => {
    const { vendaId, dono } = await comprar()
    const a = await gerar(dono, vendaId), b = await gerar(dono, vendaId)
    assert.deepEqual([a.status, b.status], [201, 201])
    assert.equal(b.corpo.pagamentoId, a.corpo.pagamentoId)
    assert.equal(b.corpo.codigoPix, a.corpo.codigoPix)
    assert.deepEqual(gw.criar, [a.corpo.pagamentoId, a.corpo.pagamentoId], 'o gateway foi chamado com o MESMO pagamentoId (externalId)')
    assert.equal((await pagamentos(vendaId)).length, 1)
  })

  it('3. #44 cinco pedidos em paralelo → 1 pagamento só, todos com o mesmo pagamentoId', async () => {
    const { vendaId, dono } = await comprar()
    const respostas = await Promise.all(Array.from({ length: 5 }, () => gerar(dono, vendaId)))
    assert.deepEqual(respostas.map((r) => r.status), [201, 201, 201, 201, 201])
    assert.equal(new Set(respostas.map((r) => r.corpo.pagamentoId)).size, 1)
    assert.equal((await pagamentos(vendaId)).length, 1)
  })

  it('4. #44 o gateway falha → 502 e o pagamento pendente sem cobrança; o pedido seguinte reaproveita e grava', async () => {
    const { vendaId, dono } = await comprar()
    gw.falharCriar = true
    const falhou = await gerar(dono, vendaId)
    assert.equal(falhou.status, 502)
    assert.deepEqual(falhou.corpo, { erro: msg502 })
    const [pendente] = await pagamentos(vendaId)
    assert.deepEqual([pendente.status, pendente.gateway_cobranca_id], ['pendente', null])

    gw.falharCriar = false
    const certo = await gerar(dono, vendaId)
    assert.equal(certo.status, 201)
    assert.equal(certo.corpo.pagamentoId, pendente.id)
    const linhas = await pagamentos(vendaId)
    assert.equal(linhas.length, 1)
    assert.equal(linhas[0].gateway_cobranca_id, gw.porPagamento.get(pendente.id))
  })

  it('4b. #44 o gateway devolve OUTRA cobrança para um pagamento que já tem uma → 502, log sem ids, nada é sobrescrito', async () => {
    const { vendaId, dono, cobrancaId } = await comPix()
    gw.trocarCobranca = true
    const r = await gerar(dono, vendaId)
    assert.equal(r.status, 502)
    assert.equal((await pagamentos(vendaId))[0].gateway_cobranca_id, cobrancaId)
    assert.ok(saida.some((linha) => /\[pagamento\] pagamento \d+: o gateway devolveu uma cobrança diferente da gravada/.test(linha)))
  })

  it('4c. #44 a cobrança reaproveitada já foi cancelada no gateway → 502 e o pagamento vira cancelado; o pedido seguinte cria outro', async () => {
    const { vendaId, dono, pagamentoId, cobrancaId } = await comPix()
    gw.cobrancas.get(cobrancaId).status = 'cancelado'
    const r = await gerar(dono, vendaId)
    assert.equal(r.status, 502)
    assert.equal((await pagamentos(vendaId))[0].status, 'cancelado')
    const novo = await gerar(dono, vendaId)
    assert.equal(novo.status, 201)
    assert.notEqual(novo.corpo.pagamentoId, pagamentoId)
    assert.deepEqual((await pagamentos(vendaId)).map((p) => p.status), ['cancelado', 'pendente'])
  })

  it('5. #44 paga, cancelada ou vencendo/vencida → 409; de outro cliente ou inexistente → 404; sem Origin → 403; sem login → 401; id inválido → 400', async () => {
    const paga = await comprar(); await mudar(paga.vendaId, 'aguardando_pagamento', 'paga', { ator: 'gateway', clienteId: null })
    const cancelada = await comprar(); await mudar(cancelada.vendaId, 'aguardando_pagamento', 'cancelada')
    const vencendo = await comprar(); await c.query("UPDATE vendas SET expira_em = now() + interval '30 seconds' WHERE id = $1", [vencendo.vendaId])
    const vencida = await comprar(); await vencer(vencida.vendaId, 1)
    for (const { vendaId, dono } of [paga, cancelada, vencendo, vencida]) {
      const r = await gerar(dono, vendaId)
      assert.equal(r.status, 409, `venda ${vendaId}`)
      assert.deepEqual(r.corpo, { erro: 'Esta compra não pode mais ser paga.' })
    }
    const alheia = await comprar(), intruso = await cliente()
    for (const id of [alheia.vendaId, 2147483000]) {
      const r = await gerar(intruso, id)
      assert.equal(r.status, 404)
      assert.deepEqual(r.corpo, { erro: 'Compra não encontrada.' })
    }
    assert.equal((await gerar(alheia.dono, alheia.vendaId, { semOrigem: true })).status, 403)
    assert.equal((await gerar(alheia.dono, alheia.vendaId, { semLogin: true })).status, 401)
    assert.equal((await gerar(alheia.dono, 'abc')).status, 400)
    // Nenhuma dessas tentativas criou pagamento ou chamou o gateway
    for (const v of [paga, cancelada, vencendo, vencida, alheia]) assert.equal((await pagamentos(v.vendaId)).length, 0)
    assert.deepEqual(gw.criar, [])
  })

  it('5b. #44 rate limit: 20 pedidos por IP em 10 minutos, contando todos; o 21º → 429 sem chamar o gateway', async () => {
    const { vendaId, dono } = await comprar()
    const intruso = await cliente()
    for (let i = 0; i < 20; i++) {
      const r = await gerar(i % 2 ? dono : intruso, vendaId) // 404 e 201 contam igual
      assert.ok([201, 404].includes(r.status), `pedido ${i + 1}: ${r.status}`)
    }
    const chamadas = gw.criar.length
    const bloqueado = await gerar(dono, vendaId)
    assert.equal(bloqueado.status, 429)
    assert.equal(gw.criar.length, chamadas)
  })

  // ======================= #46/#47 webhook =======================

  it('6. completed + consulta aprovado → venda paga com histórico de origem gateway, pagamento aprovado; o estoque NÃO muda', async () => {
    const { vendaId, produtoId, cobrancaId, pagamentoId } = await comPix()
    const estoqueAntes = await saldo(produtoId)
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    const eventoId = novoEvento()
    const r = await aviso(eventoId, cobrancaId)
    assert.deepEqual([r.status, r.corpo], [200, { recebido: true }])
    assert.equal(await statusVenda(vendaId), 'paga')
    assert.deepEqual((await historico(vendaId)).at(-1), { status_anterior: 'aguardando_pagamento', status_novo: 'paga', origem: 'gateway', alterado_por_id: null })
    const [p] = await pagamentos(vendaId)
    assert.deepEqual([p.id, p.status, p.gateway_pagamento_id, p.estorno_solicitado_em], [pagamentoId, 'aprovado', cobrancaId, null])
    assert.equal(await saldo(produtoId), estoqueAntes)
    assert.equal(await devolucoesEstoque(vendaId), 0)
    const ev = await evento(eventoId)
    assert.ok(ev.processado_em instanceof Date)
    assert.deepEqual([ev.tipo, ev.tentativas, ev.ultimo_erro], ['transparent.completed', 0, null])
    assert.deepEqual(gw.consultar, [cobrancaId], 'a decisão veio da consulta')
  })

  it('7. o mesmo evento duas vezes → nada muda na segunda (nem consulta); 2 eventos diferentes da mesma cobrança → idempotente', async () => {
    const { vendaId, cobrancaId } = await comPix()
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    const eventoId = novoEvento()
    assert.equal((await aviso(eventoId, cobrancaId)).status, 200)
    const depoisDoPrimeiro = await foto()
    assert.equal((await aviso(eventoId, cobrancaId)).status, 200)
    assert.deepEqual(await foto(), depoisDoPrimeiro)
    assert.equal(gw.consultar.length, 1, 'o evento repetido não é processado de novo')

    assert.equal((await aviso(novoEvento(), cobrancaId)).status, 200)
    const semEventos = ({ eventos, ...resto }) => resto
    assert.deepEqual(semEventos(await foto()), semEventos(depoisDoPrimeiro), 'outro aviso da mesma cobrança não muda nada')
    assert.equal((await historico(vendaId)).filter((h) => h.status_novo === 'paga').length, 1)
  })

  it('8. falha nossa (trigger) → 500 genérico, tentativas + 1 com o código curto e nada gravado; reenviado → processa', async () => {
    const { vendaId, cobrancaId } = await comPix()
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    await c.query(`CREATE FUNCTION falhar_pagamento() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.id = ${vendaId} AND NEW.status = 'paga' THEN RAISE EXCEPTION 'DADO_SINTETICO_NAO_PUBLICAR'; END IF; RETURN NEW; END $$`)
    await c.query('CREATE TRIGGER falhar_pagamento BEFORE UPDATE ON vendas FOR EACH ROW EXECUTE FUNCTION falhar_pagamento()')
    const eventoId = novoEvento()
    try {
      const r = await aviso(eventoId, cobrancaId)
      assert.deepEqual([r.status, r.corpo], [500, { erro: 'Erro interno do servidor' }])
      const ev = await evento(eventoId)
      assert.deepEqual([ev.processado_em, ev.tentativas, ev.ultimo_erro], [null, 1, 'P0001'])
      assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')
      assert.equal((await pagamentos(vendaId))[0].status, 'pendente', 'o rollback desfez o pagamento aprovado')
    } finally {
      await c.query('DROP TRIGGER falhar_pagamento ON vendas'); await c.query('DROP FUNCTION falhar_pagamento()')
    }
    assert.equal((await aviso(eventoId, cobrancaId)).status, 200)
    const ev = await evento(eventoId)
    assert.ok(ev.processado_em instanceof Date)
    assert.equal(ev.tentativas, 1)
    assert.equal(await statusVenda(vendaId), 'paga')
    assert.equal(saida.join('\n').includes('DADO_SINTETICO_NAO_PUBLICAR'), false, 'a mensagem interna foi para o log')
  })

  it('8b. gateway fora na consulta do webhook → 500 (a AbacatePay reenvia) com GATEWAY_INDISPONIVEL; reenviado → processa', async () => {
    const { vendaId, cobrancaId } = await comPix()
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    gw.foraConsulta = true
    const eventoId = novoEvento()
    assert.equal((await aviso(eventoId, cobrancaId)).status, 500)
    assert.deepEqual([(await evento(eventoId)).tentativas, (await evento(eventoId)).ultimo_erro], [1, 'GATEWAY_INDISPONIVEL'])
    gw.foraConsulta = false
    assert.equal((await aviso(eventoId, cobrancaId)).status, 200)
    assert.equal(await statusVenda(vendaId), 'paga')
  })

  it('9. a consulta traz um valor diferente do gravado → não confirma; status_detalhe "valor divergente"', async () => {
    const { vendaId, cobrancaId, total } = await comPix()
    Object.assign(gw.cobrancas.get(cobrancaId), { status: 'aprovado', valor: total + 1 })
    assert.equal((await aviso(novoEvento(), cobrancaId)).status, 200)
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')
    const [p] = await pagamentos(vendaId)
    assert.deepEqual([p.status, p.status_detalhe], ['pendente', 'valor divergente'])
    assert.ok(saida.some((linha) => /\[pagamento\] pagamento \d+: valor divergente/.test(linha)))
  })

  it('10. aprovado numa venda cancelada (vencida) → pagamento aprovado + estorno pedido, estornar chamado; a venda continua cancelada e o estoque igual', async () => {
    const { vendaId, produtoId, cobrancaId, pagamentoId } = await comPix()
    await vencer(vendaId, 10)
    // A expiração reconsulta (ainda pendente) e cancela, devolvendo o estoque
    await tarefas.executarExpiracao()
    assert.equal(await statusVenda(vendaId), 'cancelada')
    const estoqueCancelada = await saldo(produtoId)

    // O Pix é pago depois: o aviso chega com a venda já cancelada
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'HTTP 503' }) // a primeira tentativa falha...
    assert.equal((await aviso(novoEvento(), cobrancaId)).status, 200)
    let [p] = await pagamentos(vendaId)
    assert.equal(p.status, 'aprovado')
    assert.ok(p.estorno_solicitado_em instanceof Date, 'estorno pedido')
    assert.deepEqual(gw.estornar, [[cobrancaId, motivoEstorno]])

    gw.estorno = () => ({ aprovado: true, jaEstornado: false }) // ...e a tarefa tenta de novo
    assert.deepEqual(await tarefas.executarEstornos(), { estornados: 1, falhas: 0, erros: 0 })
    ;[p] = await pagamentos(vendaId)
    assert.deepEqual([p.id, p.status, p.estorno_tentativas], [pagamentoId, 'estornado', 1])
    assert.equal(await statusVenda(vendaId), 'cancelada')
    assert.equal(await saldo(produtoId), estoqueCancelada)
    assert.equal(await devolucoesEstoque(vendaId), 1)
    assert.equal((await historico(vendaId)).some((h) => h.status_novo === 'paga'), false, 'a venda nunca foi reaberta')
  })

  it('11. pagamento em dobro (2 aprovados da mesma venda) → o segundo é devolvido; a venda paga uma vez só', async () => {
    const { vendaId, dono, cobrancaId: primeira, pagamentoId: p1 } = await comPix()
    // O primeiro Pix expira no gateway; o cliente gera outro e paga
    gw.cobrancas.get(primeira).status = 'cancelado'
    assert.equal((await aviso(novoEvento(), primeira)).status, 200)
    assert.equal((await pagamentos(vendaId))[0].status, 'cancelado')
    const segundo = await gerar(dono, vendaId)
    assert.equal(segundo.status, 201)
    const p2 = segundo.corpo.pagamentoId, segunda = gw.porPagamento.get(p2)
    assert.notEqual(p2, p1)
    gw.cobrancas.get(segunda).status = 'aprovado'
    assert.equal((await aviso(novoEvento(), segunda)).status, 200)
    assert.equal(await statusVenda(vendaId), 'paga')

    // O primeiro também entra (ex.: o banco do pagador liquidou o Pix velho): é dinheiro a mais, vira devolução
    gw.cobrancas.get(primeira).status = 'aprovado'
    assert.equal((await aviso(novoEvento(), primeira)).status, 200)
    const linhas = await pagamentos(vendaId)
    assert.deepEqual(linhas.map((p) => [p.id, p.status, p.estorno_solicitado_em !== null]), [[p1, 'estornado', true], [p2, 'aprovado', false]])
    assert.deepEqual(gw.estornar, [[primeira, motivoEstorno]])
    assert.equal((await historico(vendaId)).filter((h) => h.status_novo === 'paga').length, 1)
    assert.equal(await statusVenda(vendaId), 'paga')
  })

  it('12. estorno que falha (INSUFFICIENT_FUNDS) → tentativas + 1 com o código; a tarefa tenta de novo; com 5 para e avisa o admin', async () => {
    const { vendaId, cobrancaId, pagamentoId } = await comPix()
    await mudar(vendaId, 'aguardando_pagamento', 'cancelada')
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    assert.equal((await aviso(novoEvento(), cobrancaId)).status, 200)
    let [p] = await pagamentos(vendaId)
    assert.deepEqual([p.status, p.estorno_tentativas, p.estorno_ultimo_erro], ['aprovado', 1, 'INSUFFICIENT_FUNDS'])

    for (const tentativa of [2, 3, 4, 5]) {
      const r = await tarefas.executarEstornos()
      assert.deepEqual(r, { estornados: 0, falhas: 1, erros: 0 }, `rodada da tentativa ${tentativa}`)
      ;[p] = await pagamentos(vendaId)
      assert.equal(p.estorno_tentativas, tentativa)
    }
    const chamadas = gw.estornar.filter(([id]) => id === cobrancaId).length
    assert.equal(chamadas, 5)
    assert.deepEqual(saida.filter((l) => l.startsWith('[estorno]') && l.includes('ação do admin')), [`[estorno] pagamento ${pagamentoId} precisa de ação do admin`])

    // Com 5, a tarefa não tenta mais (nem se o gateway voltasse a aceitar)
    gw.estorno = () => ({ aprovado: true, jaEstornado: false })
    assert.deepEqual(await tarefas.executarEstornos(), { estornados: 0, falhas: 0, erros: 0 })
    assert.equal(gw.estornar.filter(([id]) => id === cobrancaId).length, 5)
    ;[p] = await pagamentos(vendaId)
    assert.deepEqual([p.status, p.estorno_tentativas], ['aprovado', 5])
  })

  it('12b. "já reembolsada" (jaEstornado) conta como sucesso: o pagamento vira estornado', async () => {
    const { vendaId, cobrancaId } = await comPix()
    await mudar(vendaId, 'aguardando_pagamento', 'cancelada')
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    gw.estorno = () => ({ aprovado: true, jaEstornado: true })
    assert.equal((await aviso(novoEvento(), cobrancaId)).status, 200)
    assert.equal((await pagamentos(vendaId))[0].status, 'estornado')
  })

  it('13. refunded + consulta estornado → pagamento estornado (a venda paga não muda sozinha; log sem ids do gateway)', async () => {
    const { vendaId, cobrancaId } = await comPix()
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    assert.equal((await aviso(novoEvento(), cobrancaId)).status, 200)
    gw.cobrancas.get(cobrancaId).status = 'estornado'
    const eventoId = novoEvento()
    assert.equal((await aviso(eventoId, cobrancaId, 'transparent.refunded')).status, 200)
    assert.equal((await pagamentos(vendaId))[0].status, 'estornado')
    assert.equal((await evento(eventoId)).tipo, 'transparent.refunded')
    assert.equal(await statusVenda(vendaId), 'paga')
    assert.ok(saida.some((l) => /\[pagamento\] pagamento \d+: estornado no gateway com a venda \d+ em paga/.test(l)))
  })

  it('14. eventos_webhook.payload tem SÓ o cobrancaId (nenhum nome, e-mail, CPF, status ou valor do corpo)', async () => {
    const { cobrancaId } = await comPix()
    const eventoId = novoEvento()
    assert.equal((await aviso(eventoId, cobrancaId)).status, 200)
    assert.deepEqual((await evento(eventoId)).payload, { cobrancaId })
    const todos = (await c.query('SELECT payload FROM eventos_webhook')).rows
    assert.ok(todos.length > 0)
    for (const { payload } of todos) assert.deepEqual(Object.keys(payload), ['cobrancaId'])
    const texto = (await c.query('SELECT coalesce(json_agg(e), \'[]\')::text AS t FROM eventos_webhook e')).rows[0].t
    for (const dado of [pagador.name, pagador.email, pagador.taxId, 'PAID', 'pagamento-999', 'customer']) assert.equal(texto.includes(dado), false, dado)
  })

  it('15. cobrança desconhecida → 200 sem mudar nada; a cobrança que não chegou a ser gravada (metadata confere) → acha e confirma', async () => {
    // Desconhecida: nenhum pagamento nosso, e a consulta não traz metadata
    const desconhecida = `pix_char_${tag}DESCONHECIDA`
    gw.cobrancas.set(desconhecida, { status: 'aprovado', valor: 1000, vendaId: null, pagamentoId: null })
    const antes = await foto()
    assert.equal((await aviso(novoEvento(), desconhecida)).status, 200)
    const semEventos = ({ eventos, ...resto }) => resto
    assert.deepEqual(semEventos(await foto()), semEventos(antes))
    assert.ok(saida.includes('[pagamento] cobrança desconhecida'))

    // A etapa C do #44 não gravou: o pagamento existe sem cobrança
    const { vendaId, total } = await comprar()
    const pagamentoId = (await c.query("INSERT INTO pagamentos (venda_id, gateway, metodo, valor) VALUES ($1, 'abacatepay', 'pix', $2) RETURNING id", [vendaId, total])).rows[0].id
    // Metadata com o valor errado ou a venda errada não serve
    const valorErrado = `pix_char_${tag}VALORERRADO`, vendaErrada = `pix_char_${tag}VENDAERRADA`
    gw.cobrancas.set(valorErrado, { status: 'aprovado', valor: total + 100, vendaId, pagamentoId })
    gw.cobrancas.set(vendaErrada, { status: 'aprovado', valor: total, vendaId: vendaId + 1, pagamentoId })
    for (const id of [valorErrado, vendaErrada]) assert.equal((await aviso(novoEvento(), id)).status, 200)
    assert.equal((await pagamentos(vendaId))[0].gateway_cobranca_id, null)
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')

    const certa = `pix_char_${tag}NAOGRAVADA`
    gw.cobrancas.set(certa, { status: 'aprovado', valor: total, vendaId, pagamentoId })
    assert.equal((await aviso(novoEvento(), certa)).status, 200)
    const [p] = await pagamentos(vendaId)
    assert.deepEqual([p.gateway_cobranca_id, p.status], [certa, 'aprovado'])
    assert.equal(await statusVenda(vendaId), 'paga')
  })

  it('15b. aviso sem o id do evento ou com a cobrança fora do padrão → 200 ignorado, sem gravar nem consultar', async () => {
    const antes = await foto()
    for (const [eventoId, cobranca] of [['sem-prefixo', `pix_char_${tag}A`], [novoEvento(), 'bill_123'], [novoEvento(), `pix_char_${tag}\n`]]) {
      assert.equal((await aviso(eventoId, cobranca)).status, 200)
    }
    assert.deepEqual(await foto(), antes)
    assert.deepEqual(gw.consultar, [])
  })

  // ======================= rede de proteção =======================

  it('16. venda vencida com o Pix pago (sem aviso) → a tarefa reconsulta e confirma em vez de cancelar', async () => {
    const { vendaId, produtoId, cobrancaId } = await comPix()
    const estoqueAntes = await saldo(produtoId)
    gw.cobrancas.get(cobrancaId).status = 'aprovado'
    await vencer(vendaId, 10)
    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 0, erros: 0 })
    assert.equal(await statusVenda(vendaId), 'paga')
    assert.equal(await saldo(produtoId), estoqueAntes)
    assert.equal(await devolucoesEstoque(vendaId), 0)
  })

  it('16b. venda vencida com o Pix expirado no gateway → o pagamento vira cancelado e a venda é cancelada', async () => {
    const { vendaId, cobrancaId } = await comPix()
    gw.cobrancas.get(cobrancaId).status = 'cancelado'
    await vencer(vendaId, 10)
    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 1, erros: 0 })
    assert.equal(await statusVenda(vendaId), 'cancelada')
    assert.equal((await pagamentos(vendaId))[0].status, 'cancelado')
  })

  it('17. gateway fora na expiração → não cancela nesta rodada; vencida há mais de 1 h → cancela', async () => {
    const { vendaId } = await comPix()
    gw.foraConsulta = true
    await vencer(vendaId, 10)
    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 0, erros: 1 })
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento')
    await vencer(vendaId, 61)
    assert.deepEqual(await tarefas.executarExpiracao(), { canceladas: 1, erros: 0 })
    assert.equal(await statusVenda(vendaId), 'cancelada')
    assert.ok(saida.some((l) => l.includes(`[expiracao] venda ${vendaId}: reconsulta do Pix falhou`) && l.includes('cancelando')))
  })

  it('18. detalhe da compra com o Pix pago e sem aviso → já mostra paga; consultas em menos de 20 s → 1 chamada ao gateway', async () => {
    const pago = await comPix()
    gw.cobrancas.get(pago.cobrancaId).status = 'aprovado'
    await c.query("UPDATE pagamentos SET atualizado_em = now() - interval '1 minute' WHERE id = $1", [pago.pagamentoId])
    const r = await detalhe(pago.dono, pago.vendaId)
    assert.equal(r.status, 200)
    assert.equal(r.corpo.status, 'paga')
    assert.deepEqual(r.corpo.pagamento.status, 'aprovado')
    assert.equal(r.corpo.pagamento.mensagem, 'Pagamento confirmado.')
    assert.deepEqual(r.corpo.historico.map((h) => h.status), ['aguardando_pagamento', 'paga'])
    assert.deepEqual(gw.consultar, [pago.cobrancaId])

    // Ainda pendente: o frontend pergunta sem parar, mas só a primeira consulta vai ao gateway (os outros 4 em < 20 s)
    const pendente = await comPix()
    await c.query("UPDATE pagamentos SET atualizado_em = now() - interval '1 minute' WHERE id = $1", [pendente.pagamentoId])
    const respostas = await Promise.all(Array.from({ length: 5 }, () => detalhe(pendente.dono, pendente.vendaId)))
    for (const resposta of respostas) {
      assert.equal(resposta.status, 200)
      assert.equal(resposta.corpo.pagamento.mensagem, 'Aguardando o pagamento do Pix.')
    }
    assert.equal(gw.consultar.filter((id) => id === pendente.cobrancaId).length, 1)

    // Gateway fora no detalhe: ignora e mostra o banco
    gw.foraConsulta = true
    await c.query("UPDATE pagamentos SET atualizado_em = now() - interval '1 minute' WHERE id = $1", [pendente.pagamentoId])
    const semGateway = await detalhe(pendente.dono, pendente.vendaId)
    assert.equal(semGateway.status, 200)
    assert.equal(semGateway.corpo.status, 'aguardando_pagamento')
    // Nenhum id do gateway nem código Pix na resposta
    for (const resposta of [r, ...respostas, semGateway]) {
      for (const proibido of ['pix_char_', prefixoCodigoPix, 'estorno', 'gateway', 'abacatepay']) assert.equal(resposta.texto.includes(proibido), false, proibido)
    }
  })

  it('18b. detalhe de compra de outro cliente → 404, sem consultar o gateway', async () => {
    const alheia = await comPix()
    await c.query("UPDATE pagamentos SET atualizado_em = now() - interval '1 minute' WHERE id = $1", [alheia.pagamentoId])
    const r = await detalhe(await cliente(), alheia.vendaId)
    assert.deepEqual([r.status, r.corpo], [404, { erro: 'Compra não encontrada.' }])
    assert.deepEqual(gw.consultar, [])
  })

  // ======================= #48 mensagens =======================

  it('19. mensagens por status; o pagamento em dobro devolvido não aparece como o da compra', async () => {
    const casos = [
      ['pendente', 'aguardando_pagamento', false, 'Aguardando o pagamento do Pix.'],
      ['aprovado', 'paga', false, 'Pagamento confirmado.'],
      ['cancelado', 'aguardando_pagamento', false, 'O código Pix expirou. Gere um novo código para pagar.'],
      ['cancelado', 'cancelada', false, 'Pagamento não concluído.'],
      ['recusado', 'aguardando_pagamento', false, 'O pagamento não foi aprovado. Gere um novo código Pix.'],
      ['estornado', 'cancelada', true, 'Pagamento devolvido.'],
      ['em_disputa', 'paga', false, 'Pagamento em análise.'],
      ['aprovado', 'cancelada', true, 'Pagamento recebido. A devolução está em andamento.'],
    ]
    for (const [statusPagamento, venda, comEstorno, mensagem] of casos) {
      const { vendaId, dono, total } = await comprar()
      if (venda === 'paga') await mudar(vendaId, 'aguardando_pagamento', 'paga', { ator: 'gateway', clienteId: null })
      if (venda === 'cancelada') await mudar(vendaId, 'aguardando_pagamento', 'cancelada')
      await c.query(`INSERT INTO pagamentos (venda_id, gateway, gateway_cobranca_id, metodo, status, valor, estorno_solicitado_em)
        VALUES ($1, 'abacatepay', $2, 'pix', $3, $4, CASE WHEN $5 THEN now() END)`, [vendaId, `pix_char_${tag}M${vendaId}`, statusPagamento, total, comEstorno])
      const r = await detalhe(dono, vendaId)
      assert.equal(r.status, 200)
      assert.deepEqual(Object.keys(r.corpo.pagamento).sort(), ['criadoEm', 'mensagem', 'metodo', 'status'])
      assert.deepEqual([r.corpo.pagamento.status, r.corpo.pagamento.mensagem], [statusPagamento, mensagem], `${statusPagamento} com a venda ${venda}`)
    }

    // Em dobro: o aprovado de verdade (mais antigo) vence o devolvido e o com devolução pedida (mais novos)
    const { vendaId, dono, total } = await comprar()
    await mudar(vendaId, 'aguardando_pagamento', 'paga', { ator: 'gateway', clienteId: null })
    await c.query(`INSERT INTO pagamentos (venda_id, gateway, gateway_cobranca_id, metodo, status, valor, estorno_solicitado_em, criado_em) VALUES
      ($1, 'abacatepay', $2, 'pix', 'aprovado', $5, NULL, now() - interval '2 hours'),
      ($1, 'abacatepay', $3, 'pix', 'estornado', $5, now(), now() - interval '1 hour'),
      ($1, 'abacatepay', $4, 'pix', 'aprovado', $5, now(), now())`, [vendaId, `pix_char_${tag}D1`, `pix_char_${tag}D2`, `pix_char_${tag}D3`, total])
    const r = await detalhe(dono, vendaId)
    assert.deepEqual([r.corpo.pagamento.status, r.corpo.pagamento.mensagem], ['aprovado', 'Pagamento confirmado.'])
    const esperado = (await c.query("SELECT criado_em FROM pagamentos WHERE gateway_cobranca_id = $1", [`pix_char_${tag}D1`])).rows[0].criado_em
    assert.equal(r.corpo.pagamento.criadoEm, esperado.toISOString(), 'é o primeiro, o aprovado sem estorno')
  })

  // ======================= concorrência =======================

  it('20. webhook confirmando e tarefa expirando a mesma venda ao mesmo tempo → ou paga, ou cancelada com devolução (5 rodadas)', async (t) => {
    const resultados = []
    for (let rodada = 1; rodada <= 5; rodada++) {
      limites.limitePagamento.resetKey('127.0.0.1')
      const { vendaId, produtoId, cobrancaId } = await comPix(2)
      const estoqueComprado = await saldo(produtoId)
      await vencer(vendaId, 10)
      // A primeira consulta (de quem chegar primeiro) ainda vê pendente; as seguintes, aprovado. Assim tanto
      // "a expiração cancela antes do aviso" quanto "o aviso confirma antes da expiração" podem acontecer
      Object.assign(gw.cobrancas.get(cobrancaId), { status: 'aprovado', sequencia: ['pendente'], atraso: 15 })
      const eventoId = novoEvento()
      const [webhook, expiracao] = await Promise.all([aviso(eventoId, cobrancaId), tarefas.executarExpiracao()])
      assert.equal(webhook.status, 200, `rodada ${rodada}: o webhook respondeu ${webhook.status}`)
      assert.equal(expiracao.erros, 0, `rodada ${rodada}: erro na expiração`)
      // Se o aviso viu "pendente" primeiro, a venda continua aberta: um novo aviso (a AbacatePay avisa de novo) resolve
      if (await statusVenda(vendaId) === 'aguardando_pagamento') assert.equal((await aviso(novoEvento(), cobrancaId)).status, 200)

      const status = await statusVenda(vendaId)
      const [p] = await pagamentos(vendaId)
      const devolvido = await devolucoesEstoque(vendaId)
      const historicoVenda = (await historico(vendaId)).map((h) => h.status_novo)
      assert.ok(['paga', 'cancelada'].includes(status), `rodada ${rodada}: ${status}`)
      assert.equal(historicoVenda.includes('paga') && historicoVenda.includes('cancelada'), false, `rodada ${rodada}: paga E cancelada`)
      if (status === 'paga') {
        assert.equal(devolvido, 0, `rodada ${rodada}: paga com o estoque devolvido`)
        assert.equal(await saldo(produtoId), estoqueComprado)
        assert.deepEqual([p.status, p.estorno_solicitado_em], ['aprovado', null])
      } else {
        assert.equal(devolvido, 1, `rodada ${rodada}: cancelada sem o estoque devolvido`)
        assert.equal(await saldo(produtoId), estoqueComprado + 2)
        assert.ok(p.estorno_solicitado_em instanceof Date, `rodada ${rodada}: cancelada com pagamento aprovado sem estorno pedido`)
        assert.ok(['aprovado', 'estornado'].includes(p.status))
      }
      resultados.push(status)
    }
    // Invariante global, no schema inteiro: nenhuma venda paga com estoque devolvido e nenhuma cancelada com
    // pagamento aprovado sem devolução pedida
    const { rows: [inv] } = await c.query(`
      SELECT (SELECT count(*)::int FROM vendas v WHERE v.status = 'paga'
                AND EXISTS (SELECT 1 FROM operacoes_estoque o WHERE o.venda_id = v.id AND o.tipo_venda = 'estorno_venda')) AS pagas_devolvidas,
             (SELECT count(*)::int FROM vendas v JOIN pagamentos p ON p.venda_id = v.id
               WHERE v.status = 'cancelada' AND p.status = 'aprovado' AND p.estorno_solicitado_em IS NULL) AS canceladas_sem_devolucao`)
    assert.deepEqual(inv, { pagas_devolvidas: 0, canceladas_sem_devolucao: 0 })
    assert.ok(saida.every((l) => !/deadlock|40P01/i.test(l)))
    t.diagnostic(`resultados das rodadas: ${resultados.join(', ')}`)
  })

  // ======================= varredura dos logs =======================

  it('99. nenhum nome, e-mail, CPF, código Pix, token, cookie, segredo ou id de cobrança apareceu no log durante a suíte', () => {
    const texto = saida.join('\n')
    assert.ok(saida.length > 0, 'a captura do console não pegou nada')
    for (const proibido of [pagador.name, pagador.email, pagador.taxId, prefixoCodigoPix, `QR${tag}`, 'pix_char_', segredo, ...tokens, 'DADO_SINTETICO_NAO_PUBLICAR']) {
      assert.equal(texto.includes(proibido), false, `vazou no log: ${proibido.slice(0, 12)}...`)
    }
  })
})
