import { db } from '../../config/db.js'
import type { NovaSessao } from './auth.types.js'

export const sessaoRepository = {
    async criar(dados: NovaSessao): Promise<void>{
        await db.query(
            'INSERT INTO sessoes ( token_hash, cliente_id, expira_em, ip, user_agent )VALUES ($1,$2,$3,$4,$5)',
            [dados.tokenHash,dados.clienteId,dados.expiraEm,dados.ip,dados.userAgent]
        )
    }
}