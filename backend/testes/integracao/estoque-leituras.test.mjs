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
  let cliente, pool, servidor, origem, cors, urlApp, legado, legadoZero, transacao, estoque, criado = false
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
    transacao = (await import('../../src/utils/transacao.ts')).comTransacao
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
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
      for (const caminho of [caminhoSaldo(legado), caminhoHistorico(legado), '/api/estoque/movimentacoes']) for (const method of ['GET', 'HEAD']) {
        const r = await consultar(caminho, sessao, method); assert.equal(r.status, status)
        assert.equal(r.headers.get('cache-control'), 'no-store'); assert.match(r.headers.get('vary'), /Cookie/)
        assert.doesNotMatch(await r.text(), /saldo|12345|Produto|abertura|fixture\.example|Conferência/)
      }
      assert.deepEqual(await contagem(), antes)
    })
  }
  it('consulta o papel vigente e revogação no banco em ambas as rotas', async () => {
    for (const caminho of [caminhoSaldo(legado), caminhoHistorico(legado), '/api/estoque/movimentacoes']) {
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
      '/api/estoque/movimentacoes?produtoId=1&produtoId=2',
      caminhoHistorico(legado, '&pagina=0'), caminhoHistorico(legado, '&limite=101'), caminhoHistorico(legado, '&limite=1.5'),
      caminhoHistorico(legado, '&tipo=desconhecido'), caminhoHistorico(legado, '&pagina=9007199254740991&limite=100')]) assert.equal((await consultar(caminho)).status, 400, caminho)
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

  const geral = (query = {}) => `/api/estoque/movimentacoes?${new URLSearchParams(query)}`
  async function comDatas(executar) {
    // Datas fornecidas ANTES do INSERT; não altera timestamps de movimentos imutáveis.
    await cliente.query('CREATE TABLE instantes_fixture(produto_id integer PRIMARY KEY,instante timestamptz NOT NULL)')
    await cliente.query(`CREATE FUNCTION datar_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE instante timestamptz; BEGIN SELECT i.instante INTO instante FROM instantes_fixture i WHERE i.produto_id=NEW.produto_id;
      IF FOUND THEN NEW.criado_em=instante; END IF; RETURN NEW; END $$`)
    await cliente.query('CREATE TRIGGER datar_fixture BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION datar_fixture()')
    const inserir = async (id, data) => {
      await cliente.query('INSERT INTO instantes_fixture VALUES($1,$2) ON CONFLICT(produto_id) DO UPDATE SET instante=EXCLUDED.instante', [id, data])
      return aplicar(id)
    }
    try { await executar(inserir) } finally {
      await cliente.query('DROP TRIGGER datar_fixture ON movimentacoes_estoque'); await cliente.query('DROP FUNCTION datar_fixture()'); await cliente.query('DROP TABLE instantes_fixture')
    }
  }
  async function fotoCompleta() {
    const foto = {}
    const tabelas = (await cliente.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name", [schema])).rows
    for (const { table_name } of tabelas) {
      const nome = '"' + table_name.replaceAll('"', '""') + '"'
      foto[table_name] = (await cliente.query(`SELECT count(*)::text AS n,md5(coalesce(string_agg(linha::text,'' ORDER BY linha::text),'')) AS hash FROM (SELECT to_jsonb(t) AS linha FROM ${nome} t) s`)).rows[0]
    }
    return foto
  }
  it('listagem geral reúne ativos/inativos e todas as origens/tipos sem ampliar o DTO', async () => {
    const id = await novo(), inativo = await novo({ ativo: false })
    for (const [tipo, quantidade] of [['entrada', 5], ['ajuste_positivo', 3], ['ajuste_negativo', 1], ['saida', 1]]) await aplicar(id, { tipo, quantidade })
    await aplicar(inativo, { quantidade: 2 })
    const vendaId = await transacao(async (tx) => {
      const v = (await tx.query(`INSERT INTO vendas(cliente_id,subtotal,frete,total,tipo_entrega,entrega_destinatario,entrega_telefone,prazo_entrega_dias)
        VALUES($1,0,0,0,'retirada','Fixture','32999999999',1) RETURNING id`, [usuarios.get('cliente')])).rows[0].id
      await tx.query("INSERT INTO itens_venda(venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal) VALUES($1,$2,'Fixture',0,1,0)", [v, id])
      await estoque.baixarParaVenda(v, [{ produtoId: id, quantidade: 1 }], tx)
      return v
    })
    await transacao(async (tx) => { await tx.query("UPDATE vendas SET status='cancelada' WHERE id=$1", [vendaId]); await estoque.estornarVenda(vendaId, tx) })
    const antes = await fotoCompleta(), h = await json(geral({ limite: '100' }))
    const esperado = (await cliente.query('SELECT operacao_id,produto_id FROM movimentacoes_estoque ORDER BY criado_em DESC,id DESC LIMIT 100')).rows
    assert.equal(h.total, (await contagem()).movimentos)
    assert.deepEqual(h.itens.map((m) => [m.operacaoId, m.produtoId]), esperado.map((m) => [m.operacao_id, m.produto_id]))
    assert.ok(h.itens.some((m) => m.produtoId === inativo))
    assert.deepEqual([...new Set(h.itens.map((m) => m.origem))].sort(), ['abertura', 'admin', 'venda'])
    for (const tipo of ['entrada', 'ajuste_positivo', 'ajuste_negativo', 'saida', 'abertura', 'baixa_venda', 'estorno_venda']) {
      const filtro = await json(geral({ tipo, limite: '100' }))
      assert.ok(filtro.total > 0); assert.ok(filtro.itens.every((m) => m.tipo === tipo))
      assert.equal(filtro.total, (await cliente.query('SELECT count(*)::int AS n FROM movimentacoes_estoque WHERE tipo=$1', [tipo])).rows[0].n)
      for (const m of filtro.itens) {
        const campos = ['operacaoId', 'produtoId', 'tipo', 'quantidade', 'delta', 'saldoAnterior', 'saldoPosterior', 'criadoEm', 'motivo', 'origem', 'autorId']
        if (m.origem === 'venda') campos.push('vendaId', 'operacaoOriginalId')
        assert.deepEqual(Object.keys(m).sort(), campos.sort())
        if (tipo === 'baixa_venda' || tipo === 'estorno_venda') { assert.equal(m.vendaId, vendaId); assert.equal(m.autorId, null) }
      }
    }
    assert.deepEqual(await fotoCompleta(), antes); await reconciliar()
  })
  it('chamada antiga por produto mantém resultado e pode combinar tipo, contagem e paginação', async () => {
    const id = await novo(), outro = await novo()
    const a = await aplicar(id), b = await aplicar(id); await aplicar(id, { tipo: 'saida' }); await aplicar(outro)
    const antes = await fotoCompleta()
    const semTipo = await json(caminhoHistorico(id)); assert.equal(semTipo.total, 3)
    const p1 = await json(geral({ produtoId: String(id), tipo: 'entrada', limite: '1' }))
    const p2 = await json(geral({ produtoId: String(id), tipo: 'entrada', limite: '1', pagina: '2' }))
    assert.equal(p1.total, 2); assert.equal(p2.total, 2)
    assert.equal(p1.itens[0].operacaoId, b.operacaoId); assert.equal(p2.itens[0].operacaoId, a.operacaoId)
    assert.deepEqual(await json(geral({ produtoId: String(id), tipo: 'entrada', limite: '1', pagina: '3' })), { itens: [], total: 2 })
    assert.deepEqual(await fotoCompleta(), antes)
  })
  it('período [de,ate) respeita os microssegundos, fusos equivalentes, filtros isolados e combinados', async () => {
    const id = await novo(), datas = ['2026-03-01T00:00:00.123455Z', '2026-03-01T00:00:00.123456Z',
      '2026-03-01T00:00:00.123457Z', '2026-03-01T00:00:00.123458Z', '2026-03-01T00:00:00.123459Z']
    await comDatas(async (inserir) => {
      const ops = []
      for (const data of datas) ops.push((await inserir(id, data)).operacaoId)
      const antes = await fotoCompleta()
      for (const [de, ate] of [[datas[1], datas[3]], ['2026-02-28T21:00:00.123456-03:00', '2026-03-01T02:30:00.123458+02:30']]) {
        for (const extras of [{}, { tipo: 'entrada' }, { produtoId: String(id), tipo: 'entrada' }]) {
          const h = await json(geral({ ...extras, de, ate })); assert.equal(h.total, 2)
          assert.deepEqual(h.itens.map((m) => m.operacaoId), [ops[2], ops[1]])
          const vazio = await json(geral({ ...extras, de, ate, pagina: '2', limite: '2' })); assert.deepEqual(vazio, { itens: [], total: 2 })
        }
      }
      const desde = await json(geral({ produtoId: String(id), de: datas[1] })); assert.equal(desde.total, 4)
      assert.deepEqual(desde.itens.map((m) => m.operacaoId), ops.slice(1).reverse())
      const antesDe = await json(geral({ produtoId: String(id), ate: datas[3] })); assert.equal(antesDe.total, 3)
      assert.deepEqual(antesDe.itens.map((m) => m.operacaoId), ops.slice(0, 3).reverse())
      assert.deepEqual(await json(geral({ de: '0001-01-01T00:00:00Z', ate: '0001-01-02T00:00:00Z' })), { itens: [], total: 0 })
      assert.deepEqual(await fotoCompleta(), antes)
    })
    await reconciliar()
  })
  it('paginação geral desempata data por ID interno sem expô-lo nem ignorar registros antigos', async () => {
    const a = await novo(), b = await novo({ ativo: false })
    await comDatas(async (inserir) => {
      const data = '1999-04-05T00:00:00.000001Z'
      const primeiro = await inserir(a, data), segundo = await inserir(b, data), terceiro = await inserir(a, data)
      for (let repeticao = 0; repeticao < 2; repeticao++) {
        const ids = []
        for (let pagina = 1; pagina <= 3; pagina++) {
          const h = await json(geral({ de: data, ate: '1999-04-06T00:00:00Z', pagina: String(pagina), limite: '1' }))
          assert.equal(h.total, 3); assert.equal(h.itens.length, 1); assert.equal('id' in h.itens[0], false); ids.push(h.itens[0].operacaoId)
        }
        assert.deepEqual(ids, [terceiro.operacaoId, segundo.operacaoId, primeiro.operacaoId])
      }
      assert.deepEqual(await json(geral({ de: data, ate: '1999-04-06T00:00:00Z', pagina: '4', limite: '1' })), { itens: [], total: 3 })
    })
  })
  it('validação geral ocorre antes do SQL, mantém 404 mesmo com filtro sem resultado e trata HEAD', async () => {
    const antes = await fotoCompleta(), executar = pool.query.bind(pool), consultas = []
    mock.method(pool, 'query', (...args) => { consultas.push(args[0]); return executar(...args) })
    const invalidos = [
      'tipo=venda', 'tipo=entrada&tipo=saida', 'de=2026-02-30T12:00:00Z', 'ate=2026-11-01T12:00:00',
      'de=2026-11-02T00:00:00Z&ate=2026-11-01T00:00:00Z', 'de=2026-11-01T00:00:00Z&ate=2026-11-01T00:00:00Z',
      'produtoId=0', 'produtoId=42&produtoId=43', 'produtoId[]=42', 'tipo[0]=entrada', 'ate[]=2026-11-01T12:00:00Z',
      'de=2026-11-01T00:00:00Z&de=2026-11-02T00:00:00Z', 'origem=admin', 'pagina=1&pagina=2',
      'pagina=9007199254740991&limite=100', 'limite=101', 'limite=0', 'limite=2.5', 'desconhecido=1',
    ]
    for (const query of invalidos) {
      const r = await consultar(`/api/estoque/movimentacoes?${query}`); assert.equal(r.status, 400, query)
      assert.equal((await r.json()).erro, 'Parâmetros inválidos')
    }
    assert.ok(consultas.every((sql) => sql.includes('FROM sessoes')), 'inválidos não consultam produto/histórico')
    mock.restoreAll()
    const inexistente = await consultar(geral({ produtoId: '2147483647', de: '0001-01-01T00:00:00Z', ate: '0001-01-02T00:00:00Z' }))
    assert.equal(inexistente.status, 404)
    const head = await consultar(geral({ tipo: 'abertura' }), 'admin', 'HEAD')
    assert.equal(head.status, 200); assert.equal(await head.text(), ''); assert.equal(head.headers.get('cache-control'), 'no-store'); assert.match(head.headers.get('vary'), /Cookie/)
    assert.deepEqual(await fotoCompleta(), antes)
  })
  it('falha SQL na listagem geral não revela query nem credenciais e não escreve dados', async () => {
    const antes = await fotoCompleta(), logs = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE movimentacoes_estoque RENAME TO indisponivel_fixture')
    try {
      const r = await consultar(geral({ tipo: 'entrada' })); assert.equal(r.status, 500)
      assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' }); assert.equal(r.headers.get('cache-control'), 'no-store')
      assert.doesNotMatch(JSON.stringify(logs.mock.calls), /indisponivel_fixture|SELECT|sid|senha|hash|fixture\.example/)
    } finally { await cliente.query('ALTER TABLE indisponivel_fixture RENAME TO movimentacoes_estoque') }
    assert.deepEqual(await fotoCompleta(), antes)
  })
  it('migração 33 aplica/reaplica somente o índice e preserva todos os dados existentes', async () => {
    const antes = await fotoCompleta()
    for (let n = 0; n < 2; n++) {
      const { stdout } = await promisify(execFile)('npm', ['run', 'db:migrar-consultas-estoque'], {
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: urlApp.toString() },
      })
      assert.match(stdout, /Índice de consultas de estoque aplicado\/verificado/)
    }
    const indice = (await cliente.query("SELECT pg_get_indexdef(indexrelid) AS sql,indisvalid FROM pg_index WHERE indexrelid='idx_movimentacoes_estoque_data'::regclass")).rows[0]
    assert.equal(indice.indisvalid, true); assert.match(indice.sql, /\(criado_em DESC, id DESC\)/)
    assert.deepEqual(await fotoCompleta(), antes)
    await cliente.query('DROP INDEX idx_movimentacoes_estoque_data')
    const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect()
    try {
      await gate.query('BEGIN'); await gate.query('LOCK TABLE movimentacoes_estoque IN ACCESS EXCLUSIVE MODE')
      // Migração deve falhar atomicamente em timeout, não deixar índice parcial ou legitimar dados alterados.
      const script = await readFile(new URL('../../db/init/33_estoque_consultas.sql', import.meta.url), 'utf8')
      await assert.rejects(cliente.query(script.replace("'5s'", "'50ms'")), (e) => e.code === '55P03')
      await gate.query('ROLLBACK')
      assert.equal((await cliente.query("SELECT to_regclass('idx_movimentacoes_estoque_data') AS indice")).rows[0].indice, null)
      await cliente.query(script)
    } finally { await gate.query('ROLLBACK'); await gate.end() }
    assert.deepEqual(await fotoCompleta(), antes); await reconciliar()
  })
})
