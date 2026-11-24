import assert from 'node:assert/strict'
import { test } from 'node:test'
import { montarAvaliacao, resumirAvaliacoes } from '../src/services/avaliacoes.js'

test('avaliação do site exige nota de 1 a 5 e limpa o resto', () => {
  assert.throws(() => montarAvaliacao({ nota: 0 }), (e) => e.erro === 'Escolha uma nota de 1 a 5.')
  const a = montarAvaliacao({ nota: 4, motivo: 'invalido', encontrou: 'sim', comentario: '  ' + 'x'.repeat(400) })
  assert.equal(a.nota, 4)
  assert.equal(a.motivo, null)
  assert.equal(a.encontrou, 'sim')
  assert.equal(a.comentario.length, 300)
})

test('resumo calcula média, distribuição e respostas', () => {
  const lista = [5, 4, 4, 1].map((nota, i) => montarAvaliacao({ nota, motivo: i ? 'comprar' : 'outro', comentario: i === 1 ? 'Ótimo' : '' }, 1000 + i))
  const r = resumirAvaliacoes(lista)
  assert.equal(r.total, 4)
  assert.equal(r.media, 3.5)
  assert.deepEqual(r.distribuicao.map((d) => d.qtd), [1, 2, 0, 0, 1])
  assert.equal(r.motivos.find((m) => m.valor === 'comprar').qtd, 3)
  assert.equal(r.comentarios.length, 1)
  assert.deepEqual(resumirAvaliacoes([]).media, 0)
})

test('avaliação de produto: nota obrigatória, nome e comentário limpos, chave separa peixe de produto', async () => {
  const { montarAvaliacaoProduto, chaveItem, resumirNotas } = await import('../src/services/avaliacoes-produto.js')
  assert.throws(() => montarAvaliacaoProduto({ nota: 6 }), (e) => e.erro === 'Escolha uma nota de 1 a 5.')
  const a = montarAvaliacaoProduto({ nota: 5, nome: '  Ana   Maria  ', comentario: 'y'.repeat(600) })
  assert.equal(a.nome, 'Ana Maria')
  assert.equal(a.comentario.length, 500)
  assert.equal(montarAvaliacaoProduto({ nota: 3, nome: '   ' }).nome, null)
  assert.notEqual(chaveItem({ tipo: 'peixe', id: 7 }), chaveItem({ tipo: 'produto', id: 7 }))
  const r = resumirNotas([{ nota: 5 }, { nota: 3 }])
  assert.equal(r.media, 4)
  assert.deepEqual(r.distribuicao.map((d) => d.qtd), [1, 0, 1, 0, 0])
})
