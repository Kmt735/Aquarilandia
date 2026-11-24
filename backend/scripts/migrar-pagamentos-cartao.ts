import { readFile } from 'node:fs/promises'
import { db } from '../src/config/db.js'

try {
  const sql = await readFile(new URL('../db/init/36_pagamentos_cartao.sql', import.meta.url), 'utf8')
  await db.query(sql)
  console.info('Estrutura de pagamentos com cartão aplicada/verificada; dados preservados.')
} catch {
  console.error('Não foi possível aplicar a estrutura de pagamentos com cartão. Nenhum reset foi executado.')
  process.exitCode = 1
} finally { await db.end() }
