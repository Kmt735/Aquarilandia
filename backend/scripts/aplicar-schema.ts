// Cria as tabelas num banco VAZIO (ex.: o Postgres do Render), rodando os db/init/*.sql em ordem alfabética, como o
// Docker faz na primeira subida. Não precisa do psql instalado.
//
// Uso, do seu computador, com a "External Database URL" do Render (a URL fica no ambiente, não no histórico):
//   read -s DATABASE_URL && export DATABASE_URL
//   DATABASE_SSL=true npm run db:schema
//   unset DATABASE_URL
//
// Tudo numa transação. Recusa rodar se a tabela "categorias" já existir: os scripts não são idempotentes (CREATE TABLE sem IF NOT EXISTS),
// e rodar de novo num banco com dados pararia no meio. Nunca imprime a URL nem a senha.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url || url.trim() === '') {
  console.error('Defina DATABASE_URL (veja o topo de scripts/aplicar-schema.ts).')
  process.exit(1)
}
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined

const pasta = fileURLToPath(new URL('../db/init/', import.meta.url))
const arquivos = readdirSync(pasta).filter((a) => a.endsWith('.sql')).sort()

const cliente = new pg.Client({ connectionString: url, ssl })
try {
  await cliente.connect()
  const { rows } = await cliente.query("SELECT to_regclass('public.categorias') IS NOT NULL AS existe")
  if (rows[0]?.existe) {
    console.error('O banco já tem as tabelas (categorias existe). Nada foi alterado.')
    process.exitCode = 1
  } else {
    // Tudo numa transação só: se um arquivo falhar, nada fica pela metade e dá para rodar de novo
    await cliente.query('BEGIN')
    try {
      for (const arquivo of arquivos) {
        await cliente.query(readFileSync(join(pasta, arquivo), 'utf8'))
        console.log(`ok  ${arquivo}`)
      }
      await cliente.query('COMMIT')
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {})
      throw err
    }
    console.log(`Esquema criado (${arquivos.length} arquivos).`)
  }
} catch (err) {
  // Só a mensagem do Postgres (sem a URL): diz em qual comando parou
  console.error(`Falhou: ${err instanceof Error ? err.message : String(err)}`)
  process.exitCode = 1
} finally {
  await cliente.end().catch(() => {})
}
