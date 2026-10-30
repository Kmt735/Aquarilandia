import {AppError} from "../../utils/AppError.js"
import {clienteRepository} from "../../modulos/clientes/cliente.repository.js"
import {gerarHash , verificarSenha } from "../clientes/senha.js"
import type { DadosCadastro , DadosLogin } from "./auth.types.js"
import type { Cliente } from "../clientes/cliente.types.js"
import {gerarToken , hashToken} from "./sessao.js"
import { sessaoRepository } from "./sessao.repository.js"



const detalhesEmailEmUso = {email: 'Este e-mail já está cadastrado.'}
const DURACAO_SESSAO_MS = 7 * 24 *60 *60 *1000
const MSG_LOGIN_INVALIDO = 'Email ou senha incorretos.'
const msgCadastroRecusado = 'Não foi possível criar a conta.'

// Regras compartilhadas entre o cadastro e o criar-admin; recebem o valor já normalizado
function erroNome(nome: string): string | null {
  if (nome.length < 2 || nome.length > 120) return 'Digite seu nome (pelo menos 2 letras).'
  return null
}

function erroEmail(email: string): string | null {
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) || email.length > 160) return 'Digite um e-mail válido. Exemplo: nome@email.com.'
  return null
}

function erroSenha(senha: string): string | null {
  if (senha.length < 8 || senha.length > 128) return 'A senha precisa ter pelo menos 8 caracteres.'
  return null
}

function validarCadastro (body: unknown): DadosCadastro {
    const erros: Record<string,string> = {}

    if(typeof body !== 'object' || body === null || Array.isArray(body)) throw new AppError('Dados inválidos', 422, {body: 'Formato de dados inválido.'})
    const dados = body as Record<string, unknown>
    const nome = String (dados.nome ?? '').trim()
    const email = String (dados.email ?? '').trim().toLowerCase()
    const senha = String (dados.senha ?? '')
    const telefone = String (dados.telefone ?? '').trim().replace(/\D/g, '')
    const aceiteTermos = dados.aceiteTermos 

    const msgNome = erroNome(nome)
    if(msgNome) erros.nome = msgNome
    const msgEmail = erroEmail(email)
    if(msgEmail) erros.email = msgEmail
    const msgSenha = erroSenha(senha)
    if(msgSenha) erros.senha = msgSenha
    if(telefone.length !== 11) erros.telefone = 'Digite um celular com DDD. Exemplo: (32) 99999-0000.'
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
  const email = String(dados.email ?? '').trim().toLowerCase()
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

// true só se o erro for o UNIQUE do e-mail (dois cadastros iguais ao mesmo tempo)
function ehEmailDuplicado(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === '23505' &&
    'constraint' in err &&
    err.constraint === 'clientes_email_key'
  )
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
  }
}