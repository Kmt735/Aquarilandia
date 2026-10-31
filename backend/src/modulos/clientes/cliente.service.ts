import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { authService } from '../auth/auth.service.js'
import { vendaService } from '../vendas/venda.service.js'
import { clienteRepository } from './cliente.repository.js'
import type { AtualizacaoCliente, Cliente } from './cliente.types.js'
import {
  detalhesEmailEmUso,
  ehEmailDuplicado,
  erroEmail,
  erroNome,
  erroTelefone,
  normalizarEmail,
  normalizarTelefone,
} from './cliente.validacao.js'
import { enderecoRepository } from './endereco.repository.js'
import { verificarSenha } from './senha.js'

const msgAlteracaoRecusada = 'Não foi possível salvar as alterações.'

// Lê só nome, email e telefone; qualquer outra chave (papel, ativo, id, senhaHash...) é ignorada (api.md, seção 11)
function validarAtualizacao(body: unknown): AtualizacaoCliente {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }

  const dados = body as Record<string, unknown>
  if (dados.nome === undefined && dados.email === undefined && dados.telefone === undefined) {
    throw new AppError('Dados inválidos', 422, {
      body: 'Informe pelo menos um campo para atualizar: nome, e-mail ou telefone.',
    })
  }

  const erros: Record<string, string> = {}
  const atualizacao: AtualizacaoCliente = {}

  if (dados.nome !== undefined) {
    const nome = String(dados.nome ?? '').trim()
    const msgNome = erroNome(nome)
    if (msgNome) erros.nome = msgNome
    atualizacao.nome = nome
  }
  if (dados.email !== undefined) {
    const email = normalizarEmail(dados.email)
    const msgEmail = erroEmail(email)
    if (msgEmail) erros.email = msgEmail
    atualizacao.email = email
  }
  if (dados.telefone !== undefined) {
    const telefone = normalizarTelefone(dados.telefone)
    const msgTelefone = erroTelefone(telefone)
    if (msgTelefone) erros.telefone = msgTelefone
    atualizacao.telefone = telefone
  }

  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return atualizacao
}

// Senha sem trim, como no cadastro e na troca de senha: espaço também é caractere da senha
function validarApagarConta(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }

  const senha = String((body as Record<string, unknown>).senha ?? '')
  if (senha === '') throw new AppError('Dados inválidos', 422, { senha: 'Digite sua senha para confirmar.' })
  return senha
}

export const clienteService = {
  async buscarMeusDados(clienteId: number): Promise<Cliente> {
    const cliente = await clienteRepository.buscarPorId(clienteId)
    if (!cliente) throw new AppError('Cliente não encontrado.', 404)
    return cliente
  },

  async atualizarMeusDados(clienteId: number, body: unknown): Promise<Cliente> {
    const dados = validarAtualizacao(body)

    if (typeof dados.email === 'string') {
      const donoDoEmail = await clienteRepository.buscarPorEmail(dados.email)
      // Mandar o próprio e-mail de volta (ex.: em maiúsculas) não é conflito
      if (donoDoEmail && donoDoEmail.id !== clienteId) throw new AppError(msgAlteracaoRecusada, 409, detalhesEmailEmUso)
    }

    let cliente: Cliente | null
    try {
      cliente = await clienteRepository.atualizar(clienteId, dados)
    } catch (err) {
      // Outro cliente pegou o mesmo e-mail entre a checagem acima e o UPDATE
      if (ehEmailDuplicado(err)) throw new AppError(msgAlteracaoRecusada, 409, detalhesEmailEmUso)
      throw err
    }

    if (!cliente) throw new AppError('Cliente não encontrado.', 404)
    return cliente
  },

  // Núcleo da anonimização (LGPD, D-23), reaproveitado pela #38 (admin): NÃO confere senha nem papel,
  // quem chama decide quem pode apagar. As vendas não são tocadas: ficam com o cliente_id e os entrega_*
  async anonimizarConta(clienteId: number): Promise<void> {
    await comTransacao(async (client) => {
      // Trava a linha do cliente primeiro, como as rotas de endereço: todas pegam os locks na mesma ordem
      if (!(await clienteRepository.travarParaAlteracao(clienteId, client))) {
        throw new AppError('Cliente não encontrado.', 404)
      }
      if (await vendaService.temCompraEmAndamento(clienteId, client)) {
        throw new AppError('Você tem compras em andamento. Aguarde a entrega ou cancele antes de apagar a conta.', 409)
      }

      await enderecoRepository.excluirTodosDoCliente(clienteId, client)
      await authService.revogarAcessos(clienteId, client)
      if (!(await clienteRepository.anonimizar(clienteId, client))) throw new AppError('Cliente não encontrado.', 404)
    })
  },

  async apagarMinhaConta(clienteId: number, body: unknown): Promise<void> {
    const senha = validarApagarConta(body)

    const cliente = await clienteRepository.buscarPorId(clienteId)
    if (!cliente) throw new AppError('Faça login para continuar.', 401)
    // Evita a loja ficar sem nenhum admin
    if (cliente.papel === 'admin') throw new AppError('Contas de administrador não podem ser apagadas por aqui.', 403)

    const hash = await clienteRepository.buscarHashSenha(clienteId)
    if (!hash) throw new AppError('Faça login para continuar.', 401)

    // Mesmo curto-circuito da troca de senha: acima de 128 está errada, sem rodar o argon2 à toa.
    // O argon2 roda antes e fora da transação: é lento de propósito e não pode segurar conexão do pool
    const senhaConfere = senha.length <= 128 && (await verificarSenha(hash, senha))
    if (!senhaConfere) throw new AppError('Dados inválidos', 422, { senha: 'Senha incorreta.' })

    await clienteService.anonimizarConta(clienteId)
  },
}
