import { readFile } from 'node:fs/promises'
import { db } from '../src/config/db.js'
import { comTransacao } from '../src/utils/transacao.js'

try {
  const migracoes = await Promise.all(['30_estoque.sql', '31_estoque_vendas.sql'].map(
    (arquivo) => readFile(new URL(`../db/init/${arquivo}`, import.meta.url), 'utf8'),
  ))
  await comTransacao(async (tx) => {
    // Em base existente, mantém ordem operação → produto também entre as duas migrações.
    await tx.query("SET LOCAL lock_timeout = '5s'")
    const { rows } = await tx.query<{ tabela: string | null }>("SELECT to_regclass('operacoes_estoque') AS tabela")
    if (rows[0].tabela) await tx.query('LOCK TABLE operacoes_estoque IN ACCESS EXCLUSIVE MODE')
    for (const sql of migracoes) await tx.query(sql)
  })
  console.info('Migração de estoque aplicada/verificada; saldos preexistentes preservados e histórico reconciliado.')
} catch {
  // Não exibe SQL, credenciais, parâmetros nem conteúdo livre do histórico.
  console.error('Não foi possível aplicar/verificar a migração de estoque. Nenhum reset foi executado.')
  process.exitCode = 1
} finally {
  await db.end()
}
