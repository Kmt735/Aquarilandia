import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const url = process.env.TEST_DATABASE_URL
describe('Estoque por venda — transação do chamador e PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `estoque_venda_${randomUUID().replaceAll('-', '')}`, token = randomUUID(), segredo = randomUUID()
  let c, pool, tx, estoque, server, origem, cors, clienteId, criado = false, urlApp
  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect(); await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '30_estoque.sql', '31_estoque_vendas.sql']) await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    clienteId = (await c.query("INSERT INTO clientes(nome,email,senha_hash,papel) VALUES('Admin fixture','stock@fixture.example','hash','admin') RETURNING id")).rows[0].id
    await c.query("INSERT INTO sessoes(token_hash,cliente_id,expira_em) VALUES($1,$2,now()+interval '1 hour')", [hashToken(token), clienteId])
    urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString(); process.env.GATEWAY_WEBHOOK_SECRET = segredo
    const { app } = await import('../../src/app.ts'); pool = (await import('../../src/config/db.ts')).db
    tx = (await import('../../src/utils/transacao.ts')).comTransacao; estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    cors = (await import('../../src/config/env.ts')).env.corsOrigin
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); origem = `http://127.0.0.1:${server.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })
  async function produto(saldo = 0, { ativo = true, peixe = false } = {}) {
    const id = (await c.query('INSERT INTO produtos(categoria_id,nome,preco,ativo) SELECT id,$2,12345,$3 FROM categorias WHERE slug=$1 RETURNING id', [peixe ? 'peixes' : 'acessorios', `Produto ${randomUUID()}`, ativo])).rows[0].id
    if (peixe) await c.query(`INSERT INTO peixes(produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)
      VALUES($1,$2,'doce',5,24,28,6,7,40,'pacifico','iniciante')`, [id, `Species ${randomUUID()}`])
    if (saldo) await estoque.registrarMovimentacao(clienteId, { produtoId: id, tipo: 'entrada', quantidade: saldo, motivo: 'Saldo de teste' }, randomUUID(), {})
    return id
  }
  const itens = (...pares) => pares.map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
  async function venda(client, lista) {
    const id = (await client.query(`INSERT INTO vendas(cliente_id,subtotal,frete,total,tipo_entrega,entrega_destinatario,entrega_telefone,prazo_entrega_dias)
      VALUES($1,0,0,0,'retirada','Fixture','32999999999',1) RETURNING id`, [clienteId])).rows[0].id
    const soma = new Map()
    for (const p of lista) soma.set(p.produtoId, (soma.get(p.produtoId) ?? 0) + p.quantidade)
    for (const [produtoId, quantidade] of soma) await client.query(`INSERT INTO itens_venda(venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal)
      VALUES($1,$2,'Snapshot fixture',0,$3,0)`, [id, produtoId, quantidade])
    return id
  }
  const criar = (lista) => tx(async (client) => { const id = await venda(client, lista); await estoque.baixarParaVenda(id, lista, client); return id })
  const cancelar = (id) => tx(async (client) => { await client.query("UPDATE vendas SET status='cancelada' WHERE id=$1", [id]); await estoque.estornarVenda(id, client) })
  const saldo = async (id) => (await c.query('SELECT estoque FROM produtos WHERE id=$1', [id])).rows[0].estoque
  const foto = async () => (await c.query(`SELECT (SELECT count(*)::int FROM vendas) AS vendas, (SELECT count(*)::int FROM itens_venda) AS itens,
    (SELECT count(*)::int FROM operacoes_estoque) AS operacoes, (SELECT count(*)::int FROM movimentacoes_estoque) AS movimentos`)).rows[0]
  async function reconciliar() {
    assert.deepEqual((await c.query(`SELECT p.id FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id
      GROUP BY p.id HAVING p.estoque::bigint <> COALESCE(sum(m.delta),0)`)).rows, [])
  }
  async function historico(id) {
    const r = await fetch(`${origem}/api/estoque/movimentacoes?produtoId=${id}`, { headers: { Cookie: `sid=${token}` } }); assert.equal(r.status, 200); return r.json()
  }
  async function lockObservado(prefixo, n = 1) {
    for (let i = 0; i < 300; i++) {
      const { rows } = await c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2", [schema, `${prefixo}%`])
      if (rows[0].n >= n) return; await esperar(10)
    }
    assert.fail(`Lock não observado: ${prefixo}`)
  }
  const dominio = (status, ids) => (e) => { assert.equal(e.statusCode, status); if (ids) assert.deepEqual(e.itensIndisponiveis.map((p) => p.produtoId), ids); return true }

  it('venda multiproduto consolida repetidos, liga histórico e confirma tudo no mesmo client', async () => {
    const a = await produto(8), b = await produto(5), lista = itens([b, 2], [a, 1], [a, 2]); const antes = await foto()
    const id = await criar(lista)
    assert.equal(await saldo(a), 5); assert.equal(await saldo(b), 3)
    const depois = await foto(); assert.equal(depois.vendas - antes.vendas, 1); assert.equal(depois.itens - antes.itens, 2)
    assert.equal(depois.operacoes - antes.operacoes, 1); assert.equal(depois.movimentos - antes.movimentos, 2)
    for (const [p, q] of [[a, 3], [b, 2]]) {
      const h = await historico(p), m = h.itens[0]; assert.equal(m.tipo, 'baixa_venda'); assert.equal(m.origem, 'venda'); assert.equal(m.vendaId, id)
      assert.equal(m.operacaoOriginalId, null); assert.equal(m.autorId, null); assert.equal(m.quantidade, q); assert.equal(m.delta, -q)
      for (const campo of ['hashRequisicao', 'chaveIdempotencia', 'movimentoOriginalId', 'email', 'clienteId']) assert.equal(campo in m, false)
      assert.equal('vendaId' in h.itens.find((x) => x.tipo === 'entrada'), false)
    }
    await reconciliar()
  })
  it('retry de baixa não debita novamente e intenção diferente retorna 409', async () => {
    const p = await produto(5), lista = itens([p, 2]), id = await criar(lista), antes = await foto()
    await tx((client) => estoque.baixarParaVenda(id, lista, client))
    await assert.rejects(tx((client) => estoque.baixarParaVenda(id, itens([p, 3]), client)), dominio(409))
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(p), 3)
    await cancelar(id); await tx((client) => estoque.baixarParaVenda(id, lista, client)); assert.equal(await saldo(p), 5); await reconciliar()
  })
  it('falta de vários produtos informa todos os IDs/quantidades e desfaz venda e itens', async () => {
    const a = await produto(2), b = await produto(0), d = await produto(1), antes = await foto()
    await assert.rejects(criar(itens([d, 2], [a, 1], [b, 3])), (e) => {
      assert.equal(e.statusCode, 409); assert.deepEqual(e.itensIndisponiveis, itens([b, 3], [d, 2])); assert.doesNotMatch(JSON.stringify(e.detalhes), /Só restam|saldo|SELECT/); return true
    })
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(a), 2); await reconciliar()
  })
  it('inexistente ou inativo não é elegível; não há baixa parcial nem operação órfã', async () => {
    const a = await produto(2), inativo = await produto(4, { ativo: false }), antes = await foto()
    await assert.rejects(criar(itens([a, 1], [inativo, 1])), dominio(409, [inativo]))
    await assert.rejects(tx(async (client) => { const id = await venda(client, itens([a, 1])); await estoque.baixarParaVenda(id, itens([a, 1], [2147483647, 2]), client) }), dominio(409, [2147483647]))
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(a), 2); await reconciliar()
  })
  it('itens devem corresponder aos registros da venda; ID inexistente recebe 404', async () => {
    const p = await produto(8), antes = await foto()
    await assert.rejects(tx(async (client) => { const id = await venda(client, itens([p, 1])); await estoque.baixarParaVenda(id, itens([p, 2]), client) }), dominio(409))
    for (const f of [(client) => estoque.baixarParaVenda(2147483647, itens([p, 1]), client), (client) => estoque.estornarVenda(2147483647, client)]) await assert.rejects(tx(f), dominio(404))
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(p), 8)
  })
  it('primeira baixa de venda paga ou cancelada é recusada', async () => {
    const p = await produto(4), antes = await foto()
    for (const status of ['paga', 'cancelada']) await assert.rejects(tx(async (client) => {
      const id = await venda(client, itens([p, 1])); await client.query('UPDATE vendas SET status=$2 WHERE id=$1', [id, status]); await estoque.baixarParaVenda(id, itens([p, 1]), client)
    }), dominio(409))
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(p), 4)
  })
  it('recusa execução sem BEGIN antes de qualquer escrita', async () => {
    const p = await produto(2), id = await tx((client) => venda(client, itens([p, 1]))), antes = await foto(), client = await pool.connect()
    try {
      for (const f of [() => estoque.baixarParaVenda(id, itens([p, 1]), client), () => estoque.estornarVenda(id, client)]) await assert.rejects(f(), (e) => e.code === '25P01')
    } finally { client.release() }
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(p), 2)
  })
  it('falha no segundo movimento desfaz a primeira baixa, venda, itens e chave de operação', async () => {
    const a = await produto(5), b = await produto(5), antes = await foto()
    await c.query(`CREATE FUNCTION falhar_segundo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tipo='baixa_venda' AND NEW.produto_id=${b} THEN RAISE EXCEPTION 'FALHA_CONTROLADA'; END IF; RETURN NEW; END $$`)
    await c.query('CREATE TRIGGER falhar_segundo BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION falhar_segundo()')
    try { await assert.rejects(criar(itens([a, 2], [b, 2])), (e) => e.code === 'P0001') }
    finally { await c.query('DROP TRIGGER falhar_segundo ON movimentacoes_estoque'); await c.query('DROP FUNCTION falhar_segundo()') }
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(a), 5); assert.equal(await saldo(b), 5); await reconciliar()
  })
  it('erro do Backend 2 depois do helper também desfaz toda a transação', async () => {
    const p = await produto(2), antes = await foto()
    await assert.rejects(tx(async (client) => { const id = await venda(client, itens([p, 1])); await estoque.baixarParaVenda(id, itens([p, 1]), client); throw new Error('Falha posterior da venda') }), /Falha posterior/)
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(p), 2); await reconciliar()
  })
  it('duas vendas disputando a última unidade: uma confirma e outra 409 sem resíduos', async () => {
    const p = await produto(1), antes = await foto(), gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); let pendentes = []
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [p])
      pendentes = [criar(itens([p, 1])), criar(itens([p, 1]))].map((promise) => promise.then((id) => ({ id }), (erro) => ({ erro })))
      await lockObservado('SELECT estoque, ativo FROM produtos', 2); await gate.query('COMMIT')
      const r = await Promise.all(pendentes); assert.equal(r.filter((x) => x.id).length, 1); const erro = r.find((x) => x.erro).erro
      assert.equal(erro.statusCode, 409); assert.deepEqual(erro.itensIndisponiveis, itens([p, 1])); assert.equal(await saldo(p), 0)
    } finally { await gate.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end() }
    const depois = await foto(); assert.equal(depois.vendas - antes.vendas, 1); assert.equal(depois.itens - antes.itens, 1)
    assert.equal(depois.operacoes - antes.operacoes, 1); assert.equal(depois.movimentos - antes.movimentos, 1); await reconciliar()
  })
  it('locks seguem IDs crescentes mesmo com arrays invertidos: maior permanece livre enquanto menor bloqueia', async () => {
    const a = await produto(10), b = await produto(10), gate = new pg.Client({ connectionString: urlApp.toString() }), prova = new pg.Client({ connectionString: urlApp.toString() })
    await gate.connect(); await prova.connect(); let pendentes = []
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [a])
      pendentes = [criar(itens([b, 1], [a, 1])), criar(itens([a, 1], [b, 1]))]
      await lockObservado('SELECT estoque, ativo FROM produtos', 2)
      await prova.query('BEGIN'); await prova.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE NOWAIT', [b]); await prova.query('ROLLBACK')
      await gate.query('COMMIT'); await Promise.all(pendentes)
      assert.equal(await saldo(a), 8); assert.equal(await saldo(b), 8)
    } finally { await gate.query('ROLLBACK'); await prova.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end(); await prova.end() }
    await reconciliar()
  })
  it('estorno multiproduto usa baixas imutáveis mesmo se itens_venda mudar e produto ficar inativo', async () => {
    const a = await produto(10), b = await produto(10), id = await criar(itens([a, 2], [b, 3]))
    await c.query('UPDATE itens_venda SET quantidade=99 WHERE venda_id=$1', [id]); await c.query('DELETE FROM itens_venda WHERE venda_id=$1 AND produto_id=$2', [id, b])
    await c.query('UPDATE produtos SET ativo=false WHERE id=$1', [a]); await cancelar(id)
    assert.equal(await saldo(a), 10); assert.equal(await saldo(b), 10)
    assert.equal((await c.query('SELECT ativo FROM produtos WHERE id=$1', [a])).rows[0].ativo, false)
    const ops = (await c.query('SELECT id,tipo_venda,operacao_original_id FROM operacoes_estoque WHERE venda_id=$1 ORDER BY tipo_venda', [id])).rows
    assert.equal(ops.length, 2); assert.equal(ops[1].operacao_original_id, ops[0].id)
    const h = await historico(a); assert.equal(h.itens[0].tipo, 'estorno_venda'); assert.equal(h.itens[0].quantidade, 2); assert.equal(h.itens[0].operacaoOriginalId, ops[0].id)
    await reconciliar()
  })
  it('estorno repetido e concorrente devolve somente uma vez para toda a venda', async () => {
    const a = await produto(5), b = await produto(5), id = await criar(itens([a, 2], [b, 3])), antes = await foto()
    await c.query("UPDATE vendas SET status='cancelada' WHERE id=$1", [id])
    const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); let pendentes = []
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM vendas WHERE id=$1 FOR NO KEY UPDATE', [id])
      pendentes = [tx((client) => estoque.estornarVenda(id, client)), tx((client) => estoque.estornarVenda(id, client))]
      await lockObservado('SELECT status FROM vendas', 2); await gate.query('COMMIT'); await Promise.all(pendentes)
    } finally { await gate.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end() }
    await tx((client) => estoque.estornarVenda(id, client))
    assert.equal(await saldo(a), 5); assert.equal(await saldo(b), 5)
    const depois = await foto(); assert.equal(depois.operacoes - antes.operacoes, 1); assert.equal(depois.movimentos - antes.movimentos, 2); await reconciliar()
  })
  for (const status of ['aguardando_pagamento', 'paga', 'em_separacao', 'pronta_retirada', 'cancelamento_solicitado', 'enviada', 'entregue']) {
    it(`não devolve prematuramente com status ${status}`, async () => {
      const p = await produto(2), id = await criar(itens([p, 1]))
      if (status === 'enviada') await c.query("UPDATE vendas SET tipo_entrega='propria',entrega_cep='36000000',entrega_logradouro='Fixture',entrega_numero='1',entrega_bairro='Fixture',entrega_cidade='Fixture',entrega_uf='MG' WHERE id=$1", [id])
      await c.query('UPDATE vendas SET status=$2 WHERE id=$1', [id, status]); const antes = await foto()
      await assert.rejects(tx((client) => estoque.estornarVenda(id, client)), dominio(409)); assert.equal(await saldo(p), 1); assert.deepEqual(await foto(), antes)
    })
  }
  it('passagem histórica por envio impede devolução automática mesmo se estado atual for cancelada', async () => {
    const p = await produto(2), id = await criar(itens([p, 1]))
    await c.query("INSERT INTO historico_status_venda(venda_id,status_anterior,status_novo,origem) VALUES($1,'em_separacao','enviada','sistema')", [id])
    await assert.rejects(cancelar(id), dominio(409)); assert.equal(await saldo(p), 1); assert.equal((await c.query('SELECT status FROM vendas WHERE id=$1', [id])).rows[0].status, 'aguardando_pagamento')
  })
  it('venda cancelada sem baixa original retorna 409 em vez de fabricar crédito', async () => {
    const p = await produto(2), id = await tx((client) => venda(client, itens([p, 1]))), antes = await foto()
    await assert.rejects(cancelar(id), dominio(409)); assert.deepEqual(await foto(), antes); assert.equal(await saldo(p), 2)
  })
  it('overflow na devolução faz rollback também do cancelamento, sem créditos parciais', async () => {
    const a = await produto(3), b = await produto(2147483647), id = await criar(itens([a, 1], [b, 1]))
    await estoque.registrarMovimentacao(clienteId, { produtoId: b, tipo: 'entrada', quantidade: 1, motivo: 'Reposição de teste' }, randomUUID(), {})
    const antes = await foto(); await assert.rejects(cancelar(id), dominio(409))
    assert.equal(await saldo(a), 2); assert.equal(await saldo(b), 2147483647); assert.deepEqual(await foto(), antes)
    assert.equal((await c.query('SELECT status FROM vendas WHERE id=$1', [id])).rows[0].status, 'aguardando_pagamento'); await reconciliar()
  })
  it('quantidade INT32 máxima pode ser baixada e devolvida sem overflow intermediário', async () => {
    const p = await produto(2147483647), id = await criar(itens([p, 2147483647])); assert.equal(await saldo(p), 0)
    await cancelar(id); assert.equal(await saldo(p), 2147483647); await reconciliar()
  })
  for (const igual of [true, false]) {
    it(`duas baixas concorrentes da mesma venda, intenção ${igual ? 'igual' : 'diferente'}`, async () => {
      const p = await produto(6), id = await tx((client) => venda(client, itens([p, 2]))), antes = await foto()
      const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); let pendentes = []
      try {
        await gate.query('BEGIN'); await gate.query('SELECT id FROM vendas WHERE id=$1 FOR NO KEY UPDATE', [id])
        const primeira = tx((client) => estoque.baixarParaVenda(id, itens([p, 2]), client)).then(() => 200, (e) => e.statusCode)
        await lockObservado('SELECT status FROM vendas')
        const segunda = tx((client) => estoque.baixarParaVenda(id, itens([p, igual ? 2 : 3]), client)).then(() => 200, (e) => e.statusCode)
        pendentes = [primeira, segunda]; await lockObservado('SELECT status FROM vendas', 2)
        await gate.query('COMMIT'); assert.deepEqual(await Promise.all(pendentes), [200, igual ? 200 : 409])
      } finally { await gate.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end() }
      assert.equal(await saldo(p), 4); const depois = await foto(); assert.equal(depois.operacoes - antes.operacoes, 1); assert.equal(depois.movimentos - antes.movimentos, 1); await reconciliar()
    })
  }
  it('constraints garantem uma operação por venda/tipo, sem impedir vários produtos', async () => {
    const a = await produto(3), b = await produto(3), id = await criar(itens([a, 1], [b, 2]))
    const original = (await c.query("SELECT id FROM operacoes_estoque WHERE venda_id=$1 AND tipo_venda='baixa_venda'", [id])).rows[0].id
    await assert.rejects(c.query("INSERT INTO operacoes_estoque(id,origem,venda_id,tipo_venda) VALUES($1,'venda',$2,'baixa_venda')", [randomUUID(), id]), (e) => e.code === '23505')
    await cancelar(id)
    await assert.rejects(c.query("INSERT INTO operacoes_estoque(id,origem,venda_id,tipo_venda,operacao_original_id) VALUES($1,'venda',$2,'estorno_venda',$3)", [randomUUID(), id, original]), (e) => e.code === '23505')
    const r = (await c.query('SELECT tipo,count(*)::int AS n FROM movimentacoes_estoque WHERE operacao_id IN (SELECT id FROM operacoes_estoque WHERE venda_id=$1) GROUP BY tipo ORDER BY tipo', [id])).rows
    assert.deepEqual(r, [{ tipo: 'baixa_venda', n: 2 }, { tipo: 'estorno_venda', n: 2 }]); await reconciliar()
  })
  it('COMMIT de operação incompleta é recusado e desfaz uma baixa manual parcial', async () => {
    const a = await produto(4), b = await produto(4), antes = await foto()
    await assert.rejects(tx(async (client) => {
      const id = await venda(client, itens([a, 1], [b, 1])), op = randomUUID()
      await client.query("INSERT INTO operacoes_estoque(id,origem,venda_id,tipo_venda) VALUES($1,'venda',$2,'baixa_venda')", [op, id])
      await client.query('UPDATE produtos SET estoque=estoque-1 WHERE id=$1', [a])
      await client.query("INSERT INTO movimentacoes_estoque(operacao_id,produto_id,tipo,quantidade,delta,saldo_anterior,saldo_atual,motivo) VALUES($1,$2,'baixa_venda',1,-1,4,3,'Teste de integridade')", [op, a])
    }), (e) => e.code === '23514')
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(a), 4); assert.equal(await saldo(b), 4); await reconciliar()
  })
  it('compensação divergente é recusada e operação confirmada não aceita novos movimentos', async () => {
    const a = await produto(4), b = await produto(4), id = await criar(itens([a, 2]))
    const original = (await c.query("SELECT o.id,m.id::text AS movimento FROM operacoes_estoque o JOIN movimentacoes_estoque m ON m.operacao_id=o.id WHERE o.venda_id=$1 AND o.tipo_venda='baixa_venda'", [id])).rows[0]
    const antes = await foto()
    await assert.rejects(tx(async (client) => {
      await client.query("UPDATE vendas SET status='cancelada' WHERE id=$1", [id]); const op = randomUUID()
      await client.query("INSERT INTO operacoes_estoque(id,origem,venda_id,tipo_venda,operacao_original_id) VALUES($1,'venda',$2,'estorno_venda',$3)", [op, id, original.id])
      await client.query("INSERT INTO movimentacoes_estoque(operacao_id,produto_id,tipo,quantidade,delta,saldo_anterior,saldo_atual,motivo,movimento_original_id) VALUES($1,$2,'estorno_venda',3,3,2,5,'Quantidade inválida',$3)", [op, a, original.movimento])
    }), (e) => e.code === '23514')
    await c.query("INSERT INTO itens_venda(venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal) VALUES($1,$2,'Posterior',0,1,0)", [id, b])
    await assert.rejects(c.query("INSERT INTO movimentacoes_estoque(operacao_id,produto_id,tipo,quantidade,delta,saldo_anterior,saldo_atual,motivo) VALUES($1,$2,'baixa_venda',1,-1,4,3,'Append indevido')", [original.id, b]), (e) => e.code === '23514')
    assert.equal((await foto()).operacoes, antes.operacoes); assert.equal((await foto()).movimentos, antes.movimentos); await reconciliar()
  })
  it('falha no segundo crédito desfaz toda a devolução e a transição de cancelamento', async () => {
    const a = await produto(4), b = await produto(4), id = await criar(itens([a, 1], [b, 1])), antes = await foto()
    await c.query(`CREATE FUNCTION falhar_estorno() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.tipo='estorno_venda' AND NEW.produto_id=${b} THEN RAISE EXCEPTION 'ESTORNO_TESTE'; END IF; RETURN NEW; END $$`)
    await c.query('CREATE TRIGGER falhar_estorno BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION falhar_estorno()')
    try { await assert.rejects(cancelar(id), (e) => e.code === 'P0001') }
    finally { await c.query('DROP TRIGGER falhar_estorno ON movimentacoes_estoque'); await c.query('DROP FUNCTION falhar_estorno()') }
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(a), 3); assert.equal(await saldo(b), 3)
    assert.equal((await c.query('SELECT status FROM vendas WHERE id=$1', [id])).rows[0].status, 'aguardando_pagamento'); await reconciliar()
  })
  it('reaplicar evolução não altera saldos nem histórico já administrativo ou comercial', async () => {
    const antes = await foto(), saldos = (await c.query('SELECT id,estoque,atualizado_em FROM produtos ORDER BY id')).rows
    const sql = await readFile(new URL('../../db/init/31_estoque_vendas.sql', import.meta.url), 'utf8')
    await c.query(sql); await c.query(sql)
    assert.deepEqual(await foto(), antes); assert.deepEqual((await c.query('SELECT id,estoque,atualizado_em FROM produtos ORDER BY id')).rows, saldos)
    assert.equal((await c.query('SELECT count(*)::int AS n FROM migracoes_estoque')).rows[0].n, 2)
    for (const comando of ['UPDATE operacoes_estoque SET origem=origem', 'DELETE FROM movimentacoes_estoque', 'TRUNCATE movimentacoes_estoque']) await assert.rejects(c.query(comando), (e) => e.code === '55000')
    await reconciliar()
  })
  it('pagamento/retry não baixa novamente; webhook atual repetido não altera saldo/histórico', async () => {
    const p = await produto(2), id = await criar(itens([p, 1]))
    await c.query("UPDATE vendas SET status='paga' WHERE id=$1", [id]); await tx((client) => estoque.baixarParaVenda(id, itens([p, 1]), client))
    const antes = await foto(), logs = mock.method(console, 'info', () => {})
    const chavePublica = 't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'
    const body = JSON.stringify({ id: 'log_stock_test', event: 'transparent.completed', data: { vendaId: id } })
    for (let n = 0; n < 2; n++) {
      const r = await fetch(`${origem}/api/pagamentos/webhook?webhookSecret=${segredo}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': createHmac('sha256', chavePublica).update(body).digest('base64') }, body })
      assert.equal(r.status, 200)
    }
    assert.deepEqual(await foto(), antes); assert.equal(await saldo(p), 1); assert.doesNotMatch(JSON.stringify(logs.mock.calls), new RegExp(segredo)); await reconciliar()
  })
  it('rotas públicas mostram somente emEstoque após baixa/devolução, sem quantidade ou histórico', async () => {
    const p = await produto(1, { peixe: true }), id = await criar(itens([p, 1]))
    for (const disponivel of [false, true]) {
      if (disponivel) await cancelar(id)
      for (const rota of [`/api/produtos/${p}`, `/api/peixes/${p}`, '/api/produtos?categoria=peixes', '/api/peixes']) {
        const r = await fetch(`${origem}${rota}`); assert.equal(r.status, 200); const body = await r.json()
        for (const item of body.itens ?? [body]) if (item.id === p) {
          assert.equal(item.emEstoque, disponivel)
          for (const campo of ['estoque', 'quantidade', 'saldoAtual', 'movimentacoes', 'vendaId', 'autorId', 'operacaoId']) assert.equal(campo in item, false)
        }
      }
    }
    for (const tipo of ['baixa_venda', 'estorno_venda']) {
      const r = await fetch(`${origem}/api/estoque/movimentacoes`, { method: 'POST', headers: { Origin: cors, Cookie: `sid=${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ produtoId: p, tipo, quantidade: 1, motivo: 'Não permitir tipo interno' }) })
      assert.equal(r.status, 400)
    }
    await reconciliar()
  })
})
