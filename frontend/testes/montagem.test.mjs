import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  aquarioDaMontagem, avisosDaMontagem, CHAVE_MONTAGEM, ETAPAS, lerMontagemSalva, linhasDaMontagem, mensagemWhatsApp, montagemVazia,
  ordenarPorRecomendacao, recomendado, totaisDaMontagem,
} from '../src/lib/montagem.js'
import { criarCatalogo } from '../src/services/catalogo.js'
import { consultarMock } from '../src/mocks/catalogo-api.js'
import { linkWhatsApp } from '../src/data/contato.js'

const rotulos = { aquario: 'Aquário', equipamentos: 'Equipamentos', substrato: 'Substrato', decoracao: 'Decoração', plantas: 'Plantas', peixes: 'Peixes' }
const item = (id, categoriaSlug, preco, dados, extra = {}) => ({ id, nome: `Item ${id}`, categoriaSlug, preco, centavos: true, emEstoque: true, fichaTecnica: { tipo: categoriaSlug, dados }, ...extra })
const tanque = item(1, 'aquarios', 24990, { volumeLitros: 40, comprimentoCm: 50, larguraCm: 25, alturaCm: 32, tipoAgua: 'ambos' })
const filtro = item(2, 'filtros', 8990, { aquarioMaxLitros: 60 })
const filtroPequeno = item(3, 'filtros', 4990, { aquarioMaxLitros: 30 })
const neon = item(4, 'peixes', 890, { tipoAgua: 'doce', tempMinC: 24, tempMaxC: 29, aquarioMinLitros: 40, temperamento: 'pacifico', tamanhoAdultoCm: 4, cardumeMinimo: 6 })
const porId = new Map([tanque, filtro, filtroPequeno, neon].map((i) => [i.id, i]))

function montagem(escolhas, extra = {}) {
  const m = montagemVazia()
  return { ...m, ...extra, escolhas: { ...m.escolhas, ...escolhas } }
}

test('progresso salvo: chave versionada e leitura defensiva', () => {
  assert.equal(CHAVE_MONTAGEM, 'aquarilandia-monte-aquario-v1')
  assert.deepEqual(lerMontagemSalva(null), montagemVazia())
  assert.deepEqual(lerMontagemSalva('{quebrado'), montagemVazia())
  assert.deepEqual(lerMontagemSalva(JSON.stringify({ versao: 99, escolhas: {} })), montagemVazia())
  const lido = lerMontagemSalva(JSON.stringify({
    versao: 1, etapa: 3, concluidas: ['aquario', 'xpto'], aquarioProprio: { litros: 80, tipoAgua: 'doce' },
    escolhas: { aquario: [{ id: 1, qtd: 5 }, { id: 9, qtd: 1 }], peixes: [{ id: 4, qtd: 500 }, { id: 'x', qtd: 1 }, { id: 5, qtd: 0 }] },
  }))
  assert.equal(lido.etapa, 3)
  assert.deepEqual(lido.concluidas, ['aquario'])
  assert.deepEqual(lido.escolhas.aquario, [{ id: 1, qtd: 1 }])
  assert.deepEqual(lido.escolhas.peixes, [{ id: 4, qtd: 99 }])
  assert.deepEqual(Object.keys(lido.escolhas), ETAPAS)
})

test('linhas, totais em centavos e IDs que saíram do catálogo', () => {
  const m = montagem({ aquario: [{ id: 1, qtd: 1 }], equipamentos: [{ id: 2, qtd: 2 }, { id: 777, qtd: 1 }], peixes: [{ id: 4, qtd: 6 }] })
  const linhas = linhasDaMontagem(m, porId)
  assert.deepEqual(linhas.equipamentos.map((l) => l.id), [2])
  const totais = totaisDaMontagem(linhas)
  assert.equal(totais.porEtapa.equipamentos, 17980)
  assert.equal(totais.porEtapa.peixes, 5340)
  assert.equal(totais.total, 24990 + 17980 + 5340)
})

test('aquário próprio usa litros e água informados e estima as medidas', () => {
  const a = aquarioDaMontagem(montagem({}, { aquarioProprio: { litros: 54, tipoAgua: 'marinho' } }), porId)
  assert.equal(a.proprio, true); assert.equal(a.litros, 54); assert.equal(a.tipoAgua, 'marinho')
  assert.equal(a.medidas.comprimentoCm, 60); assert.equal(a.medidas.estimadas, true)
})

test('recomendados primeiro e avisos a partir das escolhas', () => {
  const m = montagem({ aquario: [{ id: 1, qtd: 1 }], equipamentos: [{ id: 3, qtd: 1 }], peixes: [{ id: 4, qtd: 2 }] })
  const a = aquarioDaMontagem(m, porId)
  assert.equal(recomendado(filtro, a), true)
  assert.equal(recomendado(filtroPequeno, a), false)
  assert.deepEqual(ordenarPorRecomendacao([filtroPequeno, filtro], a).map((i) => i.id), [2, 3])
  const avisos = avisosDaMontagem(a, linhasDaMontagem(m, porId))
  assert.deepEqual(avisos.map((x) => x.id).sort(), ['cardume-4', 'filtro-3', 'sem-aquecedor'])
})

test('o nome do produto prevalece sobre o campo nome da ficha (plantas)', () => {
  const planta = item(8, 'plantas', 2990, { nome: 'Glossostigma elatinoides', tempMinC: 22, tempMaxC: 26 }, { nome: 'Glossostigma' })
  const mapa = new Map([...porId, [8, planta]])
  const m = montagem({ plantas: [{ id: 8, qtd: 1 }] }, { aquarioProprio: { litros: 60, tipoAgua: 'marinho' } })
  const [aviso] = avisosDaMontagem(aquarioDaMontagem(m, mapa), linhasDaMontagem(m, mapa))
  assert.equal(aviso.id, 'agua-plantas')
  assert.match(aviso.motivo, /^Glossostigma é de água doce/)
})

test('mensagem do WhatsApp: resumo completo, montagem vazia e codificação do link', () => {
  const m = montagem({ aquario: [{ id: 1, qtd: 1 }], equipamentos: [{ id: 3, qtd: 1 }], peixes: [{ id: 4, qtd: 2 }] })
  const a = aquarioDaMontagem(m, porId)
  const linhas = linhasDaMontagem(m, porId)
  const texto = mensagemWhatsApp({ aquario: a, linhas, totais: totaisDaMontagem(linhas), avisos: avisosDaMontagem(a, linhas), rotulos })
  assert.match(texto, /\*Aquário:\* Item 1 \(40 L, água doce ou salgada\)/)
  assert.match(texto, /- 2x Item 4 \(R\$\s17,80\)/)
  assert.match(texto, /\*Total estimado:\* R\$\s317,60/)
  assert.match(texto, /Incompatível: Item 3 é pequeno para o aquário/)
  const vazio = mensagemWhatsApp({ aquario: null, linhas: linhasDaMontagem(montagemVazia(), porId), totais: { total: 0 }, avisos: [], rotulos })
  assert.match(vazio, /ainda não sei o que escolher/)
  const url = new URL(linkWhatsApp(texto))
  assert.equal(url.searchParams.get('text'), texto)
  assert.ok(!url.search.includes(' ') && !url.search.includes('\n'))
})

test('dados de demonstração passam pelo mesmo contrato da API real', async () => {
  const api = criarCatalogo(consultarMock)
  const aquarios = await api.listarProdutos({ categoria: 'aquarios', limite: 100 })
  assert.ok(aquarios.itens.length >= 4)
  assert.equal(aquarios.itens[0].fichaTecnica, null) // a listagem de produtos não traz ficha, como a API
  const detalhe = await api.obterProduto(aquarios.itens[0].id)
  assert.equal(detalhe.fichaTecnica.tipo, 'aquarios')
  assert.equal(detalhe.centavos, true)
  const peixes = await api.listarPeixes({ limite: 100 })
  assert.ok(peixes.itens.every((p) => p.ficha && p.fichaTecnica.tipo === 'peixes'))
  const esgotado = peixes.itens.find((p) => !p.emEstoque)
  assert.equal(esgotado.estoque, 0)
  await assert.rejects(api.obterProduto(999999), (e) => e.status === 404)
})
