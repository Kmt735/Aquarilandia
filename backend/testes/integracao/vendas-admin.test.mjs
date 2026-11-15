import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { format } from 'node:util'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// Lote 12: #35 cancelar a compra (com estorno), a conclusão do estorno (automática e manual), #39/#40 a listagem e o
// detalhe do admin, #41 a mudança de status e os e-mails de mudança de status. Aplicação real e PostgreSQL
// descartável; o gateway é SEMPRE o gatewayPix falso e o e-mail, o canalEmail falso (nenhuma chamada real).
const url = process.env.TEST_DATABASE_URL
describe('Cancelamento e admin de vendas (Lote 12) — PostgreSQL real, gateway e e-mail falsos', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const sufixo = randomUUID().replaceAll('-', '')
  const schema = `vendas_admin_${sufixo}`
  const tag = sufixo.slice(0, 8)
  const segredo = `segredo-teste-${randomUUID()}`
  const chavePublica = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
  const prefixoCodigoPix = `00020126PIXSEGREDO${tag}`
  const motivoEstorno = 'Pagamento recebido para compra já cancelada ou paga.'
  let c, pool, server, api, origem, estoque, tarefas, limites, gatewayPix, pagamentoService, canalEmail, AppError, adminId, admin, criado = false
  const saida = []
  let emails = [], bloqueados = []
  let n = 0
  const novoEvento = () => `log_${tag}E${++n}`

  // ---------- gateway falso ----------
  const gw = {}
  function zerarGateway() {
    Object.assign(gw, { cobrancas: new Map(), porPagamento: new Map(), criar: [], consultar: [], estornar: [],
      estorno: () => ({ aprovado: true, jaEstornado: false }), atrasoEstorno: 0 })
  }
  function instalarFalsos() {
    mock.method(gatewayPix, 'criarCobrancaPix', async ({ pagamentoId, vendaId, valor, expiraEm }) => {
      gw.criar.push(pagamentoId)
      let id = gw.porPagamento.get(pagamentoId)
      if (!id) {
        id = `pix_char_${tag}P${pagamentoId}`
        gw.porPagamento.set(pagamentoId, id)
        gw.cobrancas.set(id, { status: 'pendente', valor, vendaId, pagamentoId })
      }
      return { cobrancaId: id, status: gw.cobrancas.get(id).status, codigoPix: `${prefixoCodigoPix}${pagamentoId}`,
        qrCodeImagem: `data:image/png;base64,QR${tag}`, expiraEm }
    })
    mock.method(gatewayPix, 'consultarCobranca', async (id) => {
      gw.consultar.push(id)
      const cob = gw.cobrancas.get(id)
      if (!cob) throw new AppError('Não foi possível falar com o pagamento agora. Tente de novo em instantes.', 502)
      if (cob.atraso) await new Promise((r) => setTimeout(r, Math.floor(Math.random() * cob.atraso)))
      return { cobrancaId: id, status: cob.status, valor: cob.valor, externalId: null, vendaId: cob.vendaId, pagamentoId: cob.pagamentoId }
    })
    mock.method(gatewayPix, 'estornar', async (id, motivo) => {
      gw.estornar.push([id, motivo])
      if (gw.atrasoEstorno) await new Promise((r) => setTimeout(r, gw.atrasoEstorno))
      return gw.estorno(id)
    })
    mock.method(canalEmail, 'enviar', async (mensagem) => { emails.push(mensagem) })
  }

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '21_vendas_idempotencia.sql', '22_pagamentos_estorno.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    process.env.GATEWAY_WEBHOOK_SECRET = segredo
    delete process.env.GATEWAY_ACCESS_TOKEN
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    const env = (await import('../../src/config/env.ts')).env
    origem = env.corsOrigin
    assert.equal(env.gatewayAccessToken, undefined)
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    tarefas = await import('../../src/modulos/vendas/venda.tarefas.ts')
    limites = await import('../../src/middlewares/rateLimit.ts')
    gatewayPix = (await import('../../src/modulos/pagamentos/gateway.ts')).gatewayPix
    pagamentoService = (await import('../../src/modulos/pagamentos/pagamento.service.ts')).pagamentoService
    canalEmail = (await import('../../src/modulos/vendas/vendaNotificacoes.ts')).canalEmail
    AppError = (await import('../../src/utils/AppError.ts')).AppError
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
    admin = await conta('admin'); adminId = admin.id
  })
  beforeEach(() => {
    zerarGateway(); instalarFalsos(); emails = []; bloqueados = []
    const fetchOriginal = globalThis.fetch
    mock.method(globalThis, 'fetch', (alvo, opcoes) => {
      if (!String(alvo).startsWith(api)) { bloqueados.push(String(alvo)); throw new Error('fetch para fora bloqueado no teste') }
      return fetchOriginal(alvo, opcoes)
    })
    for (const nome of ['error', 'info', 'log', 'warn']) mock.method(console, nome, (...args) => { saida.push(format(...args)) })
    for (const l of [limites.limitePagamento, limites.limiteFrete]) l.resetKey('127.0.0.1')
  })
  afterEach(async () => {
    // Os e-mails saem depois da resposta: espera os que ainda estão a caminho antes de restaurar os falsos
    await new Promise((r) => setTimeout(r, 100))
    mock.restoreAll()
    assert.deepEqual(bloqueados, [], 'houve chamada de rede para fora da aplicação')
    const divergencias = await c.query(`SELECT p.id FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id = p.id
      GROUP BY p.id HAVING p.estoque::bigint <> COALESCE(sum(m.delta), 0)`)
    assert.deepEqual(divergencias.rows, [], 'saldo deve reconciliar com o ledger após cada cenário')
    await c.query("UPDATE vendas SET expira_em = now() + interval '1 day' WHERE status = 'aguardando_pagamento' AND expira_em < now() + interval '5 minutes'")
  })
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  // ---------- fixtures ----------
  async function conta(papel = 'cliente') {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone, papel) VALUES ($1, $2, 'hash', '32999990000', $3) RETURNING id",
      [`Conta ${randomUUID().slice(0, 6)}`, `${randomUUID()}@vendasadmin.example`, papel])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token }
  }
  async function produto(saldo = 10, preco = 1000) {
    const id = (await c.query("INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $1, $2, true FROM categorias WHERE slug = 'acessorios' RETURNING id",
      [`Produto ${randomUUID().slice(0, 8)}`, preco])).rows[0].id
    await estoque.registrarMovimentacao(adminId, { produtoId: id, tipo: 'entrada', quantidade: saldo, motivo: 'Saldo de teste' }, randomUUID(), {})
    return id
  }
  async function pedir(caminho, quem, { metodo = 'GET', body, semOrigem = false } = {}) {
    const r = await fetch(`${api}${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(semOrigem ? {} : { Origin: origem }), ...(quem ? { Cookie: `sid=${quem.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const texto = await r.text()
    return { status: r.status, cache: r.headers.get('cache-control'), texto, corpo: texto ? JSON.parse(texto) : null }
  }
  // entrega: 'retirada' | 'propria' (CEP de São João del Rei) | 'correios' (outro CEP de MG). 2 unidades de 1000
  async function comprar({ dono = null, entrega = 'retirada', itensPreparados } = {}) {
    const quem = dono ?? await conta()
    const itens = itensPreparados ?? [{ produtoId: await produto(10), quantidade: 2 }]
    const p = itens[0].produtoId
    let destino = { retirada: true }, cep = null
    if (entrega !== 'retirada') {
      cep = entrega === 'propria' ? '36300000' : '30100000'
      const enderecoId = (await c.query(`INSERT INTO enderecos_cliente (cliente_id, apelido, cep, logradouro, numero, bairro, cidade, uf)
        VALUES ($1, 'Casa', $2, 'Rua Teste', '10', 'Centro', 'Cidade Teste', 'MG') RETURNING id`, [quem.id, cep])).rows[0].id
      destino = { enderecoId }
    }
    limites.limiteFrete.resetKey('127.0.0.1')
    const cotacao = await pedir('/frete/calcular', null, { metodo: 'POST', body: { itens, ...(cep ? { cep } : { retirada: true }) } })
    assert.equal(cotacao.status, 200, cotacao.texto)
    const r = await fetch(`${api}/vendas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origem, Cookie: `sid=${quem.token}`, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ itens, ...destino, totalEsperado: cotacao.corpo.total }),
    })
    const corpo = await r.json()
    assert.equal(r.status, 201, JSON.stringify(corpo))
    assert.equal(corpo.tipoEntrega, entrega)
    return { vendaId: corpo.id, produtoId: p, dono: quem, total: corpo.total }
  }
  const assinar = (corpo) => createHmac('sha256', chavePublica).update(corpo).digest('base64')
  async function aviso(cobrancaId, eventoId = novoEvento()) {
    const corpo = JSON.stringify({ id: eventoId, event: 'transparent.completed', data: { transparent: { id: cobrancaId } } })
    const r = await fetch(`${api}/pagamentos/webhook?webhookSecret=${encodeURIComponent(segredo)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': assinar(corpo) }, body: corpo,
    })
    return r.status
  }
  // Gera o Pix pelo #44; devolve o pagamento e a cobrança
  async function comPix(opcoes) {
    const compra = await comprar(opcoes)
    const r = await pedir(`/vendas/${compra.vendaId}/pagamentos`, compra.dono, { metodo: 'POST' })
    assert.equal(r.status, 201, r.texto)
    return { ...compra, pagamentoId: r.corpo.pagamentoId, cobrancaId: gw.porPagamento.get(r.corpo.pagamentoId) }
  }
  // Venda paga de verdade: Pix gerado, consulta aprovado e o aviso do webhook
  async function paga(opcoes) {
    const compra = await comPix(opcoes)
    gw.cobrancas.get(compra.cobrancaId).status = 'aprovado'
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal(await statusVenda(compra.vendaId), 'paga')
    return compra
  }
  const cancelar = (quem, vendaId, body, opcoes = {}) => pedir(`/vendas/${vendaId}/cancelar`, quem, { metodo: 'POST', body, ...opcoes })
  const mudarStatus = (vendaId, body, quem = admin, opcoes = {}) => pedir(`/vendas/${vendaId}/status`, quem, { metodo: 'POST', body, ...opcoes })
  const statusVenda = async (id) => (await c.query('SELECT status FROM vendas WHERE id = $1', [id])).rows[0].status
  const saldo = async (id) => (await c.query('SELECT estoque FROM produtos WHERE id = $1', [id])).rows[0].estoque
  const devolucoesEstoque = async (id) => (await c.query("SELECT count(*)::int AS n FROM operacoes_estoque WHERE venda_id = $1 AND tipo_venda = 'estorno_venda'", [id])).rows[0].n
  const pagamentos = async (vendaId) => (await c.query(`SELECT id, status, status_detalhe, estorno_tentativas, estorno_ultimo_erro, estorno_solicitado_em
    FROM pagamentos WHERE venda_id = $1 ORDER BY id`, [vendaId])).rows
  const historico = async (id) => (await c.query('SELECT status_novo, origem, alterado_por_id, observacao FROM historico_status_venda WHERE venda_id = $1 ORDER BY id', [id])).rows
  const emailsDa = (vendaId) => emails.filter((e) => e.assunto.includes(`pedido #${vendaId}`) || e.texto.includes(`pedido #${vendaId}`))
  async function esperar(condicao, ms = 2000) {
    const fim = Date.now() + ms
    while (Date.now() < fim) { if (await condicao()) return true; await new Promise((r) => setTimeout(r, 20)) }
    return false
  }
  // Leva o estorno até as 5 tentativas falhadas (1 já feita, pelo cancelamento ou pelo webhook)
  async function esgotarEstorno() {
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    for (let i = 0; i < 4; i++) await tarefas.executarEstornos()
  }

  // Datas fixas só para a nova família de regressões; sessão/prazo operacional continuam validados pela API.
  async function pagaParaEstorno(opcoes) {
    const compra = await paga(opcoes)
    await c.query("UPDATE vendas SET criado_em='2026-01-15T12:00:00Z', expira_em='2099-01-01T00:00:00Z' WHERE id=$1", [compra.vendaId])
    return compra
  }
  async function solicitarSemConcluir(compra) {
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    const r = await cancelar(compra.dono, compra.vendaId)
    assert.equal(r.status, 200, r.texto)
    assert.equal(r.corpo.status, 'cancelamento_solicitado')
  }

  // ======================= #35 cancelar =======================

  it('1. aguardando_pagamento → cancelada pelo cliente: o estoque volta, o Pix pendente fica cancelado, histórico com o motivo; e-mail sem "devolvido"', async () => {
    const { vendaId, produtoId, dono, pagamentoId } = await comPix()
    assert.equal(await saldo(produtoId), 8)
    const r = await cancelar(dono, vendaId, { motivo: '  Desisti da compra  ', status: 'paga', clienteId: 999 })
    assert.equal(r.status, 200, r.texto)
    assert.equal(r.cache, 'no-store')
    assert.equal(r.corpo.status, 'cancelada')
    assert.deepEqual(Object.keys(r.corpo).sort(), ['codigoRastreio', 'criadoEm', 'entrega', 'expiraEm', 'frete', 'historico', 'id', 'itens', 'pagamento', 'prazoEntregaDias', 'status', 'subtotal', 'tipoEntrega', 'total'])
    assert.equal(r.corpo.pagamento.mensagem, 'Pagamento não concluído.')
    assert.equal(await saldo(produtoId), 10)
    assert.equal(await devolucoesEstoque(vendaId), 1)
    assert.deepEqual((await pagamentos(vendaId)).map((p) => [p.id, p.status]), [[pagamentoId, 'cancelado']])
    assert.deepEqual((await historico(vendaId)).at(-1), { status_novo: 'cancelada', origem: 'cliente', alterado_por_id: dono.id, observacao: 'Desisti da compra' })
    assert.deepEqual(gw.estornar, [], 'venda não paga não chama o estorno')
    assert.ok(await esperar(() => emailsDa(vendaId).length === 1))
    assert.match(emailsDa(vendaId)[0].assunto, /^Compra cancelada/)
    assert.equal(emailsDa(vendaId)[0].texto.includes('devolvido'), false)
  })

  it('2. paga com o estorno aprovado → cancelada no fim: pagamento estornado, estoque de volta, histórico cancelamento_solicitado (cliente) → cancelada (sistema)', async () => {
    const { vendaId, produtoId, dono, cobrancaId, pagamentoId } = await paga()
    const r = await cancelar(dono, vendaId, { motivo: 'Comprei errado' })
    assert.equal(r.status, 200, r.texto)
    assert.equal(r.corpo.status, 'cancelada')
    assert.deepEqual([r.corpo.pagamento.status, r.corpo.pagamento.mensagem], ['estornado', 'Pagamento devolvido.'])
    assert.deepEqual(gw.estornar, [[cobrancaId, motivoEstorno]])
    assert.deepEqual((await pagamentos(vendaId)).map((p) => [p.id, p.status]), [[pagamentoId, 'estornado']])
    assert.equal(await saldo(produtoId), 10)
    assert.equal(await devolucoesEstoque(vendaId), 1)
    assert.deepEqual((await historico(vendaId)).slice(-2), [
      { status_novo: 'cancelamento_solicitado', origem: 'cliente', alterado_por_id: dono.id, observacao: 'Comprei errado' },
      { status_novo: 'cancelada', origem: 'sistema', alterado_por_id: null, observacao: 'Pagamento devolvido.' },
    ])
    assert.ok(await esperar(() => emailsDa(vendaId).some((e) => e.assunto.startsWith('Compra cancelada'))))
    assert.match(emailsDa(vendaId).find((e) => e.assunto.startsWith('Compra cancelada')).texto, /O valor foi devolvido\./)
  })

  it('3. paga com o estorno falhando → cancelamento_solicitado (tentativas 1, mensagem de devolução em andamento); a tarefa com o gateway OK conclui', async () => {
    const { vendaId, produtoId, dono } = await paga()
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    const r = await cancelar(dono, vendaId)
    assert.equal(r.status, 200, r.texto)
    assert.equal(r.corpo.status, 'cancelamento_solicitado')
    assert.equal(r.corpo.pagamento.mensagem, 'Cancelamento registrado. A devolução do pagamento está em andamento.')
    let [p] = await pagamentos(vendaId)
    assert.deepEqual([p.status, p.estorno_tentativas, p.estorno_ultimo_erro], ['aprovado', 1, 'INSUFFICIENT_FUNDS'])
    assert.equal(await saldo(produtoId), 8, 'o estoque só volta quando o dinheiro volta')

    gw.estorno = () => ({ aprovado: true, jaEstornado: false })
    const rodada = await tarefas.executarEstornos()
    assert.equal(rodada.estornados, 1)
    assert.equal(await statusVenda(vendaId), 'cancelada')
    ;[p] = await pagamentos(vendaId)
    assert.equal(p.status, 'estornado')
    assert.equal(await saldo(produtoId), 10)
    assert.deepEqual((await historico(vendaId)).at(-1).origem, 'sistema')
    assert.ok(await esperar(() => emailsDa(vendaId).some((e) => e.assunto.startsWith('Compra cancelada'))))
  })

  it('4. em_separacao e pronta_retirada também cancelam; enviada, entregue e cancelada → 409', async () => {
    const separando = await paga({ entrega: 'propria' })
    assert.equal((await mudarStatus(separando.vendaId, { status: 'em_separacao' })).status, 200)
    const r1 = await cancelar(separando.dono, separando.vendaId)
    assert.deepEqual([r1.status, r1.corpo.status], [200, 'cancelada'])

    const pronta = await paga({ entrega: 'retirada' })
    for (const status of ['em_separacao', 'pronta_retirada']) assert.equal((await mudarStatus(pronta.vendaId, { status })).status, 200)
    const r2 = await cancelar(pronta.dono, pronta.vendaId)
    assert.deepEqual([r2.status, r2.corpo.status], [200, 'cancelada'])
    assert.equal(await saldo(pronta.produtoId), 10)

    const enviada = await paga({ entrega: 'propria' })
    for (const status of ['em_separacao', 'enviada']) assert.equal((await mudarStatus(enviada.vendaId, { status })).status, 200)
    const entregue = await paga({ entrega: 'retirada' })
    for (const status of ['em_separacao', 'pronta_retirada', 'entregue']) assert.equal((await mudarStatus(entregue.vendaId, { status })).status, 200)
    for (const v of [enviada, entregue, separando]) {
      const r = await cancelar(v.dono, v.vendaId)
      assert.deepEqual([r.status, r.corpo], [409, { erro: 'Esta compra não pode mais ser cancelada.' }])
      // o admin também não
      assert.equal((await cancelar(admin, v.vendaId, { motivo: 'teste' })).status, 409)
    }
  })

  it('5. cancelamento_solicitado: cliente → 409; admin com tentativas < 5 → 409; com 5 sem motivo → 422; com motivo → cancelada, estorno manual, estoque de volta', async () => {
    const { vendaId, produtoId, dono, pagamentoId } = await paga()
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    assert.equal((await cancelar(dono, vendaId)).corpo.status, 'cancelamento_solicitado')

    const deNovo = await cancelar(dono, vendaId)
    assert.deepEqual([deNovo.status, deNovo.corpo], [409, { erro: 'O cancelamento desta compra já está em andamento.' }])
    const cedo = await cancelar(admin, vendaId, { motivo: 'Devolvi pelo painel' })
    assert.deepEqual([cedo.status, cedo.corpo], [409, { erro: 'O estorno ainda está sendo tentado automaticamente.' }])

    await esgotarEstorno()
    assert.equal((await pagamentos(vendaId))[0].estorno_tentativas, 5)
    for (const body of [undefined, {}, { motivo: '   ' }]) {
      const semMotivo = await cancelar(admin, vendaId, body)
      assert.deepEqual([semMotivo.status, semMotivo.corpo.detalhes], [422, { motivo: 'Descreva como o estorno foi feito.' }])
    }
    const r = await cancelar(admin, vendaId, { motivo: 'Devolvido pelo painel da AbacatePay em 14/11' })
    assert.equal(r.status, 200, r.texto)
    assert.equal(r.corpo.status, 'cancelada')
    assert.ok(Array.isArray(r.corpo.pagamentos), 'o admin recebe o detalhe de admin')
    const [p] = await pagamentos(vendaId)
    assert.deepEqual([p.id, p.status, p.status_detalhe, p.estorno_ultimo_erro], [pagamentoId, 'estornado', 'estorno manual', 'INSUFFICIENT_FUNDS'])
    assert.equal(await saldo(produtoId), 10)
    assert.deepEqual((await historico(vendaId)).at(-1), { status_novo: 'cancelada', origem: 'admin', alterado_por_id: adminId, observacao: 'Devolvido pelo painel da AbacatePay em 14/11' })
    assert.equal(gw.estornar.length, 5, 'a conclusão manual não chama o gateway')
    assert.ok(saida.some((l) => l === `[estorno] pagamento ${pagamentoId} concluído manualmente pelo admin ${adminId}`))
  })

  it('6. venda de outro cliente → 404 (o admin acha qualquer uma); sem login → 401; sem Origin → 403; motivo com 301 caracteres → 422', async () => {
    const { vendaId, dono } = await comprar()
    const intruso = await conta()
    const alheia = await cancelar(intruso, vendaId)
    assert.deepEqual([alheia.status, alheia.corpo], [404, { erro: 'Compra não encontrada.' }])
    assert.deepEqual((await cancelar(admin, 2147483000)).corpo, { erro: 'Venda não encontrada.' })
    assert.equal((await cancelar(null, vendaId)).status, 401)
    assert.equal((await cancelar(dono, vendaId, undefined, { semOrigem: true })).status, 403)
    const longo = await cancelar(dono, vendaId, { motivo: 'a'.repeat(301) })
    assert.deepEqual([longo.status, longo.corpo.detalhes], [422, { motivo: 'O motivo pode ter até 300 caracteres.' }])
    assert.equal((await cancelar(dono, vendaId, { motivo: 42 })).status, 422)
    assert.equal(await statusVenda(vendaId), 'aguardando_pagamento', 'nada mudou')
    assert.equal((await cancelar(dono, vendaId, { motivo: 'a'.repeat(300) })).status, 200)
  })

  it('7. corrida: o cliente cancela enquanto o webhook confirma a mesma venda → nunca paga com o estoque devolvido; o Pix pago vira devolução (5 rodadas)', async (t) => {
    const finais = []
    for (let rodada = 1; rodada <= 5; rodada++) {
      const { vendaId, produtoId, dono, cobrancaId } = await comPix()
      Object.assign(gw.cobrancas.get(cobrancaId), { status: 'aprovado', atraso: 15 })
      // Nas rodadas pares o cancelamento sai um pouco depois, para o webhook poder chegar primeiro
      const atraso = rodada % 2 === 0 ? 40 : 0
      const [cancelamento, webhook] = await Promise.all([
        new Promise((r) => setTimeout(r, atraso)).then(() => cancelar(dono, vendaId)),
        aviso(cobrancaId),
      ])
      assert.equal(webhook, 200, `rodada ${rodada}: webhook ${webhook}`)
      assert.ok([200, 409].includes(cancelamento.status), `rodada ${rodada}: cancelamento ${cancelamento.status} ${cancelamento.texto}`)
      // O Pix pago numa venda já cancelada é devolvido pelo webhook; o webhook antes do cancelamento faz a venda paga,
      // e o cancelamento da paga devolve o dinheiro. Nos dois casos o fim é cancelada, com o estoque devolvido uma vez
      const status = await statusVenda(vendaId)
      const [p] = await pagamentos(vendaId)
      const historicoVenda = (await historico(vendaId)).map((h) => h.status_novo)
      assert.equal(status, 'cancelada', `rodada ${rodada}: ${status}`)
      assert.equal(await devolucoesEstoque(vendaId), 1)
      assert.equal(await saldo(produtoId), 10)
      assert.ok(p.estorno_solicitado_em instanceof Date, `rodada ${rodada}: cancelada com pagamento aprovado sem estorno pedido`)
      assert.equal(p.status, 'estornado')
      assert.equal(gw.estornar.filter(([id]) => id === cobrancaId).length, 1, `rodada ${rodada}: estorno chamado mais de uma vez`)
      finais.push(historicoVenda.includes('paga') ? 'paga→cancelada' : 'cancelada→devolução')
    }
    const { rows: [inv] } = await c.query(`SELECT count(*)::int AS n FROM vendas v WHERE v.status = 'paga'
      AND EXISTS (SELECT 1 FROM operacoes_estoque o WHERE o.venda_id = v.id AND o.tipo_venda = 'estorno_venda')`)
    assert.equal(inv.n, 0)
    t.diagnostic(`rodadas: ${finais.join(', ')}`)
  })

  it('8. corrida: dois cancelamentos da mesma venda paga em paralelo → 1 estorno só chamado no gateway', async () => {
    const { vendaId, dono, cobrancaId } = await paga()
    gw.atrasoEstorno = 30
    const respostas = await Promise.all([cancelar(dono, vendaId), cancelar(dono, vendaId), cancelar(admin, vendaId)])
    assert.deepEqual(respostas.map((r) => r.status).sort(), [200, 409, 409])
    assert.equal(gw.estornar.filter(([id]) => id === cobrancaId).length, 1)
    assert.equal(await statusVenda(vendaId), 'cancelada')
    assert.equal(await devolucoesEstoque(vendaId), 1)
  })

  // ======================= #39/#40 =======================

  it('9. cliente → 403 em todas as rotas de admin; filtros combinados; data inválida, de > ate e erros juntos → 400; fila de separação em ordem crescente', async () => {
    const cliente = await conta()
    for (const [metodo, caminho] of [['GET', '/vendas'], ['GET', '/vendas/1'], ['GET', '/vendas/1/historico'], ['POST', '/vendas/1/status'], ['GET', '/vendas/qualquer/coisa']]) {
      const r = await pedir(caminho, cliente, { metodo, body: metodo === 'POST' ? { status: 'em_separacao' } : undefined })
      assert.equal(r.status, 403, `${metodo} ${caminho}`)
      assert.equal((await pedir(caminho, null, { metodo })).status, 401, `${metodo} ${caminho} sem login`)
    }

    const dona = await conta()
    const a = await paga({ dono: dona, entrega: 'retirada' })
    const b = await paga({ dono: dona, entrega: 'propria' })
    const cc = await comprar({ dono: dona, entrega: 'retirada' })
    // Mesmo dia comercial, independente do horário da execução (inclusive perto da meia-noite).
    await c.query("UPDATE vendas SET criado_em = '2026-01-15T12:00:00Z' WHERE id = $1", [a.vendaId])
    await c.query("UPDATE vendas SET criado_em = '2026-01-15T13:00:00Z' WHERE id = $1", [b.vendaId])
    await c.query("UPDATE vendas SET criado_em = '2026-01-15T14:00:00Z' WHERE id = $1", [cc.vendaId])
    const hoje = '2026-01-15'
    const ontem = '2026-01-13'

    const todas = await pedir(`/vendas?clienteId=${dona.id}`, admin)
    assert.equal(todas.status, 200)
    assert.equal(todas.cache, 'no-store')
    assert.deepEqual(todas.corpo.dados.map((v) => v.id), [cc.vendaId, b.vendaId, a.vendaId], 'mais recentes primeiro')
    assert.equal(todas.corpo.total, 3)
    assert.deepEqual(Object.keys(todas.corpo.dados[0]).sort(), ['clienteNome', 'criadoEm', 'id', 'quantidadeItens', 'status', 'tipoEntrega', 'total'])
    assert.equal(todas.corpo.dados[0].quantidadeItens, 1)
    assert.match(todas.corpo.dados[0].clienteNome, /^Conta /)

    const fila = await pedir(`/vendas?clienteId=${dona.id}&status=paga`, admin)
    assert.deepEqual(fila.corpo.dados.map((v) => v.id), [a.vendaId, b.vendaId], 'fila de separação: as mais antigas primeiro')
    const combinado = await pedir(`/vendas?clienteId=${dona.id}&status=paga&tipoEntrega=retirada&de=${hoje}&ate=${hoje}`, admin)
    assert.deepEqual(combinado.corpo.dados.map((v) => v.id), [a.vendaId])
    assert.equal((await pedir(`/vendas?clienteId=${dona.id}&ate=${ontem}`, admin)).corpo.total, 0)
    const pagina = await pedir(`/vendas?clienteId=${dona.id}&limite=1&pagina=2`, admin)
    assert.deepEqual([pagina.corpo.dados.map((v) => v.id), pagina.corpo.total, pagina.corpo.pagina, pagina.corpo.limite], [[b.vendaId], 3, 2, 1])

    for (const [query, chaves] of [
      ['de=2026-02-30', ['de']], ['ate=14-11-2026', ['ate']], [`de=${hoje}&ate=${ontem}`, ['ate']],
      ['status=xyz&tipoEntrega=drone&clienteId=0&problemaPagamento=sim&limite=500', ['clienteId', 'limite', 'problemaPagamento', 'status', 'tipoEntrega']],
      ['status=paga&status=enviada', ['status']],
    ]) {
      const r = await pedir(`/vendas?${query}`, admin)
      assert.equal(r.status, 400, query)
      assert.equal(r.corpo.erro, 'Parâmetros inválidos')
      assert.deepEqual(Object.keys(r.corpo.detalhes).sort(), chaves, query)
    }
  })

  it('10. ?problemaPagamento=true acha só as vendas com problema (estorno esgotado, em disputa, valor divergente)', async () => {
    const esgotada = await paga()
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    await cancelar(esgotada.dono, esgotada.vendaId)
    await esgotarEstorno()
    const disputa = await paga()
    await c.query("UPDATE pagamentos SET status = 'em_disputa' WHERE venda_id = $1", [disputa.vendaId])
    const divergente = await comPix()
    Object.assign(gw.cobrancas.get(divergente.cobrancaId), { status: 'aprovado', valor: 1 })
    assert.equal(await aviso(divergente.cobrancaId), 200)
    const normal = await paga()
    const tentando = await paga()
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'HTTP 503' })
    await cancelar(tentando.dono, tentando.vendaId) // 1 tentativa só: ainda não é problema

    const r = await pedir('/vendas?problemaPagamento=true&limite=100', admin)
    assert.equal(r.status, 200)
    const ids = r.corpo.dados.map((v) => v.id)
    for (const v of [esgotada, disputa, divergente]) assert.ok(ids.includes(v.vendaId), `faltou a venda ${v.vendaId}`)
    for (const v of [normal, tentando]) assert.equal(ids.includes(v.vendaId), false, `a venda ${v.vendaId} não tem problema`)
    const { rows } = await c.query(`SELECT v.id FROM vendas v WHERE EXISTS (SELECT 1 FROM pagamentos p WHERE p.venda_id = v.id AND
      ((p.status = 'aprovado' AND p.estorno_solicitado_em IS NOT NULL AND p.estorno_tentativas >= 5) OR p.status = 'em_disputa' OR p.status_detalhe = 'valor divergente'))`)
    assert.deepEqual([...ids].sort((x, y) => x - y), rows.map((l) => l.id).sort((x, y) => x - y), 'exatamente as vendas com problema do schema')
    assert.equal((await pedir('/vendas?problemaPagamento=false&limite=100', admin)).corpo.total, (await c.query('SELECT count(*)::int AS n FROM vendas')).rows[0].n)
  })

  it('11. detalhe de admin: a conta, todos os pagamentos com o id da cobrança cortado; /historico com a autoria; 404', async () => {
    const { vendaId, dono, cobrancaId, pagamentoId } = await paga({ entrega: 'propria' })
    assert.equal((await mudarStatus(vendaId, { status: 'em_separacao', observacao: 'Separando hoje' })).status, 200)
    const r = await pedir(`/vendas/${vendaId}`, admin)
    assert.equal(r.status, 200)
    assert.equal(r.cache, 'no-store')
    const conta = (await c.query('SELECT nome, email, telefone FROM clientes WHERE id = $1', [dono.id])).rows[0]
    assert.deepEqual(r.corpo.cliente, { id: dono.id, ...conta })
    assert.deepEqual([r.corpo.status, r.corpo.pagamento.mensagem, r.corpo.historico.map((h) => h.status)],
      ['em_separacao', 'Pagamento confirmado.', ['aguardando_pagamento', 'paga', 'em_separacao']])
    assert.equal(r.corpo.pagamentos.length, 1)
    const p = r.corpo.pagamentos[0]
    assert.deepEqual(Object.keys(p).sort(), ['cobrancaInicio', 'criadoEm', 'estornoSolicitadoEm', 'estornoTentativas', 'estornoUltimoErro', 'id', 'metodo', 'status', 'statusDetalhe', 'valor'])
    assert.deepEqual([p.id, p.status, p.metodo, p.valor, p.cobrancaInicio], [pagamentoId, 'aprovado', 'pix', r.corpo.total, `${cobrancaId.slice(0, 15)}…`])
    assert.equal(r.texto.includes(cobrancaId), false, 'o id inteiro da cobrança apareceu')
    assert.equal(r.texto.includes(prefixoCodigoPix), false)

    const h = await pedir(`/vendas/${vendaId}/historico`, admin)
    assert.equal(h.status, 200)
    assert.equal(h.cache, 'no-store')
    const nomeAdmin = (await c.query('SELECT nome FROM clientes WHERE id = $1', [adminId])).rows[0].nome
    assert.deepEqual(h.corpo.map(({ data, ...e }) => e), [
      { statusAnterior: null, status: 'aguardando_pagamento', origem: 'cliente', alteradoPor: { id: dono.id, nome: conta.nome }, observacao: null },
      { statusAnterior: 'aguardando_pagamento', status: 'paga', origem: 'gateway', alteradoPor: null, observacao: null },
      { statusAnterior: 'paga', status: 'em_separacao', origem: 'admin', alteradoPor: { id: adminId, nome: nomeAdmin }, observacao: 'Separando hoje' },
    ])
    for (const caminho of ['/vendas/2147483000', '/vendas/2147483000/historico']) {
      assert.deepEqual((await pedir(caminho, admin)).corpo, { erro: 'Venda não encontrada.' })
    }
    assert.equal((await pedir('/vendas/abc', admin)).status, 400)
  })

  // ======================= #41 =======================

  it('12. #41 correios: paga → em_separacao → enviada (com rastreio) → entregue; retirada: em_separacao → pronta_retirada → entregue; e-mails certos', async () => {
    const correios = await paga({ entrega: 'correios' })
    assert.equal((await mudarStatus(correios.vendaId, { status: 'em_separacao' })).status, 200)
    const enviada = await mudarStatus(correios.vendaId, { status: 'enviada', codigoRastreio: '  br123456789br ', observacao: 'Postado' })
    assert.equal(enviada.status, 200, enviada.texto)
    assert.deepEqual([enviada.corpo.status, enviada.corpo.codigoRastreio], ['enviada', 'BR123456789BR'])
    const entregue = await mudarStatus(correios.vendaId, { status: 'entregue' })
    assert.deepEqual([entregue.status, entregue.corpo.status, entregue.corpo.codigoRastreio], [200, 'entregue', 'BR123456789BR'])
    assert.deepEqual((await historico(correios.vendaId)).map((h) => [h.status_novo, h.origem]),
      [['aguardando_pagamento', 'cliente'], ['paga', 'gateway'], ['em_separacao', 'admin'], ['enviada', 'admin'], ['entregue', 'admin']])
    assert.equal((await historico(correios.vendaId)).find((h) => h.status_novo === 'enviada').observacao, 'Postado')

    const retirada = await paga({ entrega: 'retirada' })
    for (const status of ['em_separacao', 'pronta_retirada', 'entregue']) {
      const r = await mudarStatus(retirada.vendaId, { status })
      assert.deepEqual([r.status, r.corpo.status], [200, status])
    }

    assert.ok(await esperar(() => emailsDa(correios.vendaId).length === 3 && emailsDa(retirada.vendaId).length === 3))
    assert.deepEqual(emailsDa(correios.vendaId).map((e) => e.assunto.split(' — ')[0]),
      ['Pagamento confirmado', `Seu pedido #${correios.vendaId} foi enviado`, 'Pedido entregue'])
    assert.match(emailsDa(correios.vendaId)[1].texto, /BR123456789BR/)
    assert.deepEqual(emailsDa(retirada.vendaId).map((e) => e.assunto.split(' — ')[0]),
      ['Pagamento confirmado', 'Seu pedido está pronto para retirada', 'Pedido entregue'])
    assert.ok(emailsDa(retirada.vendaId)[1].texto.includes('Retire na loja Aquarilândia (Av. Josué de Queiroz, 115 – São João del Rei)'))
  })

  it('13. #41 erros: rastreio faltando, fora do formato, em propria; pronta_retirada em correios; status fora da lista; pular etapas', async () => {
    const correios = await paga({ entrega: 'correios' })
    const propria = await paga({ entrega: 'propria' })
    for (const v of [correios, propria]) assert.equal((await mudarStatus(v.vendaId, { status: 'em_separacao' })).status, 200)

    const semRastreio = await mudarStatus(correios.vendaId, { status: 'enviada' })
    assert.deepEqual([semRastreio.status, semRastreio.corpo.detalhes], [422, { codigoRastreio: 'Informe o código de rastreio dos Correios.' }])
    for (const codigo of ['BR12345678BR', 'B1123456789BR', 'BR123456789B', 12345]) {
      const r = await mudarStatus(correios.vendaId, { status: 'enviada', codigoRastreio: codigo })
      assert.deepEqual([r.status, Object.keys(r.corpo.detalhes)], [422, ['codigoRastreio']], String(codigo))
    }
    const emPropria = await mudarStatus(propria.vendaId, { status: 'enviada', codigoRastreio: 'BR123456789BR' })
    assert.deepEqual([emPropria.status, emPropria.corpo.detalhes], [422, { codigoRastreio: 'Só compras enviadas pelos Correios têm código de rastreio.' }])
    const prontaCorreios = await mudarStatus(correios.vendaId, { status: 'pronta_retirada' })
    assert.deepEqual([prontaCorreios.status, prontaCorreios.corpo], [409, { erro: 'Só compras para retirada na loja ficam prontas para retirada.' }])
    assert.equal(await statusVenda(correios.vendaId), 'em_separacao', 'nada mudou')

    const aguardando = await comprar()
    for (const status of ['paga', 'cancelada', 'cancelamento_solicitado', 'xyz', undefined]) {
      const r = await mudarStatus(aguardando.vendaId, { status })
      assert.deepEqual([r.status, Object.keys(r.corpo.detalhes)], [422, ['status']], String(status))
    }
    assert.equal((await mudarStatus(aguardando.vendaId, ['em_separacao'])).status, 422)
    const pulo = await paga()
    const r = await mudarStatus(pulo.vendaId, { status: 'entregue' })
    assert.deepEqual([r.status, r.corpo], [409, { erro: 'Não é possível mudar de paga para entregue.' }])
    const naoPaga = await mudarStatus(aguardando.vendaId, { status: 'em_separacao' })
    assert.deepEqual([naoPaga.status, naoPaga.corpo], [409, { erro: 'Não é possível mudar de aguardando_pagamento para em_separacao.' }])
    assert.equal((await mudarStatus(2147483000, { status: 'em_separacao' })).status, 404)
    const longa = await mudarStatus(pulo.vendaId, { status: 'em_separacao', observacao: 'x'.repeat(301) })
    assert.deepEqual([longa.status, Object.keys(longa.corpo.detalhes)], [422, ['observacao']])
  })

  it('14. #41 sem Origin → 403; cliente → 403; nada muda', async () => {
    const { vendaId, dono } = await paga()
    assert.equal((await mudarStatus(vendaId, { status: 'em_separacao' }, admin, { semOrigem: true })).status, 403)
    assert.equal((await mudarStatus(vendaId, { status: 'em_separacao' }, dono)).status, 403)
    assert.equal(await statusVenda(vendaId), 'paga')
  })

  // ======================= conclusão manual do pagamento em dobro =======================

  it('15. POST /api/pagamentos/:id/concluir-estorno: cliente → 403, sem motivo → 422, sem as 5 tentativas → 409, o da compra → 409; o caso feliz', async () => {
    // Venda paga pelo segundo Pix; o primeiro também entra e vira devolução, que falha
    const { vendaId, dono, cobrancaId: primeira, pagamentoId: p1 } = await comPix()
    gw.cobrancas.get(primeira).status = 'cancelado'
    assert.equal(await aviso(primeira), 200)
    const segundo = await pedir(`/vendas/${vendaId}/pagamentos`, dono, { metodo: 'POST' })
    const p2 = segundo.corpo.pagamentoId, segunda = gw.porPagamento.get(p2)
    gw.cobrancas.get(segunda).status = 'aprovado'
    assert.equal(await aviso(segunda), 200)
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    gw.cobrancas.get(primeira).status = 'aprovado'
    assert.equal(await aviso(primeira), 200)
    const indevido = (await pagamentos(vendaId)).find((p) => p.id === p1)
    assert.deepEqual([indevido.status, indevido.status_detalhe, indevido.estorno_tentativas], ['aprovado', 'pagamento indevido', 1])

    const concluir = (quem, id, body, opcoes) => pedir(`/pagamentos/${id}/concluir-estorno`, quem, { metodo: 'POST', body, ...opcoes })
    assert.equal((await concluir(dono, p1, { motivo: 'x' })).status, 403)
    assert.equal((await concluir(null, p1, { motivo: 'x' })).status, 401)
    assert.equal((await concluir(admin, p1, { motivo: 'x' }, { semOrigem: true })).status, 403)
    const semMotivo = await concluir(admin, p1, {})
    assert.deepEqual([semMotivo.status, semMotivo.corpo.detalhes], [422, { motivo: 'Descreva como o estorno foi feito.' }])
    const cedo = await concluir(admin, p1, { motivo: 'Devolvi' })
    assert.deepEqual([cedo.status, cedo.corpo], [409, { erro: 'Este pagamento não está esperando uma devolução manual.' }])
    assert.deepEqual((await concluir(admin, p2, { motivo: 'Devolvi' })).status, 409, 'o pagamento da compra não está esperando devolução')
    assert.deepEqual((await concluir(admin, 2147483000, { motivo: 'Devolvi' })).corpo, { erro: 'Pagamento não encontrado.' })

    await esgotarEstorno()
    const r = await concluir(admin, p1, { motivo: '  Devolvido pelo painel em 14/11  ' })
    assert.equal(r.status, 200, r.texto)
    assert.deepEqual(r.corpo, { id: p1, vendaId, status: 'estornado', statusDetalhe: 'estorno manual' })
    const depois = (await pagamentos(vendaId)).find((p) => p.id === p1)
    assert.deepEqual([depois.status, depois.status_detalhe, depois.estorno_ultimo_erro], ['estornado', 'estorno manual', 'Devolvido pelo painel em 14/11'])
    assert.equal(await statusVenda(vendaId), 'paga', 'a venda paga pelo outro pagamento não muda')
    assert.equal((await concluir(admin, p1, { motivo: 'de novo' })).status, 409)

    // O pagamento da compra em cancelamento_solicitado com 5 tentativas: conclui-se pelo cancelamento da venda
    const travada = await paga()
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    await cancelar(travada.dono, travada.vendaId)
    await esgotarEstorno()
    const daCompra = await concluir(admin, travada.pagamentoId, { motivo: 'Devolvi' })
    assert.deepEqual([daCompra.status, daCompra.corpo], [409, { erro: 'Este é o pagamento da compra: conclua pelo cancelamento da venda.' }])
  })

  // ======================= e-mails =======================

  it('16. e-mails: nenhum na expiração, nenhum para conta anonimizada, nenhum dado do gateway em nenhum texto', async () => {
    const vencida = await comPix()
    await c.query("UPDATE vendas SET expira_em = now() - interval '10 minutes' WHERE id = $1", [vencida.vendaId])
    await tarefas.executarExpiracao()
    assert.equal(await statusVenda(vencida.vendaId), 'cancelada')
    await new Promise((r) => setTimeout(r, 200))
    assert.deepEqual(emailsDa(vencida.vendaId), [], 'a expiração não manda e-mail')

    const anonima = await paga({ entrega: 'retirada' })
    assert.ok(await esperar(() => emailsDa(anonima.vendaId).length === 1), 'o pagamento confirmado avisa')
    await c.query(`UPDATE clientes SET nome = 'Cliente removido', email = NULL, telefone = NULL, senha_hash = NULL, ativo = false,
      anonimizado_em = now() WHERE id = $1`, [anonima.dono.id])
    for (const status of ['em_separacao', 'pronta_retirada', 'entregue']) assert.equal((await mudarStatus(anonima.vendaId, { status })).status, 200)
    await new Promise((r) => setTimeout(r, 200))
    assert.equal(emailsDa(anonima.vendaId).length, 1, 'conta anonimizada não recebe e-mail')

    // Todos os e-mails desta suíte: texto simples, sem nada do gateway
    const todos = JSON.stringify(emails)
    for (const proibido of ['pix_char_', prefixoCodigoPix, 'abacatepay', 'gateway', 'QR', 'http://', 'https://']) {
      assert.equal(todos.includes(proibido), false, `e-mail com ${proibido}`)
    }
    for (const e of emails) assert.match(e.para, /@vendasadmin\.example$/)
  })

  it('17. confirmação financeira pelo webhook conclui pagamento, cancelamento e estoque', async (t) => {
    const { vendaId, produtoId, dono, cobrancaId, pagamentoId } = await paga()
    await c.query("UPDATE vendas SET criado_em='2026-01-15T12:00:00Z',expira_em='2099-01-01T00:00:00Z' WHERE id=$1", [vendaId])
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    assert.equal((await cancelar(dono, vendaId)).corpo.status, 'cancelamento_solicitado')
    assert.equal(await saldo(produtoId), 8)
    gw.cobrancas.get(cobrancaId).status = 'estornado'
    assert.equal(await aviso(cobrancaId), 200)
    const estado = { pagamento: (await pagamentos(vendaId)).find((p) => p.id === pagamentoId).status,
      venda: await statusVenda(vendaId), saldo: await saldo(produtoId), devolucoes: await devolucoesEstoque(vendaId) }
    t.diagnostic(JSON.stringify(estado))
    assert.deepEqual(estado, { pagamento: 'estornado', venda: 'cancelada', saldo: 10, devolucoes: 1 })
    assert.equal((await historico(vendaId)).filter((h) => h.status_novo === 'cancelada').length, 1)
  })

  it('18. mesmo evento e eventos distintos da mesma confirmação não duplicam histórico, crédito ou e-mail', async () => {
    const compra = await pagaParaEstorno()
    await solicitarSemConcluir(compra)
    gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
    const evento = novoEvento()
    assert.equal(await aviso(compra.cobrancaId, evento), 200)
    const quantidadeConsultas = gw.consultar.length
    assert.equal(await aviso(compra.cobrancaId, evento), 200)
    assert.equal(gw.consultar.length, quantidadeConsultas, 'evento processado não consulta outra vez')
    assert.deepEqual(await Promise.all([aviso(compra.cobrancaId), aviso(compra.cobrancaId)]), [200, 200])
    assert.equal(await saldo(compra.produtoId), 10)
    assert.equal(await devolucoesEstoque(compra.vendaId), 1)
    assert.equal((await historico(compra.vendaId)).filter((h) => h.status_novo === 'cancelada').length, 1)
    assert.equal(gw.estornar.length, 1, 'nenhum novo pedido financeiro')
    assert.ok(await esperar(() => emailsDa(compra.vendaId).filter((e) => e.assunto.startsWith('Compra cancelada')).length === 1))
  })

  it('19. webhook × resposta do estorno e retries simultâneos convergem; rede sem locks e aviso após COMMIT', async () => {
    const compra = await pagaParaEstorno()
    assert.ok(await esperar(() => emailsDa(compra.vendaId).length === 1))
    const observados = []
    mock.method(canalEmail, 'enviar', async (mensagem) => {
      if (mensagem.assunto.startsWith('Compra cancelada')) {
        observados.push({ venda: await statusVenda(compra.vendaId), saldo: await saldo(compra.produtoId) })
      }
      emails.push(mensagem)
    })
    let liberar, entrou
    const porta = new Promise((r) => { liberar = r })
    const iniciado = new Promise((r) => { entrou = r })
    gw.estorno = async () => {
      // Conexão independente consegue as mesmas linhas enquanto a requisição externa está em andamento.
      await c.query('BEGIN')
      try {
        await c.query('SELECT id FROM vendas WHERE id=$1 FOR UPDATE NOWAIT', [compra.vendaId])
        await c.query('SELECT id FROM pagamentos WHERE id=$1 FOR UPDATE NOWAIT', [compra.pagamentoId])
        await c.query('SELECT id FROM produtos WHERE id=$1 FOR UPDATE NOWAIT', [compra.produtoId])
      } finally { await c.query('ROLLBACK') }
      entrou()
      await porta
      return { aprovado: true, jaEstornado: false }
    }
    const cancelamento = cancelar(compra.dono, compra.vendaId)
    try {
      await iniciado
      const retries = [pagamentoService.tentarEstornoPendente(compra.pagamentoId), pagamentoService.tentarEstornoPendente(compra.pagamentoId)]
      gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
      assert.equal(await aviso(compra.cobrancaId), 200)
      assert.equal(await statusVenda(compra.vendaId), 'cancelada')
      liberar()
      assert.deepEqual(await Promise.all(retries), ['estornado', 'estornado'])
      assert.equal((await cancelamento).corpo.status, 'cancelada')
    } finally { liberar(); await cancelamento }
    assert.equal(gw.estornar.length, 1)
    assert.equal(await saldo(compra.produtoId), 10)
    assert.equal(await devolucoesEstoque(compra.vendaId), 1)
    assert.equal((await historico(compra.vendaId)).filter((h) => h.status_novo === 'cancelada').length, 1)
    assert.ok(await esperar(() => observados.length === 1))
    assert.deepEqual(observados, [{ venda: 'cancelada', saldo: 10 }], 'outra conexão já vê o COMMIT ao enviar')
  })

  for (const caminho of ['webhook', 'resposta']) {
    it(`20.${caminho}. falha no segundo produto desfaz pagamento, venda, histórico e saldo; retry só reconcilia`, async () => {
      const p1 = await produto(10), p2 = await produto(20)
      const compra = await pagaParaEstorno({ itensPreparados: [{ produtoId: p2, quantidade: 3 }, { produtoId: p1, quantidade: 2 }] })
      await solicitarSemConcluir(compra)
      const antes = await historico(compra.vendaId)
      const funcao = `falha_estorno_${caminho}`, gatilho = `falha_estorno_${caminho}`
      await c.query(`CREATE FUNCTION ${funcao}() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'falha controlada no segundo produto'; END $$`)
      await c.query(`CREATE TRIGGER ${gatilho} BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW
        WHEN (NEW.tipo = 'estorno_venda' AND NEW.produto_id = ${p2}) EXECUTE FUNCTION ${funcao}()`)
      const evento = novoEvento()
      try {
        if (caminho === 'webhook') {
          gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
          assert.equal(await aviso(compra.cobrancaId, evento), 500)
          const falhou = (await c.query('SELECT processado_em, tentativas FROM eventos_webhook WHERE gateway_notificacao_id=$1', [evento])).rows[0]
          assert.deepEqual(falhou, { processado_em: null, tentativas: 1 })
        } else {
          gw.estorno = () => {
            gw.cobrancas.get(compra.cobrancaId).status = 'estornado' // dinheiro já voltou, mesmo que o banco falhe
            return { aprovado: true, jaEstornado: false }
          }
          await assert.rejects(pagamentoService.tentarEstornoPendente(compra.pagamentoId), { code: 'P0001' })
        }
        assert.equal((await pagamentos(compra.vendaId))[0].status, 'aprovado')
        assert.equal(await statusVenda(compra.vendaId), 'cancelamento_solicitado')
        assert.deepEqual([await saldo(p1), await saldo(p2)], [8, 17])
        assert.equal(await devolucoesEstoque(compra.vendaId), 0)
        assert.deepEqual(await historico(compra.vendaId), antes)
        await new Promise((r) => setTimeout(r, 100))
        assert.equal(emailsDa(compra.vendaId).filter((e) => e.assunto.startsWith('Compra cancelada')).length, 0)
      } finally {
        await c.query(`DROP TRIGGER ${gatilho} ON movimentacoes_estoque`)
        await c.query(`DROP FUNCTION ${funcao}()`)
      }
      const pedidosFinanceiros = gw.estornar.length
      if (caminho === 'webhook') assert.equal(await aviso(compra.cobrancaId, evento), 200)
      else assert.equal(await pagamentoService.tentarEstornoPendente(compra.pagamentoId), 'estornado')
      assert.equal(gw.estornar.length, pedidosFinanceiros, 'retry reconsulta e não pede outro estorno')
      assert.equal((await pagamentos(compra.vendaId))[0].status, 'estornado')
      assert.equal(await statusVenda(compra.vendaId), 'cancelada')
      assert.deepEqual([await saldo(p1), await saldo(p2)], [10, 20])
      assert.equal(await devolucoesEstoque(compra.vendaId), 1)
      const movimentos = (await c.query(`SELECT produto_id, quantidade FROM movimentacoes_estoque m
        JOIN operacoes_estoque o ON o.id=m.operacao_id WHERE o.venda_id=$1 AND m.tipo='estorno_venda' ORDER BY produto_id`, [compra.vendaId])).rows
      assert.deepEqual(movimentos, [{ produto_id: p1, quantidade: 2 }, { produto_id: p2, quantidade: 3 }])
      assert.ok(await esperar(() => emailsDa(compra.vendaId).filter((e) => e.assunto.startsWith('Compra cancelada')).length === 1))
    })
  }

  it('21. pagamento antigo já estornado e cancelamento pendente entra na fila e recupera mesmo com cinco tentativas', async () => {
    const compra = await pagaParaEstorno()
    await solicitarSemConcluir(compra)
    await c.query("UPDATE pagamentos SET status='estornado', estorno_tentativas=5 WHERE id=$1", [compra.pagamentoId])
    gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
    assert.ok((await pagamentoService.listarEstornosPendentes(50)).includes(compra.pagamentoId))
    const pedidos = gw.estornar.length
    await tarefas.executarEstornos()
    assert.equal(gw.estornar.length, pedidos)
    assert.equal(await statusVenda(compra.vendaId), 'cancelada')
    assert.equal(await saldo(compra.produtoId), 10)
    assert.equal(await devolucoesEstoque(compra.vendaId), 1)
    assert.equal((await pagamentoService.listarEstornosPendentes(50)).includes(compra.pagamentoId), false)
  })

  it('22. consulta pendente/recusada e estorno negado mantêm o estoque baixado; não presumir confirmação', async () => {
    const compra = await pagaParaEstorno()
    await solicitarSemConcluir(compra)
    const pedidos = gw.estornar.length
    for (const estado of ['pendente', 'recusado']) {
      gw.cobrancas.get(compra.cobrancaId).status = estado
      assert.equal(await aviso(compra.cobrancaId), 200)
      assert.equal(await pagamentoService.tentarEstornoPendente(compra.pagamentoId), 'nada')
    }
    assert.equal(gw.estornar.length, pedidos, 'sem prova de aprovação não pedir reembolso')
    gw.cobrancas.get(compra.cobrancaId).status = 'aprovado'
    assert.equal(await pagamentoService.tentarEstornoPendente(compra.pagamentoId), 'falhou')
    assert.equal((await pagamentos(compra.vendaId))[0].status, 'aprovado')
    assert.equal(await statusVenda(compra.vendaId), 'cancelamento_solicitado')
    assert.equal(await saldo(compra.produtoId), 8)
    assert.equal(await devolucoesEstoque(compra.vendaId), 0)
  })

  it('23. cobrança duplicada estornada não conclui a venda, inclusive durante cancelamento do pagamento correto', async () => {
    const compra = await comPix()
    await c.query("UPDATE vendas SET criado_em='2026-01-15T12:00:00Z', expira_em='2099-01-01T00:00:00Z' WHERE id=$1", [compra.vendaId])
    gw.cobrancas.get(compra.cobrancaId).status = 'cancelado'
    assert.equal(await aviso(compra.cobrancaId), 200)
    const outro = await pedir(`/vendas/${compra.vendaId}/pagamentos`, compra.dono, { metodo: 'POST' })
    assert.equal(outro.status, 201, outro.texto)
    const correta = gw.porPagamento.get(outro.corpo.pagamentoId)
    gw.cobrancas.get(correta).status = 'aprovado'
    assert.equal(await aviso(correta), 200)
    gw.estorno = () => ({ aprovado: false, jaEstornado: false, erro: 'INSUFFICIENT_FUNDS' })
    gw.cobrancas.get(compra.cobrancaId).status = 'aprovado'
    assert.equal(await aviso(compra.cobrancaId), 200)
    // Dados divergentes de uma consulta não podem apagar a marca de cobrança indevida.
    const valor = gw.cobrancas.get(compra.cobrancaId).valor
    gw.cobrancas.get(compra.cobrancaId).valor = valor + 1
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal((await pagamentos(compra.vendaId)).find((p) => p.id === compra.pagamentoId).status_detalhe, 'pagamento indevido')
    gw.cobrancas.get(compra.cobrancaId).valor = valor
    gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal(await statusVenda(compra.vendaId), 'paga')
    await solicitarSemConcluir(compra)
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal(await statusVenda(compra.vendaId), 'cancelamento_solicitado')
    assert.equal(await saldo(compra.produtoId), 8)
    assert.equal(await devolucoesEstoque(compra.vendaId), 0)
    // A conclusão manual antiga substituía o detalhe da cobrança indevida. Não a classificar como confirmadora.
    await c.query("UPDATE pagamentos SET status_detalhe='estorno manual' WHERE id=$1", [compra.pagamentoId])
    assert.equal((await pagamentoService.listarEstornosPendentes(50)).includes(compra.pagamentoId), false)
    gw.cobrancas.get(compra.cobrancaId).valor++
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal((await pagamentos(compra.vendaId)).find((p) => p.id === compra.pagamentoId).status_detalhe, 'estorno manual')
    gw.cobrancas.get(compra.cobrancaId).valor--
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal(await statusVenda(compra.vendaId), 'cancelamento_solicitado')
    gw.cobrancas.get(correta).status = 'estornado'
    assert.equal(await aviso(correta), 200)
    assert.equal(await statusVenda(compra.vendaId), 'cancelada')
    assert.equal(await saldo(compra.produtoId), 10)
    assert.equal(await devolucoesEstoque(compra.vendaId), 1)
  })

  for (const estado of ['enviada', 'entregue']) {
    it(`24.${estado}. estorno espontâneo não cancela nem devolve; histórico de envio impede estado adulterado`, async () => {
      const compra = await pagaParaEstorno({ entrega: 'correios' })
      assert.equal((await mudarStatus(compra.vendaId, { status: 'em_separacao' })).status, 200)
      assert.equal((await mudarStatus(compra.vendaId, { status: 'enviada', codigoRastreio: 'BR123456789BR' })).status, 200)
      if (estado === 'entregue') assert.equal((await mudarStatus(compra.vendaId, { status: 'entregue' })).status, 200)
      assert.equal((await cancelar(compra.dono, compra.vendaId)).status, 409)
      gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
      assert.equal(await aviso(compra.cobrancaId), 200)
      assert.equal(await statusVenda(compra.vendaId), estado)
      assert.equal(await saldo(compra.produtoId), 8)
      assert.equal(await devolucoesEstoque(compra.vendaId), 0)
      // Simula inconsistência legada: não basta forçar cancelamento_solicitado para superar a guarda B1.
      await c.query("UPDATE vendas SET status='cancelamento_solicitado' WHERE id=$1", [compra.vendaId])
      await c.query("UPDATE pagamentos SET status='aprovado', estorno_solicitado_em='2026-01-15T13:00:00Z' WHERE id=$1", [compra.pagamentoId])
      assert.equal(await aviso(compra.cobrancaId), 500)
      assert.equal((await pagamentos(compra.vendaId))[0].status, 'aprovado', 'falha da guarda desfaz estado financeiro local')
      assert.equal(await statusVenda(compra.vendaId), 'cancelamento_solicitado')
      assert.equal(await saldo(compra.produtoId), 8)
      assert.equal(await devolucoesEstoque(compra.vendaId), 0)
      assert.equal((await historico(compra.vendaId)).filter((h) => h.status_novo === 'cancelada').length, 0)
    })
  }

  it('25. valor ou cobrança divergente não comprova estorno e não libera estoque', async () => {
    const compra = await pagaParaEstorno()
    await solicitarSemConcluir(compra)
    gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
    gw.cobrancas.get(compra.cobrancaId).valor++
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal((await pagamentos(compra.vendaId))[0].status, 'aprovado')
    const original = gatewayPix.consultarCobranca
    const substituicao = mock.method(gatewayPix, 'consultarCobranca', async (id) => ({ ...await original(id), cobrancaId: 'pix_char_OUTRA' }))
    assert.equal(await aviso(compra.cobrancaId), 500)
    substituicao.mock.restore()
    assert.equal(await statusVenda(compra.vendaId), 'cancelamento_solicitado')
    assert.equal(await saldo(compra.produtoId), 8)
    assert.equal(await devolucoesEstoque(compra.vendaId), 0)
    assert.equal(gw.estornar.length, 1)
    gw.cobrancas.get(compra.cobrancaId).valor--
    assert.equal(await aviso(compra.cobrancaId), 200)
    assert.equal(await statusVenda(compra.vendaId), 'cancelada')
  })

  it('26. reconsulta aguardando lock relê a classificação do pagamento antes de decidir sobre estoque', async () => {
    const compra = await pagaParaEstorno()
    await solicitarSemConcluir(compra)
    gw.cobrancas.get(compra.cobrancaId).status = 'estornado'
    await c.query('BEGIN')
    await c.query('SELECT id FROM pagamentos WHERE id=$1 FOR UPDATE', [compra.pagamentoId])
    const requisicao = aviso(compra.cobrancaId)
    try {
      assert.ok(await esperar(async () => {
        // A conexão observadora mantém uma transação aberta: descartar o snapshot das estatísticas entre sondagens.
        await c.query('SELECT pg_stat_clear_snapshot()')
        return (await c.query(`SELECT 1 FROM pg_stat_activity
          WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE '%FROM pagamentos%'`, [schema])).rowCount > 0
      }, 5000),
      'a consulta deve estar realmente bloqueada no PostgreSQL')
      await c.query("UPDATE pagamentos SET status_detalhe='pagamento indevido' WHERE id=$1", [compra.pagamentoId])
      await c.query('COMMIT')
    } finally { await c.query('ROLLBACK'); await requisicao }
    assert.equal(await requisicao, 200)
    assert.equal((await pagamentos(compra.vendaId))[0].status, 'estornado')
    assert.equal(await statusVenda(compra.vendaId), 'cancelamento_solicitado')
    assert.equal(await saldo(compra.produtoId), 8)
    assert.equal(await devolucoesEstoque(compra.vendaId), 0)
  })

  it('99. nenhum token, cookie, segredo, código Pix ou id de cobrança no log da suíte', () => {
    const texto = saida.join('\n')
    for (const proibido of ['pix_char_', prefixoCodigoPix, segredo, admin.token]) assert.equal(texto.includes(proibido), false, proibido.slice(0, 10))
  })
})
