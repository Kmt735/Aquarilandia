import{db} from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type {
    AtualizacaoCliente,
    Cliente,
    ClienteAdmin,
    ClienteComSenha,
    FiltrosClienteAdmin,
    NovoCliente,
    PapelCliente,
} from './cliente.types.js'

const colunas = ' id, nome, email, telefone, papel, ativo, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm" '
// Mesmas colunas (nunca senha_hash) mais a data da anonimização, só para as rotas de admin
const colunasAdmin = `${colunas}, anonimizado_em AS "anonimizadoEm" `

// Única origem dos nomes de coluna do UPDATE dinâmico: chaves vindas do objeto recebido nunca viram SQL
const colunasAtualizaveis: Record<keyof AtualizacaoCliente, string> = {
    nome: 'nome',
    email: 'email',
    telefone: 'telefone',
}


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
    },
    async atualizar(id: number, dados: AtualizacaoCliente): Promise<Cliente | null> {
        const sets: string[] = []
        const valores: unknown[] = []
        // Percorre o mapa fixo, não o objeto recebido: só nome, email e telefone podem entrar no SET
        for (const campo of Object.keys(colunasAtualizaveis) as (keyof AtualizacaoCliente)[]) {
            if (dados[campo] === undefined) continue
            valores.push(dados[campo])
            sets.push(`${colunasAtualizaveis[campo]} = $${valores.length}`)
        }
        sets.push('atualizado_em = now()')
        valores.push(id)

        const { rows } = await db.query<Cliente>(
            `UPDATE clientes SET ${sets.join(', ')} WHERE id = $${valores.length} AND ativo RETURNING ${colunas}`,
            valores,
        )
        return rows[0] ?? null
    },
    // só para a troca de senha; nunca devolver em resposta
    async buscarHashSenha(id: number): Promise<string | null> {
        const { rows } = await db.query<{ senhaHash: string }>(
            'SELECT senha_hash AS "senhaHash" FROM clientes WHERE id = $1 AND ativo',
            [id],
        )
        return rows[0]?.senhaHash ?? null
    },
    async atualizarSenha(id: number, senhaHash: string, executor: Queryable = db): Promise<void> {
        await executor.query('UPDATE clientes SET senha_hash = $2, atualizado_em = now() WHERE id = $1', [id, senhaHash])
    },
    // Serializa as alterações de endereço do mesmo cliente (limite de 10 e troca de principal):
    // dois pedidos simultâneos não passam juntos, o segundo espera o COMMIT do primeiro
    async travarParaAlteracao(id: number, executor: Queryable): Promise<boolean> {
        const { rows } = await executor.query('SELECT id FROM clientes WHERE id = $1 AND ativo FOR UPDATE', [id])
        return rows.length > 0
    },
    // A mesma linha que o travarParaAlteracao trava, mas sem exigir ativo, para o admin poder reativar ou
    // anonimizar um cliente desativado. Os dois usam FOR UPDATE na mesma linha: um espera o outro, sem deadlock
    async travarParaAdmin(id: number, executor: Queryable): Promise<{ papel: PapelCliente; ativo: boolean } | null> {
        const { rows } = await executor.query<{ papel: PapelCliente; ativo: boolean }>(
            'SELECT papel, ativo FROM clientes WHERE id = $1 AND anonimizado_em IS NULL FOR UPDATE',
            [id],
        )
        return rows[0] ?? null
    },
    // Sem filtrar ativo nem anonimizado: o admin vê também quem foi desativado ou removido
    async buscarParaAdmin(id: number, executor: Queryable = db): Promise<ClienteAdmin | null> {
        const { rows } = await executor.query<ClienteAdmin>(`SELECT ${colunasAdmin} FROM clientes WHERE id = $1`, [id])
        return rows[0] ?? null
    },
    async listarParaAdmin(filtro: FiltrosClienteAdmin): Promise<{ dados: ClienteAdmin[]; total: number }> {
        // Tudo entra como parâmetro; a busca já chega com \, % e _ escapados pelo service (ESCAPE '\')
        const valores: unknown[] = [filtro.papel]
        let where = 'WHERE anonimizado_em IS NULL AND papel = $1'
        if (filtro.busca) {
            valores.push(filtro.busca)
            const n = valores.length
            where += ` AND (nome ILIKE '%' || $${n} || '%' ESCAPE '\\' OR email ILIKE '%' || $${n} || '%' ESCAPE '\\')`
        }

        // O count usa o mesmo WHERE da página
        const { rows: contagem } = await db.query<{ total: number }>(
            `SELECT count(*)::int AS total FROM clientes ${where}`,
            valores,
        )
        const { rows } = await db.query<ClienteAdmin>(
            `SELECT ${colunasAdmin} FROM clientes ${where}
             ORDER BY criado_em DESC, id DESC
             LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
            [...valores, filtro.limite, filtro.offset],
        )
        return { dados: rows, total: contagem[0].total }
    },
    // LGPD (D-23): a linha fica, porque as vendas apontam para ela; só os dados pessoais saem.
    // Os CHECKs ck_clientes_anonimizado_* exigem exatamente esta combinação (sem e-mail, senha e telefone, inativo)
    async anonimizar(id: number, executor: Queryable): Promise<boolean> {
        const { rowCount } = await executor.query(
            `UPDATE clientes
             SET nome = 'Cliente removido', email = NULL, telefone = NULL, senha_hash = NULL,
                 ativo = FALSE, anonimizado_em = now(), atualizado_em = now()
             WHERE id = $1 AND anonimizado_em IS NULL`,
            [id],
        )
        return rowCount === 1
    },
}

