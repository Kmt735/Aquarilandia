import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// Lote 14a (R-02 da revisão de base): a escrita de endereços do cliente — POST, PATCH e DELETE
// /api/clientes/me/enderecos — com sessões reais e PostgreSQL descartável. Inclui o acesso ao endereço de OUTRO cliente
// (404, e o endereço intacto no banco), a validação campo a campo, o limite de 10 e as regras do principal.
const url = process.env.TEST_DATABASE_URL
describe('Endereços do cliente (R-02) — PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `enderecos_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, api, origem, criado = false

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    origem = (await import('../../src/config/env.ts')).env.corsOrigin
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
  })
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  async function conta() {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES ($1, $2, 'hash', '32999990000') RETURNING id",
      [`Cliente ${randomUUID().slice(0, 6)}`, `${randomUUID()}@enderecos.example`])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token }
  }
  async function pedir(metodo, caminho, quem, body, { semOrigem = false } = {}) {
    const r = await fetch(`${api}/clientes/me/enderecos${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(semOrigem ? {} : { Origin: origem }), ...(quem ? { Cookie: `sid=${quem.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const texto = await r.text()
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null }
  }
  const valido = (extra = {}) => ({ apelido: 'Casa', cep: '36300-000', logradouro: 'Rua Teste', numero: '10', complemento: 'Apto 1',
    bairro: 'Centro', cidade: 'São João del Rei', uf: 'mg', ...extra })
  const linha = async (id) => (await c.query(`SELECT cliente_id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf, principal, atualizado_em
    FROM enderecos_cliente WHERE id = $1`, [id])).rows[0]
  const doCliente = async (clienteId) => (await c.query('SELECT id, principal FROM enderecos_cliente WHERE cliente_id = $1 ORDER BY id', [clienteId])).rows

  it('POST: 201 com os campos normalizados (CEP só números, UF maiúscula, trim); o primeiro vira principal; campos do sistema ignorados', async () => {
    const ana = await conta()
    const r = await pedir('POST', '', ana, valido({ logradouro: '  Rua Teste  ', id: 999, clienteId: 1, criadoEm: '2000-01-01' }))
    assert.equal(r.status, 201)
    assert.deepEqual(Object.keys(r.corpo).sort(), ['apelido', 'atualizadoEm', 'bairro', 'cep', 'cidade', 'clienteId', 'complemento', 'criadoEm', 'id', 'logradouro', 'numero', 'principal', 'uf'])
    assert.deepEqual([r.corpo.cep, r.corpo.uf, r.corpo.logradouro, r.corpo.principal, r.corpo.clienteId], ['36300000', 'MG', 'Rua Teste', true, ana.id])
    assert.notEqual(r.corpo.id, 999)
    assert.equal(new Date(r.corpo.criadoEm).getFullYear() > 2000, true)
    const banco = await linha(r.corpo.id)
    assert.deepEqual([banco.cliente_id, banco.cep, banco.uf, banco.principal], [ana.id, '36300000', 'MG', true])

    // O segundo com principal: true passa a ser o principal; o primeiro deixa de ser
    const segundo = await pedir('POST', '', ana, valido({ apelido: 'Trabalho', principal: true }))
    assert.equal(segundo.status, 201)
    assert.deepEqual(await doCliente(ana.id), [{ id: r.corpo.id, principal: false }, { id: segundo.corpo.id, principal: true }])
    // Sem principal, o terceiro não muda o principal
    const terceiro = await pedir('POST', '', ana, valido({ apelido: 'Sítio', complemento: undefined }))
    assert.deepEqual([terceiro.status, terceiro.corpo.principal, terceiro.corpo.complemento], [201, false, null])
  })

  it('POST: 422 campo a campo, todos os erros juntos; body que não é objeto → 422 body', async () => {
    const ana = await conta()
    for (const [campo, valor] of [
      ['cep', '123'], ['cep', '363000001'], ['logradouro', 'R'], ['logradouro', 'x'.repeat(151)], ['numero', ''], ['numero', '12345678901'],
      ['bairro', 'B'], ['cidade', 'x'.repeat(81)], ['uf', 'XX'], ['apelido', 'x'.repeat(41)], ['complemento', 'x'.repeat(81)], ['principal', 'sim'],
    ]) {
      const r = await pedir('POST', '', ana, valido({ [campo]: valor }))
      assert.equal(r.status, 422, `${campo}=${String(valor).slice(0, 12)}`)
      assert.deepEqual(Object.keys(r.corpo.detalhes), [campo], `${campo}=${String(valor).slice(0, 12)}`)
    }
    const vazio = await pedir('POST', '', ana, {})
    assert.deepEqual([vazio.status, Object.keys(vazio.corpo.detalhes).sort()], [422, ['bairro', 'cep', 'cidade', 'logradouro', 'numero', 'uf']])
    const lista = await pedir('POST', '', ana, [valido()])
    assert.deepEqual([lista.status, lista.corpo.detalhes], [422, { body: 'Formato de dados inválido.' }])
    // Primitivos nem chegam ao service: o express.json (modo estrito) responde 400
    for (const body of ['texto', null]) {
      const r = await pedir('POST', '', ana, body)
      assert.deepEqual([r.status, r.corpo], [400, { erro: 'JSON inválido' }], JSON.stringify(body))
    }
    assert.deepEqual(await doCliente(ana.id), [], 'nada gravado')
  })

  it('POST: o limite de 10 endereços → o 11º 409, nada gravado', async () => {
    const ana = await conta()
    for (let i = 1; i <= 10; i++) assert.equal((await pedir('POST', '', ana, valido({ apelido: `End ${i}` }))).status, 201)
    const r = await pedir('POST', '', ana, valido({ apelido: 'Demais' }))
    assert.deepEqual([r.status, r.corpo], [409, { erro: 'Você já tem 10 endereços cadastrados.' }])
    assert.equal((await doCliente(ana.id)).length, 10)
  })

  it('PATCH: parcial (só o que veio muda), troca de principal, não desmarca o principal, body vazio → 422', async () => {
    const ana = await conta()
    const a = (await pedir('POST', '', ana, valido())).corpo
    const b = (await pedir('POST', '', ana, valido({ apelido: 'Trabalho', numero: '20' }))).corpo
    const antes = await linha(b.id)
    const r = await pedir('PATCH', `/${b.id}`, ana, { numero: ' 99 ', uf: 'sp', clienteId: 1, id: 1 })
    assert.equal(r.status, 200)
    assert.deepEqual([r.corpo.id, r.corpo.numero, r.corpo.uf, r.corpo.logradouro, r.corpo.apelido, r.corpo.clienteId], [b.id, '99', 'SP', 'Rua Teste', 'Trabalho', ana.id])
    const depois = await linha(b.id)
    assert.equal(depois.atualizado_em > antes.atualizado_em, true)

    const desmarcar = await pedir('PATCH', `/${a.id}`, ana, { principal: false })
    assert.deepEqual([desmarcar.status, desmarcar.corpo.detalhes], [422, { principal: 'Para trocar o endereço principal, marque outro como principal.' }])
    assert.equal((await pedir('PATCH', `/${b.id}`, ana, { principal: true })).status, 200)
    assert.deepEqual(await doCliente(ana.id), [{ id: a.id, principal: false }, { id: b.id, principal: true }])

    const vazio = await pedir('PATCH', `/${b.id}`, ana, {})
    assert.deepEqual([vazio.status, vazio.corpo.detalhes], [422, { body: 'Informe pelo menos um campo do endereço para atualizar.' }])
    const invalido = await pedir('PATCH', `/${b.id}`, ana, { cep: '1', bairro: 'B' })
    assert.deepEqual([invalido.status, Object.keys(invalido.corpo.detalhes).sort()], [422, ['bairro', 'cep']])
    assert.equal((await pedir('PATCH', '/abc', ana, { numero: '1' })).status, 400)
    assert.equal((await pedir('PATCH', '/2147483000', ana, { numero: '1' })).corpo.erro, 'Endereço não encontrado.')
  })

  it('DELETE: 204 sem corpo; apagar o principal passa o principal para o mais recente que sobrou; inexistente → 404', async () => {
    const ana = await conta()
    const a = (await pedir('POST', '', ana, valido({ apelido: 'A' }))).corpo
    const b = (await pedir('POST', '', ana, valido({ apelido: 'B' }))).corpo
    const cc = (await pedir('POST', '', ana, valido({ apelido: 'C' }))).corpo
    const r = await pedir('DELETE', `/${a.id}`, ana)
    assert.deepEqual([r.status, r.corpo], [204, null])
    assert.deepEqual(await doCliente(ana.id), [{ id: b.id, principal: false }, { id: cc.id, principal: true }])
    assert.equal((await pedir('DELETE', `/${a.id}`, ana)).status, 404, 'apagar de novo')
    assert.equal((await pedir('DELETE', '/abc', ana)).status, 400)
    const lista = await fetch(`${api}/clientes/me/enderecos`, { headers: { Cookie: `sid=${ana.token}` } }).then((x) => x.json())
    assert.deepEqual(lista.map((e) => [e.id, e.principal]), [[cc.id, true], [b.id, false]], 'GET: o principal primeiro')
  })

  it('o endereço de OUTRO cliente: PATCH e DELETE → 404 (a mesma resposta do inexistente) e o endereço intacto no banco', async () => {
    const ana = await conta(), bia = await conta()
    const daBia = (await pedir('POST', '', bia, valido({ apelido: 'Da Bia' }))).corpo
    const antes = await linha(daBia.id)
    const inexistente = await pedir('PATCH', '/2147483000', ana, { numero: '1' })
    for (const r of [
      await pedir('PATCH', `/${daBia.id}`, ana, { numero: '666', principal: true }),
      await pedir('DELETE', `/${daBia.id}`, ana),
    ]) {
      assert.deepEqual([r.status, r.corpo], [404, { erro: 'Endereço não encontrado.' }])
      assert.deepEqual(r.corpo, inexistente.corpo, 'não confirma que o endereço existe')
    }
    assert.deepEqual(await linha(daBia.id), antes, 'o endereço da outra cliente não mudou')
    assert.deepEqual(await doCliente(ana.id), [], 'nada foi criado para quem tentou')
    // A lista de cada um só tem os próprios
    const lista = await fetch(`${api}/clientes/me/enderecos`, { headers: { Cookie: `sid=${ana.token}` } }).then((x) => x.json())
    assert.deepEqual(lista, [])
  })

  it('sem login → 401 e sem Origin → 403 nas três escritas, sem mudar o banco', async () => {
    const ana = await conta()
    const meu = (await pedir('POST', '', ana, valido())).corpo
    const antes = await linha(meu.id)
    for (const [metodo, caminho, body] of [['POST', '', valido()], ['PATCH', `/${meu.id}`, { numero: '1' }], ['DELETE', `/${meu.id}`, undefined]]) {
      const semLogin = await pedir(metodo, caminho, null, body)
      assert.deepEqual([semLogin.status, semLogin.corpo.erro], [401, 'Faça login para continuar.'], `${metodo} sem login`)
      const semOrigem = await pedir(metodo, caminho, ana, body, { semOrigem: true })
      assert.deepEqual([semOrigem.status, semOrigem.corpo.erro], [403, 'Origem da requisição não permitida.'], `${metodo} sem Origin`)
    }
    assert.equal((await fetch(`${api}/clientes/me/enderecos`)).status, 401, 'GET sem login')
    assert.deepEqual(await linha(meu.id), antes)
    assert.equal((await doCliente(ana.id)).length, 1)
  })
})
