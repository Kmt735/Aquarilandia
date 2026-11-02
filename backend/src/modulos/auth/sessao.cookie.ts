import type { CookieOptions } from 'express'
import { env } from '../../config/env.js'

// Atributos do cookie "sid": o login grava e o logout e o apagar conta limpam com os MESMOS atributos,
// senão o navegador trata como outro cookie e não apaga o da sessão (D-07).
// Fica fora do sessao.ts de propósito: quem importa hashToken/gerarToken não pode carregar o config/env.ts
// (os testes de integração trocam o DATABASE_URL depois de importar o sessao.ts)
export const opcoesCookie: CookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax',
  path: '/',
}
