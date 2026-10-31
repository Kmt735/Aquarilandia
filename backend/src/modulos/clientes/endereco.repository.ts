import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { Endereco, NovoEndereco } from './cliente.types.js'

const colunas = `id, cliente_id AS "clienteId", apelido, cep, logradouro, numero, complemento, bairro, cidade, uf,
  principal, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`

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
}
