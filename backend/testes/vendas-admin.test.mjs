import assert from 'node:assert/strict'
import { afterEach, describe, it, mock } from 'node:test'
import { enderecoLoja } from '../src/modulos/vendas/frete.config.ts'
import { vendaRepository } from '../src/modulos/vendas/venda.repository.ts'
import { vendaService } from '../src/modulos/vendas/venda.service.ts'
import { montarAviso } from '../src/modulos/vendas/vendaNotificacoes.ts'

// Lote 12, sem banco: os textos dos e-mails de mudança de status e a validação dos filtros do GET /api/vendas (#39).
// O fluxo com PostgreSQL real está em integracao/vendas-admin.test.mjs.
afterEach(() => mock.restoreAll())

describe('montarAviso (e-mail de mudança de status)', () => {
  const dados = { vendaId: 42, nome: 'Maria', codigoRastreio: null, pagamentoDevolvido: false }
  it('um assunto e um texto por status, sempre com o número do pedido', () => {
    for (const status of ['paga', 'enviada', 'pronta_retirada', 'entregue', 'cancelada']) {
      const { assunto, texto } = montarAviso(status, dados)
      assert.match(`${assunto} ${texto}`, /pedido #42/, status)
      assert.equal(/[\r\n]/.test(assunto), false, 'quebra de linha no assunto')
    }
    assert.equal(montarAviso('paga', dados).assunto, 'Pagamento confirmado — pedido #42')
    assert.equal(montarAviso('pronta_retirada', dados).assunto, 'Seu pedido está pronto para retirada — pedido #42')
  })
  it('pronta_retirada: o texto traz o endereço da loja do frete.config.ts', () => {
    assert.equal(enderecoLoja, 'Av. Josué de Queiroz, 115 – São João del Rei')
    assert.equal(montarAviso('pronta_retirada', dados).texto,
      'Olá, Maria. Seu pedido #42 está pronto para retirada. Retire na loja Aquarilândia (Av. Josué de Queiroz, 115 – ' +
      'São João del Rei), no horário de funcionamento. Leve um documento com foto.')
  })
  it('enviada: com o rastreio quando há; cancelada: "O valor foi devolvido." só se houve devolução', () => {
    assert.match(montarAviso('enviada', { ...dados, codigoRastreio: 'BR123456789BR' }).texto, /Código de rastreio dos Correios: BR123456789BR\./)
    assert.equal(montarAviso('enviada', dados).texto.includes('rastreio'), false)
    assert.match(montarAviso('cancelada', { ...dados, pagamentoDevolvido: true }).texto, /O valor foi devolvido\.$/)
    assert.equal(montarAviso('cancelada', dados).texto.includes('devolvido'), false)
  })
})

describe('GET /api/vendas — filtros (#39), conferidos antes do banco', () => {
  const pagina = { linhas: [], total: 0 }
  it('sem filtros: os padrões (página 1, limite 20, sem problemaPagamento)', async () => {
    const repo = mock.method(vendaRepository, 'listarParaAdmin', async () => pagina)
    assert.deepEqual(await vendaService.listarParaAdmin({}), { dados: [], total: 0, pagina: 1, limite: 20 })
    assert.deepEqual(repo.mock.calls[0].arguments[0], {
      clienteId: null, status: null, tipoEntrega: null, de: null, ate: null, problemaPagamento: false, pagina: 1, limite: 20,
    })
    assert.equal(repo.mock.calls[0].arguments[1], 5)
  })
  it('todos os filtros válidos passam convertidos', async () => {
    const repo = mock.method(vendaRepository, 'listarParaAdmin', async () => pagina)
    await vendaService.listarParaAdmin({ clienteId: '7', status: 'paga', tipoEntrega: 'retirada', de: '2026-11-01', ate: '2026-11-01', problemaPagamento: 'true', pagina: '2', limite: '5' })
    assert.deepEqual(repo.mock.calls[0].arguments[0], {
      clienteId: 7, status: 'paga', tipoEntrega: 'retirada', de: '2026-11-01', ate: '2026-11-01', problemaPagamento: true, pagina: 2, limite: 5,
    })
  })
  for (const [query, chaves] of [
    [{ de: '2026-02-29' }, ['de']], [{ de: '2028-02-30' }, ['de']], [{ ate: '2026-13-01' }, ['ate']], [{ de: '2026-11-1' }, ['de']],
    [{ de: '2026-11-02', ate: '2026-11-01' }, ['ate']], [{ clienteId: '01' }, ['clienteId']], [{ clienteId: '2147483648' }, ['clienteId']],
    [{ status: ['paga', 'enviada'] }, ['status']], [{ tipoEntrega: 'drone' }, ['tipoEntrega']], [{ problemaPagamento: '1' }, ['problemaPagamento']],
    [{ status: 'x', de: 'ontem', limite: '0' }, ['de', 'limite', 'status']],
  ]) {
    it(`${JSON.stringify(query)} → 400 com ${chaves.join(', ')}, sem ir ao banco`, async () => {
      const repo = mock.method(vendaRepository, 'listarParaAdmin', async () => pagina)
      await assert.rejects(vendaService.listarParaAdmin(query), (err) => {
        assert.equal(err.statusCode, 400)
        assert.deepEqual(Object.keys(err.detalhes).sort(), chaves)
        return true
      })
      assert.equal(repo.mock.callCount(), 0)
    })
  }
  it('2028-02-29 (ano bissexto) é uma data válida', async () => {
    mock.method(vendaRepository, 'listarParaAdmin', async () => pagina)
    await vendaService.listarParaAdmin({ de: '2028-02-29' })
  })
})
