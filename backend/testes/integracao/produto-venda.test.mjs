import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'

const url = process.env.TEST_DATABASE_URL
describe('produtoService.buscarParaVenda — PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `produto_venda_${randomUUID().replaceAll('-', '')}`
  let c, pool, tx, produtos, estoque, adminId, criado = false
  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect(); await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '30_estoque.sql', '31_estoque_vendas.sql']) await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    adminId = (await c.query("INSERT INTO clientes(nome,email,senha_hash,papel) VALUES('Admin fixture','venda@fixture.example','hash','admin') RETURNING id")).rows[0].id
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    pool = (await import('../../src/config/db.ts')).db
    tx = (await import('../../src/utils/transacao.ts')).comTransacao
    produtos = (await import('../../src/modulos/catalogo/produto.service.ts')).produtoService
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
  })
  after(async () => {
    try { if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })
  async function produto({ slug = 'acessorios', preco = 12345, ativo = true, saldo = 0 } = {}) {
    const nome = `Produto ${randomUUID()}`
    const id = (await c.query('INSERT INTO produtos(categoria_id,nome,preco,ativo) SELECT id,$2,$3,$4 FROM categorias WHERE slug=$1 RETURNING id', [slug, nome, preco, ativo])).rows[0].id
    if (saldo) await estoque.registrarMovimentacao(adminId, { produtoId: id, tipo: 'entrada', quantidade: saldo, motivo: 'Saldo de teste' }, randomUUID(), {})
    return { id, nome, preco, ativo, categoria: slug }
  }
  // NOWAIT: falha na hora (55P03) se a linha estiver travada, sem prender o teste.
  async function travada(sql, id) {
    try { await c.query('BEGIN'); await c.query(`${sql} NOWAIT`, [id]); return false }
    catch (e) { if (e.code === '55P03') return true; throw e }
    finally { await c.query('ROLLBACK') }
  }
  const produtoTravado = (id) => travada('SELECT 1 FROM produtos WHERE id = $1 FOR NO KEY UPDATE', id)
  const categoriaTravada = (id) => travada('SELECT 1 FROM categorias WHERE id = (SELECT categoria_id FROM produtos WHERE id = $1) FOR UPDATE', id)

  it('2 ids → 2 itens com os 5 campos, preço em centavos e categoria = slug', async () => {
    const a = await produto({ slug: 'peixes', preco: 1990 }), b = await produto({ slug: 'aquarios', preco: 459900 })
    assert.deepEqual(await produtos.buscarParaVenda([a.id, b.id]), [a, b])
  })

  it('inexistente é omitido, inativo vem com ativo=false, repetido vem uma vez só e o resultado sai ordenado por id', async () => {
    const a = await produto(), b = await produto({ ativo: false }), c2 = await produto({ slug: 'racoes', preco: 1 })
    const r = await produtos.buscarParaVenda([c2.id, 2147483647, b.id, a.id, c2.id])
    assert.deepEqual(r, [a, b, c2])
    assert.equal(r[1].ativo, false)
    assert.deepEqual(r.map((p) => p.id), [a.id, b.id, c2.id].sort((x, y) => x - y))
  })

  it('só inexistentes → [] sem erro', async () => {
    assert.deepEqual(await produtos.buscarParaVenda([2147483646, 2147483647]), [])
  })

  it('dentro de comTransacao o produto fica travado até o COMMIT; a categoria não', async () => {
    const a = await produto({ slug: 'peixes' })
    await tx(async (client) => {
      assert.deepEqual(await produtos.buscarParaVenda([a.id], client), [a])
      assert.equal(await produtoTravado(a.id), true)
      assert.equal(await categoriaTravada(a.id), false)
    })
    assert.equal(await produtoTravado(a.id), false)
  })

  it('o lock também é liberado no ROLLBACK', async () => {
    const a = await produto()
    await assert.rejects(tx(async (client) => {
      await produtos.buscarParaVenda([a.id], client)
      assert.equal(await produtoTravado(a.id), true)
      throw new Error('falha simulada')
    }), /falha simulada/)
    assert.equal(await produtoTravado(a.id), false)
  })

  it('sem executor não trava: não espera um UPDATE em aberto e, depois, outra transação muda o preço na hora', async () => {
    const a = await produto({ preco: 1000 })
    const outro = new pg.Client({ connectionString: url, application_name: `${schema}_outro` }); await outro.connect()
    try {
      await outro.query(`SET search_path TO ${schema}`)
      // Outra transação segura a linha com um UPDATE ainda sem COMMIT: um SELECT com FOR ... UPDATE esperaria aqui.
      await outro.query('BEGIN'); await outro.query('UPDATE produtos SET preco = 1500 WHERE id = $1', [a.id])
      const lido = await Promise.race([produtos.buscarParaVenda([a.id]), esperar(2000).then(() => assert.fail('Sem executor não deveria esperar a trava.'))])
      assert.equal(lido[0].preco, 1000)
      await outro.query('ROLLBACK')
      await produtos.buscarParaVenda([a.id])
      // lock_timeout curto: se a leitura tivesse deixado trava, o UPDATE falharia com 55P03 em vez de esperar.
      await outro.query('BEGIN'); await outro.query("SET LOCAL lock_timeout = '500ms'")
      await outro.query('UPDATE produtos SET preco = 2000 WHERE id = $1', [a.id]); await outro.query('COMMIT')
      assert.equal(await produtoTravado(a.id), false)
      assert.equal((await produtos.buscarParaVenda([a.id]))[0].preco, 2000)
    } finally { await outro.query('ROLLBACK').catch(() => {}); await outro.end() }
  })

  it('com executor trava: UPDATE de preço em outra conexão espera até o COMMIT da venda', async () => {
    const a = await produto({ preco: 1000 })
    const nomeOutro = `${schema}_upd`
    const outro = new pg.Client({ connectionString: url, application_name: nomeOutro }); await outro.connect()
    try {
      await outro.query(`SET search_path TO ${schema}`)
      let terminou = false, update
      await tx(async (client) => {
        await produtos.buscarParaVenda([a.id], client)
        update = outro.query('UPDATE produtos SET preco = 3000 WHERE id = $1', [a.id]).then(() => { terminou = true })
        for (let i = 0; ; i++) {
          const { rows } = await c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [nomeOutro])
          if (rows[0].n >= 1) break
          if (i === 300) assert.fail('O UPDATE de outra conexão não esperou a trava.')
          await esperar(10)
        }
        assert.equal(terminou, false)
        assert.equal((await client.query('SELECT preco FROM produtos WHERE id = $1', [a.id])).rows[0].preco, 1000)
      })
      await update
      assert.equal(terminou, true)
      assert.equal((await produtos.buscarParaVenda([a.id]))[0].preco, 3000)
    } finally { await outro.end() }
  })

  it('outra transação que lê o mesmo produto espera o COMMIT e então vê o preço novo', async () => {
    const a = await produto({ preco: 1000 })
    let liberar; const segurando = new Promise((r) => { liberar = r })
    let travou; const travouPromessa = new Promise((r) => { travou = r })
    const primeira = tx(async (client) => {
      await produtos.buscarParaVenda([a.id], client); travou()
      await segurando
      await client.query('UPDATE produtos SET preco = 2000 WHERE id = $1', [a.id])
    })
    await travouPromessa
    const segunda = tx((client) => produtos.buscarParaVenda([a.id], client))
    for (let i = 0; i < 300; i++) {
      const { rows } = await c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [schema])
      if (rows[0].n >= 1) break
      if (i === 299) assert.fail('A segunda transação não esperou o lock.')
      await esperar(10)
    }
    liberar(); await primeira
    assert.equal((await segunda)[0].preco, 2000)
  })

  it('leitura com lock + baixa na mesma transação, em ordens opostas e em paralelo, não trava (5 rodadas)', async () => {
    const venda = async (client, itens) => {
      const id = (await client.query(`INSERT INTO vendas(cliente_id,subtotal,frete,total,tipo_entrega,entrega_destinatario,entrega_telefone,prazo_entrega_dias)
        VALUES($1,0,0,0,'retirada','Fixture','32999999999',1) RETURNING id`, [adminId])).rows[0].id
      for (const { produtoId, quantidade } of itens) await client.query(`INSERT INTO itens_venda(venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal)
        VALUES($1,$2,'Snapshot fixture',0,$3,0)`, [id, produtoId, quantidade])
      return id
    }
    for (let rodada = 0; rodada < 5; rodada++) {
      const a = await produto({ saldo: 5 }), b = await produto({ saldo: 5 })
      let chegaram = 0, soltar; const juntos = new Promise((r) => { soltar = r })
      const comprar = (ids) => tx(async (client) => {
        await produtos.buscarParaVenda(ids, client)
        if (++chegaram === 2) soltar()
        await Promise.race([juntos, esperar(200)])
        const itens = ids.map((produtoId) => ({ produtoId, quantidade: 1 }))
        await estoque.baixarParaVenda(await venda(client, itens), itens, client)
      })
      const resultados = await Promise.race([
        Promise.allSettled([comprar([a.id, b.id]), comprar([b.id, a.id])]),
        esperar(10000).then(() => assert.fail('Timeout: possível deadlock.')),
      ])
      assert.deepEqual(resultados.map((r) => r.status === 'rejected' ? r.reason.code ?? r.reason.message : 'ok'), ['ok', 'ok'])
      const { rows } = await c.query('SELECT estoque FROM produtos WHERE id = ANY($1::integer[]) ORDER BY id', [[a.id, b.id]])
      assert.deepEqual(rows.map((r) => r.estoque), [3, 3])
    }
  })

  it('fluxo completo numa transação: busca com o client → venda e itens com os preços lidos → baixa → COMMIT', async () => {
    const a = await produto({ slug: 'peixes', preco: 1990, saldo: 5 }), b = await produto({ slug: 'aquarios', preco: 459900, saldo: 3 })
    const pedido = new Map([[b.id, 1], [a.id, 2]])
    const vendaId = await tx(async (client) => {
      const lidos = await produtos.buscarParaVenda([...pedido.keys()], client)
      assert.deepEqual(lidos.map((p) => p.id), [a.id, b.id].sort((x, y) => x - y))
      assert.ok(lidos.every((p) => p.ativo))
      const subtotal = lidos.reduce((soma, p) => soma + p.preco * pedido.get(p.id), 0)
      const id = (await client.query(`INSERT INTO vendas(cliente_id,subtotal,frete,total,tipo_entrega,entrega_destinatario,entrega_telefone,prazo_entrega_dias)
        VALUES($1,$2,0,$2,'retirada','Fixture','32999999999',1) RETURNING id`, [adminId, subtotal])).rows[0].id
      for (const p of lidos) await client.query(`INSERT INTO itens_venda(venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal)
        VALUES($1,$2,$3,$4,$5,$6)`, [id, p.id, p.nome, p.preco, pedido.get(p.id), p.preco * pedido.get(p.id)])
      await estoque.baixarParaVenda(id, lidos.map((p) => ({ produtoId: p.id, quantidade: pedido.get(p.id) })), client)
      return id
    })
    const saldos = (await c.query('SELECT id, estoque FROM produtos WHERE id = ANY($1::integer[]) ORDER BY id', [[a.id, b.id]])).rows
    assert.deepEqual(Object.fromEntries(saldos.map((r) => [r.id, r.estoque])), { [a.id]: 3, [b.id]: 2 })
    const ops = (await c.query("SELECT count(*)::int AS n FROM operacoes_estoque WHERE venda_id = $1 AND tipo_venda = 'baixa_venda'", [vendaId])).rows[0].n
    assert.equal(ops, 1)
    const itens = (await c.query('SELECT produto_id, preco_unitario, subtotal FROM itens_venda WHERE venda_id = $1 ORDER BY produto_id', [vendaId])).rows
    assert.deepEqual(itens.map((i) => i.preco_unitario), [a, b].sort((x, y) => x.id - y.id).map((p) => p.preco))
    assert.equal((await c.query('SELECT subtotal FROM vendas WHERE id = $1', [vendaId])).rows[0].subtotal, 1990 * 2 + 459900)
    assert.equal(await produtoTravado(a.id), false)
  })
})
