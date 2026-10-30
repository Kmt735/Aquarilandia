import{db} from '../../config/db.js'
import type { Cliente,NovoCliente,ClienteComSenha } from './cliente.types.js'

const colunas = ' id, nome, email, telefone, papel, ativo, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm" '


export const clienteRepository = {
    async buscarPorEmail(email:string):Promise<Cliente | null> {
        const { rows } = await db.query<Cliente>(`SELECT ${colunas} FROM clientes WHERE email = $1`, [email])
        return rows[0] ?? null
    },
    async inserir(dados:NovoCliente):Promise<Cliente> {
        const { rows } = await db.query<Cliente>(`INSERT INTO  clientes(nome,email,telefone,senha_hash,aceitou_termos_em) VALUES ($1,$2,$3,$4,now()) RETURNING ${colunas}`, [dados.nome, dados.email, dados.telefone, dados.senhaHash])
        return rows[0]
    },
    // papel 'admin' fixo no SQL: o inserir (cadastro público) não grava papel, então só cria cliente
    async inserirAdmin(dados: { nome: string; email: string; senhaHash: string }): Promise<Cliente> {
        const { rows } = await db.query<Cliente>(
            `INSERT INTO clientes (nome, email, senha_hash, papel) VALUES ($1, $2, $3, 'admin') RETURNING ${colunas}`,
            [dados.nome, dados.email, dados.senhaHash],
        )
        return rows[0]
    },
    // funcao usada apenas no login ,pois devolve o hash da senha!!
    async buscarParaLogin (email:string): Promise<ClienteComSenha | null> {
        const { rows } = await db.query<ClienteComSenha>(
             ` SELECT ${colunas}, senha_hash AS "senhaHash" FROM clientes WHERE email = $1`, [email] 
        )
        return rows[0] ?? null
    },
    async buscarPorId(id:number): Promise<Cliente | null>{
        const { rows } = await db.query<Cliente>(`SELECT ${colunas} FROM clientes WHERE id = $1 AND ativo `,[id])
        return rows[0] ?? null
    } 
}

