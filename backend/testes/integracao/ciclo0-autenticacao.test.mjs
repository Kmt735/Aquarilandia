import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, beforeEach, describe, it, mock } from 'node:test'
import { inspect, promisify } from 'node:util'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'
import { gerarHash } from '../../src/modulos/clientes/senha.ts'

const urlTeste = process.env.TEST_DATABASE_URL
const executar = promisify(execFile)
describe('Ciclo 0 — autenticação, limites e orçamento com PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar PostgreSQL real.',
}, () => {
  const schema = `teste_ciclo0_${randomUUID().replaceAll('-', '')}`
  const senha = 'SenhaFicticiaCiclo0123!'
  let cliente, pool, servidor, origem, origemCors, limites, principal, admin, urlAplicacao, schemaCriado = false
  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    await cliente.query(await readFile(new URL('../../db/init/10_clientes.sql', import.meta.url), 'utf8'))
    await cliente.query(await readFile(new URL('../../db/init/15_orcamentos.sql', import.meta.url), 'utf8'))
    const hash = await gerarHash(senha)
    for (const papel of ['cliente', 'admin']) {
      const { rows } = await cliente.query('INSERT INTO clientes (nome,email,telefone,senha_hash,papel,aceitou_termos_em) VALUES ($1,$2,$3,$4,$5,now()) RETURNING id,email,papel',
        [`Pessoa Fictícia ${papel}`, `${papel}@teste.example`, '00900000000', hash, papel])
      if (papel === 'cliente') principal = rows[0]; else admin = rows[0]
    }
    const urlApp = new URL(urlTeste); urlApp.searchParams.set('options', `-c search_path=${schema}`)
    urlAplicacao = urlApp.toString()
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts')
    const { db } = await import('../../src/config/db.ts')
    const { env } = await import('../../src/config/env.ts')
    limites = await import('../../src/middlewares/rateLimit.ts')
    pool = db; origemCors = env.corsOrigin
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  beforeEach(() => {
    for (const limite of [limites.limiteLogin, limites.limiteCadastro, limites.limiteTrocaSenha]) limite.resetKey('127.0.0.1')
  })
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
  function pedir(method, caminho, body, { cookie, origin = origemCors } = {}) {
    const headers = { 'Content-Type': 'application/json' }
    if (origin !== null) headers.Origin = origin
    if (cookie) headers.Cookie = cookie
    return fetch(`${origem}${caminho}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  async function login(pessoa = principal, valor = senha) {
    const r = await pedir('POST', '/api/auth/login', { email: pessoa.email, senha: valor })
    assert.equal(r.status, 200)
    const dto = await r.json(), header = r.headers.get('set-cookie')
    const cookie = header.split(';')[0], token = cookie.slice('sid='.length)
    return { dto, header, cookie, token }
  }
  async function naoExpor(resposta, status, valores = []) {
    assert.equal(resposta.status, status)
    const body = await resposta.json(), texto = JSON.stringify(body)
    for (const valor of valores) assert.equal(texto.includes(valor), false)
    assert.equal('senhaHash' in body || 'token' in body || 'dados' in body || 'itens' in body, false)
    return body
  }
  function novaConta() {
    return { nome: "Pessoa Fictícia d'água", email: `${randomUUID()}@teste.example`, telefone: '00900000000', senha, aceiteTermos: true }
  }
  it('cadastro público não permite papel admin nem campos internos e mantém duplicidade 409', async () => {
    const dados = novaConta()
    const r = await pedir('POST', '/api/auth/cadastro', { ...dados, papel: 'admin', id: 999, ativo: false })
    assert.equal(r.status, 201); const dto = await r.json()
    assert.equal(dto.papel, 'cliente'); assert.equal(dto.ativo, true); assert.notEqual(dto.id, 999)
    assert.equal(dto.nome, dados.nome); assert.equal('senhaHash' in dto || 'senha' in dto, false)
    const registro = (await cliente.query('SELECT nome,senha_hash,papel FROM clientes WHERE id=$1', [dto.id])).rows[0]
    assert.equal(registro.nome, dados.nome); assert.notEqual(registro.senha_hash, senha); assert.equal(registro.papel, 'cliente')
    assert.equal((await pedir('POST', '/api/auth/cadastro', dados)).status, 409)
  })
  it('login guarda apenas hash do token, cookie correto e /sessao retorna somente a própria conta', async () => {
    const a = await pedir('POST', '/api/auth/login', { email: principal.email, senha: 'SenhaFicticiaErrada!' })
    const b = await pedir('POST', '/api/auth/login', { email: 'nao-existe@teste.example', senha })
    assert.equal(a.status, 401); assert.equal(b.status, 401); assert.deepEqual(await a.json(), await b.json())
    const sessao = await login()
    for (const p of [/HttpOnly/i, /SameSite=Lax/i, /Path=\//i, /Expires=/i]) assert.match(sessao.header, p)
    assert.equal(/; Secure/i.test(sessao.header), process.env.NODE_ENV === 'production')
    const rows = (await cliente.query('SELECT token_hash,expira_em FROM sessoes WHERE token_hash=$1', [hashToken(sessao.token)])).rows
    assert.equal(rows.length, 1); assert.notEqual(rows[0].token_hash, sessao.token); assert.ok(rows[0].expira_em > new Date())
    const resposta = await pedir('GET', '/api/auth/sessao?clienteId=999&papel=admin', undefined, { cookie: sessao.cookie, origin: null })
    assert.equal(resposta.status, 200); const body = await resposta.json()
    assert.equal(body.id, principal.id); assert.equal(body.email, principal.email); assert.equal(body.papel, 'cliente')
    assert.equal(JSON.stringify(body).includes(sessao.token), false)
    assert.equal('senhaHash' in body || 'senha_hash' in body || 'senha' in body, false)
  })
  it('orçamento público com Origin, consulta administrativa sem cache e papel/expiração reconsultados', async () => {
    const fixture = { nome: 'Pessoa Fictícia Restrita', telefone: '00900000000', servico: 'Outro', mensagem: 'Mensagem sintética privada' }
    const criado = await pedir('POST', '/api/orcamentos', fixture)
    assert.equal(criado.status, 201); const registro = await criado.json()
    await naoExpor(await pedir('GET', '/api/orcamentos'), 401, Object.values(fixture))
    const sessaoCliente = await login()
    await naoExpor(await pedir('GET', '/api/orcamentos', undefined, { cookie: sessaoCliente.cookie }), 403, Object.values(fixture))
    const sessao = await login(admin)
    const r = await pedir('GET', '/api/orcamentos', undefined, { cookie: sessao.cookie })
    assert.equal(r.status, 200); assert.equal(r.headers.get('cache-control'), 'no-store')
    const lista = await r.json(); assert.deepEqual(lista, { dados: [registro], total: 1, pagina: 1, limite: 20 })
    assert.deepEqual(Object.keys(lista.dados[0]).sort(), ['id', 'criadoEm', 'atualizadoEm', 'nome', 'telefone', 'servico', 'mensagem', 'status'].sort())
    await cliente.query("UPDATE clientes SET papel='cliente' WHERE id=$1", [admin.id])
    try {
      await naoExpor(await pedir('GET', '/api/orcamentos', undefined, { cookie: sessao.cookie }), 403, Object.values(fixture))
    } finally { await cliente.query("UPDATE clientes SET papel='admin' WHERE id=$1", [admin.id]) }
    await cliente.query("UPDATE sessoes SET expira_em=now()-interval '1 minute' WHERE token_hash=$1", [hashToken(sessao.token)])
    await naoExpor(await pedir('GET', '/api/orcamentos', undefined, { cookie: sessao.cookie }), 401, Object.values(fixture))
  })
  it('logout exige Origin, revoga a sessão no banco e limpa o cookie', async () => {
    assert.equal((await pedir('POST', '/api/auth/logout')).status, 401)
    const sessao = await login()
    assert.equal((await pedir('POST', '/api/auth/logout', undefined, { cookie: sessao.cookie, origin: null })).status, 403)
    assert.equal((await pedir('GET', '/api/auth/sessao', undefined, { cookie: sessao.cookie })).status, 200)
    const r = await pedir('POST', '/api/auth/logout', undefined, { cookie: sessao.cookie })
    assert.equal(r.status, 204); assert.equal(await r.text(), '')
    assert.match(r.headers.get('set-cookie'), /^sid=;/); assert.match(r.headers.get('set-cookie'), /Expires=Thu, 01 Jan 1970/i)
    assert.equal((await cliente.query('SELECT 1 FROM sessoes WHERE token_hash=$1', [hashToken(sessao.token)])).rows.length, 0)
    await naoExpor(await pedir('GET', '/api/auth/sessao', undefined, { cookie: sessao.cookie }), 401, [sessao.token])
  })
  it('troca de senha mantém a sessão atual e revoga a segunda sessão', async () => {
    const conta = novaConta(); const r = await pedir('POST', '/api/auth/cadastro', conta); assert.equal(r.status, 201)
    const pessoa = await r.json(), a = await login(pessoa), b = await login(pessoa)
    const novaSenha = 'SenhaFicticiaNovaCiclo0123!'
    const troca = await pedir('PATCH', '/api/clientes/me/senha', { senhaAtual: senha, novaSenha }, { cookie: a.cookie })
    assert.equal(troca.status, 204); assert.equal(await troca.text(), '')
    assert.equal((await pedir('GET', '/api/auth/sessao', undefined, { cookie: a.cookie })).status, 200)
    assert.equal((await pedir('GET', '/api/auth/sessao', undefined, { cookie: b.cookie })).status, 401)
    assert.equal((await pedir('POST', '/api/auth/login', { email: pessoa.email, senha })).status, 401)
    assert.equal((await login(pessoa, novaSenha)).dto.id, pessoa.id)
  })
  it('rate limit real do login impede a sexta falha sem criar sessão', async () => {
    const antes = (await cliente.query('SELECT COUNT(*)::integer AS total FROM sessoes')).rows[0].total
    for (let i = 0; i < 5; i++) {
      const r = await pedir('POST', '/api/auth/login', { email: principal.email, senha: 'SenhaFicticiaErrada!' })
      assert.equal(r.status, 401); await r.json()
    }
    const r = await pedir('POST', '/api/auth/login', { email: principal.email, senha: 'SenhaFicticiaErrada!' })
    assert.equal(r.status, 429); assert.ok(Number(r.headers.get('retry-after')) > 0)
    assert.equal((await cliente.query('SELECT COUNT(*)::integer AS total FROM sessoes')).rows[0].total, antes)
  })
  it('rate limit real do cadastro impede a sexta criação e persiste só cinco contas', async () => {
    const antes = (await cliente.query('SELECT COUNT(*)::integer AS total FROM clientes')).rows[0].total
    for (let i = 0; i < 5; i++) {
      const r = await pedir('POST', '/api/auth/cadastro', novaConta()); assert.equal(r.status, 201); await r.json()
    }
    const r = await pedir('POST', '/api/auth/cadastro', novaConta()); assert.equal(r.status, 429)
    assert.equal((await cliente.query('SELECT COUNT(*)::integer AS total FROM clientes')).rows[0].total, antes + 5)
  })
  it('falha real de sessão mantém resposta e log sem token, SQL ou detalhes pessoais', async () => {
    const sessao = await login()
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE sessoes RENAME TO sessoes_indisponiveis')
    try {
      const r = await pedir('GET', '/api/auth/sessao', undefined, { cookie: sessao.cookie })
      assert.deepEqual(await naoExpor(r, 500, [sessao.token, principal.email]), { erro: 'Erro interno do servidor' })
      const texto = inspect(log.mock.calls.map((c) => c.arguments))
      for (const valor of [sessao.token, principal.email, 'SELECT', 'sessoes']) assert.equal(texto.includes(valor), false)
      assert.equal(log.mock.callCount(), 1)
    } finally { await cliente.query('ALTER TABLE sessoes_indisponiveis RENAME TO sessoes'); log.mock.restore() }
  })
  function criarPeloScript(email) {
    return executar(process.execPath, ['--import', 'tsx', 'scripts/criar-admin.ts', '--nome', 'Admin Fictício', '--email', email], {
      cwd: fileURLToPath(new URL('../../', import.meta.url)),
      env: { ...process.env, DATABASE_URL: urlAplicacao, SENHA_ADMIN: senha },
    })
  }
  it('script de admin usa banco isolado e senha por env, sem imprimir email ou senha', async () => {
    const email = 'admin-script@teste.example'
    const resultado = await criarPeloScript(email)
    assert.match(resultado.stdout, /^Admin criado: id \d+\s*$/)
    assert.equal(resultado.stderr, '')
    assert.equal(resultado.stdout.includes(email) || resultado.stdout.includes(senha), false)
    const registro = (await cliente.query('SELECT papel,senha_hash FROM clientes WHERE email=$1', [email])).rows[0]
    assert.equal(registro.papel, 'admin'); assert.notEqual(registro.senha_hash, senha)
  })
  it('falha real no script de admin não imprime mensagem interna nem dados da linha', async () => {
    const marcador = 'DADO_SINTETICO_NAO_PUBLICAR'
    await cliente.query(`CREATE FUNCTION falhar_admin_ciclo0() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.email = 'falha-script@teste.example' THEN RAISE EXCEPTION '${marcador}'; END IF; RETURN NEW; END $$`)
    await cliente.query('CREATE TRIGGER falhar_admin_ciclo0 BEFORE INSERT ON clientes FOR EACH ROW EXECUTE FUNCTION falhar_admin_ciclo0()')
    try {
      await assert.rejects(criarPeloScript('falha-script@teste.example'), (erro) => {
        assert.equal(erro.code, 1)
        for (const valor of [marcador, senha, 'falha-script@teste.example']) {
          assert.equal(erro.stdout.includes(valor) || erro.stderr.includes(valor), false)
        }
        assert.match(erro.stderr, /P0001/)
        return true
      })
      assert.equal((await cliente.query("SELECT 1 FROM clientes WHERE email='falha-script@teste.example'")).rows.length, 0)
    } finally {
      await cliente.query('DROP TRIGGER falhar_admin_ciclo0 ON clientes'); await cliente.query('DROP FUNCTION falhar_admin_ciclo0()')
    }
  })
})
