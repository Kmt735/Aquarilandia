import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'

describe('GET /api/produtos — filtros técnicos HTTP', () => {
  let servidor
  let origem
  before(async () => {
    servidor = app.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })

  for (const [query, parametros] of [
    ['tipo_agua=doce', ['doce', null, null, null, null, null, null]],
    ['tipo_agua=salobra', ['salobra', null, null, null, null, null, null]],
    ['tipo_agua=marinho', ['marinho', null, null, null, null, null, null]],
    ['volume_min=60&volume_max=60', [null, 60, 60, null, null, null, null]],
    ['volume_min=1&volume_max=2147483647&vazao_min=2147483647', [null, 1, 2147483647, 2147483647, null, null, null]],
    ['vazao_min=400', [null, null, null, 400, null, null, null]],
    ['indicado_plantado=true', [null, null, null, null, true, null, null]],
    ['indicado_plantado=false', [null, null, null, null, false, null, null]],
    ['precisa_co2=false&iluminacao=baixa', [null, null, null, null, null, false, 'baixa']],
    ['precisa_co2=true&iluminacao=media', [null, null, null, null, null, true, 'media']],
    ['iluminacao=alta', [null, null, null, null, null, null, 'alta']],
  ]) {
    it(`parametriza ${query}`, async () => {
      const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 3 }] }))
      const resposta = await fetch(`${origem}/api/produtos?${query}`)
      assert.equal(resposta.status, 200)
      assert.deepEqual(await resposta.json(), { itens: [], total: 3 })
      assert.deepEqual(consulta.mock.calls[0].arguments[1], [null, null, null, null, 20, 0, ...parametros])
    })
  }

  it('combina filtros técnicos com categoria, busca, preços, ordem e paginação', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 2 }] }))
    const query = new URLSearchParams({
      categoria: 'aquarios', busca: 'Aquario', preco_min: '10000', preco_max: '20000',
      tipo_agua: 'doce', volume_min: '60', volume_max: '100', ordem: '-preco', pagina: '2', limite: '1',
    })
    const resposta = await fetch(`${origem}/api/produtos?${query}`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(consulta.mock.calls[0].arguments[1],
      ['aquarios', '%Aquario%', 10000, 20000, 1, 1, 'doce', 60, 100, null, null, null, null])
  })

  const invalidos = [
    ['tipo_agua=ambos', 'tipo_agua'], ['tipo_agua=salgada', 'tipo_agua'], ['tipo_agua=', 'tipo_agua'],
    ['tipo_agua=doce&tipo_agua=marinho', 'tipo_agua'], ["tipo_agua=doce'%20OR%20true--", 'tipo_agua'],
    ['volume_min=0', 'volume_min'], ['volume_min=-1', 'volume_min'], ['volume_min=60.5', 'volume_min'],
    ['volume_min=01', 'volume_min'], ['volume_min=1e2', 'volume_min'], ['volume_min=abc', 'volume_min'],
    ['volume_min=2147483648', 'volume_min'], ['volume_min=1&volume_min=2', 'volume_min'],
    ['volume_max=', 'volume_max'], ['volume_max=Infinity', 'volume_max'], ['volume_max=0', 'volume_max'],
    ['volume_min=61&volume_max=60', 'volume_max'],
    ['vazao_min=0', 'vazao_min'], ['vazao_min=-1', 'vazao_min'], ['vazao_min=399.5', 'vazao_min'],
    ['vazao_min=2147483648', 'vazao_min'], ['vazao_min=NaN', 'vazao_min'],
    ['indicado_plantado=1', 'indicado_plantado'], ['indicado_plantado=FALSE', 'indicado_plantado'],
    ['indicado_plantado=', 'indicado_plantado'], ['indicado_plantado=false&indicado_plantado=true', 'indicado_plantado'],
    ['precisa_co2=0', 'precisa_co2'], ['precisa_co2=', 'precisa_co2'], ['precisa_co2[]=false', 'precisa_co2[]'],
    ['precisa_co2=true&precisa_co2=false', 'precisa_co2'],
    ['iluminacao=led', 'iluminacao'], ['iluminacao=', 'iluminacao'], ['iluminacao=alta&iluminacao=baixa', 'iluminacao'],
  ]
  for (const [query, campo] of invalidos) {
    it(`recusa ${query} com 400 antes de consultar o banco`, async () => {
      const consulta = mock.method(db, 'query', async () => { throw new Error('Não deveria consultar') })
      const resposta = await fetch(`${origem}/api/produtos?${query}`)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 400)
      assert.equal(corpo.erro, 'Parâmetros inválidos')
      assert.equal(typeof corpo.detalhes[campo], 'string')
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  it('reúne erros gerais e técnicos sem consultar o banco', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await fetch(`${origem}/api/produtos?preco_min=-1&volume_min=100&volume_max=60&precisa_co2=1`)
    assert.equal(resposta.status, 400)
    assert.deepEqual(Object.keys((await resposta.json()).detalhes).sort(), ['precisa_co2', 'preco_min', 'volume_max'])
    assert.equal(consulta.mock.callCount(), 0)
  })
})
