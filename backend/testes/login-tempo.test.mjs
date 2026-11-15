import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import argon2 from 'argon2'
import { app } from '../src/app.ts'
import { env } from '../src/config/env.ts'
import { limiteLogin } from '../src/middlewares/rateLimit.ts'
import { authService } from '../src/modulos/auth/auth.service.ts'
import { clienteRepository } from '../src/modulos/clientes/cliente.repository.ts'
import { gerarHash } from '../src/modulos/clientes/senha.ts'

// R-03 (Lote 14a), sem banco: o login com e-mail que não existe (ou de conta inativa/anonimizada) roda o argon2.verify
// contra um hash fictício e responde o MESMO 401 da senha errada. A medição de tempo (informativa) está no relatório.
const senhaCerta = 'SenhaCerta123!'
let hashReal
const contaAtiva = () => ({ id: 7, nome: 'Fulana', email: 'fulana@exemplo.com', telefone: null, papel: 'cliente', ativo: true,
  criadoEm: new Date(), atualizadoEm: new Date(), senhaHash: hashReal })

describe('Login: o mesmo trabalho e a mesma resposta com e-mail inexistente e com senha errada (R-03)', () => {
  let servidor, base
  before(async () => {
    hashReal = await gerarHash(senhaCerta)
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}/api`
  })
  after(async () => { await new Promise((r) => servidor.close(r)) })
  afterEach(() => { mock.restoreAll(); limiteLogin.resetKey('127.0.0.1') })

  const casos = [
    ['e-mail inexistente', async () => null],
    ['conta desativada', async () => ({ ...contaAtiva(), ativo: false })],
    ['senha errada', async () => contaAtiva()],
  ]

  for (const [descricao, buscar] of casos) {
    it(`${descricao}: o argon2.verify roda uma vez e o erro é o 401 de sempre`, async () => {
      mock.method(clienteRepository, 'buscarParaLogin', buscar)
      const verify = mock.method(argon2, 'verify')
      await assert.rejects(authService.login({ email: 'alguem@exemplo.com', senha: 'SenhaErrada123!' }, { ip: null, userAgent: null }), (err) => {
        assert.deepEqual([err.statusCode, err.message, err.detalhes], [401, 'Email ou senha incorretos.', undefined])
        return true
      })
      assert.equal(verify.mock.callCount(), 1, 'sem o verify, o tempo da resposta revelaria se a conta existe')
      assert.equal(verify.mock.calls[0].arguments[1], 'SenhaErrada123!')
      assert.match(verify.mock.calls[0].arguments[0], /^\$argon2id\$/, 'contra um hash argon2id')
      // O resultado é sempre "não confere"
      assert.equal(await verify.mock.calls[0].result, false)
    })
  }

  it('o hash fictício tem os mesmos parâmetros do sistema e é gerado uma vez só', async () => {
    mock.method(clienteRepository, 'buscarParaLogin', async () => null)
    const verify = mock.method(argon2, 'verify')
    for (let i = 0; i < 3; i++) await assert.rejects(authService.login({ email: 'x@exemplo.com', senha: `Senha${i}Errada!` }, { ip: null, userAgent: null }))
    const hashes = new Set(verify.mock.calls.map((c) => c.arguments[0]))
    assert.equal(hashes.size, 1, 'o mesmo hash fictício em todas as chamadas')
    const parametros = (h) => h.split('$').slice(1, 4).join('$') // $argon2id$v=19$m=...,t=...,p=...
    assert.equal(parametros([...hashes][0]), parametros(hashReal))
  })

  it('pela rota: o mesmo status e o mesmo corpo nos três casos', async () => {
    const respostas = []
    for (const [, buscar] of casos) {
      mock.method(clienteRepository, 'buscarParaLogin', buscar)
      const r = await fetch(`${base}/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: env.corsOrigin },
        body: JSON.stringify({ email: 'alguem@exemplo.com', senha: 'SenhaErrada123!' }),
      })
      respostas.push([r.status, await r.text(), r.headers.get('set-cookie')])
      mock.restoreAll()
    }
    assert.deepEqual(respostas[0], [401, JSON.stringify({ erro: 'Email ou senha incorretos.' }), null])
    assert.deepEqual(respostas[1], respostas[0])
    assert.deepEqual(respostas[2], respostas[0])
  })
})
