import pg from 'pg'
import { env } from './env.js'
import { registrarErro } from '../utils/registrarErro.js'

// Colunas NUMERIC chegam como string por padrão; converte para number
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (valor) => Number(valor))

// DATABASE_SSL=true: TLS sem conferir a cadeia do certificado (o Render e outros bancos gerenciados usam certificado
// próprio). Protege contra quem só escuta a rede, não contra quem se passa pelo servidor; dentro da rede privada do
// Render a conexão é pela URL interna, sem TLS
export const db = new pg.Pool({
  connectionString: env.databaseUrl,
  ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
})

db.on('error', (err) => {
  registrarErro(err, 'pool')
})
