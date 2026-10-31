import { createHash, randomBytes } from 'node:crypto'
import type { CookieOptions } from 'express'
import { env } from '../../config/env.js'

// Atributos do cookie "sid": o login grava e o logout e o apagar conta limpam com os MESMOS atributos,
// senão o navegador trata como outro cookie e não apaga o da sessão (D-07)
export const opcoesCookie: CookieOptions = {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
}

export function gerarToken(): string {
    return randomBytes(32).toString('base64url')
}

export function hashToken(token:string): string {
    return createHash('sha256').update(token).digest('hex')
}
