import { randomBytes } from 'node:crypto'
import argon2 from 'argon2'

export async function gerarHash(senha: string): Promise<string> {
    return argon2.hash(senha, {type: argon2.argon2id})
}

export async function verificarSenha(hash: string, senha: string): Promise<boolean> {
  return argon2.verify(hash, senha)
}

// R-03 (Lote 14a): o login com e-mail que não existe (ou de conta inativa/anonimizada) também roda um argon2.verify,
// contra este hash fictício, para levar o mesmo tempo da senha errada e não revelar quais e-mails têm conta.
// Gerado UMA vez, na subida, pelo MESMO gerarHash do sistema (os mesmos parâmetros); a senha dele é aleatória e
// descartada, então nenhuma senha confere com ele
let hashFicticio: Promise<string> | undefined

function obterHashFicticio(): Promise<string> {
  hashFicticio ??= gerarHash(randomBytes(32).toString('base64url'))
  return hashFicticio
}

// Na subida (o módulo é carregado pelo auth.service). Se falhar, a próxima chamada tenta de novo
obterHashFicticio().catch(() => {
  hashFicticio = undefined
})

// Sempre resolve (nenhuma senha confere com o hash fictício); só gasta o mesmo tempo de uma verificação de verdade
export async function verificarSenhaFicticia(senha: string): Promise<void> {
  await argon2.verify(await obterHashFicticio(), senha)
}
