import assert from 'node:assert/strict'
import { afterEach, it, mock } from 'node:test'
import { cepService, conferirEndereco } from '../src/modulos/vendas/cep.service.ts'
import { calcularFrete } from '../src/modulos/vendas/frete.service.ts'
import { configuracaoFrete } from '../src/modulos/vendas/frete.config.ts'
import { env } from '../src/config/env.ts'

afterEach(() => mock.restoreAll())
it('consulta CEP com URL fixa, timeout e cache, sem enviar endereço ou dados de conta', async () => {
  const chamada = mock.method(globalThis, 'fetch', async (url, opcoes) => {
    assert.equal(url, 'https://viacep.com.br/ws/36307000/json/')
    assert.ok(opcoes.signal instanceof AbortSignal)
    assert.equal(opcoes.body, undefined)
    return new Response(JSON.stringify({ cep: '36307-000', localidade: 'São João del Rei', uf: 'MG', ibge: '3162500' }))
  })
  const destino = await cepService.consultar('36307000')
  assert.equal(destino.municipioIbge, '3162500')
  await cepService.consultar('36307000')
  assert.equal(chamada.mock.callCount(), 1)
  conferirEndereco(destino, { cep: '36307000', cidade: 'Sao Joao del-Rei', uf: 'MG' })
  for (const campos of [{ cidade: 'São Paulo', uf: 'SP' }, { cidade: 'São João del Rei', uf: 'SP' }]) {
    assert.throws(() => conferirEndereco(destino, { cep: '36307000', ...campos }), (err) => err.statusCode === 422)
  }
})
it('município consultado prevalece sobre a antiga faixa numérica na regra dos peixes', () => {
  assert.throws(() => calcularFrete({ cep: '36300000', municipioIbge: '3550308', retirada: false,
    itens: [{ categoria: 'peixes' }], subtotal: 1000 }), (err) => err.statusCode === 422)
  assert.equal(calcularFrete({ cep: '36340000', municipioIbge: '3162500', retirada: false,
    itens: [{ categoria: 'peixes' }], subtotal: 1000 }).tipoEntrega, 'propria')
})
it('falha do provedor e CEP inexistente não autorizam entrega por fallback', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new Error('timeout sintético') })
  await assert.rejects(cepService.consultar('01001000'), (err) => err.statusCode === 503)
  mock.restoreAll()
  mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ erro: true })))
  await assert.rejects(cepService.consultar('99999999'), (err) => err.statusCode === 422)
})
it('produção sem tabela aprovada bloqueia entrega e permite retirada sem cobrança de frete', () => {
  const anterior = env.nodeEnv
  try {
    env.nodeEnv = 'production'
    assert.throws(() => configuracaoFrete(false), (err) => err.statusCode === 503)
    assert.ok(configuracaoFrete(true))
  } finally { env.nodeEnv = anterior }
})
