import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { format } from 'node:util'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// Lote 14a (D-54): o provedor de e-mail (Resend) fora do ar nunca desfaz a operação nem muda a resposta da rota.
// O fetch para api.resend.com é FALSO e responde 500 (ou não responde); nenhum e-mail real sai. A chave é fictícia.
const url = process.env.TEST_DATABASE_URL
describe('Falha do provedor de e-mail (Lote 14a) — PostgreSQL real e Resend falso', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `email_falha_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, api, origem, env, estoque, repoVenda, tx, limites, admin, criado = false
  let envios, saida, bloqueados

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '21_vendas_idempotencia.sql', '22_pagamentos_estorno.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlApp.toString()
    process.env.FRONTEND_URL = 'http://localhost:5173'
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    env = (await import('../../src/config/env.ts')).env
    origem = env.corsOrigin
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    repoVenda = (await import('../../src/modulos/vendas/venda.repository.ts')).vendaRepository
    tx = (await import('../../src/utils/transacao.ts')).comTransacao
    limites = await import('../../src/middlewares/rateLimit.ts')
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
    admin = await conta('admin')
  })
  beforeEach(() => {
    envios = []; saida = []; bloqueados = []
    // Com a chave, o email.ts manda pelo Resend: o fetch dele é o falso abaixo
    Object.assign(env, { emailApiKey: 're_CHAVE_FICTICIA_DO_TESTE', emailRemetente: 'Loja <loja@remetente.example>' })
    const fetchOriginal = globalThis.fetch
    mock.method(globalThis, 'fetch', async (alvo, opcoes) => {
      const destino = String(alvo)
      if (destino === 'https://api.resend.com/emails') {
        envios.push(JSON.parse(opcoes.body))
        return new Response('{"message":"erro interno do provedor"}', { status: 500 })
      }
      if (!destino.startsWith(api)) { bloqueados.push(destino); throw new Error('fetch para fora bloqueado no teste') }
      return fetchOriginal(alvo, opcoes)
    })
    for (const nome of ['error', 'info', 'log', 'warn']) mock.method(console, nome, (...args) => { saida.push(format(...args)) })
    for (const l of [limites.limiteEsqueciSenhaIp, limites.limiteEsqueciSenhaEmail, limites.limiteTrocaSenha]) l.resetKey('127.0.0.1')
  })
  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 100)) // os envios saem depois da resposta
    mock.restoreAll()
    Object.assign(env, { emailApiKey: undefined, emailRemetente: undefined })
    assert.deepEqual(bloqueados, [])
  })
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  async function conta(papel = 'cliente', email = `${randomUUID()}@falhaemail.example`) {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone, papel) VALUES ($1, $2, 'hash', '32999990000', $3) RETURNING id",
      [`Conta ${randomUUID().slice(0, 6)}`, email, papel])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token, email }
  }
  const pedir = async (metodo, caminho, quem, body) => {
    const r = await fetch(`${api}${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Origin: origem, ...(quem ? { Cookie: `sid=${quem.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const texto = await r.text()
    return { status: r.status, corpo: texto ? JSON.parse(texto) : null }
  }
  const esperarEnvios = async (n) => { for (let i = 0; i < 100 && envios.length < n; i++) await new Promise((r) => setTimeout(r, 20)) }

  it('esqueci-senha com o provedor fora: o MESMO 202 de quem não tem conta, o token gravado, log sem o e-mail', async () => {
    const quem = await conta()
    const semConta = await pedir('POST', '/auth/esqueci-senha', null, { email: `${randomUUID()}@nao-existe.example` })
    const comConta = await pedir('POST', '/auth/esqueci-senha', null, { email: quem.email })
    assert.deepEqual([comConta.status, comConta.corpo], [semConta.status, semConta.corpo])
    assert.equal(comConta.status, 202)
    await esperarEnvios(1)
    assert.equal(envios.length, 1, 'o envio foi tentado no Resend')
    assert.deepEqual(envios[0].to, [quem.email])
    assert.equal('html' in envios[0], false)
    const tokens = (await c.query('SELECT count(*)::int AS n FROM tokens_recuperacao_senha WHERE cliente_id = $1', [quem.id])).rows[0].n
    assert.equal(tokens, 1, 'a falha do e-mail não desfez a transação')
    assert.ok(saida.includes('[esqueci-senha] falha ao enviar e-mail'))
    assert.equal(saida.join('\n').includes(quem.email), false, 'o log repetiu o e-mail do cliente')
  })

  it('mudança de status pelo admin com o provedor fora: 200, o status gravado e o e-mail tentado', async () => {
    const dono = await conta()
    const p = (await c.query("INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $1, 1000, true FROM categorias WHERE slug = 'acessorios' RETURNING id", [`Produto ${randomUUID().slice(0, 8)}`])).rows[0].id
    await estoque.registrarMovimentacao(admin.id, { produtoId: p, tipo: 'entrada', quantidade: 5, motivo: 'Saldo de teste' }, randomUUID(), {})
    const venda = await fetch(`${api}/vendas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origem, Cookie: `sid=${dono.token}`, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ itens: [{ produtoId: p, quantidade: 1 }], retirada: true, totalEsperado: 1000 }),
    }).then((r) => r.json())
    await tx((client) => repoVenda.mudarStatus(venda.id, 'aguardando_pagamento', 'paga', { ator: 'gateway', clienteId: null }, client))
    assert.equal((await pedir('POST', `/vendas/${venda.id}/status`, admin, { status: 'em_separacao' })).status, 200)
    const r = await pedir('POST', `/vendas/${venda.id}/status`, admin, { status: 'pronta_retirada' })
    assert.deepEqual([r.status, r.corpo.status], [200, 'pronta_retirada'])
    await esperarEnvios(1)
    assert.equal(envios.length, 1)
    assert.match(envios[0].subject, /pronto para retirada/)
    assert.equal((await c.query('SELECT status FROM vendas WHERE id = $1', [venda.id])).rows[0].status, 'pronta_retirada')
    await new Promise((resolve) => setTimeout(resolve, 50))
    assert.ok(saida.some((l) => l === `[email] venda ${venda.id}: aviso de pronta_retirada não enviado (erro inesperado)`))
    assert.equal(saida.join('\n').includes(dono.email), false)
  })

  it('troca de e-mail com o provedor fora: 200 e o e-mail novo gravado; o aviso ao antigo foi tentado', async () => {
    const senha = 'SenhaDeTeste123!'
    const argon2 = (await import('argon2')).default
    const quem = await conta()
    await c.query('UPDATE clientes SET senha_hash = $1 WHERE id = $2', [await argon2.hash(senha, { type: argon2.argon2id }), quem.id])
    const novo = `${randomUUID()}@novo.example`
    const r = await pedir('PATCH', '/clientes/me', quem, { email: novo, senhaAtual: senha })
    assert.equal(r.status, 200, JSON.stringify(r.corpo))
    assert.equal(r.corpo.email, novo)
    await esperarEnvios(1)
    assert.deepEqual(envios[0]?.to, [quem.email], 'o aviso vai para o endereço antigo')
    assert.equal((await c.query('SELECT email FROM clientes WHERE id = $1', [quem.id])).rows[0].email, novo)
    assert.ok(saida.includes('[troca-email] falha ao enviar o aviso'))
    assert.equal(saida.join('\n').includes(quem.email), false)
  })
})
