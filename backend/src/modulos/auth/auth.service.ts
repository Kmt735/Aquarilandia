import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import type { Queryable } from '../../utils/transacao.js'
import { clienteRepository } from '../clientes/cliente.repository.js'
import type { Cliente } from '../clientes/cliente.types.js'
import {
  detalhesEmailEmUso,
  ehEmailDuplicado,
  erroEmail,
  erroNome,
  erroSenha,
  erroTelefone,
  normalizarEmail,
  normalizarTelefone,
} from '../clientes/cliente.validacao.js'
import { gerarHash, verificarSenha } from '../clientes/senha.js'
import type { DadosCadastro, DadosLogin } from './auth.types.js'
import { gerarToken, hashToken } from './sessao.js'
import { sessaoRepository } from './sessao.repository.js'
import { tokenRepository } from './token.repository.js'

const DURACAO_SESSAO_MS = 7 * 24 *60 *60 *1000
const MSG_LOGIN_INVALIDO = 'Email ou senha incorretos.'
const msgCadastroRecusado = 'Não foi possível criar a conta.'

function validarCadastro (body: unknown): DadosCadastro {
    const erros: Record<string,string> = {}

    if(typeof body !== 'object' || body === null || Array.isArray(body)) throw new AppError('Dados inválidos', 422, {body: 'Formato de dados inválido.'})
    const dados = body as Record<string, unknown>
    const nome = String (dados.nome ?? '').trim()
    const email = normalizarEmail(dados.email)
    const senha = String (dados.senha ?? '')
    const telefone = normalizarTelefone(dados.telefone)
    const aceiteTermos = dados.aceiteTermos

    const msgNome = erroNome(nome)
    if(msgNome) erros.nome = msgNome
    const msgEmail = erroEmail(email)
    if(msgEmail) erros.email = msgEmail
    const msgSenha = erroSenha(senha)
    if(msgSenha) erros.senha = msgSenha
    const msgTelefone = erroTelefone(telefone)
    if(msgTelefone) erros.telefone = msgTelefone
    if(aceiteTermos !== true) erros.aceiteTermos = 'Para criar a conta, aceite os termos de uso e a política de privacidade.'

    if(Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
    return {nome,email,senha,telefone,aceiteTermos:true}
}

// Admin não tem telefone nem aceite de termos: só nome, e-mail e senha, com as regras do cadastro
function validarAdmin(body: unknown): { nome: string; email: string; senha: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }

  const dados = body as Record<string, unknown>
  const nome = String(dados.nome ?? '').trim()
  const email = normalizarEmail(dados.email)
  const senha = String(dados.senha ?? '')

  const erros: Record<string, string> = {}
  const msgNome = erroNome(nome)
  if (msgNome) erros.nome = msgNome
  const msgEmail = erroEmail(email)
  if (msgEmail) erros.email = msgEmail
  const msgSenha = erroSenha(senha)
  if (msgSenha) erros.senha = msgSenha

  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return { nome, email, senha }
}

function validarLogin(body:unknown):DadosLogin {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }

  const dados = body as Record<string, unknown>
  const email = String(dados.email ?? '').trim().toLowerCase()
  const senha = String(dados.senha ?? '')

  const erros: Record<string, string> = {}
  if (email === '') erros.email = 'Digite seu e-mail.'
  if (senha === '') erros.senha = 'Digite sua senha.'
  if (senha.length > 128) erros.senha = 'Senha inválida.'

  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return { email, senha }
}

// Senhas sem trim, como no cadastro: espaço também é caractere da senha
function validarTrocaSenha(body: unknown): { senhaAtual: string; novaSenha: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }

  const dados = body as Record<string, unknown>
  const senhaAtual = String(dados.senhaAtual ?? '')
  const novaSenha = String(dados.novaSenha ?? '')

  const erros: Record<string, string> = {}
  if (senhaAtual === '') erros.senhaAtual = 'Digite sua senha atual.'
  const msgNovaSenha = erroSenha(novaSenha)
  if (msgNovaSenha) erros.novaSenha = msgNovaSenha

  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return { senhaAtual, novaSenha }
}

export const authService = {
  async cadastrar(body: unknown): Promise<Cliente> {
    const dados = validarCadastro(body)

    const clienteExistente = await clienteRepository.buscarPorEmail(dados.email)
    if (clienteExistente) throw new AppError(msgCadastroRecusado, 409,detalhesEmailEmUso)

    const senhaHash = await gerarHash(dados.senha)

    try {
      return await clienteRepository.inserir({
        nome: dados.nome,
        email: dados.email,
        telefone: dados.telefone,
        senhaHash
      })
    } catch (err) {
      if (ehEmailDuplicado(err)) throw new AppError(msgCadastroRecusado, 409 ,detalhesEmailEmUso)
      throw err
    }
  },
  // Só o script scripts/criar-admin.ts chama esta função; nenhuma rota pode chamar (D-06)
  async criarAdmin(body: unknown): Promise<Cliente> {
    const dados = validarAdmin(body)

    const clienteExistente = await clienteRepository.buscarPorEmail(dados.email)
    if (clienteExistente) throw new AppError(msgCadastroRecusado, 409, detalhesEmailEmUso)

    const senhaHash = await gerarHash(dados.senha)

    try {
      return await clienteRepository.inserirAdmin({
        nome: dados.nome,
        email: dados.email,
        senhaHash,
      })
    } catch (err) {
      if (ehEmailDuplicado(err)) throw new AppError(msgCadastroRecusado, 409, detalhesEmailEmUso)
      throw err
    }
  },
  async login(
    body: unknown,
    contexto: { ip: string | null; userAgent: string | null }
  ): Promise<{ cliente: Cliente; token: string; expiraEm: Date }> {
    const dados = validarLogin(body)

    const encontrado = await clienteRepository.buscarParaLogin(dados.email)
    if (!encontrado || !encontrado.ativo) throw new AppError(MSG_LOGIN_INVALIDO, 401)

    const senhaConfere = await verificarSenha(encontrado.senhaHash, dados.senha)
    if (!senhaConfere) throw new AppError(MSG_LOGIN_INVALIDO, 401)

    const token = gerarToken()
    const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS)

    await sessaoRepository.criar({
      tokenHash: hashToken(token),
      clienteId: encontrado.id,
      expiraEm,
      ip: contexto.ip,
      userAgent: contexto.userAgent
    })

    const { senhaHash, ...cliente } = encontrado
    return { cliente, token, expiraEm }
  },
  async logout(token:string): Promise<void>{
    await sessaoRepository.excluirPorTokenHash(hashToken(token))
  },
  async buscarSessao(clienteId: number): Promise<Cliente>{
    const cliente = await clienteRepository.buscarPorId(clienteId)
    if(!cliente) throw new AppError('Faça login para continuar.',401)
    return cliente
  },
  async trocarSenha(clienteId: number, tokenAtual: string, body: unknown): Promise<void> {
    const dados = validarTrocaSenha(body)

    const hashAtual = await clienteRepository.buscarHashSenha(clienteId)
    if (!hashAtual) throw new AppError('Faça login para continuar.', 401)

    // Nenhuma senha válida passa de 128 (erroSenha): mais que isso está errada, sem rodar o argon2 à toa
    const senhaConfere = dados.senhaAtual.length <= 128 && (await verificarSenha(hashAtual, dados.senhaAtual))
    if (!senhaConfere) throw new AppError('Dados inválidos', 422, { senhaAtual: 'Senha atual incorreta.' })

    // Depois de conferir: só aqui a senhaAtual recebida é de fato a senha atual
    if (dados.novaSenha === dados.senhaAtual) {
      throw new AppError('Dados inválidos', 422, { novaSenha: 'A nova senha precisa ser diferente da atual.' })
    }

    const novoHash = await gerarHash(dados.novaSenha)

    // Senha nova e queda das outras sessões juntas: nunca uma sem a outra
    await comTransacao(async (client) => {
      await clienteRepository.atualizarSenha(clienteId, novoHash, client)
      await sessaoRepository.excluirOutrasDoCliente(clienteId, hashToken(tokenAtual), client)
    })
  },
  // Apaga todas as sessões e tokens; usado ao apagar a conta (LGPD) e, na #38, pelo admin
  async revogarAcessos(clienteId: number, executor: Queryable): Promise<void> {
    await sessaoRepository.excluirTodasDoCliente(clienteId, executor)
    await tokenRepository.excluirDoCliente(clienteId, executor)
  },
}