import{db} from '../../config/db.js'
import type { Cliente,NovoCliente } from './cliente.types.js'

const colunas = ' id, nome, email, telefone, papel, ativo, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm" '


export const clienteRepository = {
    async buscarPorEmail(email:string):Promise<Cliente | null> {
        const { rows } = await db.query<Cliente>(`SELECT ${colunas} FROM clientes WHERE email = $1`, [email])
        return rows[0] ?? null
    },
    async inserir(dados:NovoCliente):Promise<Cliente> {
        const { rows } = await db.query<Cliente>(`INSERT INTO  clientes(nome,email,telefone,senha_hash,aceitou_termos_em) VALUES ($1,$2,$3,$4,now()) RETURNING ${colunas}`, [dados.nome, dados.email, dados.telefone, dados.senhaHash])
        return rows[0]
    }
}


