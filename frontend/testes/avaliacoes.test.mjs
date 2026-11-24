import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { buscarResumoAvaliacoes, enviarAvaliacao, mapearResumo, montarAvaliacao } from '../src/services/avaliacoes.js'
import { enviarAvaliacaoProduto, listarAvaliacoesProduto, montarAvaliacaoProduto, somarAoResumo } from '../src/services/avaliacoes-produto.js'

// As avaliações agora vão para a API: aqui o fetch é trocado por um falso que registra o pedido
const fetchOriginal = globalThis.fetch
let pedidos = []
function responder(status, corpo) {
  pedidos = []
  globalThis.fetch = async (url, opcoes = {}) => {
    pedidos.push({ url, ...opcoes, corpo: opcoes.body ? JSON.parse(opcoes.body) : undefined })
    return new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
  }
}
afterEach(() => { globalThis.fetch = fetchOriginal })

test('avaliação do site exige nota de 1 a 5 e limpa o resto antes de enviar', () => {
  assert.throws(() => montarAvaliacao({ nota: 0 }), (e) => e.erro === 'Escolha uma nota de 1 a 5.')
  const a = montarAvaliacao({ nota: 4, motivo: 'invalido', encontrou: 'sim', comentario: '  ' + 'x'.repeat(400) })
  assert.deepEqual(Object.keys(a).sort(), ['comentario', 'encontrou', 'motivo', 'nota', 'origem', 'pagina'])
  assert.equal(a.motivo, null)
  assert.equal(a.encontrou, 'sim')
  assert.equal(a.comentario.length, 300)
})

test('enviar avaliação do site faz POST /api/avaliacoes-site e devolve o status', async () => {
  responder(201, { id: 1, nota: 5, criadaEm: '2026-11-23T10:00:00Z', status: 'pendente' })
  const r = await enviarAvaliacao({ nota: 5, origem: 'rodape', pagina: '/loja' })
  assert.equal(r.status, 'pendente')
  assert.equal(pedidos[0].url, '/api/avaliacoes-site')
  assert.equal(pedidos[0].method, 'POST')
  assert.equal(pedidos[0].corpo.origem, 'rodape')
})

test('resumo público do site recebe os rótulos das perguntas', async () => {
  responder(200, { total: 4, media: 3.5, distribuicao: [{ nota: 5, qtd: 1 }], motivos: [{ valor: 'comprar', qtd: 3 }], encontrou: [], comentarios: [{ id: 1, comentario: 'Ótimo' }] })
  const r = await buscarResumoAvaliacoes()
  assert.equal(r.total, 4)
  assert.equal(r.motivos.find((m) => m.valor === 'comprar').qtd, 3)
  assert.equal(r.motivos.find((m) => m.valor === 'outro').qtd, 0)
  assert.ok(r.encontrou.every((e) => e.rotulo && e.qtd === 0))
  assert.equal(r.comentarios.length, 1)
  assert.equal(mapearResumo(null).total, 0)
})

test('avaliação de produto: nota obrigatória, nome e comentário limpos', () => {
  assert.throws(() => montarAvaliacaoProduto({ nota: 6 }), (e) => e.erro === 'Escolha uma nota de 1 a 5.')
  const a = montarAvaliacaoProduto({ nota: 5, nome: '  Ana   Maria  ', comentario: 'y'.repeat(600) })
  assert.equal(a.nome, 'Ana Maria')
  assert.equal(a.comentario.length, 500)
  assert.equal(montarAvaliacaoProduto({ nota: 3, nome: '   ' }).nome, null)
})

test('produto e peixe usam /api/produtos/:id/avaliacoes; erro da API chega com a mensagem', async () => {
  responder(200, { itens: [{ id: 1, nota: 4 }], resumo: { total: 1, media: 4, distribuicao: [] } })
  const lista = await listarAvaliacoesProduto({ tipo: 'peixe', id: 7 })
  assert.equal(pedidos[0].url, '/api/produtos/7/avaliacoes')
  assert.equal(lista.itens.length, 1)

  responder(201, { id: 2, nota: 5, nome: null, comentario: null, criadaEm: '2026-11-23T10:00:00Z', status: 'pendente' })
  assert.equal((await enviarAvaliacaoProduto({ tipo: 'produto', id: 3 }, { nota: 5 })).status, 'pendente')
  assert.deepEqual(pedidos[0].corpo, { nota: 5, nome: null, comentario: null })

  responder(429, { erro: 'Muitas tentativas. Tente de novo em alguns minutos. ' })
  await assert.rejects(enviarAvaliacaoProduto({ tipo: 'produto', id: 3 }, { nota: 5 }), (e) => e.status === 429 && e.erro.startsWith('Muitas'))
})

test('somarAoResumo junta avaliações publicadas na hora ao resumo da API', () => {
  const base = { total: 1, media: 3, distribuicao: [5, 4, 3, 2, 1].map((nota) => ({ nota, qtd: nota === 3 ? 1 : 0 })) }
  const r = somarAoResumo(base, [{ nota: 5 }])
  assert.equal(r.total, 2)
  assert.equal(r.media, 4)
  assert.deepEqual(r.distribuicao.map((d) => d.qtd), [1, 0, 1, 0, 0])
  assert.equal(somarAoResumo(base, []), base)
})
