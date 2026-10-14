import pg from 'pg'
import { env } from './env.js'

// Colunas NUMERIC chegam como string por padrão; converte para number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number(valor))

export const db = new pg.Pool({ connectionString: env.databaseUrl })

db.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err)
})
