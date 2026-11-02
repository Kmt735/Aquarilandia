import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'
import { fichasCadastro } from '../fixtures/produto-cadastro.mjs'

const urlTeste = process.env.TEST_DATABASE_URL
describe('Ciclo 2 — produtos inativos, reativação e concorrência PostgreSQL', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.',
}, () => {
  const schema = `teste_inativos_${randomUUID().replaceAll('-', '')}`
  const tokens = new Map(), usuarios = new Map(), categorias = new Map()
  let cliente, pool, servidor, origem, cors, urlApp, criado = false
  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); criado = true; await cliente.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) await cliente.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    for (const c of (await cliente.query('SELECT id,slug FROM categorias')).rows) categorias.set(c.slug, c.id)
    for (const [nome, papel, ativo, intervalo] of [['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'], ['vencido', 'admin', true, '-1 hour'], ['inativo', 'admin', false, '1 hour'], ['mutavel', 'admin', true, '1 hour'], ['revogado', 'admin', true, '1 hour']]) {
      const id = (await cliente.query('INSERT INTO clientes(nome,email,senha_hash,papel,ativo) VALUES($1,$2,$3,$4,$5) RETURNING id', [nome, `${nome}@fixture.example`, 'hash-fixture', papel, ativo])).rows[0].id
      usuarios.set(nome, id); const token = randomUUID(); tokens.set(nome, token)
      await cliente.query('INSERT INTO sessoes(token_hash,cliente_id,expira_em) VALUES($1,$2,now()+$3::interval)', [hashToken(token), id, intervalo])
    }
    await cliente.query('DELETE FROM sessoes WHERE cliente_id=$1', [usuarios.get('revogado')])
    urlApp = new URL(urlTeste); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts'); const { db } = await import('../../src/config/db.ts'); const { env } = await import('../../src/config/env.ts')
    pool = db; cors = env.corsOrigin; servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening'); origem = `http://127.0.0.1:${servidor.address().port}`
  })
  after(async () => {
    try { if (servidor) await new Promise((r) => servidor.close(r)); if (pool) await pool.end() }
    finally { if (cliente) { try { if (criado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await cliente.end() } } }
  })
  function chamada(path, { sessao = 'admin', method = 'GET', body, origin } = {}) {
    const headers = {}
    if (sessao) headers.Cookie = `sid=${tokens.get(sessao) ?? sessao}`
    if (method !== 'GET') headers.Origin = origin === undefined ? cors : origin
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    return fetch(`${origem}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  const reativar = (id, opcoes = {}) => chamada(`/produtos/${id}/reativar`, { method: 'POST', ...opcoes })
  const estado = async (id) => (await cliente.query('SELECT * FROM produtos WHERE id=$1', [id])).rows[0]
  async function novo(tipo = 'acessorios', ativo = false, nome = randomUUID()) {
    const f = fichasCadastro.find((f) => f.tipo === tipo)
    const dados = f ? { ...f.minimos, ...f.extras } : null
    if (tipo === 'peixes') dados.nomeCientifico += randomUUID()
    const r = await chamada('/produtos', { method: 'POST', body: { categoriaId: categorias.get(tipo), nome, preco: 12345, ficha: dados ? { tipo, dados } : null } })
    assert.equal(r.status, 201); const p = await r.json()
    await cliente.query("UPDATE produtos SET ativo=$2,estoque=7,imagem_url='https://fixture.example/imagem.png',atualizado_em='2001-01-01' WHERE id=$1", [p.id, ativo])
    return p
  }
  async function corpo(path, opcoes) { const r = await chamada(path, opcoes); assert.equal(r.status, 200); return r.json() }
  async function esperarLock(prefixo, total = 1) {
    for (let n = 0; n < 300; n++) {
      const rows = (await cliente.query("SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2", [schema, `${prefixo}%`])).rows
      if (rows[0].n >= total) return
      await esperar(20)
    }
    assert.fail(`Não observou lock de ${prefixo}`)
  }
  for (const [sessao, status] of [[null, 401], ['inventado', 401], ['vencido', 401], ['inativo', 401], ['revogado', 401], ['cliente', 403]]) {
    it(`sessão ${sessao}: listagem, detalhe e reativação retornam ${status}`, async () => {
      const p = await novo(); const antes = await estado(p.id)
      for (const r of [await chamada('/produtos?incluir_inativos=true', { sessao }), await chamada(`/produtos/${p.id}?incluir_inativos=true`, { sessao }), await reativar(p.id, { sessao })]) {
        assert.equal(r.status, status); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.equal('nome' in await r.json(), false)
      }
      assert.deepEqual(await estado(p.id), antes)
    })
  }
  it('papel atual e revogação da sessão são consultados novamente', async () => {
    assert.equal((await chamada('/produtos?incluir_inativos=true', { sessao: 'mutavel' })).status, 200)
    await cliente.query("UPDATE clientes SET papel='cliente' WHERE id=$1", [usuarios.get('mutavel')])
    assert.equal((await chamada('/produtos?incluir_inativos=true', { sessao: 'mutavel' })).status, 403)
    await cliente.query('DELETE FROM sessoes WHERE cliente_id=$1', [usuarios.get('mutavel')])
    assert.equal((await chamada('/produtos?incluir_inativos=true', { sessao: 'mutavel' })).status, 401)
  })
  it('admin pagina e conta ativos/inativos após filtros sem afetar total público', async () => {
    const prefixo = `Listagem ${randomUUID()}`
    const ids = []
    for (let n = 0; n < 5; n++) ids.push((await novo('acessorios', n % 2 === 0, `${prefixo} ${n}`)).id)
    const base = `busca=${encodeURIComponent(prefixo)}`
    const publico = await corpo(`/produtos?${base}`, { sessao: null }); assert.equal(publico.total, 3)
    assert.ok(publico.itens.every((p) => !('ativo' in p)))
    const todos = await corpo(`/produtos?incluir_inativos=true&${base}&limite=2&pagina=2`)
    assert.equal(todos.total, 5); assert.deepEqual(todos.itens.map((p) => p.id), ids.slice(2, 4))
    const inativos = await corpo(`/produtos?incluir_inativos=true&ativo=false&${base}&limite=1&pagina=2`)
    assert.equal(inativos.total, 2); assert.equal(inativos.itens[0].id, ids[3]); assert.equal(inativos.itens[0].ativo, false)
    assert.deepEqual(await corpo(`/produtos?incluir_inativos=true&ativo=false&${base}&pagina=99`), { itens: [], total: 2 })
    assert.equal((await corpo(`/produtos?${base}`, { sessao: null })).total, 3)
    assert.ok(todos.itens.every((p) => !('estoque' in p) && !('criado_em' in p)))
  })
  for (const f of fichasCadastro) {
    it(`reativa ${f.tipo}, preserva produto/ficha e repete sem escrita`, async () => {
      const p = await novo(f.tipo); const antes = await estado(p.id)
      const fichaAntes = (await cliente.query(`SELECT * FROM ${f.tipo} WHERE produto_id=$1`, [p.id])).rows
      const admin = await corpo(`/produtos/${p.id}?incluir_inativos=true`)
      assert.equal(admin.ativo, false); assert.equal(admin.ficha.tipo, f.tipo)
      assert.equal((await chamada(`/produtos/${p.id}`, { sessao: null })).status, 404)
      assert.equal((await chamada(`/produtos/${p.id}`)).status, 404)
      assert.equal((await corpo(`/produtos?busca=${encodeURIComponent(p.nome)}`, { sessao: null })).total, 0)
      const r = await reativar(p.id); assert.equal(r.status, 200); const reativado = await r.json(); assert.equal(reativado.ativo, true)
      const depois = await estado(p.id)
      assert.deepEqual({ ...depois, ativo: antes.ativo, atualizado_em: antes.atualizado_em }, antes)
      assert.deepEqual((await cliente.query(`SELECT * FROM ${f.tipo} WHERE produto_id=$1`, [p.id])).rows, fichaAntes)
      const { ativo, ...publico } = reativado; assert.equal(ativo, true)
      assert.deepEqual(await corpo(`/produtos/${p.id}`, { sessao: null }), publico)
      assert.equal((await reativar(p.id)).status, 200); assert.deepEqual(await estado(p.id), depois)
      assert.equal((await corpo(`/produtos?busca=${encodeURIComponent(p.nome)}`, { sessao: null })).total, 1)
      if (f.tipo === 'peixes') {
        assert.deepEqual(await corpo(`/peixes/${p.id}`, { sessao: null }), publico)
        assert.equal((await corpo(`/peixes?busca=${encodeURIComponent(p.nome)}`, { sessao: null })).total, 1)
      }
      assert.equal((await chamada(`/produtos/${p.id}`, { method: 'PATCH', body: { ativo: false } })).status, 400)
      assert.equal((await chamada(`/produtos/${p.id}`, { method: 'DELETE' })).status, 204)
      assert.equal((await chamada(`/produtos/${p.id}`, { sessao: null })).status, 404)
      assert.equal((await chamada(`/produtos/${p.id}`)).status, 404)
      assert.equal((await corpo(`/produtos?busca=${encodeURIComponent(p.nome)}`, { sessao: null })).total, 0)
    })
  }
  it('filtros técnicos e limites continuam aplicados aos inativos', async () => {
    const p = await novo('aquarios')
    const filtros = `categoria=aquarios&volume_min=40&volume_max=40&tipo_agua=doce&busca=${encodeURIComponent(p.nome)}`
    const lista = await corpo(`/produtos?incluir_inativos=true&ativo=false&${filtros}`)
    assert.equal(lista.total, 1); assert.equal(lista.itens[0].id, p.id)
    assert.equal((await corpo(`/produtos?${filtros}`, { sessao: null })).total, 0)
    assert.equal((await corpo(`/produtos?incluir_inativos=true&ativo=false&${filtros}&vazao_min=1`)).total, 0)
  })
  it('reativação preserva vínculos, cópias e histórico de venda já existente', async () => {
    const p = await novo('peixes')
    const venda = (await cliente.query(`INSERT INTO vendas (cliente_id,subtotal,frete,total,tipo_entrega,
      entrega_destinatario,entrega_telefone,prazo_entrega_dias) VALUES ($1,12345,0,12345,'retirada','Fixture','32999999999',0) RETURNING id`, [usuarios.get('cliente')])).rows[0]
    await cliente.query('INSERT INTO itens_venda(venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal) VALUES($1,$2,$3,12345,1,12345)', [venda.id, p.id, p.nome])
    await cliente.query("INSERT INTO historico_status_venda(venda_id,status_novo,origem) VALUES($1,'aguardando_pagamento','sistema')", [venda.id])
    const tabelas = ['vendas', 'itens_venda', 'historico_status_venda']
    const snapshots = () => Promise.all(tabelas.map(async (t) => (await cliente.query(`SELECT * FROM ${t} ORDER BY id`)).rows))
    const antes = await snapshots()
    assert.equal((await reativar(p.id)).status, 200)
    assert.deepEqual(await snapshots(), antes)
    assert.equal((await cliente.query('SELECT produto_id FROM itens_venda WHERE venda_id=$1', [venda.id])).rows[0].produto_id, p.id)
  })
  it('peixe sem ficha reativado aparece só na lista genérica, não nos atalhos', async () => {
    const id = (await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,ativo) VALUES($1,'Legado ciclo2 sem ficha',123,false) RETURNING id", [categorias.get('peixes')])).rows[0].id
    assert.equal((await reativar(id)).status, 200)
    assert.equal((await corpo(`/produtos/${id}`, { sessao: null })).ficha, null)
    assert.equal((await chamada(`/peixes/${id}`, { sessao: null })).status, 404)
    assert.deepEqual(await corpo('/peixes?busca=Legado%20ciclo2', { sessao: null }), { itens: [], total: 0 })
  })
  it('inexistente retorna 404, inválidos e parâmetros administrativos incorretos 400', async () => {
    assert.equal((await reativar(2147483647)).status, 404)
    assert.equal((await chamada('/produtos/2147483647?incluir_inativos=true')).status, 404)
    for (const query of ['ativo=0', 'limite=101', 'pagina=0', 'preco_min=20&preco_max=10', 'ordem=constructor']) assert.equal((await chamada(`/produtos?incluir_inativos=true&${query}`)).status, 400)
    assert.equal((await reativar('01')).status, 400)
    assert.equal((await reativar(1, { body: { estoque: 10 } })).status, 400)
  })
  it('reativação não aceita Origin incorreto e mantém o produto inativo', async () => {
    const p = await novo(); assert.equal((await reativar(p.id, { origin: 'https://outra.example' })).status, 403); assert.equal((await estado(p.id)).ativo, false)
  })
  it('falha real na escrita desfaz reativação e não revela mensagem do PostgreSQL', async () => {
    const p = await novo(); const antes = await estado(p.id); const log = mock.method(console, 'error', () => {})
    await cliente.query("CREATE FUNCTION falhar_reativacao() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.ativo THEN RAISE EXCEPTION 'mensagem-interna-ciclo2'; END IF; RETURN NEW; END $$")
    await cliente.query('CREATE TRIGGER falhar_ciclo2 BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION falhar_reativacao()')
    try {
      const r = await reativar(p.id); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' }); assert.deepEqual(await estado(p.id), antes)
      assert.ok(log.mock.calls.every((c) => !JSON.stringify(c.arguments).includes('mensagem-interna-ciclo2')))
    } finally { await cliente.query('DROP TRIGGER falhar_ciclo2 ON produtos'); await cliente.query('DROP FUNCTION falhar_reativacao()'); log.mock.restore() }
  })
  it('falha real das leituras não expõe SQL, nem responde com cache', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE produtos RENAME TO indisponiveis_ciclo2')
    try {
      for (const path of ['/produtos?incluir_inativos=true', '/produtos/1?incluir_inativos=true']) {
        const r = await chamada(path); assert.equal(r.status, 500); assert.equal(r.headers.get('cache-control'), 'no-store'); assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
      }
    } finally { await cliente.query('ALTER TABLE indisponiveis_ciclo2 RENAME TO produtos'); log.mock.restore() }
  })
  for (const ordem of ['reativar-delete', 'delete-reativar', 'patch-reativar', 'reativar-reativar']) {
    it(`serializa operações concorrentes: ${ordem}`, async () => {
      const p = await novo('acessorios', ordem !== 'reativar-reativar')
      const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); await gate.query('BEGIN')
      const pendentes = []
      try {
        await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [p.id])
        if (ordem === 'delete-reativar') {
          pendentes.push(chamada(`/produtos/${p.id}`, { method: 'DELETE' })); await esperarLock('UPDATE produtos SET ativo = false')
        } else if (ordem === 'patch-reativar') {
          pendentes.push(chamada(`/produtos/${p.id}`, { method: 'PATCH', body: { preco: 54321 } })); await esperarLock('SELECT categoria_id')
        } else { pendentes.push(reativar(p.id)); await esperarLock('SELECT ativo') }
        if (ordem === 'reativar-delete') {
          pendentes.push(chamada(`/produtos/${p.id}`, { method: 'DELETE' })); await esperarLock('UPDATE produtos SET ativo = false')
        } else { pendentes.push(reativar(p.id)); await esperarLock('SELECT ativo', ordem === 'reativar-reativar' ? 2 : 1) }
        await gate.query('COMMIT')
        const respostas = await Promise.all(pendentes)
        assert.deepEqual(respostas.map((r) => r.status), ordem === 'delete-reativar' ? [204, 200] : ordem === 'reativar-delete' ? [200, 204] : [200, 200])
        const final = await estado(p.id); assert.equal(final.ativo, ordem !== 'reativar-delete'); assert.equal(final.estoque, 7)
        assert.equal(final.preco, ordem === 'patch-reativar' ? 54321 : 12345)
      } finally { await gate.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end() }
    })
  }
})
