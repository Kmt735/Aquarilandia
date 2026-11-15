import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile, readdir } from 'node:fs/promises'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const url = process.env.TEST_DATABASE_URL
describe('Estoque — listagem de saldos com PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL descartável.' }, () => {
  const schema = `saldos_${randomUUID().replaceAll('-', '')}`, tokens = new Map(), usuarios = new Map()
  let c, pool, servidor, api, cors, transacao, estoque, urlApp, criado = false
  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect(); await c.query(`CREATE SCHEMA ${schema}`); criado = true
    await c.query(`SET search_path TO ${schema}`)
    const pasta = new URL('../../db/init/', import.meta.url)
    for (const f of (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort()) await c.query(await readFile(new URL(f, pasta), 'utf8'))
    for (const [nome, papel, ativo, prazo] of [['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'],
      ['mutavel', 'admin', true, '1 hour'], ['vencido', 'admin', true, '-1 hour'], ['inativo', 'admin', false, '1 hour']]) {
      const id = (await c.query('INSERT INTO clientes(nome,email,senha_hash,papel,ativo)VALUES($1,$2,$3,$4,$5)RETURNING id', [nome, `${nome}@saldos.example`, 'hash-fixture', papel, ativo])).rows[0].id
      usuarios.set(nome, id); const token = randomUUID(); tokens.set(nome, token)
      await c.query('INSERT INTO sessoes(token_hash,cliente_id,expira_em)VALUES($1,$2,now()+$3::interval)', [hashToken(token), id, prazo])
    }
    urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts'); pool = (await import('../../src/config/db.ts')).db
    cors = (await import('../../src/config/env.ts')).env.corsOrigin
    transacao = (await import('../../src/utils/transacao.ts')).comTransacao
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening'); api = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(async () => { mock.restoreAll(); if (c) await reconciliar() })
  after(async () => {
    try { if (servidor) await new Promise((r) => servidor.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })
  const caminho = (query = {}) => `/api/estoque?${new URLSearchParams(query)}`
  const consultar = (path = caminho(), sessao = 'admin', method = 'GET') => fetch(api + path, {
    method, headers: sessao ? { Cookie: `sid=${tokens.get(sessao) ?? sessao}` } : {}, signal: AbortSignal.timeout(10000),
  })
  async function json(query = {}) {
    const r = await consultar(caminho(query)); assert.equal(r.status, 200, await r.clone().text())
    assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('vary'), /Cookie/)
    const h = await r.json()
    for (const item of h.itens) assert.deepEqual(Object.keys(item).sort(), ['produtoId', 'nome', 'ativo', 'saldoAtual'].sort())
    return h
  }
  async function aplicar(id, quantidade = 1, tipo = 'entrada') {
    const r = await fetch(api + '/api/estoque/movimentacoes', { method: 'POST', headers: {
      Cookie: `sid=${tokens.get('admin')}`, Origin: cors, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(),
    }, body: JSON.stringify({ produtoId: id, tipo, quantidade, motivo: 'Conferência fixture' }) })
    assert.equal(r.status, 201, await r.clone().text()); return r.json()
  }
  async function novo({ nome = `Produto ${randomUUID()}`, categoria = 'acessorios', ativo = true, saldo = 0, ficha = false } = {}) {
    const id = (await c.query('INSERT INTO produtos(categoria_id,nome,preco,ativo,imagem_url)SELECT id,$2,1999,$3,$4 FROM categorias WHERE slug=$1 RETURNING id', [categoria, nome, ativo, '/assets/fixture-legada.png'])).rows[0].id
    if (ficha) await c.query(`INSERT INTO peixes(produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)
      VALUES($1,$2,'doce',5,24,28,6,7,40,'pacifico','iniciante')`, [id, `Species ${randomUUID()}`])
    if (saldo) await aplicar(id, saldo)
    return id
  }
  async function reconciliar() {
    assert.deepEqual((await c.query('SELECT p.id FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id GROUP BY p.id HAVING p.estoque::bigint<>coalesce(sum(m.delta),0)')).rows, [])
  }
  async function foto() {
    const saida = {}
    const tabelas = (await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name", [schema])).rows
    for (const { table_name } of tabelas) {
      const nome = '"' + table_name.replaceAll('"', '""') + '"'
      saida[table_name] = (await c.query(`SELECT count(*)::text AS n,md5(coalesce(string_agg(linha::text,'' ORDER BY linha::text),'')) AS hash FROM (SELECT to_jsonb(t) AS linha FROM ${nome} t) s`)).rows[0]
    }
    return saida
  }

  it('base sem produtos retorna lista vazia, sem criar saldo ou movimentos', async () => {
    const antes = await foto(); assert.deepEqual(await json(), { itens: [], total: 0 }); assert.deepEqual(await foto(), antes)
  })
  it('produto recém-criado pelo POST aparece com zero, sem depender de histórico ou ficha', async () => {
    const categoriaId = (await c.query("SELECT id FROM categorias WHERE slug='acessorios'")).rows[0].id
    const nome = `Novo ${randomUUID()}`
    const r = await fetch(api + '/api/produtos', { method: 'POST', headers: { Cookie: `sid=${tokens.get('admin')}`, Origin: cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ categoriaId, nome, preco: 1999 }) })
    assert.equal(r.status, 201, await r.clone().text()); const p = await r.json(), antes = await foto()
    assert.deepEqual(await json({ busca: nome }), { itens: [{ produtoId: p.id, nome, ativo: true, saldoAtual: 0 }], total: 1 })
    const h = await consultar(`/api/estoque/movimentacoes?produtoId=${p.id}`); assert.deepEqual(await h.json(), { itens: [], total: 0 })
    assert.deepEqual(await foto(), antes)
  })
  for (const [sessao, status] of [[null, 401], ['inventada', 401], ['vencido', 401], ['inativo', 401], ['cliente', 403]]) {
    it(`sessão ${sessao} não recebe saldos privados, inclusive HEAD (${status})`, async () => {
      await novo({ saldo: 11, nome: `Privado ${randomUUID()}` }); const antes = await foto()
      for (const method of ['GET', 'HEAD']) {
        const r = await consultar(caminho({ ativo: 'invalido' }), sessao, method); assert.equal(r.status, status)
        assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('vary'), /Cookie/)
        assert.doesNotMatch(await r.text(), /saldoAtual|Privado|produtoId|"itens"/)
      }
      assert.deepEqual(await foto(), antes)
    })
  }
  it('mudança do papel e revogação impedem acesso com o mesmo cookie', async () => {
    assert.equal((await consultar(caminho(), 'mutavel')).status, 200)
    await c.query("UPDATE clientes SET papel='cliente' WHERE id=$1", [usuarios.get('mutavel')])
    let antes = await foto(); const r = await consultar(caminho(), 'mutavel'); assert.equal(r.status, 403); assert.doesNotMatch(await r.text(), /saldoAtual|produtoId/)
    assert.deepEqual(await foto(), antes)
    await c.query('DELETE FROM sessoes WHERE cliente_id=$1', [usuarios.get('mutavel')]); antes = await foto()
    assert.equal((await consultar(caminho(), 'mutavel')).status, 401); assert.deepEqual(await foto(), antes)
  })
  it('padrão inclui ativos/inativos e zero/positivo; cada linha coincide com a consulta individual', async () => {
    const prefixo = `Matriz ${randomUUID()}`, esperados = []
    for (const [ativo, saldo] of [[true, 0], [true, 4], [false, 0], [false, 7]]) {
      const nome = `${prefixo} ${esperados.length}`, id = await novo({ nome, ativo, saldo })
      esperados.push({ produtoId: id, nome, ativo, saldoAtual: saldo })
    }
    const antes = await foto(), h = await json({ busca: prefixo })
    assert.deepEqual(h, { itens: esperados, total: 4 })
    for (const item of h.itens) assert.deepEqual(await (await consultar(`/api/estoque/${item.produtoId}`)).json(), item)
    assert.deepEqual(await foto(), antes)
  })
  for (const campo of ['ativo', 'em_estoque']) for (const valor of ['true', 'false']) {
    it(`filtro isolado ${campo}=${valor} tem total e itens corretos`, async () => {
      const antes = await foto(), h = await json({ [campo]: valor, limite: '100' })
      const predicado = campo === 'ativo' ? `p.ativo=${valor}` : valor === 'true' ? 'p.estoque>0' : 'p.estoque=0'
      const esperado = (await c.query(`SELECT p.id AS "produtoId",p.nome,p.ativo,p.estoque AS "saldoAtual" FROM produtos p WHERE ${predicado} ORDER BY p.nome,p.id`)).rows
      assert.ok(esperado.length > 0); assert.deepEqual(h, { itens: esperado, total: esperado.length }); assert.deepEqual(await foto(), antes)
    })
  }
  it('categoria filtra por slug; inexistente é vazio e normalização segue trim do catálogo', async () => {
    await novo({ categoria: 'filtros' }); await novo({ categoria: 'peixes' })
    const antes = await foto(), h = await json({ categoria: ' filtros ', limite: '100' })
    const esperado = (await c.query("SELECT p.id AS \"produtoId\",p.nome,p.ativo,p.estoque AS \"saldoAtual\" FROM produtos p JOIN categorias c ON c.id=p.categoria_id WHERE c.slug='filtros' ORDER BY p.nome,p.id")).rows
    assert.deepEqual(h, { itens: esperado, total: esperado.length })
    assert.deepEqual(await json({ categoria: 'categoria-inexistente' }), { itens: [], total: 0 }); assert.deepEqual(await foto(), antes)
  })
  it('busca somente no nome, sem diferenciar caixa; %, _ , ! e barra invertida são literais', async () => {
    const p = `Busca ${randomUUID()}`, nomes = [`${p} Filtro 50%`, `${p} Filtro 500X`, `${p} Com_Kit`, `${p} ComXKit`, `${p}!`, `${p} Barra\\Kit`, `${p} BarraKit`]
    const ids = []
    for (const nome of nomes) ids.push(await novo({ nome }))
    const id = await novo({ nome: `${p} Nome` }); await c.query('UPDATE produtos SET descricao=$2::text,marca=$2::text WHERE id=$1', [id, `${p} ApenasNaDescricao`])
    const antes = await foto()
    for (const [busca, indice] of [[`  ${p.toUpperCase()} fIlTrO 50%  `, 0], [`${p} Com_`, 2], [`${p}!`, 4], [`${p} Barra\\`, 5]]) {
      const h = await json({ busca }); assert.equal(h.total, 1); assert.deepEqual(h.itens.map((x) => x.produtoId), [ids[indice]])
    }
    assert.deepEqual(await json({ busca: `${p} ApenasNaDescricao` }), { itens: [], total: 0 }); assert.deepEqual(await foto(), antes)
  })
  it('combina busca/categoria/booleans/ordem com contagem anterior à paginação', async () => {
    const p = `Combinado ${randomUUID()}`, ids = []
    for (const saldo of [6, 9, 9]) ids.push(await novo({ nome: `${p} Mesmo`, categoria: 'filtros', ativo: false, saldo }))
    await novo({ nome: `${p} Ativo`, categoria: 'filtros', saldo: 9 }); await novo({ nome: `${p} Zero`, categoria: 'filtros', ativo: false })
    await novo({ nome: `${p} OutraCategoria`, categoria: 'acessorios', ativo: false, saldo: 9 })
    const filtro = { busca: p, categoria: 'filtros', ativo: 'false', em_estoque: 'true', ordem: '-saldo', limite: '2' }, antes = await foto()
    const h = await json(filtro); assert.equal(h.total, 3); assert.deepEqual(h.itens.map((x) => x.produtoId), ids.slice(1))
    const h2 = await json({ ...filtro, pagina: '2' }); assert.equal(h2.total, 3); assert.deepEqual(h2.itens.map((x) => x.produtoId), [ids[0]])
    assert.deepEqual(await json({ ...filtro, pagina: '3' }), { itens: [], total: 3 }); assert.deepEqual(await foto(), antes)
  })
  it('quatro ordenações com empates são estáveis e desempatem por ID crescente', async () => {
    const p = `Ordem ${randomUUID()}`, ids = []
    for (const [sufixo, saldo] of [['A', 0], ['A', 5], ['B', 5], ['C', 1], ['C', 5]]) ids.push(await novo({ nome: `${p} ${sufixo}`, saldo }))
    const ordens = { nome: [0, 1, 2, 3, 4], '-nome': [3, 4, 2, 0, 1], saldo: [0, 3, 1, 2, 4], '-saldo': [1, 2, 4, 3, 0] }, antes = await foto()
    for (const [ordem, indices] of Object.entries(ordens)) for (let rodada = 0; rodada < 2; rodada++) {
      const lidos = []
      for (let pagina = 1; pagina <= 3; pagina++) { const h = await json({ busca: p, ordem, pagina: String(pagina), limite: '2' }); assert.equal(h.total, 5); lidos.push(...h.itens.map((x) => x.produtoId)) }
      assert.deepEqual(lidos, indices.map((i) => ids[i]))
      assert.deepEqual(await json({ busca: p, ordem, pagina: '4', limite: '2' }), { itens: [], total: 5 })
    }
    assert.deepEqual(await foto(), antes)
  })
  it('defaults 1/20 não cortam total e limite100 permite navegar todo o conjunto', async () => {
    const p = `Paginar ${randomUUID()}`
    for (let n = 0; n < 23; n++) await novo({ nome: `${p} ${String(n).padStart(2, '0')}` })
    const antes = await foto(), h = await json({ busca: p }); assert.equal(h.total, 23); assert.equal(h.itens.length, 20)
    assert.equal((await json({ busca: p, pagina: '2' })).itens.length, 3)
    assert.equal((await json({ busca: p, limite: '100' })).itens.length, 23); assert.deepEqual(await foto(), antes)
  })
  it('movimentação, baixa e devolução tornam saldo atual visível sem mudar contrato individual/histórico', async () => {
    const nome = `Venda ${randomUUID()}`, id = await novo({ nome })
    const ler = async () => (await json({ busca: nome })).itens[0].saldoAtual
    assert.equal(await ler(), 0); await aplicar(id, 5); assert.equal(await ler(), 5)
    const venda = await transacao(async (tx) => {
      const v = (await tx.query(`INSERT INTO vendas(cliente_id,subtotal,frete,total,tipo_entrega,entrega_destinatario,entrega_telefone,prazo_entrega_dias)
        VALUES($1,0,0,0,'retirada','Fixture','32999999999',1) RETURNING id`, [usuarios.get('cliente')])).rows[0].id
      await tx.query("INSERT INTO itens_venda(venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal)VALUES($1,$2,'Fixture',0,2,0)", [v, id])
      await estoque.baixarParaVenda(v, [{ produtoId: id, quantidade: 2 }], tx); return v
    })
    assert.equal(await ler(), 3)
    await transacao(async (tx) => { await tx.query("UPDATE vendas SET status='cancelada' WHERE id=$1", [venda]); await estoque.estornarVenda(venda, tx) })
    const antes = await foto(); assert.equal(await ler(), 5)
    const individual = await (await consultar(`/api/estoque/${id}`)).json(); assert.deepEqual((await json({ busca: nome })).itens[0], individual)
    const h = await (await consultar(`/api/estoque/movimentacoes?produtoId=${id}`)).json()
    assert.equal(h.total, 3); assert.deepEqual(h.itens.map((m) => m.tipo), ['estorno_venda', 'baixa_venda', 'entrada'])
    assert.deepEqual(await foto(), antes)
  })
  it('leitura não bloqueia nem vê saldo parcial de uma escrita ainda não confirmada', async () => {
    const nome = `Concorrente ${randomUUID()}`, id = await novo({ nome, saldo: 5 })
    await c.query('CREATE FUNCTION pausar_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_SCHEMA)); RETURN NEW; END $$')
    await c.query('CREATE TRIGGER pausar_fixture BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION pausar_fixture()')
    const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); let pendente
    try {
      await gate.query('SELECT pg_advisory_lock(hashtext($1))', [schema]); pendente = aplicar(id, 5, 'saida')
      let bloqueou = false
      for (let n = 0; n < 500; n++) {
        if ((await c.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'INSERT INTO movimentacoes_estoque%'", [schema])).rows.length) { bloqueou = true; break }
        await esperar(10)
      }
      assert.equal(bloqueou, true, 'INSERT precisa estar bloqueado depois do UPDATE')
      const h = await json({ busca: nome, em_estoque: 'true' }); assert.equal(h.total, 1); assert.equal(h.itens[0].saldoAtual, 5)
      assert.equal((await (await consultar(`/api/estoque/${id}`)).json()).saldoAtual, 5)
      assert.equal((await (await consultar(`/api/estoque/movimentacoes?produtoId=${id}`)).json()).total, 1)
      await gate.query('SELECT pg_advisory_unlock(hashtext($1))', [schema]); await pendente
      assert.deepEqual(await json({ busca: nome, em_estoque: 'true' }), { itens: [], total: 0 })
      assert.equal((await json({ busca: nome, em_estoque: 'false' })).itens[0].saldoAtual, 0)
    } finally {
      await gate.query('SELECT pg_advisory_unlock(hashtext($1))', [schema]); if (pendente) await Promise.allSettled([pendente]); await gate.end()
      await c.query('DROP TRIGGER pausar_fixture ON movimentacoes_estoque'); await c.query('DROP FUNCTION pausar_fixture()')
    }
  })
  it('parâmetros inválidos falham antes da consulta de saldos; HEAD mantém contrato/cache', async () => {
    const antes = await foto(), consultas = [], query = pool.query.bind(pool)
    mock.method(pool, 'query', (...args) => { consultas.push(args[0]); return query(...args) })
    for (const q of ['ativo=1', 'em_estoque=TRUE', 'ativo=false&ativo=true', 'busca[]=x', 'busca=x&busca=y', 'categoria=Filtros',
      'ordem=preco', 'ordem=saldo&ordem=nome', 'pagina=0', 'pagina=1%0A', 'pagina=9007199254740991&limite=100', 'limite=101', 'abaixoDe=3', 'produtoId=1', '__proto__=admin']) {
      const r = await consultar('/api/estoque?' + q); assert.equal(r.status, 400, q); assert.equal((await r.json()).erro, 'Parâmetros inválidos')
    }
    assert.ok(consultas.every((sql) => sql.includes('FROM sessoes')), 'inválidos não podem consultar produtos/histórico')
    mock.restoreAll(); const r = await consultar(caminho(), 'admin', 'HEAD'); assert.equal(r.status, 200); assert.equal(await r.text(), '')
    assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('vary'), /Cookie/); assert.deepEqual(await foto(), antes)
  })
  it('falha do banco não expõe SQL, dados privados ou mensagens do driver', async () => {
    const antes = await foto(), logs = mock.method(console, 'error', () => {})
    await c.query('ALTER TABLE produtos RENAME COLUMN estoque TO saldo_indisponivel_fixture')
    try {
      const r = await consultar(); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
      assert.equal(r.headers.get('cache-control'), 'no-store'); assert.doesNotMatch(JSON.stringify(logs.mock.calls), /SELECT|saldo_indisponivel_fixture|sid=|hash|senha|saldos.example/)
    } finally { await c.query('ALTER TABLE produtos RENAME COLUMN saldo_indisponivel_fixture TO estoque') }
    assert.deepEqual(await foto(), antes)
  })
  it('quantidades exatas não aparecem no catálogo ou peixes públicos', async () => {
    const nome = `Peixe ${randomUUID()}`, id = await novo({ nome, categoria: 'peixes', ficha: true, saldo: 7 })
    const inativo = await novo({ categoria: 'peixes', ficha: true, saldo: 9, ativo: false }), antes = await foto()
    assert.equal((await json({ busca: nome })).itens[0].saldoAtual, 7)
    for (const path of [`/api/produtos/${id}`, `/api/peixes/${id}`, `/api/produtos?busca=${encodeURIComponent(nome)}`, `/api/peixes?busca=${encodeURIComponent(nome)}`]) {
      const r = await fetch(api + path); assert.equal(r.status, 200); const body = await r.json()
      for (const p of body.itens ?? [body]) {
        assert.equal(p.emEstoque, true)
        for (const campo of ['estoque', 'saldoAtual', 'saldoPosterior', 'reservado', 'movimentacoes', 'autorId']) assert.equal(campo in p, false, campo)
      }
    }
    assert.equal((await fetch(`${api}/api/produtos/${inativo}`)).status, 404); assert.equal((await fetch(`${api}/api/peixes/${inativo}`)).status, 404)
    assert.deepEqual(await foto(), antes)
  })
})
