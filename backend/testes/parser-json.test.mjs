import assert from 'node:assert/strict'
import { once } from 'node:events'
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { authService } from '../src/modulos/auth/auth.service.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'
import { orcamentoRepository } from '../src/modulos/orcamentos/orcamento.repository.ts'
import { limiteOrcamento } from '../src/middlewares/rateLimit.ts'

describe('Parser JSON compartilhado — limites, codificações e integração HTTP', () => {
  let servidor, origem, consulta, conexao, sessao, log
  const limite = 100 * 1024
  const fixture = { nome: 'Pessoa de teste', telefone: '32999999999', servico: 'Outro', mensagem: '' }
  const erroTamanho = { erro: 'Corpo da requisição excede o limite de 100 KiB' }
  const erroCodificacao = { erro: 'Codificação de corpo não suportada. Envie JSON sem compressão.' }

  before(async () => {
    servidor = app.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  beforeEach(() => {
    const inesperado = async () => { throw new Error('Parser não deveria acessar sessão/banco') }
    consulta = mock.method(db, 'query', inesperado)
    conexao = mock.method(db, 'connect', inesperado)
    sessao = mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', inesperado)
    log = mock.method(console, 'error', () => {})
    // O POST de orçamento grava no PostgreSQL: aqui o repository é simulado e o db continua proibido
    mock.method(orcamentoRepository, 'inserir', async (dados) => (
      { id: 1, ...dados, status: 'novo', criadoEm: new Date(), atualizadoEm: new Date() }
    ))
    // Limpa só o estado de fixtures entre casos (o POST de orçamento tem limite de 5 por hora)
    limiteOrcamento.resetKey('127.0.0.1')
  })
  afterEach(() => {
    try {
      for (const chamada of [consulta, conexao, sessao, log]) assert.equal(chamada.mock.callCount(), 0)
    } finally { mock.restoreAll() }
  })
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })
  function enviar(caminho, body, headers = {}) {
    return fetch(`${origem}${caminho}`, { method: 'POST', body,
      headers: { 'Content-Type': 'application/json', Cookie: 'sid=nao-consultar', Origin: env.corsOrigin, ...headers } })
  }
  // A mensagem vai até 1000 caracteres (15_orcamentos.sql): o resto dos bytes vai num campo que o service ignora
  const mensagemLimite = (multibyte) => (multibyte ? 'á'.repeat(500) : 'x'.repeat(1000))
  function corpoComBytes(tamanho, multibyte) {
    const base = { ...fixture, mensagem: mensagemLimite(multibyte), preenchimento: '' }
    const restante = tamanho - Buffer.byteLength(JSON.stringify(base))
    const preenchimento = multibyte ? 'á'.repeat(Math.floor(restante / 2)) + 'x'.repeat(restante % 2) : 'x'.repeat(restante)
    const corpo = Buffer.from(JSON.stringify({ ...base, preenchimento }))
    assert.equal(corpo.length, tamanho)
    return corpo
  }

  for (const multibyte of [false, true]) {
    it(`aceita exatamente 102400 bytes de JSON ${multibyte ? 'UTF-8 multibyte' : 'ASCII'} no POST público`, async () => {
      const resposta = await enviar('/api/orcamentos', corpoComBytes(limite, multibyte))
      assert.equal(resposta.status, 201)
      const corpo = await resposta.json()
      assert.equal(corpo.nome, fixture.nome)
      assert.equal(corpo.mensagem, mensagemLimite(multibyte))
      assert.equal('preenchimento' in corpo, false)
    })
    it(`recusa 102401 bytes de JSON ${multibyte ? 'UTF-8 multibyte' : 'ASCII'} sem expor o corpo`, async () => {
      const resposta = await enviar('/api/orcamentos', corpoComBytes(limite + 1, multibyte))
      assert.equal(resposta.status, 413)
      assert.deepEqual(await resposta.json(), erroTamanho)
    })
  }
  for (const caminho of ['/api/auth/login', '/api/auth/cadastro']) {
    it(`preserva 413 antes da autenticação/validação em ${caminho}`, async () => {
      const resposta = await enviar(caminho, corpoComBytes(limite + 1, false))
      assert.equal(resposta.status, 413)
      assert.deepEqual(await resposta.json(), erroTamanho)
    })
  }
  // Gzip de produtos/PATCH/login já é coberto em produto-edicao.test.mjs.
  for (const caminho of ['/api/categorias', '/api/auth/cadastro', '/api/orcamentos']) {
    it(`preserva 415 de gzip antes das regras de ${caminho}`, async () => {
      const resposta = await enviar(caminho, gzipSync(JSON.stringify(fixture)), { 'Content-Encoding': 'gzip' })
      assert.equal(resposta.status, 415)
      assert.deepEqual(await resposta.json(), erroCodificacao)
    })
  }
  for (const [encoding, comprimir] of [['deflate', deflateSync], ['br', brotliCompressSync]]) {
    for (const caminho of ['/api/orcamentos', '/api/auth/login']) {
      it(`recusa ${encoding} em ${caminho} antes de sessão/banco`, async () => {
        const resposta = await enviar(caminho, comprimir(JSON.stringify(fixture)), { 'Content-Encoding': encoding })
        assert.equal(resposta.status, 415)
        assert.deepEqual(await resposta.json(), erroCodificacao)
      })
    }
  }
  for (const caminho of ['/api/orcamentos', '/api/auth/login']) {
    it(`mantém 400 sanitizado para JSON malformado em ${caminho}`, async () => {
      const resposta = await enviar(caminho, '{"segredo":"fixture",')
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), { erro: 'JSON inválido' })
    })
  }
  it('mantém JSON UTF-8 sem compressão com Content-Encoding identity', async () => {
    const resposta = await enviar('/api/orcamentos', JSON.stringify({ ...fixture, mensagem: 'Aquário' }), {
      'Content-Type': 'application/json; charset=utf-8', 'Content-Encoding': 'identity',
    })
    assert.equal(resposta.status, 201)
    assert.equal((await resposta.json()).mensagem, 'Aquário')
  })
  for (const tipo of ['text/plain', 'application/x-www-form-urlencoded']) {
    it(`não passa a interpretar ${tipo} como JSON`, async () => {
      const resposta = await enviar('/api/orcamentos', JSON.stringify(fixture), { 'Content-Type': tipo })
      assert.equal(resposta.status, 422)
      assert.equal((await resposta.json()).erro, 'Dados inválidos')
    })
  }
  it('mantém o corpo de login, DTO, cookie de sessão e CORS com credenciais', async () => {
    const dados = { email: 'fixture@teste.example', senha: 'SenhaFicticia123!' }
    const cliente = { id: 7, nome: 'Pessoa de teste', papel: 'cliente' }
    const login = mock.method(authService, 'login', async (body) => {
      assert.deepEqual(body, dados)
      return { cliente, token: 'token-ficticio-parser', expiraEm: new Date(Date.now() + 3600000) }
    })
    const resposta = await enviar('/api/auth/login', JSON.stringify(dados))
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), cliente)
    assert.equal(login.mock.callCount(), 1)
    const cookie = resposta.headers.get('set-cookie')
    assert.match(cookie, /^sid=token-ficticio-parser;/)
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
    assert.match(cookie, /Path=\//i)
    assert.equal(/; Secure/i.test(cookie), process.env.NODE_ENV === 'production')
    assert.equal(resposta.headers.get('access-control-allow-origin'), env.corsOrigin)
    assert.equal(resposta.headers.get('access-control-allow-credentials'), 'true')
  })
  it('preserva o preflight CORS das escritas administrativas', async () => {
    const resposta = await fetch(`${origem}/api/produtos`, { method: 'OPTIONS', headers: {
      Origin: env.corsOrigin, 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    } })
    assert.equal(resposta.status, 204)
    assert.equal(resposta.headers.get('access-control-allow-origin'), env.corsOrigin)
    assert.equal(resposta.headers.get('access-control-allow-credentials'), 'true')
    assert.match(resposta.headers.get('access-control-allow-headers'), /content-type/i)
  })
})
