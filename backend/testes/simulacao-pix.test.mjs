import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { env } from '../src/config/env.ts'
import {
  avisarSimulacaoComChaveDeProducao,
  ehChaveDeTeste,
  simulacaoPixPermitida,
  simularPagamentoPix,
} from '../src/modulos/pagamentos/gateway.ts'

// Lote 13, PASSO 3, sem banco: as duas travas da simulação de Pix (a variável e a chave de teste) e o aviso na subida.
// As chaves são fictícias (só o prefixo importa); o .env nunca é lido.
const original = { token: env.gatewayAccessToken, permitir: env.permitirSimulacaoPix, nodeEnv: env.nodeEnv, fetch: globalThis.fetch }
let chamadas
beforeEach(() => {
  chamadas = []
  globalThis.fetch = async (url, opcoes) => {
    chamadas.push({ url: String(url), opcoes })
    return new Response(JSON.stringify({ success: true, data: { id: 'pix_char_abc123', status: 'PAID' } }), { status: 200 })
  }
})
afterEach(() => {
  mock.restoreAll()
  Object.assign(env, { gatewayAccessToken: original.token, permitirSimulacaoPix: original.permitir, nodeEnv: original.nodeEnv })
  globalThis.fetch = original.fetch
})

describe('simulacaoPixPermitida: as duas travas', () => {
  for (const [permitir, token, esperado] of [
    [false, 'abc_dev_FICTICIA', false],
    [true, 'abc_prod_FICTICIA', false],
    [true, 'FICTICIA_abc_dev_', false],
    [true, undefined, false],
    [true, 'abc_dev_FICTICIA', true],
  ]) {
    it(`PERMITIR_SIMULACAO_PIX=${permitir} e chave ${token === undefined ? 'ausente' : token.slice(0, 9) + '…'} → ${esperado}`, () => {
      Object.assign(env, { permitirSimulacaoPix: permitir, gatewayAccessToken: token })
      assert.equal(simulacaoPixPermitida(), esperado)
      assert.equal(ehChaveDeTeste(), typeof token === 'string' && token.startsWith('abc_dev_'))
    })
  }
})

describe('simularPagamentoPix em produção', () => {
  it('com as duas travas → chama o simulate-payment', async () => {
    Object.assign(env, { nodeEnv: 'production', permitirSimulacaoPix: true, gatewayAccessToken: 'abc_dev_FICTICIA' })
    await simularPagamentoPix('pix_char_abc123')
    assert.equal(chamadas.length, 1)
    assert.match(chamadas[0].url, /\/transparents\/simulate-payment\?id=pix_char_abc123$/)
  })
  for (const [descricao, ajuste] of [
    ['sem a variável', { permitirSimulacaoPix: false, gatewayAccessToken: 'abc_dev_FICTICIA' }],
    ['com a chave de produção', { permitirSimulacaoPix: true, gatewayAccessToken: 'abc_prod_FICTICIA' }],
  ]) {
    it(`${descricao} → Error, sem chamar o fetch`, async () => {
      Object.assign(env, { nodeEnv: 'production', ...ajuste })
      await assert.rejects(simularPagamentoPix('pix_char_abc123'), /fora de produção/)
      assert.equal(chamadas.length, 0)
    })
  }
})

describe('aviso na subida', () => {
  it('PERMITIR_SIMULACAO_PIX=true com uma chave que não é de teste → console.error, sem a chave', () => {
    const log = mock.method(console, 'error', () => {})
    Object.assign(env, { permitirSimulacaoPix: true, gatewayAccessToken: 'abc_prod_CHAVE_FICTICIA_123' })
    avisarSimulacaoComChaveDeProducao()
    assert.deepEqual(log.mock.calls.map((c) => c.arguments),
      [['[gateway] PERMITIR_SIMULACAO_PIX=true com uma chave que não é de teste: a simulação fica desligada']])
  })
  it('com a chave de teste, ou com a variável desligada → nenhum aviso', () => {
    const log = mock.method(console, 'error', () => {})
    for (const ajuste of [{ permitirSimulacaoPix: true, gatewayAccessToken: 'abc_dev_X' }, { permitirSimulacaoPix: false, gatewayAccessToken: 'abc_prod_X' }]) {
      Object.assign(env, ajuste)
      avisarSimulacaoComChaveDeProducao()
    }
    assert.equal(log.mock.callCount(), 0)
  })
})
