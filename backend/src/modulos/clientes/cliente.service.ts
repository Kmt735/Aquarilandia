import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { paginacao } from '../../utils/validacao.js'
import { authService } from '../auth/auth.service.js'
import { vendaService } from '../vendas/venda.service.js'
import { clienteRepository } from './cliente.repository.js'
import type {
  AtualizacaoCliente,
  Cliente,
  DetalheClienteAdmin,
  ListaClientesAdmin,
  PapelCliente,
} from './cliente.types.js'
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
const msgClienteNaoEncontrado = 'Cliente não encontrado.'

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

// ?papel= padrão 'cliente'. ?busca= sem curingas: \, % e _ ganham uma barra antes e viram texto literal no
// ILIKE ... ESCAPE '\'. A barra do usuário também é escapada, senão "\%" dele viraria um % literal "de graça"
function lerFiltrosAdmin(parametros: Record<string, unknown>): { papel: PapelCliente; busca?: string } {
  let papel: PapelCliente = 'cliente'
  if (parametros.papel !== undefined) {
    if (parametros.papel !== 'cliente' && parametros.papel !== 'admin') {
      throw new AppError('Parâmetros inválidos', 400, { papel: 'Use cliente ou admin.' })
    }
    papel = parametros.papel
  }

  if (parametros.busca === undefined) return { papel }
  // ?busca=a&busca=b chega como array: só um texto de busca é aceito
  if (typeof parametros.busca !== 'string') {
    throw new AppError('Parâmetros inválidos', 400, { busca: 'Informe um único texto de busca.' })
  }
  const busca = parametros.busca.trim()
  if (busca.length > 100) {
    throw new AppError('Parâmetros inválidos', 400, { busca: 'A busca pode ter até 100 caracteres.' })
  }
  if (busca === '') return { papel }
  return { papel, busca: busca.replace(/[\\%_]/g, '\\$&') }
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
      // Trava a linha do cliente primeiro, como as rotas de endereço: todas pegam os locks na mesma ordem.
      // Sem exigir ativo: o admin pode anonimizar um cliente desativado (pelo /me ele está sempre ativo)
      if (!(await clienteRepository.travarParaAdmin(clienteId, client))) {
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

  async listarParaAdmin(query: unknown): Promise<ListaClientesAdmin> {
    const parametros = (typeof query === 'object' && query !== null ? query : {}) as Record<string, unknown>
    const { pagina, limite } = paginacao(parametros)
    const { papel, busca } = lerFiltrosAdmin(parametros)

    const offset = (pagina - 1) * limite
    const { dados, total } = await clienteRepository.listarParaAdmin({ busca, papel, limite, offset })
    const vendas = await vendaService.contarPorClientes(dados.map((cliente) => cliente.id))
    return {
      dados: dados.map((cliente) => ({
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        papel: cliente.papel,
        ativo: cliente.ativo,
        criadoEm: cliente.criadoEm,
        quantidadeVendas: vendas.get(cliente.id) ?? 0,
      })),
      total,
      pagina,
      limite,
    }
  },

  async buscarParaAdmin(id: number): Promise<DetalheClienteAdmin> {
    // Anonimizado também aparece (nome 'Cliente removido', e-mail e telefone nulos): é o dono das vendas antigas
    const cliente = await clienteRepository.buscarParaAdmin(id)
    if (!cliente) throw new AppError(msgClienteNaoEncontrado, 404)

    const [enderecos, resumo] = await Promise.all([
      enderecoRepository.listarDoCliente(id),
      vendaService.resumoDoCliente(id),
    ])
    return { ...cliente, enderecos, ...resumo }
  },
}
