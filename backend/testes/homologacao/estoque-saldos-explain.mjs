import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'

// Somente base DESCARTÁVEL: cria/remove schema próprio e não usa DATABASE_URL como fallback.
if (!process.env.TEST_DATABASE_URL) throw new Error('Defina TEST_DATABASE_URL descartável para executar EXPLAIN.')
const raiz = fileURLToPath(new URL('../..', import.meta.url))
const require = createRequire(`${raiz}/package.json`), { Client } = require('pg')
process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = 'postgres://fixture@127.0.0.1:1/fixture'
const { estoqueRepository } = await import(`${raiz}/src/modulos/estoque/estoque.repository.ts`)
const { db } = await import(`${raiz}/src/config/db.ts`)
const cenarios = {
  geral: {}, saldo: { ordem: 'saldo' }, saldoDecrescente: { ordem: '-saldo' },
  categoria: { categoria: 'filtros' }, busca: { busca: 'Filtro' },
  inativosZerados: { ativo: false, emEstoque: false },
  combinados: { categoria: 'filtros', busca: 'Produto', ativo: true, emEstoque: true, ordem: '-saldo' },
}
const consultas = {}
db.query = async (sql, parametros) => { consultas.atual = { sql, parametros }; return { rows: [{ itens: [], total: '0' }] } }
for (const [nome, filtro] of Object.entries(cenarios)) {
  await estoqueRepository.listarSaldos({ pagina: 1, limite: 20, ordem: 'nome', ...filtro }); consultas[nome] = consultas.atual
}
delete consultas.atual; await db.end()
const client = new Client({ connectionString: process.env.TEST_DATABASE_URL })
const schema = `explain_saldos_${randomUUID().replaceAll('-', '')}`
await client.connect()
try {
  await client.query(`CREATE SCHEMA ${schema}`); await client.query(`SET search_path TO ${schema}`)
  await client.query(await readFile(`${raiz}/db/init/01_catalogo.sql`, 'utf8'))
  // Saldos fictícios são anteriores à abertura legada: a migração30 registra/reconcilia sem incrementá-los.
  await client.query(`INSERT INTO produtos(categoria_id,nome,preco,estoque,ativo)
    SELECT ids[1+(n%cardinality(ids))],
      CASE WHEN n%10=0 THEN 'Filtro ' ELSE 'Produto ' END || lpad((n%2500)::text,4,'0'),
      1999, CASE WHEN n%3=0 THEN 0 ELSE 1+n%37 END,n%4<>0
    FROM generate_series(1,10000)n CROSS JOIN (SELECT array_agg(id ORDER BY id) AS ids FROM categorias) c`)
  for (const f of (await readdir(`${raiz}/db/init`)).filter((f) => f.endsWith('.sql') && f !== '01_catalogo.sql').sort()) {
    await client.query(await readFile(`${raiz}/db/init/${f}`, 'utf8'))
  }
  await client.query('VACUUM ANALYZE produtos'); await client.query('ANALYZE categorias')
  const antes = (await client.query('SELECT md5(string_agg(to_jsonb(p)::text,\'\' ORDER BY id)) AS hash FROM produtos p')).rows[0].hash
  const resultado = { versao: (await client.query('SHOW server_version')).rows[0].server_version, produtos: 10000, planos: {}, medianasMs: {} }
  for (const [nome, { sql, parametros }] of Object.entries(consultas)) {
    const planos = []
    for (let n = 0; n < 3; n++) planos.push((await client.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ' + sql, parametros)).rows[0]['QUERY PLAN'][0])
    resultado.planos[nome] = planos; resultado.medianasMs[nome] = planos.map((p) => p['Execution Time']).sort((a, b) => a - b)[1]
  }
  assert.equal((await client.query('SELECT md5(string_agg(to_jsonb(p)::text,\'\' ORDER BY id)) AS hash FROM produtos p')).rows[0].hash, antes)
  assert.deepEqual((await client.query('SELECT p.id FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id GROUP BY p.id HAVING p.estoque::bigint<>coalesce(sum(m.delta),0)')).rows, [])
  if (process.env.ARQUIVO_EXPLAIN) await writeFile(process.env.ARQUIVO_EXPLAIN, JSON.stringify(resultado, null, 2))
  console.log(JSON.stringify({ versao: resultado.versao, produtos: resultado.produtos, medianasMs: resultado.medianasMs }, null, 2))
} finally { await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await client.end() }
