import { cepValido } from './cep'
import { telefoneValido } from './telefone'

// Mensagens iguais às do backend (auth.service.ts). Formato de erro: { campo: 'mensagem' },
// o mesmo de `detalhes` em { erro, detalhes } — os formulários mostram cada uma embaixo do campo.
export const MENSAGENS = {
  nome: 'Digite seu nome (pelo menos 2 letras).',
  email: 'Digite um e-mail válido. Exemplo: nome@email.com.',
  senha: 'A senha precisa ter pelo menos 8 caracteres.',
  telefone: 'Digite um celular com DDD. Exemplo: (32) 99999-0000.',
  aceiteTermos: 'Para criar a conta, aceite os termos de uso e a política de privacidade.',
  senhaLogin: 'Digite sua senha.',
  confirmarSenha: 'As duas senhas precisam ser iguais.',
  cep: 'Digite um CEP com 8 números. Exemplo: 36300-000.',
  obrigatorio: 'Preencha este campo.',
  servico: 'Escolha um serviço da lista.',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const regras = {
  nome: (v) => (v.trim().length >= 2 ? null : MENSAGENS.nome),
  email: (v) => (EMAIL.test(v.trim()) ? null : MENSAGENS.email),
  senha: (v) => (v.length >= 8 ? null : MENSAGENS.senha),
  senhaLogin: (v) => (v ? null : MENSAGENS.senhaLogin),
  telefone: (v) => (telefoneValido(v) ? null : MENSAGENS.telefone),
  aceiteTermos: (v) => (v === true ? null : MENSAGENS.aceiteTermos),
  cep: (v) => (cepValido(v) ? null : MENSAGENS.cep),
  obrigatorio: (v) => (String(v ?? '').trim() ? null : MENSAGENS.obrigatorio),
  servico: (v) => (v ? null : MENSAGENS.servico),
}

// Valida um objeto com { campo: regra }; devolve { campo: mensagem } só com os campos inválidos
export function validar(valores, mapaRegras) {
  const erros = {}
  for (const [campo, regra] of Object.entries(mapaRegras)) {
    const msg = regra(valores[campo], valores)
    if (msg) erros[campo] = msg
  }
  return erros
}
