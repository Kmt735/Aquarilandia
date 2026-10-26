import type { PoolClient } from 'pg'
import { db } from '../config/db.js'

export type Queryable = Pick<PoolClient, 'query'>

export async function comTransacao<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  let descartado = false
  try {
    await client.query('BEGIN')
    const resultado = await fn(client)
    await client.query('COMMIT')
    return resultado
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Uma conexão cujo rollback falhou não pode voltar ao pool para outro pedido.
      client.release(true)
      descartado = true
    }
    throw err
  } finally {
    if (!descartado) client.release()
  }
}
