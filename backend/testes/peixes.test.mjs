import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'

describe('GET /api/peixes e /api/peixes/:id — contrato HTTP', () => {
  let servidor
  let origem
  const peixe = {
    id: 42, categoriaId: 1, categoria: 'peixes', nome: 'Betta', descricao: null, marca: null,
    preco: 2000, imagemUrl: null, emEstoque: false,
    ficha: { tipo: 'peixes', dados: {
      nomeCientifico: 'Betta splendens', origem: null, tipoAgua: 'doce', tamanhoAdultoCm: 6.5,
      tempMinC: 24.5, tempMaxC: 28.5, phMin: 6, phMax: 7.5, aquarioMinLitros: 20,
      temperamento: 'semi_agressivo', nivelNatacao: null, cardumeMinimo: 1, dieta: null, dificuldade: 'iniciante',
    } },
  }

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

  it('lista no envelope itens/total com campos e ficha do produto, usando paginação padrão', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [peixe], total: 1 }] }))
    const resposta = await fetch(`${origem}/api/peixes`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { itens: [peixe], total: 1 })
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [null, null, null, null, null, null, null, null, 20, 0])
  })

  it('parametriza filtros combinados, busca literal e paginação', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 7 }] }))
    const query = new URLSearchParams({
      temperatura: '24.55', ph: '7.25', tamanho_max: '6.5', aquario_litros: '60', dificuldade: 'iniciante',
      temperamento: 'pacifico', tipo_agua: 'doce', busca: "  Betta 100%_! d'água  ", pagina: '2', limite: '5',
    })
    const resposta = await fetch(`${origem}/api/peixes?${query}`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { itens: [], total: 7 })
    const [sql, parametros] = consulta.mock.calls[0].arguments
    assert.deepEqual(parametros, [24.55, 7.25, 6.5, 60, 'iniciante', 'pacifico', 'doce', "%Betta 100!%!_!! d'água%", 5, 5])
    assert.equal(sql.includes("Betta 100%_! d'água"), false)
  })

  for (const query of [
    'temperatura=-999.9&ph=0&tamanho_max=0.1&aquario_litros=1',
    'temperatura=999.9&ph=14&tamanho_max=9999.9&aquario_litros=2147483647&limite=100',
    'tipo_agua=salobra&dificuldade=avancado&temperamento=agressivo',
    'tipo_agua=marinho&dificuldade=intermediario&temperamento=semi_agressivo',
  ]) {
    it(`aceita os valores válidos ${query}`, async () => {
      mock.method(db, 'query', async () => ({ rows: [{ itens: [], total: 0 }] }))
      assert.equal((await fetch(`${origem}/api/peixes?${query}`)).status, 200)
    })
  }

  it('retorna o mesmo objeto no detalhe de peixes e no detalhe de produtos', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [peixe] }))
    for (const rota of ['peixes', 'produtos']) {
      const resposta = await fetch(`${origem}/api/${rota}/42`)
      assert.equal(resposta.status, 200)
      assert.deepEqual(await resposta.json(), peixe)
    }
    assert.deepEqual(consulta.mock.calls.map((call) => call.arguments[1]), [[42], [42]])
  })

  it('retorna 404 se o ID não corresponder a um peixe público com ficha', async () => {
    mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await fetch(`${origem}/api/peixes/42?incluir_inativos=true`, { headers: { Cookie: 'sid=teste' } })
    assert.equal(resposta.status, 404)
    assert.deepEqual(await resposta.json(), { erro: 'Peixe não encontrado' })
  })

  const invalidos = [
    ['pagina=0', 'pagina'], ['pagina=01', 'pagina'], ['pagina=1.5', 'pagina'], ['pagina=1e2', 'pagina'],
    ['pagina=9007199254740992', 'pagina'], ['pagina=9007199254740991&limite=100', 'pagina'],
    ['pagina=1&pagina=2', 'pagina'], ['pagina[]=1', 'pagina[]'],
    ['limite=0', 'limite'], ['limite=101', 'limite'], ['limite=abc', 'limite'], ['limite=', 'limite'],
    ['temperatura=1000', 'temperatura'], ['temperatura=-1000', 'temperatura'], ['temperatura=NaN', 'temperatura'],
    ['temperatura=Infinity', 'temperatura'], ['temperatura=2e1', 'temperatura'], ['temperatura=24,5', 'temperatura'],
    ['temperatura=', 'temperatura'], ['temperatura=24&temperatura=26', 'temperatura'],
    ['ph=-0.1', 'ph'], ['ph=14.01', 'ph'], ['ph=abc', 'ph'], ['ph=7&ph=8', 'ph'],
    ['tamanho_max=0', 'tamanho_max'], ['tamanho_max=-1', 'tamanho_max'], ['tamanho_max=10000', 'tamanho_max'],
    ['aquario_litros=0', 'aquario_litros'], ['aquario_litros=-1', 'aquario_litros'],
    ['aquario_litros=19.5', 'aquario_litros'], ['aquario_litros=2147483648', 'aquario_litros'],
    ['dificuldade=facil', 'dificuldade'], ['dificuldade=', 'dificuldade'],
    ['temperamento=territorial', 'temperamento'], ['temperamento=pacifico&temperamento=agressivo', 'temperamento'],
    ['tipo_agua=salgada', 'tipo_agua'], ['tipo_agua=doce&tipo_agua=marinho', 'tipo_agua'],
    ['busca=', 'busca'], ['busca=%20%20', 'busca'], ['busca=a&busca=b', 'busca'],
    [`busca=${'a'.repeat(151)}`, 'busca'],
    ['filtros=doce,disp', 'filtros'], ['tipoAgua=doce', 'tipoAgua'], ['categoria=peixes', 'categoria'],
    ['incluir_inativos=true', 'incluir_inativos'], ['ordem=preco', 'ordem'], ['__proto__=1', '__proto__'],
  ]
  for (const [query, campo] of invalidos) {
    it(`recusa ${query.slice(0, 85)} com 400 sem consultar o banco`, async () => {
      const consulta = mock.method(db, 'query', async () => { throw new Error('Não deveria consultar') })
      const resposta = await fetch(`${origem}/api/peixes?${query}`)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 400)
      assert.equal(corpo.erro, 'Parâmetros inválidos')
      assert.equal(typeof corpo.detalhes[campo], 'string')
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  for (const id of ['0', '-1', '1.5', '1e2', '01', ' 1 ', '2147483648', 'betta-splendens', "1' OR true --"]) {
    it(`recusa ID ${id} com 400 sem consultar o banco`, async () => {
      const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
      const resposta = await fetch(`${origem}/api/peixes/${encodeURIComponent(id)}`)
      assert.equal(resposta.status, 400)
      assert.equal(typeof (await resposta.json()).detalhes.id, 'string')
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  it('reúne erros de filtros independentes', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await fetch(`${origem}/api/peixes?ph=15&tipo_agua=errado&tamanho_max=0`)
    assert.equal(resposta.status, 400)
    assert.deepEqual(Object.keys((await resposta.json()).detalhes).sort(), ['ph', 'tamanho_max', 'tipo_agua'])
    assert.equal(consulta.mock.callCount(), 0)
  })

  for (const caminho of ['/peixes', '/peixes/42']) {
    it(`trata falha do banco em ${caminho} sem expor detalhes internos`, async () => {
      mock.method(console, 'error', () => {})
      mock.method(db, 'query', async () => { throw new Error('Falha interna: senha=segredo') })
      const resposta = await fetch(`${origem}/api${caminho}`)
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    })
  }
})
