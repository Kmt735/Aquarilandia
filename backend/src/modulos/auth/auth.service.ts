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

function validarCadastro (body: unknown): DadosCadastro {
    const erros: Record<string,string> = {}

    if(typeof body !== 'object' || body === null || Array.isArray(body)) throw new AppError('Dados inválidos', 422, {body: 'Formato de dados inválido.'})
    const dados = body as Record<string, unknown>
    const nome = String (dados.nome ?? '').trim()
    const email = String (dados.email ?? '').trim().toLowerCase()
    const senha = String (dados.senha ?? '')
    const telefone = String (dados.telefone ?? '').trim().replace(/\D/g, '')
    const aceiteTermos = dados.aceiteTermos 

    if(nome.length < 2 || nome.length > 120) erros.nome = 'Digite seu nome (pelo menos 2 letras).'
    if(!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) || email.length > 160) erros.email = 'Digite um e-mail válido. Exemplo: nome@email.com.'
    if(senha.length < 8 || senha.length > 128) erros.senha = 'A senha precisa ter pelo menos 8 caracteres.'
    if(telefone.length !== 11) erros.telefone = 'Digite um celular com DDD. Exemplo: (32) 99999-0000.'
    if(aceiteTermos !== true) erros.aceiteTermos = 'Para criar a conta, aceite os termos de uso e a política de privacidade.'

    if(Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
    return {nome,email,senha,telefone,aceiteTermos:true}
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
  }
}