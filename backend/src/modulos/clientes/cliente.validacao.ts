// Regras de campos de cliente usadas pelo cadastro, pelo criar-admin e pela conta (/me).
// As funções erro* recebem o valor já normalizado e devolvem a mensagem do api.md (seção 6) ou null.

export const detalhesEmailEmUso = { email: 'Este e-mail já está cadastrado.' }

export function erroNome(nome: string): string | null {
  if (nome.length < 2 || nome.length > 120) return 'Digite seu nome (pelo menos 2 letras).'
  return null
}

export function erroEmail(email: string): string | null {
  if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) || email.length > 160) return 'Digite um e-mail válido. Exemplo: nome@email.com.'
  return null
}

export function erroSenha(senha: string): string | null {
  if (senha.length < 8 || senha.length > 128) return 'A senha precisa ter pelo menos 8 caracteres.'
  return null
}

export function erroTelefone(telefone: string): string | null {
  if (telefone.length !== 11) return 'Digite um celular com DDD. Exemplo: (32) 99999-0000.'
  return null
}

export function normalizarEmail(valor: unknown): string {
  return String(valor ?? '').trim().toLowerCase()
}

export function normalizarTelefone(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '')
}

// true só se o erro for o UNIQUE do e-mail (dois cadastros iguais ao mesmo tempo)
export function ehEmailDuplicado(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === '23505' &&
    'constraint' in err &&
    err.constraint === 'clientes_email_key'
  )
}
