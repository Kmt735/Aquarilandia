import pg from 'pg'
import { env } from './env.js'
import { registrarErro } from '../utils/registrarErro.js'

// Colunas NUMERIC chegam como string por padrão; converte para number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number(valor))

export const db = new pg.Pool({ connectionString: env.databaseUrl })

db.on('error', (err) => {
  registrarErro(err, 'pool')
})
