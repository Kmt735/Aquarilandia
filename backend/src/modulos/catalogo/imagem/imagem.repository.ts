import { db } from '../../../config/db.js'
import type { PoolClient } from 'pg'
import { urlImagem } from './imagem.limites.js'

export const imagemRepository = {
  async existe(produtoId: number): Promise<boolean> {
    return (await db.query('SELECT 1 FROM produtos WHERE id=$1', [produtoId])).rows.length > 0
  },
  async bloquear(produtoId: number, tx: PoolClient): Promise<{ imagemId: string | null; imagemUrl: string | null } | undefined> {
    return (await tx.query<{ imagemId: string | null; imagemUrl: string | null }>(
      'SELECT imagem_arquivo_id AS "imagemId", imagem_url AS "imagemUrl" FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [produtoId],
    )).rows[0]
  },
  async vincular(produtoId: number, id: string | null, tx: PoolClient): Promise<void> {
    await tx.query('UPDATE produtos SET imagem_arquivo_id=$2,imagem_url=$3,atualizado_em=now() WHERE id=$1', [produtoId, id, id ? urlImagem(id) : null])
  },
  async travarArquivo(id: string, tx: PoolClient, tentar = false): Promise<boolean> {
    const { rows } = await tx.query<{ ok: boolean }>(tentar
      ? 'SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS ok'
      : 'SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`imagem-produto:${id}`])
    return tentar ? rows[0].ok : true
  },
  async referenciado(id: string, tx: PoolClient): Promise<boolean> {
    const { rows } = await tx.query<{ existe: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM produtos WHERE imagem_arquivo_id=$1 OR imagem_url=$2) AS existe', [id, urlImagem(id)],
    )
    return rows[0].existe
  },
  async publica(id: string): Promise<boolean> {
    return (await db.query('SELECT 1 FROM produtos WHERE imagem_arquivo_id=$1 AND ativo', [id])).rows.length > 0
  },
}
