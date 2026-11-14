import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { once } from 'node:events'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { env } from '../src/config/env.ts'
import { gatewayPix } from '../src/modulos/pagamentos/gateway.ts'
import { codigoDoErro, pagamentoService } from '../src/modulos/pagamentos/pagamento.service.ts'
import { escolherPagamento, mensagemDoPagamento } from '../src/modulos/vendas/venda.service.ts'
import { AppError } from '../src/utils/AppError.ts'

// Lote 11, sem banco: as mensagens do pagamento (#48), a escolha do pagamento da compra, o código curto dos erros e o
// que o controller do webhook lê do corpo. O processamento com PostgreSQL real está em integracao/pagamentos.test.mjs.

const segredo = 'segredo-de-teste-do-webhook-lote-11'
const chavePublica = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
const segredoOriginal = env.gatewayWebhookSecret

describe('mensagemDoPagamento (#48)', () => {
  const p = (status) => ({ status, metodo: 'pix', criadoEm: new Date() })
  for (const [status, venda, esperada] of [
    ['pendente', 'aguardando_pagamento', 'Aguardando o pagamento do Pix.'],
    ['aprovado', 'paga', 'Pagamento confirmado.'],
    ['aprovado', 'entregue', 'Pagamento confirmado.'],
    ['aprovado', 'cancelada', 'Pagamento recebido. A devolução está em andamento.'],
    ['aprovado', 'cancelamento_solicitado', 'Pagamento recebido. A devolução está em andamento.'],
    ['cancelado', 'aguardando_pagamento', 'O código Pix expirou. Gere um novo código para pagar.'],
    ['cancelado', 'cancelada', 'Pagamento não concluído.'],
    ['cancelado', 'paga', 'Pagamento não concluído.'],
    ['recusado', 'aguardando_pagamento', 'O pagamento não foi aprovado. Gere um novo código Pix.'],
    ['estornado', 'cancelada', 'Pagamento devolvido.'],
    ['em_disputa', 'paga', 'Pagamento em análise.'],
  ]) {
    it(`${status} com a venda ${venda} → "${esperada}"`, () => assert.equal(mensagemDoPagamento(p(status), venda), esperada))
  }
})

describe('escolherPagamento com estorno pedido (#48)', () => {
  const pag = (id, status, horas, estorno = null) => ({ id, status, metodo: 'pix', criadoEm: new Date(Date.UTC(2026, 10, 14, horas)), estornoSolicitadoEm: estorno })
  it('o aprovado com devolução pedida (em dobro) não vence o aprovado de verdade, mesmo sendo mais novo', () => {
    const escolhido = escolherPagamento([pag(1, 'aprovado', 8), pag(2, 'aprovado', 9, new Date()), pag(3, 'estornado', 10, new Date())])
    assert.equal(escolhido.criadoEm.getUTCHours(), 8)
  })
  it('sem aprovado válido → o mais recente de qualquer status (o com devolução pedida entra aqui)', () => {
    assert.equal(escolherPagamento([pag(1, 'cancelado', 8), pag(2, 'aprovado', 9, new Date())]).status, 'aprovado')
    assert.equal(escolherPagamento([pag(1, 'aprovado', 8, new Date()), pag(2, 'estornado', 9, new Date())]).status, 'estornado')
  })
  it('devolve só status, metodo e criadoEm (o estorno nunca sai)', () => {
    assert.deepEqual(Object.keys(escolherPagamento([pag(1, 'aprovado', 8, new Date())])).sort(), ['criadoEm', 'metodo', 'status'])
  })
})

describe('codigoDoErro', () => {
  it('SQLSTATE, 502 do gateway, outro AppError e erro qualquer, nunca a mensagem', () => {
    assert.equal(codigoDoErro(Object.assign(new Error('valor "maria@x" na tabela pagamentos'), { code: '23505' })), '23505')
    assert.equal(codigoDoErro(new AppError('Não foi possível falar com o pagamento agora.', 502)), 'GATEWAY_INDISPONIVEL')
    assert.equal(codigoDoErro(new AppError('Compra não encontrada.', 404)), 'HTTP_404')
    assert.equal(codigoDoErro(Object.assign(new Error('x'), { code: 'algo\ncom quebra' })), 'ERRO_INESPERADO')
    assert.equal(codigoDoErro('texto'), 'ERRO_INESPERADO')
  })
})

describe('gatewayPix (o seam dos testes)', () => {
  it('expõe exatamente as três funções do gateway', () => {
    assert.deepEqual(Object.keys(gatewayPix).sort(), ['consultarCobranca', 'criarCobrancaPix', 'estornar'])
    for (const fn of Object.values(gatewayPix)) assert.equal(typeof fn, 'function')
  })
})

describe('Webhook — o que o controller lê do corpo (#46/#47)', () => {
  let servidor, base
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}/api`
  })
  after(async () => { await new Promise((r) => servidor.close(r)) })
  let avisos, logs
  beforeEach(() => {
    env.gatewayWebhookSecret = segredo
    avisos = mock.method(pagamentoService, 'processarAviso', async () => {})
    logs = mock.method(console, 'error', () => {})
  })
  afterEach(() => { mock.restoreAll(); env.gatewayWebhookSecret = segredoOriginal })

  const enviar = (objeto, { assinatura } = {}) => {
    const corpo = JSON.stringify(objeto)
    return fetch(`${base}/pagamentos/webhook?webhookSecret=${encodeURIComponent(segredo)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': assinatura ?? createHmac('sha256', chavePublica).update(corpo).digest('base64') },
      body: corpo,
    })
  }
  const completo = { id: 'log_abc123', event: 'transparent.completed', data: { transparent: { id: 'pix_char_xyz789', status: 'PAID', amount: 999 }, customer: { name: 'Fulana' } } }

  it('passa ao service SÓ o id do evento, o tipo e o id da cobrança (status, valor e cliente do corpo ficam de fora)', async () => {
    const r = await enviar(completo)
    assert.equal(r.status, 200)
    assert.deepEqual(avisos.mock.calls.map((c) => c.arguments), [['log_abc123', 'transparent.completed', 'pix_char_xyz789']])
  })
  it('refunded também é processado; checkout.completed e evento desconhecido só são confirmados', async () => {
    await enviar({ ...completo, event: 'transparent.refunded' })
    await enviar({ ...completo, event: 'checkout.completed' })
    await enviar({ ...completo, event: 'outro' })
    assert.deepEqual(avisos.mock.calls.map((c) => c.arguments[1]), ['transparent.refunded'])
  })
  for (const [descricao, corpo] of [
    ['sem id do evento', { ...completo, id: undefined }],
    ['id do evento fora do padrão', { ...completo, id: 'log_abc\n' }],
    ['id do evento sem log_', { ...completo, id: 'abc123' }],
    ['sem data', { ...completo, data: undefined }],
    ['cobrança fora do padrão', { ...completo, data: { transparent: { id: 'bill_123' } } }],
    ['cobrança em array', { ...completo, data: { transparent: [{ id: 'pix_char_x' }] } }],
    ['cobrança grande demais', { ...completo, data: { transparent: { id: `pix_char_${'a'.repeat(92)}` } } }],
  ]) {
    it(`${descricao} → 200 ignorado, sem chamar o service, log curto sem os ids`, async () => {
      const r = await enviar(corpo)
      assert.equal(r.status, 200)
      assert.equal(avisos.mock.callCount(), 0)
      const texto = logs.mock.calls.map((c) => c.arguments.join(' ')).join('\n')
      assert.match(texto, /\[webhook\] transparent\.completed sem o id do evento ou da cobrança; ignorado/)
      assert.equal(/log_|pix_char|bill_|Fulana/.test(texto), false)
    })
  }
  it('assinatura errada → 401 sem chamar o service', async () => {
    const r = await enviar(completo, { assinatura: 'errada' })
    assert.equal(r.status, 401)
    assert.equal(avisos.mock.callCount(), 0)
  })
  it('o service falhou → 500 genérico (a AbacatePay reenvia), sem a mensagem interna', async () => {
    avisos.mock.mockImplementation(async () => { throw new Error('Falha ao processar o aviso do gateway.') })
    const r = await enviar(completo)
    assert.equal(r.status, 500)
    assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
  })
})

describe('POST /api/vendas/:id/pagamentos — guardas antes do banco (#44)', () => {
  let servidor, base
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}/api`
  })
  after(async () => { await new Promise((r) => servidor.close(r)) })
  afterEach(() => mock.restoreAll())

  it('sem Origin → 403 e sem login → 401, sem chamar o service', async () => {
    const gerar = mock.method(pagamentoService, 'gerarPix', async () => { throw new Error('não devia chamar') })
    const semOrigem = await fetch(`${base}/vendas/1/pagamentos`, { method: 'POST' })
    assert.equal(semOrigem.status, 403)
    const semLogin = await fetch(`${base}/vendas/1/pagamentos`, { method: 'POST', headers: { Origin: env.corsOrigin } })
    assert.equal(semLogin.status, 401)
    assert.equal(gerar.mock.callCount(), 0)
  })
})
