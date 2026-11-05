import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const url = process.env.TEST_DATABASE_URL
describe('POST /api/vendas — Idempotency-Key e totalEsperado (Lote 9b) — PostgreSQL real', {
  skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.',
}, () => {
  const schema = `venda_idempotencia_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, api, origem, estoque, limites, vendaRepository, adminId, criado = false

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '21_vendas_idempotencia.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    adminId = (await c.query("INSERT INTO clientes (nome, email, senha_hash, papel) VALUES ('Admin', 'admin@idem.example', 'hash', 'admin') RETURNING id")).rows[0].id
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    origem = (await import('../../src/config/env.ts')).env.corsOrigin
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    limites = await import('../../src/middlewares/rateLimit.ts')
    vendaRepository = (await import('../../src/modulos/vendas/venda.repository.ts')).vendaRepository
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  // ---------- fixtures (só no schema descartável) ----------
  async function produto({ preco = 1000, saldo = 100, slug = 'acessorios' } = {}) {
    const id = (await c.query('INSERT INTO produtos (categoria_id, nome, preco) SELECT id, $2, $3 FROM categorias WHERE slug = $1 RETURNING id',
      [slug, `Produto ${randomUUID().slice(0, 8)}`, preco])).rows[0].id
    if (saldo) await estoque.registrarMovimentacao(adminId, { produtoId: id, tipo: 'entrada', quantidade: saldo, motivo: 'Saldo de teste' }, randomUUID(), {})
    return id
  }
  async function cliente() {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES ($1, $2, 'hash', '32999990000') RETURNING id",
      [`Comprador ${randomUUID().slice(0, 6)}`, `${randomUUID()}@idem.example`])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token }
  }
  const endereco = async (clienteId, cep = '36307000') => (await c.query(`INSERT INTO enderecos_cliente
    (cliente_id, cep, logradouro, numero, bairro, cidade, uf) VALUES ($1, $2, 'Rua Teste', '10', 'Centro', 'Cidade', 'MG') RETURNING id`,
  [clienteId, cep])).rows[0].id
  async function pedir(caminho, body, { token, chave, semChave = false } = {}) {
    const resposta = await fetch(`${api}${caminho}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origem,
        ...(token ? { Cookie: `sid=${token}` } : {}),
        ...(chave && !semChave ? { 'Idempotency-Key': chave } : {}),
      },
      body: JSON.stringify(body),
    })
    return { status: resposta.status, corpo: await resposta.json(), repetida: resposta.headers.get('idempotent-replayed') }
  }
  async function cotar(itens, destino) {
    limites.limiteFrete.resetKey('127.0.0.1')
    const r = await pedir('/frete/calcular', { itens, ...destino })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    return r.corpo.total
  }
  const comprar = (quem, chave, body, opcoes = {}) => pedir('/vendas', body, { token: quem.token, chave, ...opcoes })
  const itens = (...pares) => pares.map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
  const saldo = async (id) => (await c.query('SELECT estoque FROM produtos WHERE id = $1', [id])).rows[0].estoque
  const doCliente = async (clienteId) => (await c.query(`SELECT
      (SELECT count(*)::int FROM vendas WHERE cliente_id = $1) AS vendas,
      (SELECT count(*)::int FROM historico_status_venda h JOIN vendas v ON v.id = h.venda_id WHERE v.cliente_id = $1) AS historico,
      (SELECT count(*)::int FROM operacoes_estoque o JOIN vendas v ON v.id = o.venda_id WHERE v.cliente_id = $1) AS baixas`, [clienteId])).rows[0]
  const comTimeout = (promessa, ms = 10000) => Promise.race([promessa, esperar(ms).then(() => assert.fail(`Timeout de ${ms} ms.`))])

  it('1. sem Idempotency-Key ou com chave inválida → 400 do padrão do estoque; nada criado', async () => {
    const quem = await cliente(), p = await produto()
    const body = { itens: itens([p, 1]), retirada: true, totalEsperado: 1000 }
    for (const chave of [undefined, 'abc', '7F0C6A7E-2B1D-4C3A-9E8F-1A2B3C4D5E6F', '7f0c6a7e-2b1d-0c3a-9e8f-1a2b3c4d5e6f']) {
      const r = await comprar(quem, chave, body)
      assert.equal(r.status, 400, `chave ${chave}`)
      assert.deepEqual(r.corpo, { erro: 'Dados inválidos', detalhes: { 'Idempotency-Key': 'Informe um UUID canônico em minúsculas (versão 1 a 8 e variante RFC).' } })
    }
    assert.deepEqual(await doCliente(quem.id), { vendas: 0, historico: 0, baixas: 0 })
    assert.equal(await saldo(p), 100)
  })

  it('2. a mesma chave duas vezes em sequência → a mesma venda; estoque baixado uma vez; 1 histórico', async () => {
    const quem = await cliente(), p = await produto({ preco: 1990 }), end = await endereco(quem.id)
    const body = { itens: itens([p, 2]), enderecoId: end, totalEsperado: await cotar(itens([p, 2]), { cep: '36307000' }) }
    const chave = randomUUID()
    const primeira = await comprar(quem, chave, body)
    const segunda = await comprar(quem, chave, body)
    assert.deepEqual([primeira.status, segunda.status], [201, 201])
    assert.deepEqual([primeira.repetida, segunda.repetida], [null, 'true'])
    assert.deepEqual(segunda.corpo, primeira.corpo, 'a repetição devolve o mesmo corpo')
    assert.deepEqual(await doCliente(quem.id), { vendas: 1, historico: 1, baixas: 1 })
    assert.equal(await saldo(p), 98)
  })

  it('3. a mesma chave em paralelo (2 e depois 5 pedidos) → todos com o mesmo id, 1 venda e 1 baixa (5 rodadas)', async () => {
    const p = await produto({ saldo: 1000 })
    for (let rodada = 0; rodada < 5; rodada++) {
      for (const paralelos of [2, 5]) {
        const quem = await cliente(), chave = randomUUID()
        const r = await comTimeout(Promise.all(Array.from({ length: paralelos },
          () => comprar(quem, chave, { itens: itens([p, 1]), retirada: true, totalEsperado: 1000 }))))
        assert.ok(r.every((x) => x.status === 201), `rodada ${rodada + 1}: ${r.map((x) => x.status)}`)
        assert.equal(new Set(r.map((x) => x.corpo.id)).size, 1, 'todos com o mesmo id')
        assert.equal(r.filter((x) => x.repetida === null).length, 1, 'só um pedido criou; os outros são repetição')
        assert.deepEqual(await doCliente(quem.id), { vendas: 1, historico: 1, baixas: 1 })
      }
    }
    assert.equal(await saldo(p), 1000 - 10)
  })

  it('4. a mesma chave com outro carrinho → 409; nada novo', async () => {
    const quem = await cliente(), a = await produto(), b = await produto(), chave = randomUUID()
    assert.equal((await comprar(quem, chave, { itens: itens([a, 1]), retirada: true, totalEsperado: 1000 })).status, 201)
    for (const body of [
      { itens: itens([a, 2]), retirada: true, totalEsperado: 2000 },
      { itens: itens([a, 1], [b, 1]), retirada: true, totalEsperado: 2000 },
      { itens: itens([a, 1]), enderecoId: await endereco(quem.id), totalEsperado: 2000 },
    ]) {
      const r = await comprar(quem, chave, body)
      assert.deepEqual([r.status, r.corpo.erro], [409, 'Esta chave já foi usada em outra compra.'])
    }
    assert.deepEqual(await doCliente(quem.id), { vendas: 1, historico: 1, baixas: 1 })
    assert.deepEqual([await saldo(a), await saldo(b)], [99, 100])
  })

  it('5. a mesma compra com os itens em outra ordem (ou divididos) e a mesma chave → repetição', async () => {
    const quem = await cliente(), a = await produto(), b = await produto({ preco: 500 }), chave = randomUUID()
    const primeira = await comprar(quem, chave, { itens: itens([a, 2], [b, 1]), retirada: true, totalEsperado: 2500 })
    const reordenada = await comprar(quem, chave, { itens: itens([b, 1], [a, 2]), retirada: true, totalEsperado: 2500 })
    const dividida = await comprar(quem, chave, { itens: itens([a, 1], [b, 1], [a, 1]), retirada: true, totalEsperado: 2500 })
    assert.deepEqual([primeira.status, reordenada.status, dividida.status], [201, 201, 201])
    assert.deepEqual([reordenada.corpo.id, dividida.corpo.id], [primeira.corpo.id, primeira.corpo.id])
    assert.deepEqual([reordenada.repetida, dividida.repetida], ['true', 'true'])
    assert.deepEqual(await doCliente(quem.id), { vendas: 1, historico: 1, baixas: 1 })
  })

  it('6. a chave de um cliente usada por OUTRO cliente → venda nova para o segundo; nunca a do primeiro', async () => {
    const x = await cliente(), y = await cliente(), p = await produto(), chave = randomUUID()
    const body = { itens: itens([p, 1]), retirada: true, totalEsperado: 1000 }
    const dex = await comprar(x, chave, body)
    const dey = await comprar(y, chave, body)
    assert.deepEqual([dex.status, dey.status, dey.repetida], [201, 201, null])
    assert.notEqual(dey.corpo.id, dex.corpo.id)
    const donos = (await c.query('SELECT id, cliente_id FROM vendas WHERE id = ANY($1) ORDER BY id', [[dex.corpo.id, dey.corpo.id]])).rows
    assert.deepEqual(donos, [{ id: dex.corpo.id, cliente_id: x.id }, { id: dey.corpo.id, cliente_id: y.id }])
    assert.equal(await saldo(p), 98)
  })

  it('7. chaves diferentes → vendas diferentes; o limite de 5 continua; repetir uma chave antiga não conta como nova', async () => {
    const quem = await cliente(), p = await produto()
    const body = { itens: itens([p, 1]), retirada: true, totalEsperado: 1000 }
    const chaves = Array.from({ length: 5 }, () => randomUUID())
    const ids = []
    for (const chave of chaves) ids.push((await comprar(quem, chave, body)).corpo.id)
    assert.equal(new Set(ids).size, 5)
    const sexta = await comprar(quem, randomUUID(), body)
    assert.deepEqual([sexta.status, sexta.corpo.erro], [409, 'Você já tem 5 compras aguardando pagamento.'])
    // Repetição com 5 abertas: a chave é conferida antes do limite, então devolve a venda já criada
    const repetida = await comprar(quem, chaves[2], body)
    assert.deepEqual([repetida.status, repetida.corpo.id, repetida.repetida], [201, ids[2], 'true'])
    assert.equal((await doCliente(quem.id)).vendas, 5)
  })

  it('8. sem totalEsperado (ou inválido) → 422; totalEsperado certo → 201', async () => {
    const quem = await cliente(), p = await produto({ preco: 1500 })
    for (const totalEsperado of [undefined, '1500', -1, 1.5, null]) {
      const r = await comprar(quem, randomUUID(), { itens: itens([p, 1]), retirada: true, totalEsperado })
      assert.deepEqual([r.status, r.corpo.detalhes], [422, { totalEsperado: 'Atualize o carrinho antes de finalizar a compra.' }])
    }
    assert.equal((await doCliente(quem.id)).vendas, 0)
    const certo = await comprar(quem, randomUUID(), { itens: itens([p, 1]), retirada: true, totalEsperado: await cotar(itens([p, 1]), { retirada: true }) })
    assert.deepEqual([certo.status, certo.corpo.total], [201, 1500])
  })

  it('9. preço muda entre a cotação e a compra → 409 com o total novo formatado; nada criado; nova compra com o total novo → 201', async () => {
    const quem = await cliente(), p = await produto({ preco: 1000, saldo: 10 })
    const pedido = itens([p, 2])
    const cotado = await cotar(pedido, { retirada: true })
    assert.equal(cotado, 2000)
    await c.query('UPDATE produtos SET preco = 61728 WHERE id = $1', [p])

    const chave = randomUUID()
    const r = await comprar(quem, chave, { itens: pedido, retirada: true, totalEsperado: cotado })
    assert.equal(r.status, 409)
    assert.deepEqual(r.corpo, {
      erro: 'O valor da compra mudou desde a cotação. Confira o carrinho antes de finalizar.',
      detalhes: { totalEsperado: 'O total agora é R$ 1.234,56.' },
    })
    assert.deepEqual(await doCliente(quem.id), { vendas: 0, historico: 0, baixas: 0 })
    assert.equal(await saldo(p), 10)

    // O cliente confere e confirma o total novo. A tentativa recusada não gravou nada, então até a mesma chave serve
    const novo = await cotar(pedido, { retirada: true })
    const confirmada = await comprar(quem, chave, { itens: pedido, retirada: true, totalEsperado: novo })
    assert.deepEqual([confirmada.status, confirmada.corpo.total, confirmada.corpo.itens[0].precoUnitario], [201, 123456, 61728])
    assert.equal(await saldo(p), 8)
  })

  it('10. frete muda (endereço de outra faixa com o mesmo totalEsperado) → 409', async () => {
    const quem = await cliente(), p = await produto({ preco: 2000 })
    const local = await endereco(quem.id, '36307000'), longe = await endereco(quem.id, '01001000')
    const cotadoLocal = await cotar(itens([p, 1]), { cep: '36307000' })
    assert.equal((await comprar(quem, randomUUID(), { itens: itens([p, 1]), enderecoId: longe, totalEsperado: cotadoLocal })).status, 409)
    assert.equal((await doCliente(quem.id)).vendas, 0)
    assert.equal((await comprar(quem, randomUUID(), { itens: itens([p, 1]), enderecoId: local, totalEsperado: cotadoLocal })).status, 201)
  })

  it('rede de segurança: se o UNIQUE da chave estourar no INSERT (23505), devolve a venda já gravada', async () => {
    const quem = await cliente(), p = await produto(), chave = randomUUID()
    const body = { itens: itens([p, 1]), retirada: true, totalEsperado: 1000 }
    const primeira = await comprar(quem, chave, body)
    assert.equal(primeira.status, 201)
    // Simula a corrida que a trava do cliente impede: a busca dentro da transação "não vê" a venda, o INSERT bate no UNIQUE
    const original = vendaRepository.buscarPorChave
    let chamadas = 0
    mock.method(vendaRepository, 'buscarPorChave', async (...args) => (++chamadas === 1 ? null : original.apply(vendaRepository, args)))
    const segunda = await comprar(quem, chave, body)
    assert.deepEqual([segunda.status, segunda.corpo.id, segunda.repetida, chamadas], [201, primeira.corpo.id, 'true', 2])
    assert.deepEqual(await doCliente(quem.id), { vendas: 1, historico: 1, baixas: 1 })
    assert.equal(await saldo(p), 99)
  })
})
