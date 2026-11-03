import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { env } from '../src/config/env.ts'
import { verificarWebhook } from '../src/modulos/pagamentos/webhook.ts'

// Segredo de teste definido aqui (o do .env nunca é lido). A chave pública é a publicada pela AbacatePay
// (https://docs.abacatepay.com/pages/webhooks/security), copiada à parte para conferir a constante do código.
const segredo = 'segredo-de-teste-do-webhook-123'
const chavePublica = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
const original = env.gatewayWebhookSecret
const corpoValido = Buffer.from('{"id":"log_abc","event":"transparent.completed","data":{"transparent":{"id":"pix_char_x"}}}')
const assinar = (corpo) => createHmac('sha256', chavePublica).update(corpo).digest('base64')

// Request mínimo: só o que o verificarWebhook usa (query, rawBody e get de header, sem diferenciar maiúsculas)
// ('chave' in opcoes, e não valor padrão: assim dá para pedir explicitamente rawBody ou assinatura undefined)
function pedido(opcoes = {}) {
  const query = 'query' in opcoes ? opcoes.query : { webhookSecret: segredo }
  const rawBody = 'rawBody' in opcoes ? opcoes.rawBody : corpoValido
  const assinatura = 'assinatura' in opcoes ? opcoes.assinatura : assinar(corpoValido)
  const headers = assinatura === undefined ? {} : { 'x-webhook-signature': assinatura }
  return { query, rawBody, get: (nome) => headers[nome.toLowerCase()] }
}
let erros

beforeEach(() => {
  env.gatewayWebhookSecret = segredo
  erros = mock.method(console, 'error', () => {})
})
afterEach(() => {
  mock.restoreAll()
  env.gatewayWebhookSecret = original
})

describe('Webhook AbacatePay — verificarWebhook (#45)', () => {
  it('segredo e assinatura válidos → true', () => {
    assert.equal(verificarWebhook(pedido()), true)
  })

  for (const [descricao, query] of [
    ['segredo errado', { webhookSecret: 'outro-segredo' }],
    ['segredo com um caractere a mais', { webhookSecret: `${segredo}x` }],
    ['segredo vazio', { webhookSecret: '' }],
    ['segredo ausente', {}],
    ['segredo repetido (array)', { webhookSecret: [segredo, segredo] }],
    ['segredo como objeto', { webhookSecret: { valor: segredo } }],
  ]) {
    it(`${descricao} → false`, () => assert.equal(verificarWebhook(pedido({ query })), false))
  }

  it('assinatura de outro corpo → false', () => {
    assert.equal(verificarWebhook(pedido({ assinatura: assinar(Buffer.from('{"id":"log_outro"}')) })), false)
  })
  it('assinatura com 1 caractere trocado → false', () => {
    const certa = assinar(corpoValido)
    const trocada = (certa[0] === 'A' ? 'B' : 'A') + certa.slice(1)
    assert.equal(verificarWebhook(pedido({ assinatura: trocada })), false)
  })
  it('assinatura com tamanho diferente → false (sem lançar)', () => {
    assert.equal(verificarWebhook(pedido({ assinatura: assinar(corpoValido).slice(0, -1) })), false)
    assert.equal(verificarWebhook(pedido({ assinatura: `${assinar(corpoValido)}=` })), false)
  })
  it('sem o header ou com ele vazio → false', () => {
    assert.equal(verificarWebhook(pedido({ assinatura: undefined })), false)
    assert.equal(verificarWebhook(pedido({ assinatura: '' })), false)
  })
  it('corpo re-serializado (mesmo JSON, bytes diferentes) → false', () => {
    const comEspacos = Buffer.from('{ "id": "log_abc", "event": "transparent.completed" }')
    const reserializado = Buffer.from(JSON.stringify(JSON.parse(comEspacos.toString())))
    assert.equal(verificarWebhook(pedido({ rawBody: comEspacos, assinatura: assinar(comEspacos) })), true)
    assert.equal(verificarWebhook(pedido({ rawBody: comEspacos, assinatura: assinar(reserializado) })), false)
  })
  it('assinatura com a chave errada (ex.: o próprio segredo) → false', () => {
    const outra = createHmac('sha256', segredo).update(corpoValido).digest('base64')
    assert.equal(verificarWebhook(pedido({ assinatura: outra })), false)
  })
  it('rawBody ausente (ou em texto) → false', () => {
    assert.equal(verificarWebhook(pedido({ rawBody: undefined })), false)
    assert.equal(verificarWebhook(pedido({ rawBody: corpoValido.toString() })), false)
  })
  it('segredo do .env vazio → false mesmo com tudo "certo", e avisa uma vez só', () => {
    for (const vazio of [undefined, '']) {
      env.gatewayWebhookSecret = vazio
      for (const query of [{ webhookSecret: segredo }, { webhookSecret: '' }, {}]) {
        assert.equal(verificarWebhook(pedido({ query })), false)
      }
    }
    const avisos = erros.mock.calls.filter((c) => c.arguments[0] === '[webhook] GATEWAY_WEBHOOK_SECRET ausente')
    assert.equal(avisos.length, 1)
  })
  it('nada do segredo ou do corpo vai para o log', () => {
    verificarWebhook(pedido({ query: { webhookSecret: 'tentativa-errada' } }))
    const texto = erros.mock.calls.map((c) => c.arguments.join(' ')).join('\n')
    for (const parte of [segredo, 'tentativa-errada', 'log_abc']) assert.equal(texto.includes(parte), false)
  })
})
