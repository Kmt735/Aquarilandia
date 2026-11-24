// Cria as tabelas de avaliações num banco que JÁ existe (o db:schema só roda em banco vazio).
// O 36_avaliacoes.sql é idempotente: rodar de novo não muda nada nem apaga dados.
// Uso: npm run db:migrar-avaliacoes (com DATABASE_URL e NODE_ENV no .env ou no ambiente; DATABASE_SSL=true
// para a External Database URL do Render)
import { readFile } from 'node:fs/promises'
import { db } from '../src/config/db.js'
import { comTransacao } from '../src/utils/transacao.js'

try {
  const sql = await readFile(new URL('../db/init/36_avaliacoes.sql', import.meta.url), 'utf8')
  await comTransacao((tx) => tx.query(sql))
  console.info('Tabelas de avaliações aplicadas/verificadas; dados preservados.')
} catch (err) {
  // Só a mensagem do Postgres (ex.: a tabela produtos não existe), nunca a URL do banco
  console.error(`Não foi possível aplicar as tabelas de avaliações. Nada foi apagado. ${err instanceof Error ? err.message : ''}`)
  process.exitCode = 1
} finally { await db.end() }
