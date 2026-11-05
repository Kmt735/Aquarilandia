import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'

const url = process.env.TEST_DATABASE_URL
const migracao = await readFile(new URL('../../db/init/30_estoque.sql', import.meta.url), 'utf8')
const evolucaoVenda = await readFile(new URL('../../db/init/31_estoque_vendas.sql', import.meta.url), 'utf8')
const executarArquivo = promisify(execFile)
describe('Estoque — bootstrap e migração incremental PostgreSQL', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  let cliente
  before(async () => { cliente = new pg.Client({ connectionString: url }); await cliente.connect() })
  after(async () => { if (cliente) await cliente.end() })
  async function isolado(executar) {
    const schema = `migracao_estoque_${randomUUID().replaceAll('-', '')}`
    await cliente.query(`CREATE SCHEMA ${schema}`); await cliente.query(`SET search_path TO ${schema}`)
    try { await executar() } finally { await cliente.query(`DROP SCHEMA ${schema} CASCADE`) }
  }
  async function base() {
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
  }
  const resumo = async () => (await cliente.query(`SELECT id,estoque,ativo,atualizado_em FROM produtos ORDER BY id`)).rows
  it('bootstrap completo em ordem alfabética cria banco novo com categorias, sem estoque artificial', async () => isolado(async () => {
    const pasta = new URL('../../db/init/', import.meta.url)
    for (const f of (await readdir(pasta)).filter((f) => f.endsWith('.sql')).sort()) await cliente.query(await readFile(new URL(f, pasta), 'utf8'))
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM categorias')).rows[0].n, 12)
    for (const tabela of ['produtos', 'movimentacoes_estoque', 'operacoes_estoque']) {
      assert.equal((await cliente.query(`SELECT count(*)::int AS n FROM ${tabela}`)).rows[0].n, 0)
    }
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM migracoes_estoque')).rows[0].n, 2)
  }))
  it('fotografa saldo legado zero/positivo/máximo e inativo sem somar unidades nem inferir reservas', async () => isolado(async () => {
    await base()
    for (const [estoque, ativo] of [[0, true], [7, true], [2147483647, false]]) {
      await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,estoque,ativo,atualizado_em) SELECT id,'Legado',12345,$1,$2,'2001-01-01' FROM categorias WHERE slug='acessorios'", [estoque, ativo])
    }
    const c = (await cliente.query("INSERT INTO clientes(nome,email,senha_hash) VALUES('Fixture','migracao@fixture.example','hash') RETURNING id")).rows[0].id
    await cliente.query(`INSERT INTO vendas(cliente_id,subtotal,frete,total,tipo_entrega,entrega_destinatario,entrega_telefone,prazo_entrega_dias)
      VALUES($1,1000,0,1000,'retirada','Fixture','32999999999',1)`, [c])
    const antes = await resumo()
    await cliente.query(migracao)
    assert.deepEqual(await resumo(), antes)
    const movimentos = (await cliente.query(`SELECT m.produto_id,m.tipo,m.quantidade,m.delta,m.saldo_anterior,m.saldo_atual,o.origem,o.autor_id,o.chave_idempotencia
      FROM movimentacoes_estoque m JOIN operacoes_estoque o ON o.id=m.operacao_id ORDER BY m.produto_id`)).rows
    assert.equal(movimentos.length, 3)
    for (const [i, m] of movimentos.entries()) {
      assert.equal(m.tipo, 'abertura'); assert.equal(m.origem, 'abertura')
      assert.equal(m.saldo_anterior, 0); assert.equal(m.saldo_atual, antes[i].estoque)
      assert.equal(m.quantidade, antes[i].estoque); assert.equal(m.delta, antes[i].estoque)
      assert.equal(m.autor_id, null); assert.equal(m.chave_idempotencia, null)
    }
    assert.equal((await cliente.query("SELECT to_regclass('alocacoes_estoque') AS tabela")).rows[0].tabela, null)
    assert.equal((await cliente.query('SELECT status FROM vendas')).rows[0].status, 'aguardando_pagamento')
    await cliente.query(migracao)
    assert.deepEqual(await resumo(), antes)
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM movimentacoes_estoque')).rows[0].n, 3)
    await cliente.query("INSERT INTO produtos(categoria_id,nome,preco) SELECT id,'Novo zero',0 FROM categorias WHERE slug='acessorios'")
    await cliente.query(migracao)
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM movimentacoes_estoque')).rows[0].n, 3)
  }))
  it('reaplicação recusa divergência introduzida por SQL externo em vez de legitimá-la como outra abertura', async () => isolado(async () => {
    await base()
    await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,estoque) SELECT id,'Legado',0,7 FROM categorias WHERE slug='acessorios'")
    await cliente.query(migracao)
    await cliente.query('UPDATE produtos SET estoque=8')
    await assert.rejects(cliente.query(migracao), (e) => e.code === '55000')
    assert.equal((await resumo())[0].estoque, 8)
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM movimentacoes_estoque')).rows[0].n, 1)
    assert.equal((await cliente.query('SELECT saldo_atual FROM movimentacoes_estoque')).rows[0].saldo_atual, 7)
  }))
  it('falha de DDL desfaz a migração inteira e preserva os dados anteriores', async () => isolado(async () => {
    await base()
    await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,estoque) SELECT id,'Legado',0,7 FROM categorias WHERE slug='acessorios'")
    await cliente.query('CREATE TABLE operacoes_estoque (estrutura_incompativel integer)')
    const antes = await resumo()
    await assert.rejects(cliente.query(migracao), (e) => e.code === '42P07')
    assert.deepEqual(await resumo(), antes)
    for (const nome of ['movimentacoes_estoque', 'migracoes_estoque']) {
      assert.equal((await cliente.query('SELECT to_regclass($1) AS tabela', [nome])).rows[0].tabela, null)
    }
  }))
  it('script incremental usa a mesma migração, é repetível e falha sem imprimir SQL/credenciais', async () => isolado(async () => {
    await base()
    await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,estoque) SELECT id,'Legado',0,7 FROM categorias WHERE slug='acessorios'")
    const schema = (await cliente.query('SELECT current_schema() AS schema')).rows[0].schema
    const urlScript = new URL(url); urlScript.searchParams.set('options', `-c search_path=${schema}`)
    const executar = () => executarArquivo(process.execPath, ['--import', 'tsx', 'scripts/migrar-estoque.ts'], {
      cwd: fileURLToPath(new URL('../..', import.meta.url)), env: { ...process.env, DATABASE_URL: urlScript.toString(), NODE_ENV: 'test' },
    })
    for (let n = 0; n < 2; n++) assert.match((await executar()).stdout, /Migração de estoque aplicada\/verificada/)
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM migracoes_estoque')).rows[0].n, 2)
    assert.equal((await resumo())[0].estoque, 7)
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM movimentacoes_estoque')).rows[0].n, 1)
    await cliente.query('UPDATE produtos SET estoque=8')
    await assert.rejects(executar(), (e) => {
      assert.equal(e.code, 1)
      assert.match(e.stderr, /Não foi possível aplicar\/verificar/)
      assert.doesNotMatch(e.stderr, /postgres:\/\/|SELECT|UPDATE|RAISE|password|senha/i)
      return true
    })
  }))
  it('histórico/operação não permitem UPDATE, DELETE ou TRUNCATE, e FKs preservam produtos', async () => isolado(async () => {
    await base()
    await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,estoque) SELECT id,'Legado',0,7 FROM categorias WHERE slug='acessorios'")
    await cliente.query(migracao)
    for (const sql of ['UPDATE movimentacoes_estoque SET saldo_atual=9', 'DELETE FROM movimentacoes_estoque',
      'UPDATE operacoes_estoque SET origem=origem', 'DELETE FROM operacoes_estoque', 'TRUNCATE movimentacoes_estoque',
      'TRUNCATE operacoes_estoque CASCADE']) await assert.rejects(cliente.query(sql), (e) => e.code === '55000')
    await assert.rejects(cliente.query('DELETE FROM produtos'), (e) => e.code === '23503')
    assert.equal((await cliente.query('SELECT saldo_atual FROM movimentacoes_estoque')).rows[0].saldo_atual, 7)
  }))
  it('evolução 002 preserva abertura e movimentos administrativos existentes sem novo crédito', async () => isolado(async () => {
    await base()
    const p = (await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,estoque,ativo) SELECT id,'Legado inativo',12345,7,false FROM categorias WHERE slug='acessorios' RETURNING id")).rows[0].id
    await cliente.query(migracao)
    const admin = (await cliente.query("INSERT INTO clientes(nome,email,senha_hash,papel) VALUES('Admin','legacy@fixture.example','hash','admin') RETURNING id")).rows[0].id
    const op = randomUUID()
    await cliente.query("INSERT INTO operacoes_estoque(id,autor_id,chave_idempotencia,hash_requisicao) VALUES($1,$2,$3,$4)", [op, admin, randomUUID(), 'a'.repeat(64)])
    await cliente.query('UPDATE produtos SET estoque=8 WHERE id=$1', [p])
    await cliente.query("INSERT INTO movimentacoes_estoque(operacao_id,produto_id,tipo,quantidade,delta,saldo_anterior,saldo_atual,motivo) VALUES($1,$2,'entrada',1,1,7,8,'Histórico anterior')", [op, p])
    const estado = await resumo()
    const historico = () => cliente.query('SELECT id,operacao_id,produto_id,tipo,quantidade,delta,saldo_anterior,saldo_atual,motivo,criado_em FROM movimentacoes_estoque ORDER BY id')
    const operacoes = () => cliente.query('SELECT id,origem,autor_id,chave_idempotencia,hash_requisicao,criado_em FROM operacoes_estoque ORDER BY id')
    const antes = (await historico()).rows, ops = (await operacoes()).rows
    await cliente.query(evolucaoVenda); await cliente.query(evolucaoVenda)
    assert.deepEqual(await resumo(), estado); assert.deepEqual((await historico()).rows, antes); assert.deepEqual((await operacoes()).rows, ops)
    assert.deepEqual((await cliente.query('SELECT venda_id,tipo_venda,operacao_original_id,transacao_venda FROM operacoes_estoque')).rows,
      ops.map(() => ({ venda_id: null, tipo_venda: null, operacao_original_id: null, transacao_venda: null })))
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM migracoes_estoque')).rows[0].n, 2)
    await assert.rejects(cliente.query('UPDATE operacoes_estoque SET origem=origem'), (e) => e.code === '55000')
  }))
  it('falha de DDL na evolução 002 não perde histórico nem deixa migração parcial', async () => isolado(async () => {
    await base(); await cliente.query("INSERT INTO produtos(categoria_id,nome,preco,estoque) SELECT id,'Legado',0,7 FROM categorias WHERE slug='acessorios'"); await cliente.query(migracao)
    await cliente.query('ALTER TABLE operacoes_estoque ADD COLUMN venda_id INTEGER')
    const estado = await resumo()
    await assert.rejects(cliente.query(evolucaoVenda), (e) => e.code === '42701')
    assert.deepEqual(await resumo(), estado)
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM migracoes_estoque')).rows[0].n, 1)
    assert.equal((await cliente.query('SELECT count(*)::int AS n FROM movimentacoes_estoque')).rows[0].n, 1)
    assert.equal((await cliente.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema=current_schema() AND column_name='movimento_original_id'")).rows[0].n, 0)
  }))
})
