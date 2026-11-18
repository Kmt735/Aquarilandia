import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, before, describe, it } from 'node:test'

// O runner executa cada arquivo em processo separado: este liga a produção só aqui (valores fictícios, D-52)
process.env.NODE_ENV = 'production'
process.env.DATABASE_URL = 'postgres://fixture:senha-ficticia-de-producao-com-32-caracteres@127.0.0.1:1/fixture'
process.env.CORS_ORIGIN = 'https://loja.example'
process.env.FRONTEND_URL = 'https://loja.example'
process.env.API_URL = 'https://loja.example'
process.env.GATEWAY_ACCESS_TOKEN = 'token-ficticio-de-teste'
process.env.GATEWAY_WEBHOOK_SECRET = 'segredo-ficticio-de-teste-com-mais-de-32-caracteres'
// Lote 14a (D-54): obrigatórias em produção. Fictícias: nenhum caso deste arquivo manda e-mail
process.env.EMAIL_API_KEY = 'chave-ficticia-do-resend-de-teste'
process.env.EMAIL_REMETENTE = 'Loja <loja@remetente-ficticio.example>'
const { app } = await import('../src/app.ts')
const { db } = await import('../src/config/db.ts')

describe('Cabeçalhos em produção', () => {
  let servidor, base
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}`
  })
  after(async () => {
    await new Promise((r) => servidor.close(r))
    await db.end()
  })
  it('HSTS de 180 dias, sem preload e sem subdomínios; a CSP de sempre; trust proxy de 1 salto (o Caddy)', async () => {
    const r = await fetch(`${base}/api/inexistente`)
    assert.equal(r.headers.get('strict-transport-security'), 'max-age=15552000')
    assert.match(r.headers.get('content-security-policy'), /^default-src 'self';/)
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(r.headers.get('referrer-policy'), 'no-referrer')
    assert.equal(app.get('trust proxy'), 1)
    await r.arrayBuffer()
  })
})
