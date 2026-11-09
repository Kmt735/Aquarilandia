import { AppError } from '../../utils/AppError.js'
import { enviarEmail } from '../../utils/email.js'
import type { MensagemEmail } from '../../utils/email.js'
import { comTransacao } from '../../utils/transacao.js'
import { paginacao } from '../../utils/validacao.js'
import { authService } from '../auth/auth.service.js'
import { tokenRepository } from '../auth/token.repository.js'
import { vendaService } from '../vendas/venda.service.js'
import { clienteRepository } from './cliente.repository.js'
import type {
  AtualizacaoCliente,
  Cliente,
  ClienteAdmin,
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
// O admin nunca altera nem remove outro admin, nem a própria conta (a loja não fica sem admin)
const msgContaAdmin = 'Não é possível alterar uma conta de administrador.'

// Mesma mensagem de sempre para o cliente (#24); o admin recebe o texto escrito para quem gerencia a loja
const msgCompraEmAndamento = {
  cliente: 'Você tem compras em andamento. Aguarde a entrega ou cancele antes de apagar a conta.',
  admin: 'Este cliente tem compras em andamento. Aguarde a entrega ou o cancelamento antes de remover a conta.',
} as const

// Lê só nome, email e telefone, mais a senhaAtual quando o email vem (D-47); qualquer outra chave (papel, ativo, id,
// senhaHash...) é ignorada (api.md, seção 11). A senhaAtual é conferida no service, só se o e-mail mudar
function validarAtualizacao(body: unknown): { atualizacao: AtualizacaoCliente; senhaAtual: string } {
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
  let senhaAtual = ''

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
    // Sem trim, como na troca de senha: espaço também é caractere da senha
    senhaAtual = String(dados.senhaAtual ?? '')
  }
  if (dados.telefone !== undefined) {
    const telefone = normalizarTelefone(dados.telefone)
    const msgTelefone = erroTelefone(telefone)
    if (msgTelefone) erros.telefone = msgTelefone
    atualizacao.telefone = telefone
  }

  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return { atualizacao, senhaAtual }
}

// Vai para o e-mail ANTIGO: sem o e-mail novo e sem link (um link num e-mail inesperado ensina a clicar em golpe)
function montarAvisoEmailAlterado(para: string): MensagemEmail {
  return {
    para,
    assunto: 'Aquarilândia: seu e-mail foi alterado',
    texto: [
      'Olá!',
      '',
      'O e-mail de acesso da sua conta na Aquarilândia acabou de ser trocado.',
      'A partir de agora, este endereço não recebe mais as mensagens da conta.',
      '',
      'Se foi você, não precisa fazer nada.',
      'Se não foi você, fale com a loja o quanto antes.',
    ].join('\n'),
  }
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

// Só o ativo é lido; papel, nome, email etc. no body são ignorados (api.md, seção 11)
function validarAtivo(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }
  // Exatamente true ou false: 'false', 0 e null não viram booleano
  const { ativo } = body as Record<string, unknown>
  if (typeof ativo !== 'boolean') throw new AppError('Dados inválidos', 422, { ativo: 'Informe true ou false.' })
  return ativo
}

export const clienteService = {
  async buscarMeusDados(clienteId: number): Promise<Cliente> {
    const cliente = await clienteRepository.buscarPorId(clienteId)
    if (!cliente) throw new AppError('Cliente não encontrado.', 404)
    return cliente
  },

  async atualizarMeusDados(clienteId: number, body: unknown): Promise<Cliente> {
    const { atualizacao: dados, senhaAtual } = validarAtualizacao(body)

    // Preenchido só quando o e-mail muda de verdade: é para ele que vai o aviso
    let emailAntigo: string | null = null
    if (typeof dados.email === 'string') {
      const atual = await clienteRepository.buscarPorId(clienteId)
      if (!atual) throw new AppError('Cliente não encontrado.', 404)

      if (atual.email === dados.email) {
        // O próprio e-mail (ex.: em maiúsculas, já normalizado) não exige senha e nem é regravado
        delete dados.email
      } else {
        // D-47: sessão roubada + recuperação de senha = conta roubada. Trocar o e-mail exige a senha atual
        if (senhaAtual === '') {
          throw new AppError('Dados inválidos', 422, { senhaAtual: 'Digite sua senha atual para trocar o e-mail.' })
        }
        const hash = await clienteRepository.buscarHashSenha(clienteId)
        if (!hash) throw new AppError('Faça login para continuar.', 401)
        // Mesmo curto-circuito da troca de senha; o argon2 roda aqui, fora da transação
        const senhaConfere = senhaAtual.length <= 128 && (await verificarSenha(hash, senhaAtual))
        if (!senhaConfere) throw new AppError('Dados inválidos', 422, { senhaAtual: 'Senha atual incorreta.' })

        // Depois da senha: sem ela, a sessão roubada não descobre quais e-mails têm conta
        const donoDoEmail = await clienteRepository.buscarPorEmail(dados.email)
        if (donoDoEmail && donoDoEmail.id !== clienteId) {
          throw new AppError(msgAlteracaoRecusada, 409, detalhesEmailEmUso)
        }
        emailAntigo = atual.email
      }
    }

    let cliente: Cliente | null
    try {
      if (emailAntigo === null) {
        cliente = await clienteRepository.atualizar(clienteId, dados)
      } else {
        cliente = await comTransacao(async (client) => {
          // Cliente travado primeiro, como no esqueci-senha: um link não nasce no meio da troca do e-mail
          if (!(await clienteRepository.travarParaAlteracao(clienteId, client))) return null
          const atualizado = await clienteRepository.atualizar(clienteId, dados, client)
          // O link de recuperação mandado ao e-mail antigo deixa de valer
          await tokenRepository.excluirDoCliente(clienteId, client)
          return atualizado
        })
      }
    } catch (err) {
      // Outro cliente pegou o mesmo e-mail entre a checagem acima e o UPDATE
      if (ehEmailDuplicado(err)) throw new AppError(msgAlteracaoRecusada, 409, detalhesEmailEmUso)
      throw err
    }

    if (!cliente) throw new AppError('Cliente não encontrado.', 404)

    // Depois do COMMIT e sem esperar o provedor. Se não foi a pessoa, o aviso chega no endereço que ela ainda lê
    if (emailAntigo !== null) {
      void enviarEmail(montarAvisoEmailAlterado(emailAntigo)).catch(() => {
        console.error('[troca-email] falha ao enviar o aviso')
      })
    }
    return cliente
  },

  // Núcleo da anonimização (LGPD, D-23), reaproveitado pela #38 (admin): NÃO confere senha nem papel,
  // quem chama decide quem pode apagar. As vendas não são tocadas: ficam com o cliente_id e os entrega_*.
  // contexto só escolhe a mensagem do 409 de compras em andamento.
  async anonimizarConta(clienteId: number, contexto: 'cliente' | 'admin' = 'cliente'): Promise<void> {
    await comTransacao(async (client) => {
      // Trava a linha do cliente primeiro, como as rotas de endereço: todas pegam os locks na mesma ordem.
      // Sem exigir ativo: o admin pode anonimizar um cliente desativado (pelo /me ele está sempre ativo)
      if (!(await clienteRepository.travarParaAdmin(clienteId, client))) {
        throw new AppError('Cliente não encontrado.', 404)
      }
      if (await vendaService.temCompraEmAndamento(clienteId, client)) {
        throw new AppError(msgCompraEmAndamento[contexto], 409)
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

  async definirAtivoPeloAdmin(adminId: number, id: number, body: unknown): Promise<ClienteAdmin> {
    const ativo = validarAtivo(body)

    return comTransacao(async (client) => {
      const atual = await clienteRepository.travarParaAdmin(id, client)
      if (!atual) throw new AppError(msgClienteNaoEncontrado, 404)
      if (atual.papel === 'admin' || id === adminId) throw new AppError(msgContaAdmin, 409)

      // Pedir o estado que já está valendo não escreve nada (repetir o PATCH dá o mesmo resultado)
      if (atual.ativo === ativo) {
        const cliente = await clienteRepository.buscarParaAdmin(id, client)
        if (!cliente) throw new Error('Cliente travado não encontrado na própria transação.')
        return cliente
      }

      const cliente = await clienteRepository.definirAtivo(id, ativo, client)
      // Na mesma transação: o cliente é deslogado na hora e os links de recuperação pendentes deixam de valer
      // Também ao reativar: sessão da corrida login × desativação voltaria a valer (nenhuma é legítima)
      await authService.revogarAcessos(id, client)
      return cliente
    })
  },

  async removerPeloAdmin(adminId: number, id: number): Promise<void> {
    const cliente = await clienteRepository.buscarParaAdmin(id)
    if (!cliente || cliente.anonimizadoEm) throw new AppError(msgClienteNaoEncontrado, 404)
    if (cliente.papel === 'admin' || id === adminId) throw new AppError(msgContaAdmin, 409)

    await clienteService.anonimizarConta(id, 'admin')
  },
}
