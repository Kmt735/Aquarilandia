import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { STATUS_INICIAL } from '../src/modulos/avaliacoes/avaliacao.config.ts'
import { lerFiltros, limparTexto, validarAvaliacaoProduto, validarAvaliacaoSite, validarStatus } from '../src/modulos/avaliacoes/avaliacao.validacao.ts'

const erro = (status, campo) => (e) => e.statusCode === status && (!campo || campo in (e.detalhes ?? {}))

describe('Avaliações — validação no servidor', () => {
  it('moderação ligada por padrão: avaliação nova nasce pendente', () => {
    assert.equal(STATUS_INICIAL, 'pendente')
  })

  it('limparTexto tira tags, controles e espaços sobrando', () => {
    assert.equal(limparTexto('  <b>Oi</b>   <script>x()</script> tudo\u0000 bem '), 'Oi x() tudo bem')
    assert.equal(limparTexto('a <img src=x onerror=alert(1)> b'), 'a b')
    assert.equal(limparTexto('linha 1\r\n\r\n\r\n\r\nlinha   2', true), 'linha 1\n\nlinha 2')
    assert.equal(limparTexto('2 < 3 e 5 > 4'), '2 3 e 5 4')
    assert.equal(limparTexto('Achei fácil <i>comprar</i>.'), 'Achei fácil comprar.')
  })

  it('produto: nota inteira de 1 a 5; nome e comentário opcionais e limpos', () => {
    for (const nota of [undefined, 0, 6, 2.5, '4', null, true]) assert.throws(() => validarAvaliacaoProduto({ nota }), erro(422, 'nota'))
    assert.deepEqual(validarAvaliacaoProduto({ nota: 4, nome: '   ', comentario: '' }), { nota: 4, nome: null, comentario: null })
    assert.deepEqual(validarAvaliacaoProduto({ nota: 5, nome: ' Ana  <i>Maria</i> ' }), { nota: 5, nome: 'Ana Maria', comentario: null })
    assert.throws(() => validarAvaliacaoProduto({ nota: 5, nome: 'n'.repeat(41) }), erro(422, 'nome'))
    assert.throws(() => validarAvaliacaoProduto({ nota: 5, comentario: 'c'.repeat(501) }), erro(422, 'comentario'))
    assert.throws(() => validarAvaliacaoProduto({ nota: 5, comentario: { texto: 'x' } }), erro(422, 'comentario'))
    assert.throws(() => validarAvaliacaoProduto([5]), erro(422))
    // Campos que o visitante não decide são ignorados
    assert.deepEqual(Object.keys(validarAvaliacaoProduto({ nota: 3, status: 'aprovada', id: 9 })).sort(), ['comentario', 'nome', 'nota'])
  })

  it('site: opções fora da lista viram null, origem padrão aba, página só caminho do site', () => {
    const v = validarAvaliacaoSite({ nota: 2, motivo: 'comprar', encontrou: 'talvez', origem: 'hack', pagina: 'https://outro.site/x' })
    assert.deepEqual(v, { nota: 2, comentario: null, motivo: 'comprar', encontrou: null, origem: 'aba', pagina: null })
    assert.equal(validarAvaliacaoSite({ nota: 5, pagina: '/peixes/3' }).pagina, '/peixes/3')
    assert.throws(() => validarAvaliacaoSite({ nota: 5, comentario: 'c'.repeat(301) }), erro(422, 'comentario'))
  })

  it('status e filtros do painel', () => {
    assert.equal(validarStatus({ status: 'oculta' }), 'oculta')
    assert.throws(() => validarStatus({ status: 'apagada' }), erro(422, 'status'))
    assert.deepEqual(lerFiltros({ status: 'pendente', nota: '5' }), { status: 'pendente', nota: 5 })
    assert.deepEqual(lerFiltros({ status: '', nota: '' }), { status: undefined, nota: undefined })
    assert.throws(() => lerFiltros({ nota: '9' }), erro(400, 'nota'))
  })
})
