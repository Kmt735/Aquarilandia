import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'
import { estoqueRepository } from '../src/modulos/estoque/estoque.repository.ts'

describe('Estoque administrativo — HTTP, validação e transação', () => {
  let servidor, origem
  const entrada = { produtoId: 42, tipo: 'entrada', quantidade: 10, motivo: 'Reposição conferida' }
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => { if (servidor) await new Promise((r) => servidor.close(r)); await db.end() })
  function autorizar(papel = 'admin') {
    const usuario = { id: 7, papel, valido: true }
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => usuario.valido ? { id: usuario.id, papel: usuario.papel } : null)
    return usuario
  }
  function enviar(body = entrada, { chave = randomUUID(), headers = {}, query = '' } = {}) {
    return fetch(`${origem}/api/estoque/movimentacoes${query}`, {
      method: 'POST', headers: { Cookie: 'sid=teste', Origin: env.corsOrigin,
        'Content-Type': 'application/json', 'Idempotency-Key': chave, ...headers }, body: JSON.stringify(body),
    })
  }
  function banco(saldo = 0) {
    const comandos = []
    const tx = { query: async (sql) => { comandos.push(sql); return { rows: [] } }, release: mock.fn() }
    const conectar = mock.method(db, 'connect', async () => tx)
    const criar = mock.method(estoqueRepository, 'criarOperacao', async () => true)
    const bloquear = mock.method(estoqueRepository, 'bloquearProduto', async () => ({ estoque: saldo }))
    const atualizar = mock.method(estoqueRepository, 'atualizarSaldo', async () => {})
    const inserir = mock.method(estoqueRepository, 'inserirMovimento', async (operacaoId, dados, saldoAnterior, saldoAtual) => ({
      operacaoId, produtoId: dados.produtoId, tipo: dados.tipo, quantidade: dados.quantidade,
      saldoAnterior, saldoAtual, criadoEm: new Date('2026-11-03T12:00:00Z'),
    }))
    return { comandos, tx, conectar, criar, bloquear, atualizar, inserir }
  }
  for (const [nome, papel, cookie, status] of [['visitante', 'admin', '', 401], ['cliente', 'cliente', 'sid=x', 403]]) {
    it(`${nome} não abre transação nem movimenta unidades (${status})`, async () => {
      autorizar(papel); const b = banco()
      assert.equal((await enviar(entrada, { headers: { Cookie: cookie, 'X-Role': 'admin' } })).status, status)
      assert.equal(b.conectar.mock.callCount(), 0)
    })
  }
  it('sessão inexistente/revogada retorna 401', async () => {
    autorizar().valido = false; const b = banco()
    assert.equal((await enviar()).status, 401); assert.equal(b.conectar.mock.callCount(), 0)
  })
  for (const origin of ['', 'null', 'https://outro.example']) {
    it(`Origin ${JSON.stringify(origin)} retorna 403 antes do banco`, async () => {
      autorizar(); const b = banco()
      assert.equal((await enviar(entrada, { headers: { Origin: origin } })).status, 403)
      assert.equal(b.conectar.mock.callCount(), 0)
    })
  }
  for (const [tipo, saldoAtual] of [['entrada', 110], ['ajuste_positivo', 110], ['saida', 90], ['ajuste_negativo', 90]]) {
    it(`${tipo} usa o sinal correto, autoria da sessão e o mesmo client até COMMIT`, async () => {
      autorizar(); const b = banco(100); const chave = randomUUID()
      const r = await enviar({ ...entrada, tipo }, { chave }); assert.equal(r.status, 201)
      const resultado = await r.json()
      assert.deepEqual(Object.keys(resultado).sort(), ['operacaoId', 'produtoId', 'tipo', 'quantidade', 'saldoAnterior', 'saldoAtual', 'criadoEm'].sort())
      assert.equal(resultado.saldoAnterior, 100); assert.equal(resultado.saldoAtual, saldoAtual)
      assert.equal(resultado.criadoEm, '2026-11-03T12:00:00.000Z')
      assert.match(r.headers.get('cache-control'), /no-store/); assert.match(r.headers.get('vary'), /Cookie/)
      assert.deepEqual(b.comandos, ['BEGIN', 'COMMIT'])
      assert.equal(b.criar.mock.calls[0].arguments[1], 7); assert.equal(b.criar.mock.calls[0].arguments[2], chave)
      for (const chamada of [b.criar, b.bloquear, b.atualizar, b.inserir]) assert.equal(chamada.mock.calls[0].arguments.at(-1), b.tx)
      assert.equal(b.tx.release.mock.callCount(), 1)
    })
  }
  const invalidos = [null, [], 42, {},
    ...['produtoId', 'quantidade'].flatMap((campo) => [0, -1, 1.5, '1', null, true, 2147483648, 9007199254740992].map((valor) => ({ ...entrada, [campo]: valor }))),
    ...['abertura', 'reserva', 'estorno', '', null, ['entrada']].map((tipo) => ({ ...entrada, tipo })),
    ...['', '   ', '...', '🐟', 'Reposição\nindevida', 'Texto\u0000secreto', 'x'.repeat(301), null, 123].map((motivo) => ({ ...entrada, motivo })),
    ...['estoque', 'saldoAtual', 'saldoAbsoluto', 'ativo', 'preco', 'vendaId', 'atorId', 'autorId', 'origem', 'papel'].map((campo) => ({ ...entrada, [campo]: 1 })),
    JSON.parse('{"produtoId":42,"tipo":"entrada","quantidade":1,"motivo":"Entrada","__proto__":{}}'),
  ]
  for (const [i, body] of invalidos.entries()) {
    it(`body inválido ${i}: 400 sem abrir transação`, async () => {
      autorizar(); const b = banco()
      const r = await enviar(body); assert.equal(r.status, 400)
      // O parser JSON global (strict) recusa null/primitivos antes do controller.
      assert.equal((await r.json()).erro, body === null || typeof body !== 'object' ? 'JSON inválido' : 'Dados inválidos')
      assert.equal(b.conectar.mock.callCount(), 0)
    })
  }
  for (const chave of ['', 'abc', '00000000-0000-0000-0000-000000000000', randomUUID().toUpperCase(), `${randomUUID()}, ${randomUUID()}`]) {
    it(`chave não canônica ${chave.slice(0, 12)}: 400`, async () => {
      autorizar(); const b = banco(); const r = await enviar(entrada, { chave })
      assert.equal(r.status, 400); assert.equal(typeof (await r.json()).detalhes['Idempotency-Key'], 'string')
      assert.equal(b.conectar.mock.callCount(), 0)
    })
  }
  it('header ausente e query não prevista são recusados', async () => {
    autorizar(); const b = banco()
    assert.equal((await fetch(`${origem}/api/estoque/movimentacoes`, { method: 'POST', headers: {
      Cookie: 'sid=x', Origin: env.corsOrigin, 'Content-Type': 'application/json',
    }, body: JSON.stringify(entrada) })).status, 400)
    assert.equal((await enviar(entrada, { query: '?vendaId=1' })).status, 400)
    assert.equal(b.conectar.mock.callCount(), 0)
  })
  it('aceita limites e normaliza trim/NFC antes da persistência', async () => {
    autorizar(); const b = banco()
    const motivo = `  ${'a\u0301'.repeat(300)}  `
    const r = await enviar({ ...entrada, produtoId: 2147483647, quantidade: 2147483647, motivo })
    assert.equal(r.status, 201); assert.equal((await r.json()).saldoAtual, 2147483647)
    assert.equal(b.inserir.mock.calls[0].arguments[1].motivo, 'á'.repeat(300))
  })
  for (const [saldo, body, status, mensagem] of [
    [null, entrada, 404, 'Produto não encontrado'],
    [0, { ...entrada, tipo: 'saida' }, 409, 'Estoque insuficiente'],
    [2147483647, entrada, 409, 'Limite de estoque excedido'],
  ]) {
    it(`${mensagem} desfaz a reivindicação da chave`, async () => {
      autorizar(); const b = banco(saldo)
      if (saldo === null) b.bloquear.mock.mockImplementation(async () => null)
      const r = await enviar(body); assert.equal(r.status, status); assert.equal((await r.json()).erro, mensagem)
      assert.equal(b.atualizar.mock.callCount(), 0); assert.deepEqual(b.comandos, ['BEGIN', 'ROLLBACK'])
    })
  }
  it('replay usa resultado histórico e hash da intenção normalizada; nova intenção com mesma chave dá 409', async () => {
    const usuario = autorizar(); const b = banco(); const chave = randomUUID()
    const primeiro = await enviar(entrada, { chave }); const resultado = await primeiro.json()
    const hash = b.criar.mock.calls[0].arguments[3]
    b.criar.mock.mockImplementation(async () => false)
    mock.method(estoqueRepository, 'buscarOperacao', async () => ({ ...resultado, hashRequisicao: hash }))
    const replay = await enviar({ motivo: '  Reposic\u0327a\u0303o conferida  ', quantidade: 10, tipo: 'entrada', produtoId: 42 }, { chave })
    assert.equal(replay.status, 201); assert.deepEqual(await replay.json(), resultado)
    assert.equal(b.bloquear.mock.callCount(), 1); assert.equal(b.atualizar.mock.callCount(), 1)
    assert.equal((await enviar({ ...entrada, quantidade: 11 }, { chave })).status, 409)
    usuario.papel = 'cliente'
    assert.equal((await enviar(entrada, { chave })).status, 403)
    usuario.valido = false
    assert.equal((await enviar(entrada, { chave })).status, 401)
    assert.equal(b.conectar.mock.callCount(), 3)
  })
  it('falha após atualizar saldo retorna 500 sem motivo livre, SQL ou credenciais', async () => {
    autorizar(); const b = banco(); const logs = mock.method(console, 'error', () => {})
    b.inserir.mock.mockImplementation(async () => { throw Object.assign(new Error('SQL senha=SEGREDO motivo=PRIVADO'), { code: '23514' }) })
    const r = await enviar({ ...entrada, motivo: 'PRIVADO' }); assert.equal(r.status, 500)
    assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' }); assert.deepEqual(b.comandos, ['BEGIN', 'ROLLBACK'])
    assert.doesNotMatch(JSON.stringify(logs.mock.calls), /SEGREDO|PRIVADO|INSERT|UPDATE/)
  })
})
