import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { hashToken } from '../src/modulos/auth/sessao.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'
import { entradaProduto, fichasCadastro } from './fixtures/produto-cadastro.mjs'

describe('POST /api/produtos — HTTP, validação e transação', () => {
  let servidor
  let origem
  const token = 'sessao-cadastro-produto'
  before(async () => {
    servidor = app.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })
  function autorizar(papel = 'admin') {
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async (hash) => (
      hash === hashToken(token) ? { id: 7, papel } : null
    ))
  }
  function criar(body, headers = {}) {
    return fetch(`${origem}/api/produtos`, {
      method: 'POST', headers: { Cookie: `sid=${token}`, Origin: env.corsOrigin, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  }
  function banco({ categoria = 'acessorios', detalhe = {}, erroEtapa, erro, rollbackFalha = false } = {}) {
    const chamadas = []
    const client = {
      release: mock.fn(),
      async query(sql, params) {
        chamadas.push({ sql, params })
        if (rollbackFalha && sql === 'ROLLBACK') throw new Error('Conexão perdida')
        if (erroEtapa && sql.includes(erroEtapa)) throw erro ?? new Error('Interno senha=segredo')
        if (sql.includes('FOR SHARE')) return { rows: categoria ? [{ id: 3, nome: 'Categoria', slug: categoria }] : [] }
        if (sql.startsWith('INSERT INTO produtos')) return { rows: [{ id: 42 }] }
        if (sql.startsWith('SELECT p.id')) return { rows: [detalhe] }
        return { rows: [] }
      },
    }
    const connect = mock.method(db, 'connect', async () => client)
    // Consultas de cadastro devem usar somente o client da transação.
    mock.method(db, 'query', async () => { throw new Error('Consulta fora da transação') })
    return { chamadas, client, connect }
  }

  it('permite credenciais na origem CORS configurada, conforme o contrato compartilhado', async () => {
    const resposta = await fetch(`${origem}/api/produtos`, {
      method: 'OPTIONS', headers: { Origin: env.corsOrigin, 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type' },
    })
    assert.equal(resposta.status, 204)
    assert.equal(resposta.headers.get('access-control-allow-origin'), env.corsOrigin)
    assert.equal(resposta.headers.get('access-control-allow-credentials'), 'true')
    assert.match(resposta.headers.get('access-control-allow-methods'), /POST/)
  })

  for (const [descricao, papel, headers, status] of [
    ['sem sessão', 'admin', { Cookie: '' }, 401], ['sessão inválida', 'admin', { Cookie: 'sid=inventada' }, 401],
    ['cliente autenticado', 'cliente', {}, 403], ['sem Origin', 'admin', { Origin: '' }, 403],
    ['Origin incorreto', 'admin', { Origin: 'https://invalida.example' }, 403],
  ]) {
    it(`recusa ${descricao} antes de adquirir conexão`, async () => {
      autorizar(papel)
      const { connect } = banco()
      assert.equal((await criar(entradaProduto(3), headers)).status, status)
      assert.equal(connect.mock.callCount(), 0)
    })
  }

  it('grava básicos parametrizados com estoque zero, lê o mesmo DTO e confirma antes de responder', async () => {
    autorizar()
    const detalhe = { id: 42, categoriaId: 3, categoria: 'acessorios', nome: "Redinha d'água", preco: 8990,
      descricao: 'Descrição', marca: 'Marca', imagemUrl: null, emEstoque: false, ficha: null }
    const { chamadas, client } = banco({ detalhe })
    const resposta = await criar({ ...entradaProduto(3), nome: " Redinha d'água ", descricao: ' Descrição ', marca: ' Marca ', estoque: 0 })
    assert.equal(resposta.status, 201)
    assert.deepEqual(await resposta.json(), detalhe)
    assert.equal(chamadas[0].sql, 'BEGIN')
    assert.match(chamadas[1].sql, /FOR SHARE$/)
    assert.deepEqual(chamadas[2].params, [3, "Redinha d'água", 'Descrição', 'Marca', 8990])
    assert.equal(chamadas[2].sql.includes("d'água"), false)
    assert.match(chamadas[2].sql, /\$5, 0\)/)
    assert.equal(chamadas.at(-1).sql, 'COMMIT')
    assert.equal(client.release.mock.callCount(), 1)
  })

  for (const ficha of fichasCadastro) {
    it(`insere ficha ${ficha.tipo} parametrizada na mesma conexão`, async () => {
      autorizar()
      const { chamadas } = banco({ categoria: ficha.tipo })
      const dados = { ...ficha.minimos, ...ficha.extras }
      assert.equal((await criar(entradaProduto(3, { tipo: ficha.tipo, dados }))).status, 201)
      const escrita = chamadas.find((c) => c.sql.startsWith(`INSERT INTO ${ficha.tipo} `))
      assert.ok(escrita)
      assert.equal(escrita.params[0], 42)
      if (ficha.tipo === 'peixes') assert.equal(escrita.sql.includes(dados.nomeCientifico), false)
      assert.equal(chamadas.at(-1).sql, 'COMMIT')
    })
    for (const campo of ficha.obrigatorios) {
      it(`exige ${ficha.tipo}.${campo} sem abrir transação`, async () => {
        autorizar()
        const { connect } = banco()
        const dados = { ...ficha.minimos }
        delete dados[campo]
        const resposta = await criar(entradaProduto(3, { tipo: ficha.tipo, dados }))
        assert.equal(resposta.status, 400)
        assert.equal(typeof (await resposta.json()).detalhes[`ficha.dados.${campo}`], 'string')
        assert.equal(connect.mock.callCount(), 0)
      })
    }
    it(`valida tipos, limites e faixas de ${ficha.tipo}`, async () => {
      autorizar()
      const { connect } = banco()
      for (const invalido of ficha.invalidos) {
        const resposta = await criar(entradaProduto(3, { tipo: ficha.tipo, dados: { ...ficha.minimos, ...invalido } }))
        assert.equal(resposta.status, 400, JSON.stringify(invalido))
        assert.equal((await resposta.json()).erro, 'Dados inválidos')
      }
      assert.equal(connect.mock.callCount(), 0)
    })
  }

  it('categoria inexistente retorna 400 e desfaz a transação sem INSERT', async () => {
    autorizar()
    const { chamadas } = banco({ categoria: null })
    const resposta = await criar(entradaProduto(3))
    assert.equal(resposta.status, 400)
    assert.equal(typeof (await resposta.json()).detalhes.categoriaId, 'string')
    assert.equal(chamadas.some((c) => c.sql.startsWith('INSERT')), false)
    assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
  })

  for (const [categoria, ficha] of [
    ['peixes', null], ['aquarios', { tipo: 'peixes', dados: fichasCadastro[0].minimos }],
    ['acessorios', { tipo: 'peixes', dados: fichasCadastro[0].minimos }],
  ]) {
    it(`recusa ficha ${ficha?.tipo ?? 'ausente'} para categoria ${categoria}`, async () => {
      autorizar()
      const { chamadas } = banco({ categoria })
      const resposta = await criar(entradaProduto(3, ficha))
      assert.equal(resposta.status, 400)
      assert.equal(typeof (await resposta.json()).detalhes.ficha, 'string')
      assert.equal(chamadas.some((c) => c.sql.startsWith('INSERT')), false)
      assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
    })
  }

  const basico = entradaProduto(3)
  for (const [descricao, dados] of [
    ['array', []], ['nulo', null], ['vazio', {}],
    ['ID textual', { ...basico, categoriaId: '3' }], ['ID zero', { ...basico, categoriaId: 0 }],
    ['ID decimal', { ...basico, categoriaId: 1.5 }], ['ID grande', { ...basico, categoriaId: 2147483648 }],
    ['nome vazio', { ...basico, nome: ' ' }], ['nome longo', { ...basico, nome: 'x'.repeat(151) }],
    ['nome nulo', { ...basico, nome: 'No\u0000me' }], ['marca longa', { ...basico, marca: 'x'.repeat(81) }],
    ['descrição objeto', { ...basico, descricao: {} }], ['preço string', { ...basico, preco: '8990' }],
    ['preço decimal', { ...basico, preco: 89.9 }], ['preço negativo', { ...basico, preco: -1 }],
    ['preço grande', { ...basico, preco: 2147483648 }], ['estoque positivo', { ...basico, estoque: 1 }],
    ['estoque negativo', { ...basico, estoque: -1 }], ['estoque string', { ...basico, estoque: '0' }],
    ['estoque nulo', { ...basico, estoque: null }], ['ativo', { ...basico, ativo: false }],
    ['imagem', { ...basico, imagemUrl: 'https://foto.example' }], ['ID atribuído', { ...basico, id: 42 }],
    ['ficha array', { ...basico, ficha: [] }], ['ficha desconhecida', { ...basico, ficha: { tipo: 'toString', dados: {} } }],
    ['injeção de tabela', { ...basico, ficha: { tipo: 'peixes; DROP TABLE produtos', dados: {} } }],
    ['ficha sem dados', { ...basico, ficha: { tipo: 'peixes' } }],
    ['ficha extra', { ...basico, ficha: { tipo: 'filtros', dados: fichasCadastro[2].minimos, interno: true } }],
    ['dados extras', { ...basico, ficha: { tipo: 'filtros', dados: { ...fichasCadastro[2].minimos, produtoId: 1 } } }],
  ]) {
    it(`recusa ${descricao} com 400 antes do banco`, async () => {
      autorizar()
      const { connect } = banco()
      const resposta = await criar(dados)
      assert.equal(resposta.status, 400)
      assert.equal((await resposta.json()).erro, dados === null ? 'JSON inválido' : 'Dados inválidos')
      assert.equal(connect.mock.callCount(), 0)
    })
  }

  it('traduz duplicidade científica em 409 após rollback', async () => {
    autorizar()
    const { chamadas } = banco({ categoria: 'peixes', erroEtapa: 'INSERT INTO peixes',
      erro: Object.assign(new Error('Detalhe interno do banco'), { code: '23505', constraint: 'peixes_nome_cientifico_key' }) })
    const resposta = await criar(entradaProduto(3, { tipo: 'peixes', dados: fichasCadastro[0].minimos }))
    assert.equal(resposta.status, 409)
    assert.deepEqual(await resposta.json(), { erro: 'Peixe já cadastrado', detalhes: { 'ficha.dados.nomeCientifico': 'Já existe um peixe com esse nome científico.' } })
    assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
  })

  for (const etapa of ['BEGIN', 'FOR SHARE', 'INSERT INTO produtos', 'INSERT INTO peixes', 'SELECT p.id', 'COMMIT']) {
    it(`falha em ${etapa} faz rollback, libera a conexão e responde sem detalhes internos`, async () => {
      autorizar()
      mock.method(console, 'error', () => {})
      const { chamadas, client } = banco({ categoria: 'peixes', erroEtapa: etapa })
      const resposta = await criar(entradaProduto(3, { tipo: 'peixes', dados: fichasCadastro[0].minimos }))
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
      assert.equal(client.release.mock.callCount(), 1)
    })
  }

  it('descarta conexão se o próprio rollback falhar', async () => {
    autorizar()
    mock.method(console, 'error', () => {})
    const { client } = banco({ erroEtapa: 'INSERT INTO produtos', rollbackFalha: true })
    assert.equal((await criar(basico)).status, 500)
    assert.equal(client.release.mock.callCount(), 1)
    assert.deepEqual(client.release.mock.calls[0].arguments, [true])
  })

  it('falha ao obter conexão mantém resposta genérica', async () => {
    autorizar()
    mock.method(console, 'error', () => {})
    mock.method(db, 'connect', async () => { throw new Error('Falha banco segredo') })
    const resposta = await criar(basico)
    assert.equal(resposta.status, 500)
    assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
  })
})
