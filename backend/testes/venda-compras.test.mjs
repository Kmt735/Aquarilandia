import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { env } from '../src/config/env.ts'
import { authService } from '../src/modulos/auth/auth.service.ts'
import { vendaRepository } from '../src/modulos/vendas/venda.repository.ts'
import { escolherPagamento, montarResumo } from '../src/modulos/vendas/venda.service.ts'
import { iniciarTarefasVendas } from '../src/modulos/vendas/venda.tarefas.ts'

// Sem banco: as funções puras das compras do cliente (#33, #34) e o agendamento da tarefa (#32).
// Nenhum caso chega a consultar o PostgreSQL: o que tocaria o banco é simulado.

const nodeEnvOriginal = env.nodeEnv
afterEach(() => {
  mock.timers.reset()
  mock.restoreAll()
  env.nodeEnv = nodeEnvOriginal
})

describe('montarResumo (#33)', () => {
  it('1 item → só o nome; 2 → "e mais 1 item"; 3 ou mais → "e mais N itens"', () => {
    assert.equal(montarResumo('Filtro X', 1), 'Filtro X')
    assert.equal(montarResumo('Filtro X', 2), 'Filtro X e mais 1 item')
    assert.equal(montarResumo('Filtro X', 3), 'Filtro X e mais 2 itens')
    assert.equal(montarResumo('Filtro X', 30), 'Filtro X e mais 29 itens')
  })
  it('venda sem itens (só por dado inserido à mão) → null', () => {
    assert.equal(montarResumo(null, 0), null)
    assert.equal(montarResumo('Filtro X', 0), null)
  })
})

describe('escolherPagamento (#34)', () => {
  const pag = (id, status, horas, metodo = 'pix') => ({ id, status, metodo, criadoEm: new Date(Date.UTC(2026, 10, 9, horas)) })

  it('o aprovado vence um recusado mais novo', () => {
    assert.deepEqual(escolherPagamento([pag(2, 'recusado', 12), pag(1, 'aprovado', 10)]),
      { status: 'aprovado', metodo: 'pix', criadoEm: new Date(Date.UTC(2026, 10, 9, 10)) })
  })
  it('entre aprovados, o mais recente; a ordem recebida não importa', () => {
    const lista = [pag(1, 'aprovado', 8, 'pix'), pag(3, 'aprovado', 11, 'credit_card'), pag(2, 'recusado', 12)]
    assert.equal(escolherPagamento(lista).metodo, 'credit_card')
    assert.equal(escolherPagamento([...lista].reverse()).metodo, 'credit_card')
  })
  it('sem aprovado, o mais recente de qualquer status', () => {
    assert.equal(escolherPagamento([pag(1, 'pendente', 9), pag(2, 'recusado', 11), pag(3, 'cancelado', 10)]).status, 'recusado')
  })
  it('mesma data: o maior id desempata', () => {
    assert.equal(escolherPagamento([pag(5, 'recusado', 9, 'a'), pag(7, 'recusado', 9, 'b'), pag(6, 'recusado', 9, 'c')]).metodo, 'b')
  })
  it('sem pagamentos → null', () => {
    assert.equal(escolherPagamento([]), null)
  })
  it('devolve só status, metodo e criadoEm (sem o id nem outro campo que viesse junto)', () => {
    const escolhido = escolherPagamento([{ ...pag(1, 'aprovado', 9), gatewayPagamentoId: 'pay_x', valor: 100 }])
    assert.deepEqual(Object.keys(escolhido).sort(), ['criadoEm', 'metodo', 'status'])
  })
})

describe('iniciarTarefasVendas (#32)', () => {
  it('com NODE_ENV=test não agenda nada', () => {
    env.nodeEnv = 'test'
    const timeout = mock.method(globalThis, 'setTimeout')
    const intervalo = mock.method(globalThis, 'setInterval')
    iniciarTarefasVendas()
    assert.equal(timeout.mock.callCount(), 0)
    assert.equal(intervalo.mock.callCount(), 0)
  })

  it('fora de test: primeira rodada em 30 s, depois a cada 5 min, timers com unref e nunca duas rodadas juntas', async () => {
    env.nodeEnv = 'development'
    mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
    const unref = []
    const timeoutOriginal = globalThis.setTimeout, intervaloOriginal = globalThis.setInterval
    mock.method(globalThis, 'setTimeout', (fn, ms) => { const t = timeoutOriginal(fn, ms); unref.push(['timeout', ms, mock.method(t, 'unref')]); return t })
    mock.method(globalThis, 'setInterval', (fn, ms) => { const t = intervaloOriginal(fn, ms); unref.push(['intervalo', ms, mock.method(t, 'unref')]); return t })

    // A primeira rodada fica presa na busca das vencidas até o teste liberar
    let liberar
    const busca = mock.method(vendaRepository, 'buscarVencidas', () => new Promise((resolve) => { liberar = resolve }))
    const sessoes = mock.method(authService, 'limparSessoesVencidas', async () => {})
    const tokens = mock.method(authService, 'limparTokensVencidos', async () => {})

    iniciarTarefasVendas()
    assert.deepEqual(unref.map(([tipo, ms]) => [tipo, ms]), [['timeout', 30000], ['intervalo', 300000]])
    for (const [, , chamado] of unref) assert.equal(chamado.mock.callCount(), 1, 'timer sem unref')

    mock.timers.tick(29999)
    assert.equal(busca.mock.callCount(), 0)
    mock.timers.tick(1)
    assert.equal(busca.mock.callCount(), 1, 'primeira rodada aos 30 s')

    // O intervalo de 5 min chega com a primeira rodada ainda presa: não começa outra
    mock.timers.tick(300000)
    assert.equal(busca.mock.callCount(), 1)

    liberar([])
    for (let i = 0; i < 5; i++) await Promise.resolve()
    assert.equal(sessoes.mock.callCount(), 1)
    assert.equal(tokens.mock.callCount(), 1)

    // Terminada a rodada, o próximo intervalo roda normalmente
    busca.mock.mockImplementation(async () => [])
    mock.timers.tick(300000)
    assert.equal(busca.mock.callCount(), 2)
  })

  it('um erro na expiração não impede as limpezas nem escapa da rodada', async () => {
    env.nodeEnv = 'development'
    mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
    const log = mock.method(console, 'error', () => {})
    mock.method(vendaRepository, 'buscarVencidas', async () => {
      throw Object.assign(new Error('detalhe interno com dado sensível'), { code: '57P01' })
    })
    const sessoes = mock.method(authService, 'limparSessoesVencidas', async () => {})
    mock.method(authService, 'limparTokensVencidos', async () => {})

    iniciarTarefasVendas()
    mock.timers.tick(30000)
    for (let i = 0; i < 10; i++) await Promise.resolve()
    assert.equal(sessoes.mock.callCount(), 1)
    assert.deepEqual(log.mock.calls.map((c) => c.arguments), [['[expiracao] rodada falhou: 57P01']])
  })
})
