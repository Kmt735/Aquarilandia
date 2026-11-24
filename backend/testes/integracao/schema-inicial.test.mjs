import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'

const url = process.env.TEST_DATABASE_URL
describe('Schema inicial — transação completa dos arquivos de deploy', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `deploy_${randomUUID().replaceAll('-', '')}`
  let cliente, arquivos
  before(async () => {
    cliente = new pg.Client({ connectionString: url })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    await cliente.query(`SET search_path TO ${schema}`)
    const pasta = new URL('../../db/init/', import.meta.url)
    arquivos = await Promise.all((await readdir(pasta)).filter((nome) => nome.endsWith('.sql')).sort()
      .map((nome) => readFile(new URL(nome, pasta), 'utf8')))
  })
  after(async () => {
    if (cliente) {
      try { await cliente.query('ROLLBACK'); await cliente.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`) }
      finally { await cliente.end() }
    }
  })
  it('falha após a última migração desfaz também catálogo, estoque e pagamentos', async () => {
    await cliente.query('BEGIN')
    for (const sql of arquivos) await cliente.query(sql)
    await assert.rejects(cliente.query('SELECT 1 / 0'), (erro) => erro.code === '22012')
    await cliente.query('ROLLBACK')
    const tabelas = await cliente.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [schema])
    assert.deepEqual(tabelas.rows, [], 'Uma migração não pode confirmar a transação do bootstrap antes do fim')
  })
  it('aplica todos os arquivos juntos e preserva as tabelas comerciais', async () => {
    await cliente.query('BEGIN')
    for (const sql of arquivos) await cliente.query(sql)
    await cliente.query('COMMIT')
    for (const tabela of ['categorias', 'clientes', 'vendas', 'pagamentos_checkout', 'produto_logistica', 'movimentacoes_estoque']) {
      const resultado = await cliente.query('SELECT to_regclass($1)::text AS tabela', [`${schema}.${tabela}`])
      assert.ok(resultado.rows[0].tabela, tabela)
    }
    assert.ok((await cliente.query('SELECT count(*)::int AS total FROM categorias')).rows[0].total > 0)
  })
})
