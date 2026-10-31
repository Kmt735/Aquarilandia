import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { clienteRepository } from './cliente.repository.js'
import type { Endereco } from './cliente.types.js'
import { enderecoRepository } from './endereco.repository.js'
import { validarAtualizacaoEndereco, validarEndereco } from './endereco.validacao.js'

const msgEnderecoNaoEncontrado = 'Endereço não encontrado.'
const msgNaoAutenticado = 'Faça login para continuar.'
const limiteEnderecos = 10

export const enderecoService = {
  async listarMeus(clienteId: number): Promise<Endereco[]> {
    return enderecoRepository.listarDoCliente(clienteId)
  },

  async criar(clienteId: number, body: unknown): Promise<Endereco> {
    const dados = validarEndereco(body)

    return comTransacao(async (client) => {
      if (!(await clienteRepository.travarParaAlteracao(clienteId, client))) throw new AppError(msgNaoAutenticado, 401)

      const total = await enderecoRepository.contarDoCliente(clienteId, client)
      if (total >= limiteEnderecos) throw new AppError(`Você já tem ${limiteEnderecos} endereços cadastrados.`, 409)

      // O primeiro endereço sempre vira principal, para o cliente nunca ficar sem um
      const principal = dados.principal === true || total === 0
      // Desmarca antes de inserir: o índice único parcial não aceita dois principais nem por um instante
      if (principal && total > 0) await enderecoRepository.desmarcarPrincipal(clienteId, client)

      return enderecoRepository.inserir(clienteId, { ...dados, principal }, client)
    })
  },

  async atualizar(clienteId: number, enderecoId: number, body: unknown): Promise<Endereco> {
    const dados = validarAtualizacaoEndereco(body)

    return comTransacao(async (client) => {
      if (!(await clienteRepository.travarParaAlteracao(clienteId, client))) throw new AppError(msgNaoAutenticado, 401)

      const atual = await enderecoRepository.buscarDoCliente(enderecoId, clienteId, client)
      if (!atual) throw new AppError(msgEnderecoNaoEncontrado, 404)

      // Desmarcar o principal deixaria o cliente sem nenhum; a troca é feita marcando outro
      if (dados.principal === false && atual.principal) {
        throw new AppError('Dados inválidos', 422, {
          principal: 'Para trocar o endereço principal, marque outro como principal.',
        })
      }
      if (dados.principal === true && !atual.principal) await enderecoRepository.desmarcarPrincipal(clienteId, client)

      const endereco = await enderecoRepository.atualizar(enderecoId, clienteId, dados, client)
      if (!endereco) throw new AppError(msgEnderecoNaoEncontrado, 404)
      return endereco
    })
  },
}
