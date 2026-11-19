import { cepValido } from './cep.js'
import { telefoneValido } from './telefone.js'

// Padrão do item 9 do PDF: primeiro o erro curto, depois como corrigir ("CEP inválido. Digite os 8 números…").
// A <MensagemErro> mostra a primeira frase em destaque e o resto na linha de baixo.
// Formato de erro: { campo: 'mensagem' }, o mesmo de `detalhes` em { erro, detalhes } — cada uma aparece embaixo do campo.
export const MENSAGENS = {
  nome: 'Nome muito curto. Digite pelo menos 2 letras.',
  email: 'E-mail inválido. Use o formato nome@email.com.',
  senha: 'Senha muito curta. Use pelo menos 8 caracteres.',
  telefone: 'Celular inválido. Digite com DDD, como (32) 99999-0000.',
  aceiteTermos: 'Termos não aceitos. Marque a caixa para criar a conta.',
  senhaLogin: 'Senha em branco. Digite sua senha.',
  confirmarSenha: 'As senhas não conferem. Digite a mesma senha nos dois campos.',
  cep: 'CEP inválido. Digite os 8 números, como 36300-000.',
  obrigatorio: 'Campo obrigatório. Preencha para continuar.',
  servico: 'Serviço não escolhido. Escolha um da lista.',
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

// Divide "Erro curto. Como corrigir." em { erro, ajuda }. Sem segunda frase, tudo fica em `erro`.
export function dividirMensagem(texto) {
  const m = String(texto ?? '').match(/^(.+?)[.!]\s+(.+)$/s)
  return m ? { erro: m[1], ajuda: m[2] } : { erro: String(texto ?? ''), ajuda: '' }
}
