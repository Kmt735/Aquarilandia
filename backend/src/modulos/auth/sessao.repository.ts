import { db } from '../../config/db.js'
import type { NovaSessao,UsuarioLogado } from './auth.types.js'

const colunasUsuario = 'c.id, c.papel'
export const sessaoRepository = {
    async criar(dados: NovaSessao): Promise<void>{
        await db.query(
            'INSERT INTO sessoes ( token_hash, cliente_id, expira_em, ip, user_agent )VALUES ($1,$2,$3,$4,$5)',
            [dados.tokenHash,dados.clienteId,dados.expiraEm,dados.ip,dados.userAgent]
        )
    },

    async buscarUsuarioPorTokenHash(tokenHash:string): Promise<UsuarioLogado | null>{
        const { rows } = await db.query<UsuarioLogado>(` SELECT ${colunasUsuario} FROM sessoes AS s JOIN clientes AS c ON c.id= s.cliente_id WHERE token_hash = $1 AND expira_em > now() AND ativo = true  `, [tokenHash])
        return rows[0] ?? null
    }

}