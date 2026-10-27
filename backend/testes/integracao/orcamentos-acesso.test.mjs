import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const urlTeste = process.env.TEST_DATABASE_URL
describe('Orçamentos — HTTP com sessões e papéis reais no PostgreSQL', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para verificar sessões reais no PostgreSQL.',
}, () => {
  const schema = `teste_orcamentos_${randomUUID().replaceAll('-', '')}`
  const usuarios = new Map(), tokens = new Map()
  const fixture = { nome: 'Pessoa Fictícia Restrita', telefone: '32999999999', servico: 'Outro', mensagem: 'Mensagem confidencial sintética' }
  let cliente, pool, servidor, origem, criado, schemaCriado = false
  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    await cliente.query(await readFile(new URL('../../db/init/10_clientes.sql', import.meta.url), 'utf8'))
    for (const [chave, papel, ativo, validade] of [
      ['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'],
      ['inativo', 'admin', false, '1 hour'], ['expirado', 'admin', true, '-1 hour'],
      ['mutavel', 'admin', true, '1 hour'], ['revogavel', 'admin', true, '1 hour'],
    ]) {
      const { rows } = await cliente.query('INSERT INTO clientes (nome,email,senha_hash,papel,ativo) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [chave, `${chave}@teste.example`, 'hash-fixture-sem-login', papel, ativo])
      usuarios.set(chave, rows[0].id)
      const token = randomUUID(); tokens.set(chave, token)
      await cliente.query('INSERT INTO sessoes (token_hash,cliente_id,expira_em) VALUES ($1,$2,now()+$3::interval)',
        [hashToken(token), rows[0].id, validade])
    }
    const urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlAplicacao.toString()
    const { app } = await import('../../src/app.ts')
    const { db } = await import('../../src/config/db.ts')
    pool = db
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
    const resposta = await fetch(`${origem}/api/orcamentos`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fixture) })
    assert.equal(resposta.status, 201); criado = await resposta.json()
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
  function requisitar(sessao = null, method = 'GET', caminho = '/api/orcamentos') {
    const headers = {}
    if (sessao) headers.Cookie = `sid=${tokens.get(sessao) ?? sessao}`
    return fetch(`${origem}${caminho}`, { method, headers })
  }
  async function negar(resposta, status) {
    assert.equal(resposta.status, status)
    const corpo = await resposta.json()
    assert.deepEqual(corpo, { erro: status === 401 ? 'Faça login para continuar.' : 'Acesso permitido somente para administradores.' })
    for (const valor of [...Object.values(fixture), criado.id]) assert.equal(JSON.stringify(corpo).includes(valor), false)
  }

  for (const [descricao, sessao, status] of [['visitante', null, 401], ['token inventado', 'inventado', 401],
    ['sessão vencida', 'expirado', 401], ['conta inativa', 'inativo', 401], ['cliente', 'cliente', 403]]) {
    it(`${descricao} não recebe dados pessoais`, async () => negar(await requisitar(sessao), status))
  }
  it('admin obtém somente os campos administrativos e a resposta não deve ser armazenada em cache', async () => {
    const resposta = await requisitar('admin')
    assert.equal(resposta.status, 200); assert.equal(resposta.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await resposta.json(), [criado])
    assert.deepEqual(Object.keys(criado).sort(), ['id', 'criadoEm', 'nome', 'telefone', 'servico', 'mensagem'].sort())
  })
  it('rebaixar o papel no banco bloqueia o mesmo cookie imediatamente; promover novamente restaura o acesso', async () => {
    assert.equal((await requisitar('mutavel')).status, 200)
    await cliente.query("UPDATE clientes SET papel='cliente' WHERE id=$1", [usuarios.get('mutavel')])
    await negar(await requisitar('mutavel'), 403)
    await cliente.query("UPDATE clientes SET papel='admin' WHERE id=$1", [usuarios.get('mutavel')])
    assert.equal((await requisitar('mutavel')).status, 200)
    await cliente.query('UPDATE clientes SET ativo=false WHERE id=$1', [usuarios.get('mutavel')])
    await negar(await requisitar('mutavel'), 401)
  })
  it('revogar a sessão no banco invalida o acesso com o mesmo token', async () => {
    assert.equal((await requisitar('revogavel')).status, 200)
    await cliente.query('DELETE FROM sessoes WHERE cliente_id=$1', [usuarios.get('revogavel')])
    await negar(await requisitar('revogavel'), 401)
  })
  it('POST continua público sem depender de sessão ou de o banco de sessões estar disponível', async () => {
    await cliente.query('ALTER TABLE sessoes RENAME TO sessoes_indisponiveis')
    try {
      const resposta = await fetch(`${origem}/api/orcamentos`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: 'sid=invalido' }, body: JSON.stringify({ ...fixture, nome: 'Outra pessoa sintética' }) })
      assert.equal(resposta.status, 201)
      assert.equal((await resposta.json()).nome, 'Outra pessoa sintética')
    } finally { await cliente.query('ALTER TABLE sessoes_indisponiveis RENAME TO sessoes') }
  })
  for (const [method, sufixo] of [['GET', '/um-id'], ['PATCH', '/um-id'], ['DELETE', '/um-id']]) {
    it(`${method} /orcamentos${sufixo} tem guarda administrativa, mas o CRUD segue ausente`, async () => {
      const caminho = `/api/orcamentos${sufixo}`
      await negar(await requisitar(null, method, caminho), 401)
      await negar(await requisitar('cliente', method, caminho), 403)
      assert.equal((await requisitar('admin', method, caminho)).status, 404)
      const lista = await (await requisitar('admin')).json()
      assert.deepEqual(lista.find((item) => item.id === criado.id), criado)
    })
  }
  it('falha real de sessão responde 500 genérico sem entregar a lista', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE sessoes RENAME TO sessoes_indisponiveis')
    try {
      const resposta = await requisitar('admin')
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    } finally {
      await cliente.query('ALTER TABLE sessoes_indisponiveis RENAME TO sessoes'); log.mock.restore()
    }
  })
})
