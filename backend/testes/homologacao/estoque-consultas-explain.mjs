import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
// Somente PostgreSQL DESCARTÁVEL. Cria e remove seu próprio schema; não usa DATABASE_URL como fallback.
if (!process.env.TEST_DATABASE_URL) throw new Error('Defina TEST_DATABASE_URL descartável para executar EXPLAIN.')
const raiz=fileURLToPath(new URL('../..',import.meta.url))
const require=createRequire(`${raiz}/package.json`),{Client}=require('pg')
process.env.NODE_ENV='test';process.env.DATABASE_URL='postgres://fixture@127.0.0.1:1/fixture'
const {estoqueRepository}=await import(`${raiz}/src/modulos/estoque/estoque.repository.ts`)
const {db}=await import(`${raiz}/src/config/db.ts`)
const cenarios={geral:{},produto:{produtoId:1},tipo:{tipo:'entrada'},periodo:{de:'2026-01-01T00:00:00.000000Z',ate:'2026-02-01T00:00:00.000000Z'},combinados:{tipo:'entrada',de:'2026-01-01T00:00:00.000000Z',ate:'2026-02-01T00:00:00.000000Z'}}
const consultas={}
db.query=async(sql,params)=>{consultas.atual={sql,params};return{rows:[{existe:true,itens:[],total:'0'}]}}
for(const [nome,filtro] of Object.entries(cenarios)){await estoqueRepository.listarHistorico({...filtro,pagina:1,limite:20});consultas[nome]=consultas.atual}
delete consultas.atual;await db.end()
const client=new Client({connectionString:process.env.TEST_DATABASE_URL}),schema=`explain_estoque_${randomUUID().replaceAll('-','')}`
await client.connect()
try {
 await client.query(`CREATE SCHEMA ${schema}`);await client.query(`SET search_path TO ${schema}`)
 for(const f of (await readdir(`${raiz}/db/init`)).filter(f=>f.endsWith('.sql')&&f!=='33_estoque_consultas.sql').sort())await client.query(await readFile(`${raiz}/db/init/${f}`,'utf8'))
 await client.query("INSERT INTO clientes(id,nome,email,senha_hash,papel)VALUES(1,'Fixture','explain@fixture.example','hash','admin')")
 await client.query("INSERT INTO produtos(id,categoria_id,nome,preco,estoque,ativo)SELECT n,c.id,'Fixture '||n,12345,0,n%2=0 FROM generate_series(1,600)n CROSS JOIN categorias c WHERE slug='acessorios'")
 await client.query(`CREATE TEMP TABLE dados_explain AS SELECT gen_random_uuid() AS operacao, p.id AS produto, n,
  CASE n%4 WHEN 1 THEN 'entrada' WHEN 2 THEN 'saida' WHEN 3 THEN 'ajuste_positivo' ELSE 'ajuste_negativo' END AS tipo,
  '2025-01-01T00:00:00Z'::timestamptz + floor(((n-1)*600+p.id)/5.0)*interval '30 minutes' AS data
  FROM produtos p CROSS JOIN generate_series(1,200)n`)
 await client.query("INSERT INTO operacoes_estoque(id,autor_id,chave_idempotencia,hash_requisicao,criado_em)SELECT operacao,1,gen_random_uuid(),repeat('a',64),data FROM dados_explain")
 await client.query("INSERT INTO movimentacoes_estoque(operacao_id,produto_id,tipo,quantidade,delta,saldo_anterior,saldo_atual,motivo,criado_em)SELECT operacao,produto,tipo,1,CASE WHEN n%2=1 THEN 1 ELSE -1 END,CASE WHEN n%2=1 THEN 0 ELSE 1 END,CASE WHEN n%2=1 THEN 1 ELSE 0 END,'Fixture EXPLAIN',data FROM dados_explain ORDER BY n,produto")
 assert.equal((await client.query('SELECT count(*)::int AS n FROM movimentacoes_estoque')).rows[0].n,120000)
 assert.deepEqual((await client.query('SELECT p.id FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id GROUP BY p.id HAVING p.estoque::bigint<>coalesce(sum(m.delta),0)')).rows,[])
 await client.query('VACUUM ANALYZE movimentacoes_estoque');await client.query('VACUUM ANALYZE operacoes_estoque');await client.query('ANALYZE produtos')
 const resultados={versao:(await client.query('SHOW server_version')).rows[0].server_version,produtos:600,movimentos:120000,planos:{},tempos:{}}
 for(const etapa of ['antes','depois']){
  if(etapa==='depois'){await client.query(await readFile(`${raiz}/db/init/33_estoque_consultas.sql`,'utf8'));await client.query('ANALYZE movimentacoes_estoque')}
  resultados.planos[etapa]={};resultados.tempos[etapa]={}
  for(const [nome,{sql,params}]of Object.entries(consultas)){
   const planos=[]
   for(let n=0;n<3;n++)planos.push((await client.query('EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) '+sql,params)).rows[0]['QUERY PLAN'][0])
   resultados.planos[etapa][nome]=planos
   resultados.tempos[etapa][nome]=planos.map(p=>p['Execution Time']).sort((a,b)=>a-b)[1]
  }
 }
 resultados.bytesIndice=(await client.query("SELECT pg_relation_size('idx_movimentacoes_estoque_data')::int AS bytes")).rows[0].bytes
 if(process.env.ARQUIVO_EXPLAIN)await writeFile(process.env.ARQUIVO_EXPLAIN,JSON.stringify(resultados,null,2))
 console.log(JSON.stringify({versao:resultados.versao,produtos:600,movimentos:120000,medianasMs:resultados.tempos,bytesIndice:resultados.bytesIndice},null,2))
}finally{await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await client.end()}
