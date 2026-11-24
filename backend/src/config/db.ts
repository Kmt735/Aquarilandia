import pg from 'pg'
import { env } from './env.js'
import { registrarErro } from '../utils/registrarErro.js'

// Colunas NUMERIC chegam como string por padrão; converte para number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number(valor))

// DATABASE_SSL=true: TLS com validação padrão do certificado, para a URL externa do banco gerenciado.
// Na rede privada do Render, a URL interna também pode ser usada sem TLS (padrão false).
export const db = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? true : undefined,
})

db.on('error', (err) => {
  registrarErro(err, 'pool')
})
