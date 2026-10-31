import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'

// O runner executa cada arquivo em processo separado; não muda o ambiente de outras suítes.
process.env.NODE_ENV = 'production'
const { app } = await import('../src/app.ts')
const { db } = await import('../src/config/db.ts')
const { env } = await import('../src/config/env.ts')
const { limiteLogin } = await import('../src/middlewares/rateLimit.ts')
const { authService } = await import('../src/modulos/auth/auth.service.ts')

describe('Ciclo 0 — cookie e contrato do proxy em produção', () => {
  let servidor, origem
  const ips = ['198.51.100.20', '198.51.100.21', ...Array.from({ length: 7 }, (_, i) => `192.0.2.${i + 1}`)]
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  beforeEach(() => { for (const ip of ips) limiteLogin.resetKey(ip) })
  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })
  function login(ip, body = {}) {
    return fetch(`${origem}/api/auth/login`, { method: 'POST', headers: { Origin: env.corsOrigin,
      'Content-Type': 'application/json', 'X-Forwarded-For': ip }, body: JSON.stringify(body) })
  }
  it('produção mantém trust proxy=1 e cookie Secure/HttpOnly/SameSite=Lax sem devolver o token no DTO', async () => {
    assert.equal(app.get('trust proxy'), 1)
    mock.method(authService, 'login', async () => ({ cliente: { id: 7, nome: 'Cliente Fictício', papel: 'cliente' },
      token: 'token-ficticio-producao', expiraEm: new Date(Date.now() + 3600000) }))
    const resposta = await login(ips[0], { email: 'cliente@example.com', senha: 'SenhaFicticia123!' })
    assert.equal(resposta.status, 200)
    const cookie = resposta.headers.get('set-cookie')
    for (const padrao of [/; Secure/i, /; HttpOnly/i, /SameSite=Lax/i, /Path=\//i, /Expires=/i]) assert.match(cookie, padrao)
    const body = await resposta.json()
    assert.equal(JSON.stringify(body).includes('token-ficticio-producao'), false)
    assert.equal(resposta.headers.get('access-control-allow-origin'), env.corsOrigin)
    assert.equal(resposta.headers.get('access-control-allow-credentials'), 'true')
  })
  it('com um proxy confiável, IPs encaminhados diferentes recebem limites independentes', async () => {
    for (let i = 0; i < 5; i++) assert.equal((await login(ips[0])).status, 422)
    const bloqueado = await login(ips[0]); assert.equal(bloqueado.status, 429); await bloqueado.json()
    assert.equal((await login(ips[1])).status, 422)
  })
  it('documenta o risco de acesso direto: XFF controlado pelo cliente consegue trocar o bucket em produção', async () => {
    // Comprova uma condição de implantação, não afirma que o ambiente publicado aceita acesso direto.
    for (const ip of ips.slice(2)) {
      const resposta = await login(ip)
      assert.equal(resposta.status, 422)
    }
  })
})
