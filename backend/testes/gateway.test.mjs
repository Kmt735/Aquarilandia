import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { env } from '../src/config/env.ts'
import {
  consultarCobranca,
  consultarStatusCobranca,
  criarCobrancaPix,
  estornar,
  simularPagamentoPix,
} from '../src/modulos/pagamentos/gateway.ts'
import { AppError } from '../src/utils/AppError.ts'

// Sem rede: o globalThis.fetch é trocado por uma função falsa em cada teste e restaurado depois.
// O token é fictício e definido aqui; o do .env nunca é lido (npm test não carrega o .env).
const token = 'tok_FICTICIO_DE_TESTE_9f8e7d'
const original = { fetch: globalThis.fetch, token: env.gatewayAccessToken, nodeEnv: env.nodeEnv }
const msg502 = 'Não foi possível falar com o pagamento agora. Tente de novo em instantes.'
let chamadas, logs

function responder(corpo, status = 200) {
  globalThis.fetch = async (url, opcoes) => {
    chamadas.push({ url: String(url), opcoes })
    return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
function falharRede(erro = new TypeError('fetch failed')) {
  globalThis.fetch = async (url, opcoes) => { chamadas.push({ url: String(url), opcoes }); throw erro }
}
const ok = (data) => ({ data, success: true, error: null })
const daqui = (minutos) => new Date(Date.now() + minutos * 60_000)
const novaCobranca = (extra = {}) => ({ pagamentoId: 42, vendaId: 7, valor: 12_345, expiraEm: daqui(30), ...extra })
const pix = (extra = {}) => ({
  id: 'pix_char_abc123', amount: 12_345, status: 'PENDING', devMode: true,
  brCode: '00020101021226CODIGO-PIX-FICTICIO', brCodeBase64: 'data:image/png;base64,iVBORw0KGgo=',
  expiresAt: '2026-11-02T20:00:00.000Z', metadata: { vendaId: 7, pagamentoId: 42 }, ...extra,
})
const impresso = () => logs.flatMap((espiao) => espiao.mock.calls.map((c) => c.arguments.join(' '))).join('\n')
const eh502 = (err) => err instanceof AppError && err.statusCode === 502 && err.message === msg502

beforeEach(() => {
  chamadas = []
  env.gatewayAccessToken = token
  env.nodeEnv = 'test'
  globalThis.fetch = async () => { throw new Error('fetch não configurado no teste') }
  logs = ['error', 'info', 'log', 'warn', 'debug'].map((nome) => mock.method(console, nome, () => {}))
})
afterEach(() => {
  mock.restoreAll()
  globalThis.fetch = original.fetch
  env.gatewayAccessToken = original.token
  env.nodeEnv = original.nodeEnv
})

describe('Gateway AbacatePay — criarCobrancaPix (#43)', () => {
  it('monta URL, método, Bearer e body certos, sem customer', async () => {
    responder(ok(pix()))
    const expiraEm = daqui(30)
    const resultado = await criarCobrancaPix(novaCobranca({ expiraEm }))
    assert.equal(chamadas.length, 1)
    const [{ url, opcoes }] = chamadas
    assert.equal(url, 'https://api.abacatepay.com/v2/transparents/create')
    assert.equal(opcoes.method, 'POST')
    assert.equal(opcoes.headers.Authorization, `Bearer ${token}`)
    assert.equal(opcoes.headers['Content-Type'], 'application/json')
    assert.ok(opcoes.signal instanceof AbortSignal, 'toda chamada tem timeout')
    const body = JSON.parse(opcoes.body)
    assert.deepEqual(Object.keys(body).sort(), ['data', 'method'])
    assert.equal(body.method, 'PIX')
    assert.deepEqual(Object.keys(body.data).sort(), ['amount', 'description', 'expiresIn', 'externalId', 'metadata'])
    assert.equal(body.data.amount, 12_345, 'centavos, sem conversão')
    assert.equal(body.data.description, 'Aquarilândia: pedido #7')
    assert.equal(body.data.externalId, 'pagamento-42')
    assert.deepEqual(body.data.metadata, { vendaId: 7, pagamentoId: 42 })
    assert.ok(body.data.expiresIn >= 1799 && body.data.expiresIn <= 1800, 'segundos até expiraEm, para baixo')
    assert.equal('customer' in body.data, false)
    assert.deepEqual(resultado, {
      cobrancaId: 'pix_char_abc123', status: 'pendente', codigoPix: '00020101021226CODIGO-PIX-FICTICIO',
      qrCodeImagem: 'data:image/png;base64,iVBORw0KGgo=', expiraEm: new Date('2026-11-02T20:00:00.000Z'),
    })
    assert.equal(impresso().includes('CODIGO-PIX'), false, 'o código Pix nunca vai para o log')
  })

  it('valor 99 → 422 sem chamar o fetch; 100 é aceito', async () => {
    responder(ok(pix({ amount: 100 })))
    await assert.rejects(criarCobrancaPix(novaCobranca({ valor: 99 })),
      (err) => err instanceof AppError && err.statusCode === 422 && err.message === 'O valor mínimo para pagar com Pix é R$ 1,00.')
    assert.equal(chamadas.length, 0)
    await criarCobrancaPix(novaCobranca({ valor: 100 }))
    assert.equal(chamadas.length, 1)
  })

  for (const [descricao, extra] of [
    ['valor com centavos quebrados', { valor: 100.5 }], ['valor em texto', { valor: '1000' }],
    ['pagamentoId 0', { pagamentoId: 0 }], ['vendaId negativo', { vendaId: -1 }],
    ['expiraEm no passado', { expiraEm: daqui(-1) }], ['expiraEm em 59 s', { expiraEm: new Date(Date.now() + 59_000) }],
    ['expiraEm inválido', { expiraEm: new Date('x') }],
  ]) {
    it(`${descricao} → Error comum sem chamar o fetch`, async () => {
      responder(ok(pix()))
      await assert.rejects(criarCobrancaPix(novaCobranca(extra)), (err) => !(err instanceof AppError))
      assert.equal(chamadas.length, 0)
    })
  }

  it('timeout ou rede fora → 502', async () => {
    for (const erro of [new DOMException('timeout', 'TimeoutError'), new TypeError('fetch failed')]) {
      falharRede(erro)
      await assert.rejects(criarCobrancaPix(novaCobranca()), eh502)
    }
    assert.match(impresso(), /\[gateway\] criar: sem resposta/)
  })

  for (const status of [401, 403, 500, 503]) {
    it(`HTTP ${status} → 502, sem o token na mensagem nem nos logs`, async () => {
      responder({ data: null, success: false, error: 'Token de autenticação inválido ou ausente.' }, status)
      await assert.rejects(criarCobrancaPix(novaCobranca()), (err) => eh502(err) && !err.message.includes(token))
      assert.match(impresso(), new RegExp(`\\[gateway\\] criar: HTTP ${status}`))
      assert.equal(impresso().includes(token), false)
      assert.equal(impresso().includes('Token de autenticação'), false, 'o corpo da resposta não vai para o log')
    })
  }

  for (const [descricao, corpo] of [
    ['success false', { data: pix(), success: false, error: 'algo' }],
    ['success como objeto', { data: pix(), success: { message: 'ok' }, error: null }],
    ['sem brCode', ok(pix({ brCode: undefined }))],
    ['brCode vazio', ok(pix({ brCode: '' }))],
    ['imagem que não é data URL', ok(pix({ brCodeBase64: 'https://exemplo.test/qr.png' }))],
    ['id fora do padrão', ok(pix({ id: 'bill_123' }))],
    ['expiresAt inválido', ok(pix({ expiresAt: 'amanhã' }))],
    ['valor diferente do pedido', ok(pix({ amount: 1 }))],
    ['data nulo', ok(null)],
    ['corpo que não é JSON', null],
  ]) {
    it(`resposta com ${descricao} → 502`, async () => {
      if (corpo === null) {
        globalThis.fetch = async () => new Response('<html>erro</html>', { status: 200 })
      } else {
        responder(corpo)
      }
      await assert.rejects(criarCobrancaPix(novaCobranca()), eh502)
    })
  }

  it('sem GATEWAY_ACCESS_TOKEN → 502 sem chamar a rede', async () => {
    responder(ok(pix()))
    env.gatewayAccessToken = undefined
    await assert.rejects(criarCobrancaPix(novaCobranca()), eh502)
    assert.equal(chamadas.length, 0)
    assert.match(impresso(), /\[gateway\] GATEWAY_ACCESS_TOKEN ausente/)
  })
})

describe('Gateway AbacatePay — mapa de status', () => {
  for (const [daAbacatePay, doProjeto] of [
    ['PENDING', 'pendente'], ['PAID', 'aprovado'], ['APPROVED', 'aprovado'], ['EXPIRED', 'cancelado'],
    ['CANCELLED', 'cancelado'], ['FAILED', 'recusado'], ['REFUNDED', 'estornado'], ['UNDER_DISPUTE', 'em_disputa'],
  ]) {
    it(`${daAbacatePay} → ${doProjeto}`, async () => {
      responder(ok([pix({ status: daAbacatePay })]))
      assert.equal((await consultarCobranca('pix_char_abc123')).status, doProjeto)
    })
  }
  for (const status of ['REDEEMED', 'paid', 'APROVADO', '', null, 'constructor', '__proto__']) {
    it(`status desconhecido ${JSON.stringify(status)} → 502, nunca aprovado`, async () => {
      responder(ok([pix({ status })]))
      await assert.rejects(consultarCobranca('pix_char_abc123'), eh502)
    })
  }
})

describe('Gateway AbacatePay — consultarCobranca', () => {
  it('usa GET /transparents/list?id= e devolve só tipos do projeto', async () => {
    responder(ok([pix({ status: 'PAID', externalId: 'pagamento-42' })]))
    const consulta = await consultarCobranca('pix_char_abc123')
    assert.equal(chamadas[0].url, 'https://api.abacatepay.com/v2/transparents/list?id=pix_char_abc123')
    assert.equal(chamadas[0].opcoes.method, 'GET')
    assert.equal(chamadas[0].opcoes.body, undefined)
    assert.deepEqual(consulta, {
      cobrancaId: 'pix_char_abc123', status: 'aprovado', valor: 12_345, externalId: 'pagamento-42', vendaId: 7, pagamentoId: 42,
    })
  })
  it('metadata em texto numérico é aceito', async () => {
    responder(ok([pix({ metadata: { vendaId: '7', pagamentoId: '42' } })]))
    const consulta = await consultarCobranca('pix_char_abc123')
    assert.equal(consulta.vendaId, 7); assert.equal(consulta.pagamentoId, 42); assert.equal(consulta.externalId, null)
  })
  for (const metadata of [undefined, null, {}, { vendaId: 0 }, { vendaId: -3 }, { vendaId: 1.5 }, { vendaId: '7a' },
    { vendaId: '07' }, { vendaId: true }, { vendaId: [7] }]) {
    it(`metadata inválido ${JSON.stringify(metadata)} → vendaId null`, async () => {
      responder(ok([pix({ metadata })]))
      assert.equal((await consultarCobranca('pix_char_abc123')).vendaId, null)
    })
  }
  for (const [descricao, data] of [
    ['lista vazia', []], ['outra cobrança', [pix({ id: 'pix_char_outra' })]], ['duas iguais', [pix(), pix()]],
    ['data objeto', pix()], ['valor negativo', [pix({ amount: -1 })]], ['valor em texto', [pix({ amount: '100' })]],
  ]) {
    it(`${descricao} → 502`, async () => {
      responder(ok(data))
      await assert.rejects(consultarCobranca('pix_char_abc123'), eh502)
    })
  }
  it('consultarStatusCobranca usa GET /transparents/check?id=', async () => {
    responder(ok({ id: 'pix_char_abc123', status: 'PAID', expiresAt: '2026-11-02T20:00:00.000Z' }))
    assert.equal(await consultarStatusCobranca('pix_char_abc123'), 'aprovado')
    assert.equal(chamadas[0].url, 'https://api.abacatepay.com/v2/transparents/check?id=pix_char_abc123')
    responder(ok({ id: 'pix_char_outra', status: 'PAID' }))
    await assert.rejects(consultarStatusCobranca('pix_char_abc123'), eh502)
  })
})

describe('Gateway AbacatePay — estornar', () => {
  const reembolso = (extra = {}) => ok({ id: 'tran_1', status: 'COMPLETE', amount: 12_345, originalId: 'pix_char_abc123', ...extra })
  it('sucesso → aprovado true, com o motivo no body', async () => {
    responder(reembolso())
    assert.deepEqual(await estornar('pix_char_abc123', 'Pedido cancelado'), { aprovado: true, jaEstornado: false })
    assert.equal(chamadas[0].url, 'https://api.abacatepay.com/v2/transparents/refund')
    assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), { id: 'pix_char_abc123', reason: 'Pedido cancelado' })
  })
  it('sem motivo → body só com o id', async () => {
    responder(reembolso())
    await estornar('pix_char_abc123')
    assert.deepEqual(JSON.parse(chamadas[0].opcoes.body), { id: 'pix_char_abc123' })
  })
  it('"Esta cobrança já foi reembolsada." → aprovado e jaEstornado', async () => {
    responder({ data: null, success: false, error: 'Esta cobrança já foi reembolsada.' }, 400)
    assert.deepEqual(await estornar('pix_char_abc123'), { aprovado: true, jaEstornado: true })
  })
  for (const [descricao, preparar, erro] of [
    ['HTTP 500', () => responder({ data: null, success: false, error: 'Internal' }, 500), 'HTTP 500'],
    ['código de erro da API', () => responder({ data: null, success: false, error: 'INSUFFICIENT_FUNDS' }, 400), 'INSUFFICIENT_FUNDS'],
    ['texto livre no erro', () => responder({ data: null, success: false, error: 'Cliente Fulano CPF 123' }, 400), 'HTTP 400'],
    // Resposta real do Dev mode (02/11/2026): o reembolso sai do saldo disponível, e a API manda texto, não o código
    ['"Saldo insuficiente" (resposta real do Dev mode)',
      () => responder({ data: null, success: false, error: 'Saldo insuficiente para realizar o reembolso.' }, 400),
      'INSUFFICIENT_FUNDS'],
    ['rede fora', () => falharRede(), 'sem resposta'],
    ['resposta de outra cobrança', () => responder(reembolso({ originalId: 'pix_char_outra' })), 'resposta inválida'],
    ['success false com 200', () => responder({ data: null, success: false, error: null }), 'resposta inválida'],
  ]) {
    it(`${descricao} → aprovado false com erro curto, sem lançar`, async () => {
      preparar()
      assert.deepEqual(await estornar('pix_char_abc123'), { aprovado: false, jaEstornado: false, erro })
    })
  }
  it('sem chave → aprovado false, sem rede', async () => {
    responder(reembolso())
    env.gatewayAccessToken = ''
    assert.deepEqual(await estornar('pix_char_abc123'), { aprovado: false, jaEstornado: false, erro: 'sem chave' })
    assert.equal(chamadas.length, 0)
  })
  it('motivo com 501 caracteres → Error sem rede; 500 é aceito', async () => {
    responder(reembolso())
    await assert.rejects(estornar('pix_char_abc123', 'a'.repeat(501)), /500 caracteres/)
    assert.equal(chamadas.length, 0)
    assert.equal((await estornar('pix_char_abc123', 'a'.repeat(500))).aprovado, true)
  })
})

describe('Gateway AbacatePay — ids e Dev mode', () => {
  for (const id of ['pix_char_1&x=2', '../x', 'pix_char_', 'pix_char_abc/../../v1', 'pix_char_abc?id=outro',
    'card_abc', 'pix_char_abc\n', ' pix_char_abc', 123, null]) {
    it(`id fora do padrão ${JSON.stringify(id)} → Error sem chamar o fetch`, async () => {
      responder(ok([pix()]))
      await assert.rejects(consultarCobranca(id), (err) => !(err instanceof AppError) && /pix_char_/.test(err.message))
      await assert.rejects(consultarStatusCobranca(id), (err) => !(err instanceof AppError))
      await assert.rejects(estornar(id), (err) => !(err instanceof AppError))
      await assert.rejects(simularPagamentoPix(id), (err) => !(err instanceof AppError))
      assert.equal(chamadas.length, 0)
    })
  }
  it('simularPagamentoPix usa POST /transparents/simulate-payment?id=', async () => {
    responder(ok(pix({ status: 'PAID' })))
    await simularPagamentoPix('pix_char_abc123')
    assert.equal(chamadas[0].url, 'https://api.abacatepay.com/v2/transparents/simulate-payment?id=pix_char_abc123')
    assert.equal(chamadas[0].opcoes.method, 'POST')
  })
  it('simularPagamentoPix em produção → Error sem chamar o fetch', async () => {
    responder(ok(pix()))
    env.nodeEnv = 'production'
    await assert.rejects(simularPagamentoPix('pix_char_abc123'), /fora de produção/)
    assert.equal(chamadas.length, 0)
  })
  it('simularPagamentoPix com HTTP 403 → 502', async () => {
    responder({ data: null, success: false, error: 'Forbidden' }, 403)
    await assert.rejects(simularPagamentoPix('pix_char_abc123'), eh502)
  })
})
