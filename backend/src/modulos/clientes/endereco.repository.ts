import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { AtualizacaoEndereco, Endereco, NovoEndereco } from './cliente.types.js'

const colunas = `id, cliente_id AS "clienteId", apelido, cep, logradouro, numero, complemento, bairro, cidade, uf,
  principal, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`

// Única origem dos nomes de coluna do UPDATE dinâmico: chaves vindas do objeto recebido nunca viram SQL
const colunasAtualizaveis: Record<keyof AtualizacaoEndereco, string> = {
  apelido: 'apelido',
  cep: 'cep',
  logradouro: 'logradouro',
  numero: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  cidade: 'cidade',
  uf: 'uf',
  principal: 'principal',
}

// Toda query filtra por cliente_id: o endereço de outro cliente simplesmente não é encontrado
export const enderecoRepository = {
  async listarDoCliente(clienteId: number): Promise<Endereco[]> {
    const { rows } = await db.query<Endereco>(
      `SELECT ${colunas} FROM enderecos_cliente WHERE cliente_id = $1 ORDER BY principal DESC, criado_em DESC, id DESC`,
      [clienteId],
    )
    return rows
  },

  async buscarDoCliente(id: number, clienteId: number, executor: Queryable = db): Promise<Endereco | null> {
    const { rows } = await executor.query<Endereco>(
      `SELECT ${colunas} FROM enderecos_cliente WHERE id = $1 AND cliente_id = $2 FOR UPDATE`,
      [id, clienteId],
    )
    return rows[0] ?? null
  },

  async contarDoCliente(clienteId: number, executor: Queryable = db): Promise<number> {
    const { rows } = await executor.query<{ total: number }>(
      'SELECT count(*)::int AS total FROM enderecos_cliente WHERE cliente_id = $1',
      [clienteId],
    )
    return rows[0].total
  },

  async desmarcarPrincipal(clienteId: number, executor: Queryable = db): Promise<void> {
    await executor.query(
      'UPDATE enderecos_cliente SET principal = false, atualizado_em = now() WHERE cliente_id = $1 AND principal',
      [clienteId],
    )
  },

  async inserir(clienteId: number, dados: NovoEndereco, executor: Queryable = db): Promise<Endereco> {
    const { rows } = await executor.query<Endereco>(
      `INSERT INTO enderecos_cliente
         (cliente_id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, principal)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING ${colunas}`,
      [
        clienteId,
        dados.apelido,
        dados.cep,
        dados.logradouro,
        dados.numero,
        dados.complemento,
        dados.bairro,
        dados.cidade,
        dados.uf,
        dados.principal,
      ],
    )
    return rows[0]
  },

  async atualizar(
    id: number,
    clienteId: number,
    dados: AtualizacaoEndereco,
    executor: Queryable = db,
  ): Promise<Endereco | null> {
    const sets: string[] = []
    const valores: unknown[] = []
    // Percorre o mapa fixo, não o objeto recebido: só as 9 colunas do endereço podem entrar no SET
    for (const campo of Object.keys(colunasAtualizaveis) as (keyof AtualizacaoEndereco)[]) {
      if (dados[campo] === undefined) continue
      valores.push(dados[campo])
      sets.push(`${colunasAtualizaveis[campo]} = $${valores.length}`)
    }
    sets.push('atualizado_em = now()')
    valores.push(id, clienteId)

    const { rows } = await executor.query<Endereco>(
      `UPDATE enderecos_cliente SET ${sets.join(', ')}
       WHERE id = $${valores.length - 1} AND cliente_id = $${valores.length}
       RETURNING ${colunas}`,
      valores,
    )
    return rows[0] ?? null
  },

  async excluir(id: number, clienteId: number, executor: Queryable = db): Promise<{ principal: boolean } | null> {
    const { rows } = await executor.query<{ principal: boolean }>(
      'DELETE FROM enderecos_cliente WHERE id = $1 AND cliente_id = $2 RETURNING principal',
      [id, clienteId],
    )
    return rows[0] ?? null
  },

  // Se não sobrou endereço, a subconsulta devolve NULL e o UPDATE não altera nenhuma linha
  async marcarMaisRecenteComoPrincipal(clienteId: number, executor: Queryable = db): Promise<void> {
    await executor.query(
      `UPDATE enderecos_cliente SET principal = true, atualizado_em = now()
       WHERE cliente_id = $1 AND id = (
         SELECT id FROM enderecos_cliente WHERE cliente_id = $1 ORDER BY criado_em DESC, id DESC LIMIT 1
       )`,
      [clienteId],
    )
  },
}
