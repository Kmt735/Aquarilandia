import assert from 'node:assert/strict'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { inspect } from 'node:util'
import pg from 'pg'
import { gerarHash } from '../../src/modulos/clientes/senha.ts'

const urlTeste = process.env.TEST_DATABASE_URL
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sha256 = (texto) => createHash('sha256').update(texto).digest('hex')

describe('Recuperação de senha (#19b, #19c) e senha atual para trocar o e-mail (D-47) no PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para verificar a recuperação de senha no PostgreSQL.',
}, () => {
  const schema = `teste_recuperacao_${randomUUID().replaceAll('-', '')}`
  // Senhas e e-mails fictícios só deste teste
  const senha = 'SenhaFicticiaRecup123'
  const senhaNova = 'SenhaFicticiaNova456'
  const frontendTeste = 'http://frontend.teste'
  const msgLink = { erro: 'Link inválido ou expirado.' }
  const msgEsqueci = { mensagem: 'Se este e-mail estiver cadastrado, você receberá um link para criar uma senha nova.' }
  const emailsUsados = new Set()
  let cliente, pool, servidor, origem, origemCors, limites, env, schemaCriado = false
  let hashSenha, espioes

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    await cliente.query(await readFile(new URL('../../db/init/10_clientes.sql', import.meta.url), 'utf8'))
    hashSenha = await gerarHash(senha)

    // O e-mail sai pelo modo de desenvolvimento do email.ts (console.info "[email:dev]"), interceptado abaixo
    process.env.NODE_ENV = 'development'
    process.env.FRONTEND_URL = frontendTeste
    delete process.env.EMAIL_API_KEY
    const urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    urlAplicacao.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlAplicacao.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    env = (await import('../../src/config/env.ts')).env
    limites = await import('../../src/middlewares/rateLimit.ts')
    origemCors = env.corsOrigin
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  beforeEach(() => {
    // Limpa só o estado dos limitadores entre os casos; os limiares reais não mudam
    for (const limite of [limites.limiteLogin, limites.limiteTrocaSenha, limites.limiteEsqueciSenhaIp,
      limites.limiteRedefinirSenha]) limite.resetKey('127.0.0.1')
    for (const email of emailsUsados) limites.limiteEsqueciSenhaEmail.resetKey(email)
    espioes = Object.fromEntries(['info', 'error', 'warn', 'log'].map((nome) => [nome, mock.method(console, nome, () => {})]))
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    try {
      if (servidor) await new Promise((resolve) => servidor.close(resolve))
      if (pool) await pool.end()
    } finally {
      if (cliente) {
        try { if (schemaCriado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`) }
        finally { await cliente.end() }
      }
    }
  })

  async function criarConta() {
    const email = `teste.recup.${randomUUID().slice(0, 8)}@exemplo.com`
    emailsUsados.add(email)
    const { rows } = await cliente.query(
      'INSERT INTO clientes (nome, email, senha_hash, telefone, aceitou_termos_em) VALUES ($1, $2, $3, $4, now()) RETURNING id',
      ['Pessoa Fictícia Recup', email, hashSenha, '00900000000'])
    return { id: rows[0].id, email }
  }
  function pedir(method, caminho, body, { cookie, origin = origemCors } = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (origin !== null) headers.Origin = origin
    if (cookie) headers.Cookie = cookie
    return fetch(`${origem}${caminho}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    })
  }
  const esqueci = (email) => pedir('POST', '/api/auth/esqueci-senha', { email })
  const redefinir = (token, novaSenha = senhaNova) => pedir('POST', '/api/auth/redefinir-senha', { token, novaSenha })
  const login = (email, valor = senha) => pedir('POST', '/api/auth/login', { email, senha: valor })
  async function logar(email, valor = senha) {
    const resposta = await login(email, valor)
    assert.equal(resposta.status, 200)
    return resposta.headers.get('set-cookie').split(';')[0]
  }
  const sessaoValida = async (cookie) => (await pedir('GET', '/api/auth/sessao', undefined, { cookie })).status
  const tokensDe = async (id) => (await cliente.query(
    `SELECT token_hash, extract(epoch FROM expira_em - criado_em)::int AS segundos,
            expira_em > now() + interval '29 minutes' AND expira_em <= now() + interval '30 minutes' AS janela
     FROM tokens_recuperacao_senha WHERE cliente_id = $1`, [id])).rows
  const linhasInfo = () => espioes.info.mock.calls.map((c) => c.arguments.join(' '))
  const emailsPara = (endereco) => linhasInfo().filter((l) => l.startsWith(`[email:dev] para ${endereco} |`))
  function tokenDoEmail(endereco) {
    const linhas = emailsPara(endereco)
    assert.ok(linhas.length > 0, 'o e-mail de recuperação foi enviado')
    const achado = linhas.at(-1).match(/\/redefinir-senha\?token=([^\s|]+)/)
    assert.ok(achado, 'o e-mail traz o link')
    return decodeURIComponent(achado[1])
  }
  // Pede um link zerando os limites antes (os casos de limite usam esqueci() direto)
  async function pedirLink(email) {
    limites.limiteEsqueciSenhaIp.resetKey('127.0.0.1'); limites.limiteEsqueciSenhaEmail.resetKey(email)
    const resposta = await esqueci(email)
    assert.equal(resposta.status, 202)
    assert.deepEqual(await resposta.json(), msgEsqueci)
    return tokenDoEmail(email)
  }
  // Nenhum token impresso fora do "[email:dev]" e nada de token no erro/aviso/log
  function semTokenNosLogs(token) {
    for (const nome of ['error', 'warn', 'log']) {
      assert.equal(inspect(espioes[nome].mock.calls.map((c) => c.arguments)).includes(token), false, nome)
    }
    for (const linha of linhasInfo()) if (linha.includes(token)) assert.ok(linha.startsWith('[email:dev] '))
  }
  async function travarCliente(id) {
    const outro = new pg.Client({ connectionString: urlTeste }); await outro.connect()
    await outro.query(`SET search_path TO ${schema}`)
    await outro.query('BEGIN')
    await outro.query('SELECT id FROM clientes WHERE id = $1 FOR UPDATE', [id])
    return outro
  }
  async function aguardarEsperas(quantidade) {
    const fim = Date.now() + 7000
    while (Date.now() < fim) {
      const { rows } = await cliente.query(
        "SELECT count(*)::int AS total FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'",
        [schema])
      if (rows[0].total >= quantidade) return
      await esperar(20)
    }
    assert.fail(`Não observou ${quantidade} espera(s) de lock`)
  }

  describe('POST /api/auth/esqueci-senha (#19b)', () => {
    it('com conta: 202, um token no banco só com o hash e validade de 30 minutos', async () => {
      const conta = await criarConta()
      const resposta = await esqueci(conta.email.toUpperCase())
      assert.equal(resposta.status, 202)
      const texto = await resposta.text()
      assert.deepEqual(JSON.parse(texto), msgEsqueci)
      assert.equal(resposta.headers.get('set-cookie'), null)

      const token = tokenDoEmail(conta.email)
      assert.match(token, /^[A-Za-z0-9_-]{43}$/)
      assert.equal(texto.includes(token), false, 'o token nunca aparece na resposta')
      for (const [, valor] of resposta.headers) assert.equal(valor.includes(token), false)
      const [linha] = emailsPara(conta.email)
      assert.ok(linha.includes(`${frontendTeste}/redefinir-senha?token=${encodeURIComponent(token)}`))
      assert.ok(linha.includes('assunto Aquarilândia: criar uma senha nova'))

      const tokens = await tokensDe(conta.id)
      assert.equal(tokens.length, 1)
      assert.equal(tokens[0].token_hash, sha256(token))
      assert.equal(tokens[0].segundos, 1800)
      assert.equal(tokens[0].janela, true)
      const { rows } = await cliente.query('SELECT count(*)::int AS n FROM tokens_recuperacao_senha WHERE token_hash = $1',
        [token])
      assert.equal(rows[0].n, 0, 'o token inteiro não é gravado')
      semTokenNosLogs(token)
    })

    it('sem conta: 202 com o MESMO corpo, nenhum token e nenhum e-mail', async () => {
      const antes = (await cliente.query('SELECT count(*)::int AS n FROM tokens_recuperacao_senha')).rows[0].n
      const resposta = await esqueci('teste.recup.ninguem@exemplo.com')
      assert.equal(resposta.status, 202)
      assert.deepEqual(await resposta.json(), msgEsqueci)
      assert.equal((await cliente.query('SELECT count(*)::int AS n FROM tokens_recuperacao_senha')).rows[0].n, antes)
      assert.equal(espioes.info.mock.callCount(), 0)
      assert.equal(espioes.error.mock.callCount(), 0)
    })

    it('conta inativa ou anonimizada: 202, nenhum token e nenhum e-mail', async () => {
      const inativa = await criarConta(), anonimizada = await criarConta()
      await cliente.query('UPDATE clientes SET ativo = false WHERE id = $1', [inativa.id])
      await cliente.query(`UPDATE clientes SET nome = 'Cliente removido', email = NULL, telefone = NULL, senha_hash = NULL,
        ativo = false, anonimizado_em = now() WHERE id = $1`, [anonimizada.id])
      for (const conta of [inativa, anonimizada]) {
        const resposta = await esqueci(conta.email)
        assert.equal(resposta.status, 202)
        assert.deepEqual(await resposta.json(), msgEsqueci)
        assert.equal((await tokensDe(conta.id)).length, 0)
      }
      assert.equal(espioes.info.mock.callCount(), 0)
    })

    it('pedir de novo: o token antigo some e fica só o novo', async () => {
      const conta = await criarConta()
      const primeiro = await pedirLink(conta.email)
      const segundo = await pedirLink(conta.email)
      assert.notEqual(primeiro, segundo)
      const tokens = await tokensDe(conta.id)
      assert.deepEqual(tokens.map((t) => t.token_hash), [sha256(segundo)])
      const antigo = await redefinir(primeiro)
      assert.equal(antigo.status, 400)
      assert.deepEqual(await antigo.json(), msgLink)
    })

    it('e-mail mal formado ou body que não é objeto: 422, sem consultar conta nem mandar e-mail', async () => {
      for (const email of ['nada', '', undefined, 'a b@exemplo.com', 123]) {
        const resposta = await pedir('POST', '/api/auth/esqueci-senha', email === undefined ? {} : { email })
        limites.limiteEsqueciSenhaIp.resetKey('127.0.0.1')
        assert.equal(resposta.status, 422, String(email))
        assert.deepEqual(await resposta.json(),
          { erro: 'Dados inválidos', detalhes: { email: 'Digite um e-mail válido. Exemplo: nome@email.com.' } })
      }
      const lista = await pedir('POST', '/api/auth/esqueci-senha', ['teste@exemplo.com'])
      assert.equal(lista.status, 422)
      assert.deepEqual(await lista.json(), { erro: 'Dados inválidos', detalhes: { body: 'Formato de dados inválido.' } })
      assert.equal(espioes.info.mock.callCount(), 0)
    })

    it('sem Origin: 403, sem token', async () => {
      const conta = await criarConta()
      const resposta = await pedir('POST', '/api/auth/esqueci-senha', { email: conta.email }, { origin: null })
      assert.equal(resposta.status, 403)
      assert.deepEqual(await resposta.json(), { erro: 'Origem da requisição não permitida.' })
      assert.equal((await tokensDe(conta.id)).length, 0)
    })

    it('limite por e-mail: o 4º pedido do mesmo e-mail em 1 hora é 429, mesmo vindo de "outro IP"', async () => {
      const conta = await criarConta()
      // O IP do teste é sempre 127.0.0.1 (sem trust proxy em desenvolvimento). Zerar o contador do IP antes de
      // cada pedido equivale a cada pedido chegar de um IP novo: só o contador do e-mail continua somando
      const variantes = [conta.email, conta.email.toUpperCase(), `  ${conta.email}  `, conta.email]
      const status = []
      for (const email of variantes) {
        limites.limiteEsqueciSenhaIp.resetKey('127.0.0.1')
        const resposta = await esqueci(email)
        status.push(resposta.status)
        if (resposta.status === 429) {
          assert.deepEqual(await resposta.json(), { erro: 'Muitas tentativas. Tente de novo em alguns minutos. ' })
          assert.ok(Number(resposta.headers.get('retry-after')) > 0)
        } else await resposta.json()
      }
      assert.deepEqual(status, [202, 202, 202, 429])
      assert.equal(emailsPara(conta.email).length, 3, 'só três e-mails chegaram')
    })

    it('limite por IP: o 4º pedido do mesmo IP em 1 hora é 429, mesmo com e-mails diferentes', async () => {
      const status = []
      for (let i = 0; i < 4; i++) {
        const email = `teste.recup.ip${i}.${randomUUID().slice(0, 6)}@exemplo.com`
        emailsUsados.add(email)
        const resposta = await esqueci(email); status.push(resposta.status); await resposta.json()
      }
      assert.deepEqual(status, [202, 202, 202, 429])
    })

    it('falha do provedor: 202 igual, token criado e o log não leva o e-mail nem o token', async () => {
      const conta = await criarConta()
      const chaveOriginal = env.emailApiKey
      env.emailApiKey = 'chave-ficticia-de-teste'
      try {
        const resposta = await esqueci(conta.email)
        assert.equal(resposta.status, 202)
        assert.deepEqual(await resposta.json(), msgEsqueci)
        const fim = Date.now() + 2000
        while (espioes.error.mock.callCount() === 0 && Date.now() < fim) await esperar(10)
      } finally { env.emailApiKey = chaveOriginal }
      assert.deepEqual(espioes.error.mock.calls.map((c) => c.arguments), [['[esqueci-senha] falha ao enviar e-mail']])
      assert.equal(espioes.info.mock.callCount(), 0)
      assert.equal((await tokensDe(conta.id)).length, 1)
    })

    it('sem FRONTEND_URL: 202 igual, nenhum token e só o aviso fixo no log', async () => {
      const conta = await criarConta()
      const urlOriginal = env.frontendUrl
      env.frontendUrl = ''
      try {
        const resposta = await esqueci(conta.email)
        assert.equal(resposta.status, 202)
        assert.deepEqual(await resposta.json(), msgEsqueci)
      } finally { env.frontendUrl = urlOriginal }
      assert.deepEqual(espioes.error.mock.calls.map((c) => c.arguments), [['[esqueci-senha] FRONTEND_URL ausente']])
      assert.equal((await tokensDe(conta.id)).length, 0)
      assert.equal(espioes.info.mock.callCount(), 0)
    })
  })

  describe('POST /api/auth/redefinir-senha (#19c)', () => {
    it('fluxo completo: pedir, redefinir, login com a nova 200 e com a antiga 401; as sessões abertas caem', async () => {
      const conta = await criarConta()
      const sessaoA = await logar(conta.email), sessaoB = await logar(conta.email)
      const token = await pedirLink(conta.email)

      const resposta = await redefinir(token)
      assert.equal(resposta.status, 204)
      assert.equal(await resposta.text(), '')
      assert.equal(resposta.headers.get('set-cookie'), null)

      assert.equal(await sessaoValida(sessaoA), 401)
      assert.equal(await sessaoValida(sessaoB), 401)
      assert.equal((await cliente.query('SELECT count(*)::int AS n FROM sessoes WHERE cliente_id = $1', [conta.id])).rows[0].n, 0)
      assert.equal((await tokensDe(conta.id)).length, 0)
      assert.equal((await login(conta.email)).status, 401)
      assert.equal((await login(conta.email, senhaNova)).status, 200)
      semTokenNosLogs(token)
    })

    it('o mesmo token duas vezes: a segunda é 400', async () => {
      const conta = await criarConta()
      const token = await pedirLink(conta.email)
      assert.equal((await redefinir(token)).status, 204)
      const repetido = await redefinir(token, 'OutraSenhaFicticia789')
      assert.equal(repetido.status, 400)
      assert.deepEqual(await repetido.json(), msgLink)
      assert.equal((await login(conta.email, senhaNova)).status, 200, 'a segunda tentativa não trocou a senha')
    })

    it('token vencido: 400 e a senha continua a mesma', async () => {
      const conta = await criarConta()
      const token = await pedirLink(conta.email)
      // O CHECK exige expira_em > criado_em: os dois vão para o passado
      await cliente.query(`UPDATE tokens_recuperacao_senha SET criado_em = now() - interval '1 hour',
        expira_em = now() - interval '1 minute' WHERE cliente_id = $1`, [conta.id])
      const resposta = await redefinir(token)
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), msgLink)
      assert.equal((await login(conta.email)).status, 200)
    })

    it('token inventado, com formato errado ou ausente: 400 com a MESMA mensagem', async () => {
      const inventado = randomBytes(32).toString('base64url')
      for (const body of [
        { token: inventado, novaSenha: senhaNova },
        { token: 'abc', novaSenha: senhaNova },
        { token: `${inventado}A`, novaSenha: senhaNova },
        { token: `${inventado.slice(0, 42)}+`, novaSenha: senhaNova },
        { token: `${inventado.slice(0, 42)}=`, novaSenha: senhaNova },
        { token: 12345, novaSenha: senhaNova },
        { token: null, novaSenha: senhaNova },
        { novaSenha: senhaNova },
      ]) {
        const resposta = await pedir('POST', '/api/auth/redefinir-senha', body)
        limites.limiteRedefinirSenha.resetKey('127.0.0.1')
        assert.equal(resposta.status, 400, JSON.stringify(body))
        assert.deepEqual(await resposta.json(), msgLink)
      }
    })

    it('conta desativada depois do pedido: 400 e a senha não muda', async () => {
      const conta = await criarConta()
      const token = await pedirLink(conta.email)
      const antes = (await cliente.query('SELECT senha_hash FROM clientes WHERE id = $1', [conta.id])).rows[0].senha_hash
      await cliente.query('UPDATE clientes SET ativo = false WHERE id = $1', [conta.id])
      const resposta = await redefinir(token)
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), msgLink)
      const depois = (await cliente.query('SELECT senha_hash FROM clientes WHERE id = $1', [conta.id])).rows[0].senha_hash
      assert.equal(depois, antes)
    })

    it('novaSenha curta: 422 e o token continua valendo', async () => {
      const conta = await criarConta()
      const token = await pedirLink(conta.email)
      const resposta = await redefinir(token, '1234567')
      assert.equal(resposta.status, 422)
      assert.deepEqual(await resposta.json(),
        { erro: 'Dados inválidos', detalhes: { novaSenha: 'A senha precisa ter pelo menos 8 caracteres.' } })
      assert.equal((await tokensDe(conta.id)).length, 1)
      assert.equal((await redefinir(token)).status, 204)
    })

    it('sem Origin: 403', async () => {
      const resposta = await pedir('POST', '/api/auth/redefinir-senha',
        { token: randomBytes(32).toString('base64url'), novaSenha: senhaNova }, { origin: null })
      assert.equal(resposta.status, 403)
    })

    it('limite: o 11º pedido do mesmo IP em 1 hora é 429', async () => {
      const status = []
      for (let i = 0; i < 11; i++) {
        const resposta = await pedir('POST', '/api/auth/redefinir-senha', { token: 'formato-errado', novaSenha: senhaNova })
        status.push(resposta.status); await resposta.json()
      }
      assert.deepEqual(status, [...Array(10).fill(400), 429])
    })

    it('dois redefinir em paralelo com o mesmo token: um 204 e um 400, sem 500', async () => {
      const conta = await criarConta()
      const token = await pedirLink(conta.email)
      // Segura o cliente numa transação de fora até os dois pedidos estarem esperando a mesma trava
      const trava = await travarCliente(conta.id)
      let pedidos
      try {
        pedidos = [redefinir(token, 'SenhaParalelaUm111'), redefinir(token, 'SenhaParalelaDois222')]
        await aguardarEsperas(2)
      } finally { await trava.query('COMMIT'); await trava.end() }
      const respostas = await Promise.all(pedidos)
      assert.deepEqual(respostas.map((r) => r.status).sort(), [204, 400])
      const perdedor = respostas.find((r) => r.status === 400)
      assert.deepEqual(await perdedor.json(), msgLink)
      const vencedora = respostas[0].status === 204 ? 'SenhaParalelaUm111' : 'SenhaParalelaDois222'
      assert.equal((await login(conta.email, vencedora)).status, 200)
      assert.equal((await tokensDe(conta.id)).length, 0)
    })

    it('redefinir em paralelo com um novo esqueci-senha: sem 500, sem travar e com um único token no fim', async () => {
      const conta = await criarConta()
      const token = await pedirLink(conta.email)
      limites.limiteEsqueciSenhaIp.resetKey('127.0.0.1')
      const trava = await travarCliente(conta.id)
      let pedidos
      try {
        pedidos = [redefinir(token), esqueci(conta.email)]
        await aguardarEsperas(2)
      } finally { await trava.query('COMMIT'); await trava.end() }
      const [respostaRedefinir, respostaEsqueci] = await Promise.all(pedidos)
      assert.equal(respostaEsqueci.status, 202)
      assert.ok([204, 400].includes(respostaRedefinir.status), String(respostaRedefinir.status))
      // Quem pegou a trava primeiro decide: redefinir antes → senha nova e o link novo vale;
      // esqueci antes → o link antigo foi trocado (400) e a senha continua a antiga. Nos dois, sobra o link novo
      const novo = tokenDoEmail(conta.email)
      assert.notEqual(novo, token)
      assert.deepEqual((await tokensDe(conta.id)).map((t) => t.token_hash), [sha256(novo)])
      const senhaVigente = respostaRedefinir.status === 204 ? senhaNova : senha
      assert.equal((await login(conta.email, senhaVigente)).status, 200)
    })
  })

  describe('troca de senha logada (#19c, passo 7)', () => {
    it('PATCH /me/senha apaga os links de recuperação pendentes', async () => {
      const conta = await criarConta()
      const cookie = await logar(conta.email)
      const token = await pedirLink(conta.email)
      const troca = await pedir('PATCH', '/api/clientes/me/senha', { senhaAtual: senha, novaSenha: senhaNova }, { cookie })
      assert.equal(troca.status, 204)
      assert.equal((await tokensDe(conta.id)).length, 0)
      const resposta = await redefinir(token, 'OutraSenhaFicticia789')
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), msgLink)
    })
  })

  describe('PATCH /api/clientes/me — senha atual para trocar o e-mail (D-47)', () => {
    const msgFalta = { erro: 'Dados inválidos', detalhes: { senhaAtual: 'Digite sua senha atual para trocar o e-mail.' } }
    const msgErrada = { erro: 'Dados inválidos', detalhes: { senhaAtual: 'Senha atual incorreta.' } }
    const emailDe = async (id) => (await cliente.query('SELECT email FROM clientes WHERE id = $1', [id])).rows[0].email
    const atualizar = (cookie, body) => pedir('PATCH', '/api/clientes/me', body, { cookie })

    it('e-mail novo sem senhaAtual ou com senhaAtual vazia: 422', async () => {
      const conta = await criarConta(), cookie = await logar(conta.email)
      for (const body of [{ email: 'teste.recup.novo1@exemplo.com' }, { email: 'teste.recup.novo1@exemplo.com', senhaAtual: '' }]) {
        const resposta = await atualizar(cookie, body)
        assert.equal(resposta.status, 422)
        assert.deepEqual(await resposta.json(), msgFalta)
      }
      assert.equal(await emailDe(conta.id), conta.email)
    })

    it('senha errada (ou com mais de 128 caracteres): 422 Senha atual incorreta.', async () => {
      const conta = await criarConta(), cookie = await logar(conta.email)
      for (const senhaAtual of ['SenhaErradaFicticia', 'x'.repeat(129), ` ${senha}`]) {
        const resposta = await atualizar(cookie, { email: 'teste.recup.novo2@exemplo.com', senhaAtual })
        assert.equal(resposta.status, 422)
        assert.deepEqual(await resposta.json(), msgErrada)
      }
      assert.equal(await emailDe(conta.id), conta.email)
    })

    it('com a senha certa: 200, os links pendentes somem e o aviso vai para o e-mail ANTIGO', async () => {
      const conta = await criarConta(), cookie = await logar(conta.email)
      const token = await pedirLink(conta.email)
      const novoEmail = `teste.recup.trocado.${randomUUID().slice(0, 8)}@exemplo.com`
      emailsUsados.add(novoEmail)
      espioes.info.mock.resetCalls()

      const resposta = await atualizar(cookie, { email: novoEmail.toUpperCase(), senhaAtual: senha })
      assert.equal(resposta.status, 200)
      const corpo = await resposta.json()
      assert.equal(corpo.email, novoEmail)
      assert.equal('senhaAtual' in corpo || 'senhaHash' in corpo, false)
      assert.equal(await emailDe(conta.id), novoEmail)
      assert.equal((await tokensDe(conta.id)).length, 0)
      assert.equal((await redefinir(token)).status, 400, 'o link mandado ao e-mail antigo morreu')

      const avisos = emailsPara(conta.email)
      assert.equal(avisos.length, 1)
      assert.ok(avisos[0].includes('assunto Aquarilândia: seu e-mail foi alterado'))
      assert.equal(avisos[0].includes(novoEmail), false, 'o aviso não mostra o e-mail novo')
      assert.equal(avisos[0].includes(novoEmail.split('@')[0]), false)
      assert.equal(/https?:\/\//.test(avisos[0]), false, 'o aviso não tem link')
      assert.equal(emailsPara(novoEmail).length, 0)
      assert.equal(espioes.error.mock.callCount(), 0)

      // A recuperação passa a valer só para o e-mail novo
      limites.limiteEsqueciSenhaIp.resetKey('127.0.0.1')
      assert.equal((await esqueci(conta.email)).status, 202)
      assert.equal((await tokensDe(conta.id)).length, 0)
      await pedirLink(novoEmail)
      assert.equal((await tokensDe(conta.id)).length, 1)
    })

    it('e-mail de outra conta: senha errada 422 antes do 409; senha certa 409', async () => {
      const conta = await criarConta(), outra = await criarConta(), cookie = await logar(conta.email)
      const errada = await atualizar(cookie, { email: outra.email, senhaAtual: 'SenhaErradaFicticia' })
      assert.equal(errada.status, 422)
      assert.deepEqual(await errada.json(), msgErrada)
      const certa = await atualizar(cookie, { email: outra.email, senhaAtual: senha })
      assert.equal(certa.status, 409)
      assert.deepEqual(await certa.json(),
        { erro: 'Não foi possível salvar as alterações.', detalhes: { email: 'Este e-mail já está cadastrado.' } })
      assert.equal(espioes.info.mock.callCount(), 0, 'nenhum aviso quando nada mudou')
    })

    it('o próprio e-mail (em maiúsculas) e só nome ou telefone: 200 sem senha, sem aviso e sem apagar links', async () => {
      const conta = await criarConta(), cookie = await logar(conta.email)
      await pedirLink(conta.email)
      espioes.info.mock.resetCalls()

      const proprio = await atualizar(cookie, { email: conta.email.toUpperCase(), nome: 'Nome Trocado' })
      assert.equal(proprio.status, 200)
      const corpo = await proprio.json()
      assert.equal(corpo.email, conta.email); assert.equal(corpo.nome, 'Nome Trocado')
      for (const body of [{ nome: 'Outro Nome' }, { telefone: '(00) 98888-7777' }]) {
        const resposta = await atualizar(cookie, body)
        assert.equal(resposta.status, 200, JSON.stringify(body)); await resposta.json()
      }
      assert.equal(espioes.info.mock.callCount(), 0)
      assert.equal((await tokensDe(conta.id)).length, 1, 'o link pendente só morre quando o e-mail muda')
    })

    it('6 tentativas com senha errada: a 6ª é 429; um PATCH só com nome logo depois é 200', async () => {
      const conta = await criarConta(), cookie = await logar(conta.email)
      const status = []
      for (let i = 0; i < 6; i++) {
        const resposta = await atualizar(cookie, { email: 'teste.recup.novo3@exemplo.com', senhaAtual: 'SenhaErradaFicticia' })
        status.push(resposta.status); await resposta.json()
      }
      assert.deepEqual(status, [422, 422, 422, 422, 422, 429])
      const soNome = await atualizar(cookie, { nome: 'Nome Depois Do Limite' })
      assert.equal(soNome.status, 200)
      // O contador é o mesmo da troca de senha: ela também está barrada agora
      const troca = await pedir('PATCH', '/api/clientes/me/senha', { senhaAtual: senha, novaSenha: senhaNova }, { cookie })
      assert.equal(troca.status, 429)
    })
  })
})
