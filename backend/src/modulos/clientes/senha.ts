import argon2 from 'argon2'

export async function gerarHash(senha: string): Promise<string> {
    return argon2.hash(senha, {type: argon2.argon2id})
}

export async function verificarSenha(hash: string, senha: string): Promise<boolean> {
  return argon2.verify(hash, senha)
}



