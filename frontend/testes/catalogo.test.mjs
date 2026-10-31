import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { criarCatalogo } from '../src/services/catalogo.js'
import { consultarApi } from '../src/services/api-publica.js'
import { imagemSegura, linhasFicha } from '../src/services/catalogo-mapeamento.js'
import { subtotalEmCentavos } from '../src/utils/dinheiro.js'
import { urlItem } from '../src/utils/rotas.js'

const categorias = [{ id: 1, nome: 'Peixes', slug: 'peixes' }, { id: 2, nome: 'Aquários', slug: 'aquarios' }]
const produto = (id = 1, dados = {}) => ({ id, nome: `Produto ${id}`, categoriaId: 2, categoria: 'aquarios', descricao: null, marca: null, preco: 12345, imagemUrl: null, emEstoque: true, ...dados })
const ficha = { tipo: 'peixes', dados: { nomeCientifico: 'Espécie real', tipoAgua: 'doce', tempMinC: 24, tempMaxC: 28, phMin: 6, phMax: 7, tamanhoAdultoCm: 5, aquarioMinLitros: 40, dificuldade: 'iniciante', temperamento: 'pacifico' } }
const fetchOriginal = globalThis.fetch

afterEach(() => { globalThis.fetch = fetchOriginal })

function catalogoCom(consulta) {
  return criarCatalogo((caminho, params) => caminho === '/categorias' ? Promise.resolve({ itens: categorias, total: 2 }) : consulta(caminho, params))
}

test('listagem respeita o total do servidor e preserva ID numérico, centavos e ausências', async () => {
  const api = catalogoCom(async (rota, params) => {
    assert.equal(rota, '/produtos')
    assert.deepEqual(params, { busca: 'aquário', categoria: 'aquarios', preco_min: 5000, preco_max: 19999, ordem: 'preco', pagina: 2, limite: 9 })
    return { itens: [produto(19)], total: 25 }
  })
  const resultado = await api.listarProdutos({ categoria: 'Aquários', busca: ' aquário ', preco: '50-200', ordem: 'menor-preco', pagina: '2' })
  assert.equal(resultado.total, 25)
  assert.equal(resultado.totalPaginas, 3)
  assert.equal(resultado.pagina, 2)
  const p = resultado.itens[0]
  assert.equal(p.id, 19)
  assert.equal(p.preco, 12345)
  assert.equal(p.centavos, true)
  assert.equal(p.categoria, 'Aquários')
  assert.equal(p.estoque, null)
  assert.equal(p.ficha, null)
  assert.equal(p.fichaTecnica, null)
  assert.deepEqual(p.imagens, [])
  assert.equal(urlItem(p), '/loja/19')
})

test('detalhe consulta o mesmo ID e traduz ficha real de peixe sem inventar convivência', async () => {
  const api = catalogoCom(async (rota) => {
    assert.equal(rota, '/peixes/12')
    return produto(12, { categoriaId: 1, categoria: 'peixes', ficha, emEstoque: false })
  })
  const p = await api.obterPeixe('12')
  assert.equal(p.id, 12)
  assert.equal(p.preco, 12345)
  assert.equal(p.ficha.temperatura, '24–28 °C')
  assert.equal(p.ficha.ph, '6–7')
  assert.equal(p.cientifico, 'Espécie real')
  assert.equal(p.disponibilidade, 'esgotado')
  assert.equal(p.estoque, 0)
  assert.deepEqual(p.combinaCom, [])
  assert.equal(urlItem(p), '/peixes/12')
})

test('categoria peixes sem ficha na loja aponta ao detalhe genérico, sem inventar atalho', async () => {
  const p = await catalogoCom(async () => produto(8, { categoria: 'peixes', ficha: null })).obterProduto(8)
  assert.equal(urlItem(p), '/loja/8')
  assert.equal(p.entregaLocal, true)
})

test('todas as páginas de categorias são consultadas, incluindo categorias desconhecidas da UI', async () => {
  const chamadas = []
  const api = criarCatalogo(async (rota, params) => {
    chamadas.push([rota, params.pagina])
    return params.pagina === 1 ? { itens: categorias, total: 3 } : { itens: [{ id: 15, nome: 'Novidade', slug: 'novidade' }], total: 3 }
  })
  assert.equal((await api.listarCategorias()).length, 3)
  assert.deepEqual(chamadas, [['/categorias', 1], ['/categorias', 2]])
})

test('disponibilidade local considera páginas posteriores, mantém total filtrado e desempata por ID', async () => {
  const chamadas = []
  const api = catalogoCom(async (_, params) => {
    chamadas.push(params)
    return params.pagina === 1 ? { itens: [produto(4, { nome: 'Mesmo', emEstoque: false }), produto(3, { nome: 'Mesmo' })], total: 4 }
      : { itens: [produto(2, { nome: 'Mesmo' }), produto(1, { nome: 'Mesmo' })], total: 4 }
  })
  const lista = await api.listarProdutos({ disponibilidade: 'in', ordem: 'z-a', limite: 2, pagina: 2 })
  assert.equal(lista.total, 3)
  assert.deepEqual(lista.itens.map((i) => i.id), [3])
  assert.equal(chamadas.length, 2)
  assert.ok(chamadas.every((p) => !('disponibilidade' in p)))
})

test('filtros reais de peixes são enviados; faixa de preço e ordem ficam locais sobre conjunto completo', async () => {
  const api = catalogoCom(async (rota, params) => {
    assert.equal(rota, '/peixes')
    assert.deepEqual(params, { busca: 'espécie', tipo_agua: 'marinho', temperamento: 'pacifico', dificuldade: 'iniciante', pagina: 1, limite: 100 })
    return { itens: [produto(4, { preco: 4999 }), produto(2, { preco: 5000 }), produto(1, { preco: 19999 }), produto(3, { preco: 20000 })], total: 4 }
  })
  const r = await api.listarPeixes({ busca: 'espécie', agua: 'marinho', temperamento: 'pacifico', dificuldade: 'iniciante', preco: '50-200', ordem: 'maior-preco' })
  assert.deepEqual(r.itens.map((p) => p.id), [1, 2])
  assert.equal(r.total, 2)
})

test('lista vazia mantém envelope e erros não retornam dados fictícios', async () => {
  const api = catalogoCom(async () => ({ itens: [], total: 0 }))
  assert.equal((await api.listarProdutos()).itens.length, 0)
  await assert.rejects(catalogoCom(async () => { throw new Error('Indisponível') }).listarPeixes(), /Indisponível/)
  await assert.rejects(catalogoCom(async () => []).listarProdutos(), { status: 502 })
  await assert.rejects(catalogoCom(async () => ({ itens: [produto(1, { preco: 12.5 })], total: 1 })).listarProdutos(), { status: 502 })
})

for (const filtros of [{ pagina: 0 }, { limite: 0 }, { pagina: '0' }, { pagina: '-1' }, { limite: 101 }, { ordem: 'sql' }, { preco: 'livre' }, { disponibilidade: 'talvez' }]) {
  test(`filtro inválido é recusado: ${JSON.stringify(filtros)}`, async () => {
    await assert.rejects(catalogoCom(async () => assert.fail('Não deve consultar produtos')).listarProdutos(filtros), { status: 400 })
  })
}
for (const id of ['betta', '01', '0', '-1', '1e2', '2147483648', '']) {
  test(`ID inválido não gera consulta: ${JSON.stringify(id)}`, async () => {
    await assert.rejects(criarCatalogo(async () => assert.fail('Não deve consultar API')).obterProduto(id), { status: 400 })
  })
}

test('ficha pública usa lista de campos permitidos e preserva booleanos e nulos', () => {
  assert.deepEqual(linhasFicha(null), [])
  assert.deepEqual(linhasFicha({ tipo: 'plantas', dados: { precisaCo2: false, crescimento: null, segredo: 'não mostrar' } }), [['Precisa de CO₂', 'Não'], ['Crescimento', 'Não informado']])
})

test('imagens aceitam HTTP(S) e caminhos locais, bloqueiam esquemas e credenciais', () => {
  for (const url of [null, 'javascript:alert(1)', 'data:image/svg+xml,x', '//evil.test/x', '/\\evil.test/x', 'https://u:senha@site.test/x', '/x\ny']) assert.equal(imagemSegura(url), null)
  assert.equal(imagemSegura('/imagens/a.jpg'), '/imagens/a.jpg')
  assert.equal(imagemSegura('https://site.test/a.jpg'), 'https://site.test/a.jpg')
})

test('fronteira de apresentação mantém valores corretos para itens novos e carrinhos legados', () => {
  assert.equal(subtotalEmCentavos([{ preco: 12345, centavos: true, qtd: 2 }, { preco: 10.5, qtd: 1 }]), 25740)
})

test('HTTP usa apenas API pública e não envia credenciais', async () => {
  globalThis.fetch = async (url, opcoes) => {
    assert.equal(url, '/api/produtos?busca=a%26b&pagina=2')
    assert.equal(opcoes.credentials, 'omit')
    assert.deepEqual(opcoes.headers, { Accept: 'application/json' })
    return Response.json({ itens: [], total: 0 })
  }
  assert.deepEqual(await consultarApi('/produtos', { busca: 'a&b', pagina: 2, limite: undefined }), { itens: [], total: 0 })
})
for (const status of [400, 404, 500]) {
  test(`HTTP ${status} preserva status e oculta detalhes internos`, async () => {
    globalThis.fetch = async () => Response.json({ erro: 'senha-do-banco', detalhes: { stack: 'interno' } }, { status })
    await assert.rejects(consultarApi('/produtos'), (erro) => erro.status === status && !JSON.stringify(erro).includes('senha-do-banco'))
  })
}
test('HTTP diferencia rede indisponível e JSON inválido sem fallback', async () => {
  globalThis.fetch = async () => { throw new TypeError('network') }
  await assert.rejects(consultarApi('/categorias'), { status: 0 })
  globalThis.fetch = async () => new Response('<html>proxy</html>')
  await assert.rejects(consultarApi('/categorias'), { status: 502 })
})
