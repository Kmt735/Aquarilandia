import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const url = process.env.TEST_DATABASE_URL
describe('Estoque — consultas administrativas com PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `leituras_estoque_${randomUUID().replaceAll('-', '')}`
  const usuarios = new Map(), tokens = new Map()
  let cliente, pool, servidor, origem, cors, urlApp, legado, legadoZero, criado = false
  before(async () => {
    cliente = new pg.Client({ connectionString: url }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); criado = true; await cliente.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) await cliente.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    legado = await novo({ saldo: 7, ativo: false }); legadoZero = await novo()
    await cliente.query(await readFile(new URL('../../db/init/30_estoque.sql', import.meta.url), 'utf8'))
    await cliente.query(await readFile(new URL('../../db/init/31_estoque_vendas.sql', import.meta.url), 'utf8'))
    for (const [nome, papel, ativo, prazo] of [['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'],
      ['mutavel', 'admin', true, '1 hour'], ['vencido', 'admin', true, '-1 hour'], ['inativo', 'admin', false, '1 hour']]) {
      const id = (await cliente.query('INSERT INTO clientes(nome,email,senha_hash,papel,ativo) VALUES($1,$2,$3,$4,$5) RETURNING id', [nome, `${nome}@fixture.example`, 'hash-fixture', papel, ativo])).rows[0].id
      usuarios.set(nome, id); const token = randomUUID(); tokens.set(nome, token)
      await cliente.query('INSERT INTO sessoes(token_hash,cliente_id,expira_em) VALUES($1,$2,now()+$3::interval)', [hashToken(token), id, prazo])
    }
    urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts'); const { db } = await import('../../src/config/db.ts'); const { env } = await import('../../src/config/env.ts')
    pool = db; cors = env.corsOrigin; servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening'); origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    try { if (servidor) await new Promise((r) => servidor.close(r)); if (pool) await pool.end() }
    finally { if (cliente) { try { if (criado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await cliente.end() } } }
  })
  async function novo({ ativo = true, saldo = 0, peixe = false, ficha = false } = {}) {
    const id = (await cliente.query('INSERT INTO produtos(categoria_id,nome,preco,estoque,ativo) SELECT id,$2,12345,$3,$4 FROM categorias WHERE slug=$1 RETURNING id', [peixe ? 'peixes' : 'acessorios', `Produto ${randomUUID()}`, saldo, ativo])).rows[0].id
    if (ficha) await cliente.query(`INSERT INTO peixes(produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)
      VALUES($1,$2,'doce',5,24,28,6,7,40,'pacifico','iniciante')`, [id, `Species ${randomUUID()}`])
    return id
  }
  const caminhoSaldo = (id) => `/api/estoque/${id}`
  const caminhoHistorico = (id, query = '') => `/api/estoque/movimentacoes?produtoId=${id}${query}`
  function consultar(caminho, sessao = 'admin', method = 'GET') {
    return fetch(`${origem}${caminho}`, { method, headers: sessao ? { Cookie: `sid=${tokens.get(sessao) ?? sessao}` } : {}, signal: AbortSignal.timeout(5000) })
  }
  async function json(caminho) {
    const r = await consultar(caminho); assert.equal(r.status, 200, await r.clone().text()); return r.json()
  }
  async function aplicar(id, { tipo = 'entrada', quantidade = 1, chave = randomUUID(), motivo = 'Conferência administrativa' } = {}) {
    const r = await fetch(`${origem}/api/estoque/movimentacoes`, { method: 'POST', headers: { Origin: cors, Cookie: `sid=${tokens.get('admin')}`, 'Content-Type': 'application/json', 'Idempotency-Key': chave }, body: JSON.stringify({ produtoId: id, tipo, quantidade, motivo }) })
    assert.equal(r.status, 201, await r.clone().text()); return r.json()
  }
  const contagem = async () => (await cliente.query(`SELECT (SELECT count(*)::int FROM operacoes_estoque) AS operacoes,
    (SELECT count(*)::int FROM movimentacoes_estoque) AS movimentos`)).rows[0]
  async function reconciliar() {
    assert.deepEqual((await cliente.query(`SELECT p.id FROM produtos p LEFT JOIN
      (SELECT produto_id,sum(delta) AS saldo FROM movimentacoes_estoque GROUP BY produto_id) m ON m.produto_id=p.id
      WHERE p.estoque::bigint <> COALESCE(m.saldo,0)`)).rows, [])
  }
  for (const [sessao, status] of [[null, 401], ['inventada', 401], ['vencido', 401], ['inativo', 401], ['cliente', 403]]) {
    it(`GET e HEAD não revelam saldo/histórico com sessão ${sessao} (${status})`, async () => {
      const antes = await contagem()
      for (const caminho of [caminhoSaldo(legado), caminhoHistorico(legado)]) for (const method of ['GET', 'HEAD']) {
        const r = await consultar(caminho, sessao, method); assert.equal(r.status, status)
        assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('vary'), /Cookie/)
        assert.doesNotMatch(await r.text(), /saldo|12345|Produto|abertura|fixture\.example|Conferência/)
      }
      assert.deepEqual(await contagem(), antes)
    })
  }
  it('consulta o papel vigente e revogação no banco em ambas as rotas', async () => {
    for (const caminho of [caminhoSaldo(legado), caminhoHistorico(legado)]) {
      const token = randomUUID(); tokens.set('mutavel', token)
      await cliente.query("UPDATE clientes SET papel='admin' WHERE id=$1", [usuarios.get('mutavel')])
      await cliente.query("INSERT INTO sessoes(token_hash,cliente_id,expira_em) VALUES($1,$2,now()+interval '1 hour')", [hashToken(token), usuarios.get('mutavel')])
      assert.equal((await consultar(caminho, 'mutavel')).status, 200)
      await cliente.query("UPDATE clientes SET papel='cliente' WHERE id=$1", [usuarios.get('mutavel')])
      const r = await consultar(caminho, 'mutavel'); assert.equal(r.status, 403); assert.doesNotMatch(await r.text(), /saldo|Produto|motivo|abertura/)
      await cliente.query('DELETE FROM sessoes WHERE cliente_id=$1', [usuarios.get('mutavel')])
      assert.equal((await consultar(caminho, 'mutavel')).status, 401)
    }
  })
  it('saldo inclui inativo e histórico distingue abertura positiva e zero sem expor segredo', async () => {
    const antes = await contagem()
    assert.deepEqual(await json(caminhoSaldo(legado)), { produtoId: legado, nome: (await cliente.query('SELECT nome FROM produtos WHERE id=$1', [legado])).rows[0].nome, ativo: false, saldoAtual: 7 })
    for (const [id, saldo] of [[legado, 7], [legadoZero, 0]]) {
      const h = await json(caminhoHistorico(id)); assert.equal(h.total, 1); assert.equal(h.itens.length, 1)
      assert.deepEqual(Object.keys(h.itens[0]).sort(), ['operacaoId', 'produtoId', 'tipo', 'quantidade', 'delta', 'saldoAnterior', 'saldoPosterior', 'criadoEm', 'motivo', 'origem', 'autorId'].sort())
      const m = h.itens[0]; assert.equal(m.tipo, 'abertura'); assert.equal(m.origem, 'abertura'); assert.equal(m.autorId, null)
      assert.equal(m.delta, saldo); assert.equal(m.quantidade, saldo); assert.equal(m.saldoAnterior, 0); assert.equal(m.saldoPosterior, saldo)
      assert.match(m.criadoEm, /^\d{4}-\d\d-\d\dT.*\.\d{3}Z$/)
    }
    assert.deepEqual(await contagem(), antes); await reconciliar()
  })
  it('entrada, replay e saída: saldo atual evolui e snapshots antigos permanecem', async () => {
    const id = await novo(), chave = randomUUID()
    assert.deepEqual(await json(caminhoHistorico(id)), { itens: [], total: 0 })
    const primeiro = await aplicar(id, { quantidade: 3, chave }); const segundo = await aplicar(id, { quantidade: 5 })
    assert.deepEqual(await aplicar(id, { quantidade: 3, chave }), primeiro)
    assert.equal((await json(caminhoSaldo(id))).saldoAtual, 8)
    const h = await json(caminhoHistorico(id)); assert.equal(h.total, 2)
    assert.deepEqual(h.itens.map((m) => [m.operacaoId, m.saldoAnterior, m.saldoPosterior, m.delta]), [[segundo.operacaoId, 3, 8, 5], [primeiro.operacaoId, 0, 3, 3]])
    assert.ok(h.itens.every((m) => m.autorId === usuarios.get('admin') && m.origem === 'admin' && m.motivo === 'Conferência administrativa'))
    await aplicar(id, { tipo: 'saida', quantidade: 8 })
    assert.equal((await json(caminhoSaldo(id))).saldoAtual, 0)
    assert.equal((await json(caminhoHistorico(id))).total, 3); await reconciliar()
  })
  it('produto inativo permite movimentação e consulta sem reativar', async () => {
    const id = await novo({ ativo: false }); await aplicar(id, { quantidade: 4 })
    const saldo = await json(caminhoSaldo(id)); assert.equal(saldo.ativo, false); assert.equal(saldo.saldoAtual, 4)
    assert.equal((await json(caminhoHistorico(id))).total, 1)
    assert.equal((await fetch(`${origem}/api/produtos/${id}`)).status, 404)
  })
  it('paginação isola produto, preserva total fora da última página e desempata datas pelo ID interno', async () => {
    const id = await novo(), outro = await novo(); await aplicar(outro)
    await cliente.query(`CREATE FUNCTION fixar_data_movimento() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.criado_em='2000-01-01T00:00:00Z'; RETURN NEW; END $$`)
    await cliente.query('CREATE TRIGGER fixar_data BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION fixar_data_movimento()')
    try {
      const a = await aplicar(id), b = await aplicar(id)
      const p1 = await json(caminhoHistorico(id, '&pagina=1&limite=1')), p2 = await json(caminhoHistorico(id, '&pagina=2&limite=1'))
      assert.equal(p1.total, 2); assert.equal(p2.total, 2)
      assert.equal(p1.itens[0].operacaoId, b.operacaoId); assert.equal(p2.itens[0].operacaoId, a.operacaoId)
      assert.equal(p1.itens[0].criadoEm, p2.itens[0].criadoEm)
      assert.deepEqual(await json(caminhoHistorico(id, '&pagina=3&limite=1')), { itens: [], total: 2 })
    } finally { await cliente.query('DROP TRIGGER fixar_data ON movimentacoes_estoque'); await cliente.query('DROP FUNCTION fixar_data_movimento()') }
    await reconciliar()
  })
  it('IDs, paginação e filtros inválidos recebem 400 e produto inexistente recebe 404', async () => {
    const antes = await contagem()
    for (const caminho of ['/api/estoque/0', '/api/estoque/01', '/api/estoque/1e1', '/api/estoque/2147483648', '/api/estoque/1?x=1',
      '/api/estoque/movimentacoes', '/api/estoque/movimentacoes?produtoId=1&produtoId=2',
      caminhoHistorico(legado, '&pagina=0'), caminhoHistorico(legado, '&limite=101'), caminhoHistorico(legado, '&limite=1.5'),
      caminhoHistorico(legado, '&tipo=entrada'), caminhoHistorico(legado, '&pagina=9007199254740991&limite=100')]) assert.equal((await consultar(caminho)).status, 400, caminho)
    for (const caminho of [caminhoSaldo(2147483647), caminhoHistorico(2147483647)]) assert.equal((await consultar(caminho)).status, 404)
    assert.deepEqual(await contagem(), antes)
  })
  it('falhas reais de consulta não expõem SQL, sessão ou motivo em resposta/log', async () => {
    const logs = mock.method(console, 'error', () => {})
    for (const [antes, depois, caminho] of [
      ['ALTER TABLE produtos RENAME COLUMN estoque TO saldo_indisponivel', 'ALTER TABLE produtos RENAME COLUMN saldo_indisponivel TO estoque', caminhoSaldo(legado)],
      ['ALTER TABLE movimentacoes_estoque RENAME TO historico_indisponivel', 'ALTER TABLE historico_indisponivel RENAME TO movimentacoes_estoque', caminhoHistorico(legado)],
    ]) {
      await cliente.query(antes)
      try { const r = await consultar(caminho); assert.equal(r.status, 500); assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' }) }
      finally { await cliente.query(depois) }
    }
    assert.doesNotMatch(JSON.stringify(logs.mock.calls), /SELECT|saldo_indisponivel|historico_indisponivel|sid=|fixture\.example|Conferência/)
  })
  it('leitura durante UPDATE ainda não confirmado não vê saldo ou movimento parcial', async () => {
    const id = await novo(); await aplicar(id, { quantidade: 5 })
    await cliente.query(`CREATE FUNCTION esperar_movimento() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(hashtext(TG_TABLE_SCHEMA)); RETURN NEW; END $$`)
    await cliente.query('CREATE TRIGGER esperar_movimento BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION esperar_movimento()')
    const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); let pendente
    try {
      await gate.query('SELECT pg_advisory_lock(hashtext($1))', [schema])
      pendente = aplicar(id, { tipo: 'saida', quantidade: 2 })
      let bloqueou = false
      for (let n = 0; n < 300; n++) {
        const { rows } = await cliente.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'INSERT INTO movimentacoes_estoque%'", [schema])
        if (rows.length) { bloqueou = true; break }; await esperar(10)
      }
      assert.equal(bloqueou, true, 'INSERT do histórico deve estar bloqueado após o UPDATE')
      assert.equal((await json(caminhoSaldo(id))).saldoAtual, 5)
      const h = await json(caminhoHistorico(id)); assert.equal(h.total, 1); assert.equal(h.itens[0].saldoPosterior, 5)
      await gate.query('SELECT pg_advisory_unlock(hashtext($1))', [schema]); await pendente
      assert.equal((await json(caminhoSaldo(id))).saldoAtual, 3)
      assert.equal((await json(caminhoHistorico(id))).total, 2)
    } finally {
      await gate.query('SELECT pg_advisory_unlock(hashtext($1))', [schema]); if (pendente) await Promise.allSettled([pendente]); await gate.end()
      await cliente.query('DROP TRIGGER esperar_movimento ON movimentacoes_estoque'); await cliente.query('DROP FUNCTION esperar_movimento()')
    }
    await reconciliar()
  })
  it('reaplicar a migração não recria abertura nem muda saldo ou timestamp', async () => {
    const antes = (await cliente.query('SELECT id,estoque,ativo,atualizado_em FROM produtos ORDER BY id')).rows, numeros = await contagem()
    const historico = await json(caminhoHistorico(legado))
    for (let n = 0; n < 2; n++) {
      const { stdout } = await promisify(execFile)('npm', ['run', 'db:migrar-estoque'], {
        cwd: fileURLToPath(new URL('../..', import.meta.url)), env: { ...process.env, DATABASE_URL: urlApp.toString(), NODE_ENV: 'test' },
      })
      assert.match(stdout, /Migração de estoque aplicada\/verificada/)
    }
    assert.deepEqual((await cliente.query('SELECT id,estoque,ativo,atualizado_em FROM produtos ORDER BY id')).rows, antes)
    assert.deepEqual(await contagem(), numeros); assert.deepEqual(await json(caminhoHistorico(legado)), historico); await reconciliar()
  })
  it('catálogo e vitrine só expõem emEstoque, preservando filtros de ativo e ficha', async () => {
    const peixe = await novo({ peixe: true, ficha: true }), semFicha = await novo({ peixe: true }), inativo = await novo({ peixe: true, ficha: true, ativo: false })
    for (const id of [peixe, semFicha, inativo]) await aplicar(id, { quantidade: 2 })
    const vitrine = async () => (await (await fetch(`${origem}/api/peixes?em_estoque=true&pagina=1&limite=3`)).json())
    assert.deepEqual((await vitrine()).itens.map((p) => p.id), [peixe])
    for (const caminho of [`/api/produtos/${peixe}`, `/api/peixes/${peixe}`, `/api/produtos?categoria=peixes`, '/api/peixes?em_estoque=true&limite=3']) {
      const r = await fetch(`${origem}${caminho}`); assert.equal(r.status, 200); const body = await r.json()
      for (const p of body.itens ?? [body]) {
        assert.equal(p.emEstoque, true)
        for (const campo of ['estoque', 'saldoAtual', 'saldoPosterior', 'movimentacoes', 'autorId', 'hashRequisicao', 'chaveIdempotencia', 'motivo']) assert.equal(campo in p, false, campo)
      }
    }
    await aplicar(peixe, { tipo: 'saida', quantidade: 2 }); assert.deepEqual(await vitrine(), { itens: [], total: 0 })
    assert.equal((await (await fetch(`${origem}/api/peixes/${peixe}`)).json()).emEstoque, false)
    assert.equal((await fetch(`${origem}/api/peixes/${semFicha}`)).status, 404); assert.equal((await fetch(`${origem}/api/peixes/${inativo}`)).status, 404)
    assert.equal((await fetch(`${origem}/api/categorias`)).status, 200); await reconciliar()
  })
})
