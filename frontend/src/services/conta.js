import { requisitarApi } from './api.js'

export async function sessaoAtual() {
  try { return await requisitarApi('/auth/sessao') }
  catch (erro) { if (erro.status === 401) return null; throw erro }
}
export const entrar = ({ email, senha }) => requisitarApi('/auth/login', { metodo: 'POST', corpo: { email, senha } })
export const cadastrar = (dados) => requisitarApi('/auth/cadastro', { metodo: 'POST', corpo: dados })
export async function sair() {
  try { await requisitarApi('/auth/logout', { metodo: 'POST' }) }
  catch (erro) { if (erro.status !== 401) throw erro }
}
export const MENSAGEM_ESQUECI = 'Se este e-mail estiver cadastrado, você receberá um link para criar uma senha nova.'
export async function esqueciSenha({ email }) {
  const resposta = await requisitarApi('/auth/esqueci-senha', { metodo: 'POST', corpo: { email } })
  return resposta.mensagem
}
export const redefinirSenha = ({ token, senha }) => requisitarApi('/auth/redefinir-senha', {
  metodo: 'POST', corpo: { token, novaSenha: senha },
})
export const atualizarDados = (_usuario, { nome, email, telefone, senhaAtual }) => requisitarApi('/clientes/me', {
  metodo: 'PATCH', corpo: { nome, email, telefone, senhaAtual },
})
export const listarEnderecos = () => requisitarApi('/clientes/me/enderecos')
export async function salvarEndereco(endereco) {
  const { id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, principal } = endereco
  const salvo = await requisitarApi(`/clientes/me/enderecos${id ? `/${encodeURIComponent(id)}` : ''}`, {
    metodo: id ? 'PATCH' : 'POST', corpo: { apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, principal },
  })
  const lista = await listarEnderecos()
  return [...lista.filter((e) => e.id !== salvo.id), salvo]
}
export async function tornarPrincipal(id) {
  await requisitarApi(`/clientes/me/enderecos/${encodeURIComponent(id)}`, { metodo: 'PATCH', corpo: { principal: true } })
  return listarEnderecos()
}
export async function removerEndereco(id) {
  await requisitarApi(`/clientes/me/enderecos/${encodeURIComponent(id)}`, { metodo: 'DELETE' })
  return listarEnderecos()
}
