// Harness da homologação isolada; depende das rotas de recuperação ainda não integradas na base local.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import pg from 'pg'
import { gerarHash } from '../../src/modulos/clientes/senha.ts'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

describe('Homologação cruzada — estoque local + Backend 2 remoto', () => {
  const schema = `homologacao_b2_${randomUUID().replaceAll('-', '')}`
  const senha = 'SenhaHomologacao123', novaSenha = 'OutraSenhaSegura456', chave = randomUUID()
  let c, pool, server, url, cors, id, produto, cookie, movimento
  const email = 'admin@homologacao.example', novoEmail = 'novo@homologacao.example'
  before(async () => {
    assert.ok(process.env.TEST_DATABASE_URL, 'PostgreSQL descartável obrigatório')
    c = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '30_estoque.sql', '31_estoque_vendas.sql']) await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    id = (await c.query("INSERT INTO clientes(nome,email,senha_hash,papel) VALUES('Admin fixture',$1,$2,'admin') RETURNING id", [email, await gerarHash(senha)])).rows[0].id
    produto = (await c.query("INSERT INTO produtos(categoria_id,nome,preco) SELECT id,'Fixture integração',100 FROM categorias WHERE slug='acessorios' RETURNING id")).rows[0].id
    const dbUrl = new URL(process.env.TEST_DATABASE_URL); dbUrl.searchParams.set('options', `-c search_path=${schema}`); process.env.DATABASE_URL = dbUrl.toString()
    delete process.env.EMAIL_API_KEY
    mock.method(console, 'info', () => {}) // Não imprimir conteúdo de e-mail de desenvolvimento.
    const { app } = await import('../../src/app.ts'); pool = (await import('../../src/config/db.ts')).db
    cors = (await import('../../src/config/env.ts')).env.corsOrigin
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); url = `http://127.0.0.1:${server.address().port}`
  })
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { mock.restoreAll(); if (c) { try { await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })
  const req = (path, method = 'GET', body, sid = cookie, headers = {}) => fetch(`${url}${path}`, { method, headers: { Origin: cors, ...(sid ? { Cookie: sid } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) })
  async function login(emailAtual, senhaAtual) {
    const r = await req('/api/auth/login', 'POST', { email: emailAtual, senha: senhaAtual }, null); assert.equal(r.status, 200)
    const set = r.headers.get('set-cookie'); assert.match(set, /HttpOnly/i); assert.match(set, /SameSite=Lax/i)
    cookie = set.split(';')[0]
  }
  async function token() {
    const t = randomBytes(32).toString('base64url')
    await c.query("INSERT INTO tokens_recuperacao_senha(cliente_id,token_hash,expira_em) VALUES($1,$2,now()+interval '30 minutes')", [id, hashToken(t)])
    return t
  }
  it('login real de admin permite movimentar e ler saldo/histórico', async () => {
    await login(email, senha)
    const r = await req('/api/estoque/movimentacoes', 'POST', { produtoId: produto, tipo: 'entrada', quantidade: 3, motivo: 'Entrada homologada' }, cookie, { 'Idempotency-Key': chave })
    assert.equal(r.status, 201); movimento = await r.json()
    assert.equal((await (await req(`/api/estoque/${produto}`)).json()).saldoAtual, 3)
    const h = await (await req(`/api/estoque/movimentacoes?produtoId=${produto}`)).json(); assert.equal(h.total, 1); assert.equal(h.itens[0].autorId, id)
  })
  it('D-47 exige senha na troca de e-mail sem impedir consulta de estoque', async () => {
    await token()
    assert.equal((await req('/api/clientes/me', 'PATCH', { email: novoEmail })).status, 422)
    assert.equal((await req('/api/clientes/me', 'PATCH', { email: novoEmail, senhaAtual: senha })).status, 200)
    assert.equal((await c.query('SELECT count(*)::int AS n FROM tokens_recuperacao_senha WHERE cliente_id=$1', [id])).rows[0].n, 0)
    assert.equal((await req(`/api/estoque/${produto}`)).status, 200)
  })
  it('redefinição remota revoga sessão nas duas leituras e no replay de escrita', async () => {
    const t = await token()
    assert.equal((await req('/api/auth/redefinir-senha', 'POST', { token: t, novaSenha }, null)).status, 204)
    for (const path of [`/api/estoque/${produto}`, `/api/estoque/movimentacoes?produtoId=${produto}`]) {
      const r = await req(path); assert.equal(r.status, 401); assert.doesNotMatch(await r.text(), /saldo|motivo|Entrada homologada/)
    }
    assert.equal((await req('/api/estoque/movimentacoes', 'POST', { produtoId: produto, tipo: 'entrada', quantidade: 3, motivo: 'Entrada homologada' }, cookie, { 'Idempotency-Key': chave })).status, 401)
    assert.equal((await c.query('SELECT estoque FROM produtos WHERE id=$1', [produto])).rows[0].estoque, 3)
  })
  it('novo login preserva autoria e idempotência sem segunda entrada', async () => {
    await login(novoEmail, novaSenha)
    const r = await req('/api/estoque/movimentacoes', 'POST', { produtoId: produto, tipo: 'entrada', quantidade: 3, motivo: 'Entrada homologada' }, cookie, { 'Idempotency-Key': chave })
    assert.equal(r.status, 201); assert.deepEqual(await r.json(), movimento)
    const h = await (await req(`/api/estoque/movimentacoes?produtoId=${produto}`)).json(); assert.equal(h.total, 1); assert.equal(h.itens[0].autorId, id)
    const { rows } = await c.query('SELECT p.id FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id GROUP BY p.id HAVING p.estoque::bigint <> COALESCE(sum(m.delta),0)')
    assert.deepEqual(rows, [])
  })
})
