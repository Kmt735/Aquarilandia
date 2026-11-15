import { readFile } from 'node:fs/promises'
import { db } from '../src/config/db.js'
import { comTransacao } from '../src/utils/transacao.js'

try {
  const sql = await readFile(new URL('../db/init/33_estoque_consultas.sql', import.meta.url), 'utf8')
  await comTransacao((tx) => tx.query(sql))
  console.info('Índice de consultas de estoque aplicado/verificado; dados preservados.')
} catch {
  console.error('Não foi possível aplicar/verificar o índice de estoque. Nenhum reset foi executado.')
  process.exitCode = 1
} finally { await db.end() }
