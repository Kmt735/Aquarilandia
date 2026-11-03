import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { inspect } from 'node:util'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
process.env.NODE_ENV = 'development'
const { app } = await import('../src/app.ts')
const { db } = await import('../src/config/db.ts')
const { env } = await import('../src/config/env.ts')
const limites = await import('../src/middlewares/rateLimit.ts')
const { authService, montarEmailRecuperacao, tokenComFormatoValido } = await import('../src/modulos/auth/auth.service.ts')
const { gerarToken } = await import('../src/modulos/auth/sessao.ts')
const { clienteRepository } = await import('../src/modulos/clientes/cliente.repository.ts')

const frontendTeste = 'http://frontend.teste'
const original = { frontendUrl: env.frontendUrl, emailApiKey: env.emailApiKey }
const metodos = ['debug', 'error', 'info', 'log', 'warn']
let espioes

beforeEach(() => {
  espioes = Object.fromEntries(metodos.map((nome) => [nome, mock.method(console, nome, () => {})]))
  env.frontendUrl = frontendTeste
  env.emailApiKey = undefined
})
afterEach(() => {
  mock.restoreAll()
  env.frontendUrl = original.frontendUrl
  env.emailApiKey = original.emailApiKey
})
const linhas = (nome) => espioes[nome].mock.calls.map((c) => inspect(c.arguments))
const semBanco = () => [
  mock.method(db, 'query', async () => { throw new Error('Não acessar banco neste cenário') }),
  mock.method(db, 'connect', async () => { throw new Error('Não acessar banco neste cenário') }),
]

describe('Recuperação de senha — formato do token (#19c)', () => {
  it('aceita tudo o que o gerarToken produz', () => {
    for (let i = 0; i < 200; i++) assert.equal(tokenComFormatoValido(gerarToken()), true)
  })

  it('recusa tamanho, alfabeto e tipo diferentes', () => {
    const valido = randomBytes(32).toString('base64url')
    for (const token of [
      '', 'abc', valido.slice(0, 42), `${valido}A`, `${valido.slice(0, 42)}+`, `${valido.slice(0, 42)}/`,
      `${valido.slice(0, 42)}=`, `${valido.slice(0, 42)} `, ` ${valido.slice(0, 42)}`, `${valido.slice(0, 41)}é`,
      `${valido.slice(0, 42)}\n`, randomBytes(32).toString('base64'),
    ]) assert.equal(tokenComFormatoValido(token), false, JSON.stringify(token))
    for (const token of [undefined, null, 123, [valido], { token: valido }, true]) {
      assert.equal(tokenComFormatoValido(token), false, String(token))
    }
  })
})

describe('Recuperação de senha — texto do e-mail (#19b)', () => {
  it('leva o link com o token codificado, a validade e o aviso para quem não pediu', () => {
    const token = gerarToken()
    const mensagem = montarEmailRecuperacao('pessoa@exemplo.com', token, frontendTeste)
    assert.equal(mensagem.para, 'pessoa@exemplo.com')
    assert.equal(mensagem.assunto, 'Aquarilândia: criar uma senha nova')
    assert.ok(mensagem.texto.includes(`${frontendTeste}/redefinir-senha?token=${token}`))
    assert.match(mensagem.texto, /30 minutos/)
    assert.match(mensagem.texto, /não pediu/)
    assert.equal(mensagem.html, undefined)
  })

  it('codifica o token na URL (encodeURIComponent), caso o formato mude', () => {
    const mensagem = montarEmailRecuperacao('pessoa@exemplo.com', 'a+b/c=d&e', frontendTeste)
    assert.ok(mensagem.texto.includes(`${frontendTeste}/redefinir-senha?token=a%2Bb%2Fc%3Dd%26e`))
    assert.equal(mensagem.texto.includes('a+b/c=d&e'), false)
  })

  it('montar o e-mail não imprime nada', () => {
    montarEmailRecuperacao('pessoa@exemplo.com', gerarToken(), frontendTeste)
    for (const nome of metodos) assert.equal(espioes[nome].mock.callCount(), 0, nome)
  })
})

describe('Recuperação de senha — authService.esqueciSenha com o banco simulado (#19b)', () => {
  // Simula o client do comTransacao: a trava devolve o cliente; DELETE e INSERT só são registrados
  function transacaoSimulada({ travou = true } = {}) {
    const consultas = []
    const client = {
      async query(sql, valores) {
        consultas.push({ sql: String(sql), valores })
        if (/FOR UPDATE/.test(sql)) return { rows: travou ? [{ id: 7 }] : [], rowCount: travou ? 1 : 0 }
        return { rows: [], rowCount: 0 }
      },
      release() {},
    }
    mock.method(db, 'connect', async () => client)
    mock.method(db, 'query', async () => { throw new Error('Fora da transação, só o buscarIdAtivoPorEmail (simulado)') })
    return consultas
  }

  it('grava só o hash do token, manda o e-mail depois do COMMIT e não loga o token fora do [email:dev]', async () => {
    mock.method(clienteRepository, 'buscarIdAtivoPorEmail', async () => 7)
    const consultas = transacaoSimulada()
    await authService.esqueciSenha({ email: '  Pessoa@Exemplo.com ' })

    const sqls = consultas.map((c) => c.sql.replace(/\s+/g, ' ').trim())
    assert.equal(sqls[0], 'BEGIN')
    assert.match(sqls[1], /FROM clientes WHERE id = \$1 AND ativo FOR UPDATE/)
    assert.match(sqls[2], /^DELETE FROM tokens_recuperacao_senha WHERE cliente_id = \$1/)
    assert.match(sqls[3], /^INSERT INTO tokens_recuperacao_senha/)
    assert.equal(sqls[4], 'COMMIT')

    assert.equal(espioes.info.mock.callCount(), 1)
    const [linha] = espioes.info.mock.calls[0].arguments
    assert.ok(linha.startsWith('[email:dev] para pessoa@exemplo.com | assunto Aquarilândia: criar uma senha nova'))
    const token = decodeURIComponent(linha.match(/redefinir-senha\?token=([^\s|]+)/)[1])
    assert.equal(tokenComFormatoValido(token), true)

    const [clienteId, tokenHash] = consultas[3].valores
    assert.equal(clienteId, 7)
    assert.equal(tokenHash, createHash('sha256').update(token).digest('hex'))
    assert.equal(JSON.stringify(consultas).includes(token), false, 'o token inteiro nunca vai para o banco')
    for (const nome of ['debug', 'error', 'log', 'warn']) assert.equal(espioes[nome].mock.callCount(), 0, nome)
  })

  it('conta inexistente: não abre transação nem manda e-mail', async () => {
    mock.method(clienteRepository, 'buscarIdAtivoPorEmail', async () => null)
    const [, connect] = semBanco()
    await authService.esqueciSenha({ email: 'ninguem@exemplo.com' })
    assert.equal(connect.mock.callCount(), 0)
    for (const nome of metodos) assert.equal(espioes[nome].mock.callCount(), 0, nome)
  })

  it('conta desativada entre a busca e a trava: nada de token nem de e-mail', async () => {
    mock.method(clienteRepository, 'buscarIdAtivoPorEmail', async () => 7)
    const consultas = transacaoSimulada({ travou: false })
    await authService.esqueciSenha({ email: 'pessoa@exemplo.com' })
    assert.equal(consultas.some((c) => /DELETE|INSERT/.test(c.sql)), false)
    assert.equal(espioes.info.mock.callCount(), 0)
  })

  it('falha no envio: o erro não escapa e o log é a frase fixa, sem e-mail nem token', async () => {
    env.emailApiKey = 'chave-ficticia-de-teste'
    mock.method(clienteRepository, 'buscarIdAtivoPorEmail', async () => 7)
    const consultas = transacaoSimulada()
    await authService.esqueciSenha({ email: 'pessoa@exemplo.com' })
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(espioes.error.mock.calls.map((c) => c.arguments), [['[esqueci-senha] falha ao enviar e-mail']])
    assert.equal(espioes.info.mock.callCount(), 0)
    const tokenHash = consultas.find((c) => /INSERT/.test(c.sql)).valores[1]
    assert.equal(linhas('error').join('').includes('pessoa@exemplo.com'), false)
    assert.equal(linhas('error').join('').includes(tokenHash), false)
  })

  it('sem FRONTEND_URL: não consulta o banco, não gera token e loga só a frase fixa', async () => {
    env.frontendUrl = undefined
    const [query, connect] = semBanco()
    await authService.esqueciSenha({ email: 'pessoa@exemplo.com' })
    assert.equal(query.mock.callCount() + connect.mock.callCount(), 0)
    assert.deepEqual(espioes.error.mock.calls.map((c) => c.arguments), [['[esqueci-senha] FRONTEND_URL ausente']])
  })
})

describe('Recuperação de senha — HTTP antes do banco', () => {
  let servidor, origem
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  beforeEach(() => {
    limites.limiteEsqueciSenhaIp.resetKey('127.0.0.1'); limites.limiteRedefinirSenha.resetKey('127.0.0.1')
    for (const chave of ['sem-email', 'nada']) limites.limiteEsqueciSenhaEmail.resetKey(chave)
  })
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })
  const enviar = (caminho, body, { origin = env.corsOrigin } = {}) => fetch(`${origem}${caminho}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(origin === null ? {} : { Origin: origin }) },
    body: JSON.stringify(body),
  })

  it('esqueci-senha: e-mail mal formado é 422 sem tocar no banco', async () => {
    const consultas = semBanco()
    const resposta = await enviar('/api/auth/esqueci-senha', { email: 'nada' })
    assert.equal(resposta.status, 422)
    assert.deepEqual(await resposta.json(),
      { erro: 'Dados inválidos', detalhes: { email: 'Digite um e-mail válido. Exemplo: nome@email.com.' } })
    for (const consulta of consultas) assert.equal(consulta.mock.callCount(), 0)
  })

  it('esqueci-senha e redefinir-senha sem Origin: 403 sem tocar no banco', async () => {
    const consultas = semBanco()
    for (const caminho of ['/api/auth/esqueci-senha', '/api/auth/redefinir-senha']) {
      const resposta = await enviar(caminho, {}, { origin: null })
      assert.equal(resposta.status, 403)
    }
    for (const consulta of consultas) assert.equal(consulta.mock.callCount(), 0)
  })

  it('redefinir-senha: token fora do formato é 400 com a mensagem única, sem banco', async () => {
    const consultas = semBanco()
    for (const token of [undefined, '', 'abc', 42, 'x'.repeat(44)]) {
      const resposta = await enviar('/api/auth/redefinir-senha', { token, novaSenha: 'SenhaFicticia123' })
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), { erro: 'Link inválido ou expirado.' })
    }
    for (const consulta of consultas) assert.equal(consulta.mock.callCount(), 0)
  })

  it('redefinir-senha: novaSenha curta ou body que não é objeto é 422', async () => {
    semBanco()
    const curta = await enviar('/api/auth/redefinir-senha', { token: gerarToken(), novaSenha: '1234567' })
    assert.equal(curta.status, 422)
    assert.deepEqual(await curta.json(),
      { erro: 'Dados inválidos', detalhes: { novaSenha: 'A senha precisa ter pelo menos 8 caracteres.' } })
    const lista = await enviar('/api/auth/redefinir-senha', [])
    assert.equal(lista.status, 422)
    assert.deepEqual(await lista.json(), { erro: 'Dados inválidos', detalhes: { body: 'Formato de dados inválido.' } })
  })

  it('o limite por e-mail usa o e-mail normalizado: maiúsculas e espaços contam na mesma chave', async () => {
    semBanco()
    const status = []
    for (const email of ['nada', ' NADA ', 'Nada', 'nada']) {
      limites.limiteEsqueciSenhaIp.resetKey('127.0.0.1')
      const resposta = await enviar('/api/auth/esqueci-senha', { email })
      status.push(resposta.status); await resposta.json()
    }
    assert.deepEqual(status, [422, 422, 422, 429], 'o 422 de formato também conta: o limite soma todos os pedidos')
  })
})
