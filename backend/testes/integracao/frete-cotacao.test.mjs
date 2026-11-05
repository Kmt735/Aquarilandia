import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, describe, it } from 'node:test'
import pg from 'pg'

const url = process.env.TEST_DATABASE_URL
describe('POST /api/frete/calcular (#28) — PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `frete_cotacao_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, base, origem, limites, config, criado = false

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    origem = (await import('../../src/config/env.ts')).env.corsOrigin
    limites = await import('../../src/middlewares/rateLimit.ts')
    config = (await import('../../src/modulos/vendas/frete.config.ts')).configFrete
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    base = `http://127.0.0.1:${server.address().port}/api/frete/calcular`
  })
  beforeEach(() => limites.limiteFrete.resetKey('127.0.0.1'))
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  async function produto({ slug = 'acessorios', preco = 1000, ativo = true } = {}) {
    const { rows } = await c.query('INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $2, $3, $4 FROM categorias WHERE slug = $1 RETURNING id',
      [slug, `Produto ${randomUUID().slice(0, 8)}`, preco, ativo])
    return rows[0].id
  }
  async function cotar(body, { comOrigem = true } = {}) {
    const resposta = await fetch(base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(comOrigem ? { Origin: origem } : {}) },
      body: JSON.stringify(body),
    })
    return { status: resposta.status, corpo: await resposta.json() }
  }
  const itens = (...pares) => pares.map(([produtoId, quantidade]) => ({ produtoId, quantidade }))

  it('1. 200 em São João del Rei, em outro estado e na retirada; subtotal e total com os preços do catálogo', async () => {
    const filtro = await produto({ preco: 1990 }), racao = await produto({ slug: 'racoes', preco: 500 })
    const pedido = itens([filtro, 2], [racao, 1])
    const subtotal = 1990 * 2 + 500

    const local = await cotar({ itens: pedido, cep: '36307-000' })
    assert.equal(local.status, 200)
    const sjdr = config.saoJoaoDelRei
    assert.deepEqual(local.corpo, { frete: sjdr.valor, prazoDias: sjdr.prazoDias, tipoEntrega: 'propria', subtotal, total: subtotal + sjdr.valor })

    const longe = await cotar({ itens: pedido, cep: '01001000' })
    const sp = config.faixasBrasil.find((f) => '01001000' >= f.cepInicio && '01001000' <= f.cepFim)
    assert.deepEqual(longe.corpo, { frete: sp.valor, prazoDias: sp.prazoDias, tipoEntrega: 'correios', subtotal, total: subtotal + sp.valor })

    const retirada = await cotar({ itens: pedido, retirada: true })
    assert.deepEqual(retirada.corpo, { frete: 0, prazoDias: config.prazoRetiradaDias, tipoEntrega: 'retirada', subtotal, total: subtotal })
  })

  it('preço do body é ignorado: o subtotal vem só do catálogo', async () => {
    const p = await produto({ preco: 2500 })
    const r = await cotar({ itens: [{ produtoId: p, quantidade: 2, precoUnitario: 1 }], retirada: true, subtotal: 1, total: 1 })
    assert.equal(r.corpo.subtotal, 5000); assert.equal(r.corpo.total, 5000)
  })

  it('2. peixe fora de São João del Rei → 422 no índice ORIGINAL do peixe, mesmo com repetidos antes dele', async () => {
    const a = await produto(), b = await produto(), peixe = await produto({ slug: 'peixes' })
    const r = await cotar({ itens: itens([a, 1], [a, 2], [b, 1], [peixe, 1]), cep: '01001000' })
    assert.equal(r.status, 422)
    assert.deepEqual(r.corpo.detalhes, { 'itens.3.produtoId': 'Este peixe só pode ser entregue em São João del Rei.' })
    // O mesmo carrinho em São João del Rei ou na retirada passa
    assert.equal((await cotar({ itens: itens([a, 1], [a, 2], [b, 1], [peixe, 1]), cep: '36300000' })).status, 200)
    assert.equal((await cotar({ itens: itens([a, 1], [peixe, 1]), retirada: true })).status, 200)
  })

  it('3. inexistente e inativo → 422 no índice; body inválido → 422', async () => {
    const ok = await produto(), inativo = await produto({ ativo: false })
    const r = await cotar({ itens: itens([ok, 1], [2147483000, 1], [inativo, 1]), cep: '36300000' })
    assert.equal(r.status, 422)
    assert.deepEqual(r.corpo.detalhes, { 'itens.1.produtoId': 'Produto indisponível.', 'itens.2.produtoId': 'Produto indisponível.' })

    assert.deepEqual((await cotar({ itens: [], cep: '36300000' })).corpo.detalhes, { itens: 'Adicione de 1 a 30 produtos.' })
    assert.deepEqual((await cotar({ itens: itens([ok, 1]), cep: '123' })).corpo.detalhes,
      { cep: 'Informe um CEP válido com 8 números ou escolha retirar na loja.' })
    assert.deepEqual((await cotar({ itens: itens([ok, 1]) })).corpo.detalhes, { entrega: 'Escolha um endereço de entrega ou retirar na loja.' })
    const lista = await cotar([1, 2])
    assert.equal(lista.status, 422); assert.deepEqual(lista.corpo.detalhes, { body: 'Formato de dados inválido.' })
  })

  it('4. 30 cotações passam; a 31ª no mesmo minuto → 429', async () => {
    const p = await produto()
    for (let i = 0; i < 30; i++) assert.equal((await cotar({ itens: itens([p, 1]), retirada: true })).status, 200, `cotação ${i + 1}`)
    const bloqueada = await cotar({ itens: itens([p, 1]), retirada: true })
    assert.equal(bloqueada.status, 429)
  })

  it('5. sem login → 200; sem Origin → 403 (e não gasta o limite)', async () => {
    const p = await produto()
    assert.equal((await cotar({ itens: itens([p, 1]), retirada: true })).status, 200)
    const semOrigem = await cotar({ itens: itens([p, 1]), retirada: true }, { comOrigem: false })
    assert.equal(semOrigem.status, 403)
  })
})
