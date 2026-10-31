// INTEGRAÇÃO: rotas de auth e clientes do backend (cadastro, login, logout, senha, endereços).
// Hoje tudo é simulado em memória/sessionStorage com os dados de mocks/conta.js.
import { ENDERECOS_EXEMPLO, USUARIO_EXEMPLO } from '../mocks/conta'
import { ErroApi, gravarSessao, lerSessao, simularRede } from './http'
import { MENSAGENS, regras, validar } from '../utils/validacao'

const CHAVE_SESSAO = 'aquarilandia-sessao-exemplo'
const CHAVE_ENDERECOS = 'aquarilandia-enderecos-exemplo'

export const sessaoAtual = () => lerSessao(CHAVE_SESSAO, null)

function exigirValido(dados, mapa) {
  const detalhes = validar(dados, mapa)
  if (Object.keys(detalhes).length) throw new ErroApi('Confira os campos destacados.', detalhes, 400)
}

export async function entrar({ email, senha }) {
  exigirValido({ email, senha }, { email: regras.email, senha: regras.senhaLogin })
  await simularRede(600)
  const usuario = { ...USUARIO_EXEMPLO, email: email.trim() }
  gravarSessao(CHAVE_SESSAO, usuario)
  return usuario
}

export async function cadastrar(dados) {
  exigirValido(dados, {
    nome: regras.nome,
    email: regras.email,
    senha: regras.senha,
    telefone: regras.telefone,
    aceiteTermos: regras.aceiteTermos,
  })
  await simularRede(700)
  const usuario = { ...USUARIO_EXEMPLO, nome: dados.nome.trim(), email: dados.email.trim(), telefone: dados.telefone }
  gravarSessao(CHAVE_SESSAO, usuario)
  return usuario
}

export async function sair() {
  await simularRede(200)
  gravarSessao(CHAVE_SESSAO, null)
}

// A resposta é sempre a mesma, exista ou não o e-mail (não revela quem tem conta)
export const MENSAGEM_ESQUECI = 'Se este e-mail estiver cadastrado, você receberá um link para criar uma senha nova.'

export async function esqueciSenha({ email }) {
  exigirValido({ email }, { email: regras.email })
  await simularRede(600)
  return MENSAGEM_ESQUECI
}

export async function redefinirSenha({ senha, confirmarSenha }) {
  exigirValido(
    { senha, confirmarSenha },
    { senha: regras.senha, confirmarSenha: (v, todos) => (v === todos.senha ? null : MENSAGENS.confirmarSenha) },
  )
  await simularRede(600)
}

export async function atualizarDados(usuario, dados) {
  exigirValido(dados, { nome: regras.nome, email: regras.email, telefone: regras.telefone })
  await simularRede(500)
  const novo = { ...usuario, ...dados }
  gravarSessao(CHAVE_SESSAO, novo)
  return novo
}

export async function listarEnderecos() {
  await simularRede()
  return lerSessao(CHAVE_ENDERECOS, ENDERECOS_EXEMPLO)
}

export async function salvarEndereco(endereco) {
  exigirValido(endereco, {
    cep: regras.cep,
    logradouro: regras.obrigatorio,
    numero: regras.obrigatorio,
    bairro: regras.obrigatorio,
    cidade: regras.obrigatorio,
    uf: regras.obrigatorio,
  })
  await simularRede(500)
  const lista = lerSessao(CHAVE_ENDERECOS, ENDERECOS_EXEMPLO)
  const id = endereco.id ?? `end-${Date.now()}`
  const novo = { ...endereco, id, principal: lista.length === 0 ? true : Boolean(endereco.principal) }
  let atualizada = lista.some((e) => e.id === id) ? lista.map((e) => (e.id === id ? novo : e)) : [...lista, novo]
  if (novo.principal) atualizada = atualizada.map((e) => ({ ...e, principal: e.id === id }))
  gravarSessao(CHAVE_ENDERECOS, atualizada)
  return atualizada
}

export async function tornarPrincipal(id) {
  await simularRede(300)
  const lista = lerSessao(CHAVE_ENDERECOS, ENDERECOS_EXEMPLO).map((e) => ({ ...e, principal: e.id === id }))
  gravarSessao(CHAVE_ENDERECOS, lista)
  return lista
}

export async function removerEndereco(id) {
  await simularRede(300)
  let lista = lerSessao(CHAVE_ENDERECOS, ENDERECOS_EXEMPLO).filter((e) => e.id !== id)
  if (lista.length && !lista.some((e) => e.principal)) lista = lista.map((e, i) => ({ ...e, principal: i === 0 }))
  gravarSessao(CHAVE_ENDERECOS, lista)
  return lista
}
