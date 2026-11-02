import assert from 'node:assert/strict'
import { once } from 'node:events'
import { gzipSync } from 'node:zlib'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { hashToken } from '../src/modulos/auth/sessao.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'
import { fichasCadastro } from './fixtures/produto-cadastro.mjs'

describe('PATCH /api/produtos/:id — HTTP e segurança', () => {
  let servidor
  let origem
  const token = 'sessao-edicao-produto'
  const peixe = { id: 42, categoriaId: 1, categoria: 'peixes', nome: 'Betta', preco: 2500,
    descricao: 'Descrição', marca: 'Marca', imagemUrl: null, emEstoque: true,
    ficha: { tipo: 'peixes', dados: { ...fichasCadastro[0].minimos, ...fichasCadastro[0].extras } } }
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
    return mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async (hash) => (
      hash === hashToken(token) ? { id: 7, papel } : null
    ))
  }
  function editar(body, { id = '42', headers = {}, raw = false } = {}) {
    return fetch(`${origem}/api/produtos/${id}`, { method: 'PATCH',
      headers: { Cookie: `sid=${token}`, Origin: env.corsOrigin, 'Content-Type': 'application/json', ...headers },
      body: raw ? body : JSON.stringify(body) })
  }
  function banco({ atual = peixe, atualizado = atual, erroEtapa, erroLeitura, erro } = {}) {
    const chamadas = []
    let leituras = 0
    const client = { release: mock.fn(), async query(sql, params) {
      chamadas.push({ sql, params })
      if (erroEtapa && sql.includes(erroEtapa)) throw erro ?? new Error('Interno senha=segredo')
      if (sql.includes('FOR NO KEY UPDATE')) return { rows: atual ? [{ categoriaId: atual.categoriaId }] : [] }
      if (sql.includes('FOR SHARE')) return { rows: [{ id: atual.categoriaId, slug: atual.categoria }] }
      if (sql.startsWith('SELECT p.id')) {
        leituras++
        if (leituras === erroLeitura) throw new Error('Detalhe interno de consulta')
        return { rows: [leituras === 1 ? atual : atualizado] }
      }
      if (sql.startsWith('UPDATE produtos')) return { rows: [{ id: 42 }] }
      if (sql.startsWith('UPDATE ')) return { rows: [{ produto_id: 42 }] }
      return { rows: [] }
    } }
    const connect = mock.method(db, 'connect', async () => client)
    mock.method(db, 'query', async () => { throw new Error('Consulta fora da transação') })
    return { chamadas, client, connect }
  }

  for (const [descricao, papel, headers, status] of [
    ['sem sessão', 'admin', { Cookie: '' }, 401], ['sessão inválida', 'admin', { Cookie: 'sid=inventada' }, 401],
    ['cliente', 'cliente', { 'X-Role': 'admin' }, 403], ['sem Origin', 'admin', { Origin: '' }, 403],
    ['Origin incorreto', 'admin', { Origin: 'https://invalida.example' }, 403], ['Origin null', 'admin', { Origin: 'null' }, 403],
  ]) {
    it(`recusa ${descricao} antes de adquirir conexão`, async () => {
      autorizar(papel)
      const { connect } = banco()
      assert.equal((await editar({ preco: 1234 }, { headers })).status, status)
      assert.equal(connect.mock.callCount(), 0)
    })
  }

  it('edita preço em centavos, preserva omitidos e retorna o DTO após COMMIT', async () => {
    autorizar()
    const esperado = { ...peixe, preco: 1234 }
    const { chamadas, client } = banco({ atualizado: esperado })
    const resposta = await editar({ preco: 1234 })
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), esperado)
    assert.equal(chamadas[0].sql, 'BEGIN')
    assert.match(chamadas[1].sql, /FOR NO KEY UPDATE$/)
    assert.match(chamadas[2].sql, /FOR SHARE$/)
    const escrita = chamadas.find((c) => c.sql.startsWith('UPDATE produtos'))
    assert.deepEqual(escrita.params, [42, 1234])
    assert.match(escrita.sql, /SET preco = \$2, atualizado_em = now\(\)/)
    for (const campo of ['nome =', 'estoque =', 'ativo =', 'categoria_id =', 'imagem_url =']) assert.equal(escrita.sql.includes(campo), false)
    assert.equal(chamadas.some((c) => c.sql.startsWith('UPDATE peixes')), false)
    assert.equal(chamadas.at(-1).sql, 'COMMIT')
    assert.equal(client.release.mock.callCount(), 1)
  })

  it('limpa somente campos anuláveis e envia textos como parâmetros', async () => {
    autorizar()
    const { chamadas } = banco()
    const resposta = await editar({ nome: " Betta d'água ", descricao: null, marca: null })
    assert.equal(resposta.status, 200)
    const escrita = chamadas.find((c) => c.sql.startsWith('UPDATE produtos'))
    assert.deepEqual(escrita.params, [42, "Betta d'água", null, null])
    assert.equal(escrita.sql.includes("d'água"), false)
  })

  for (const fixture of fichasCadastro) {
    it(`edita parcialmente ficha ${fixture.tipo}, sem regravar os omitidos`, async () => {
      autorizar()
      const atual = { ...peixe, categoria: fixture.tipo, ficha: { tipo: fixture.tipo, dados: { ...fixture.padroes, ...fixture.minimos, ...fixture.extras } } }
      const [campo, valor] = Object.entries(fixture.minimos)[0]
      const { chamadas } = banco({ atual })
      const resposta = await editar({ ficha: { dados: { [campo]: valor } } })
      assert.equal(resposta.status, 200)
      const escrita = chamadas.find((c) => c.sql.startsWith(`UPDATE ${fixture.tipo} `))
      assert.ok(escrita)
      assert.deepEqual(escrita.params, [42, valor])
      assert.equal(escrita.sql.split(' SET ')[1].split(' WHERE ')[0].trim().split(',').length, 1)
    })
  }

  for (const [descricao, body] of [
    ['corpo vazio', {}], ['array', []], ['ficha nula', { ficha: null }], ['ficha vazia', { ficha: {} }],
    ['dados vazios', { ficha: { dados: {} } }], ['dados nulos', { ficha: { dados: null } }],
    ['dados array', { ficha: { dados: [] } }], ['categoria até igual', { categoriaId: 1 }],
    ['ID', { id: 42 }], ['estoque zero', { estoque: 0 }], ['estoque positivo', { estoque: 1 }],
    ['ativo', { ativo: true }], ['imagem', { imagemUrl: null }], ['papel', { papel: 'admin' }],
    ['campo desconhecido', { surpresa: 'x' }], ['data interna', { atualizadoEm: '2026-10-26' }],
    ['tipo de ficha até igual', { ficha: { tipo: 'peixes', dados: { origem: 'Brasil' } } }],
    ['tipo incompatível', { ficha: { tipo: 'aquarios', dados: { volumeLitros: 40 } } }],
  ]) {
    it(`recusa ${descricao} antes da transação`, async () => {
      autorizar()
      const { connect } = banco()
      const resposta = await editar(body)
      assert.equal(resposta.status, 400)
      assert.equal((await resposta.json()).erro, 'Dados inválidos')
      assert.equal(connect.mock.callCount(), 0)
    })
  }

  for (const body of [{ nome: null }, { nome: '' }, { nome: 'x'.repeat(151) }, { marca: 'x'.repeat(81) },
    { preco: null }, { preco: '2500' }, { preco: 25.5 }, { preco: -1 }, { preco: 2147483648 },
    { ficha: { dados: { phMin: 8 } } }, { ficha: { dados: { tempMaxC: 24 } } },
    { ficha: { dados: { nomeCientifico: null } } }, { ficha: { dados: { tipoAgua: 'ambos' } } },
    { ficha: { dados: { cardumeMinimo: null } } }, { ficha: { dados: { produtoId: 9 } } },
    { ficha: { dados: { estoque: 99 } } }]) {
    it(`valida estado final: ${JSON.stringify(body)}`, async () => {
      autorizar()
      const { chamadas } = banco()
      assert.equal((await editar(body)).status, 400)
      assert.equal(chamadas.some((c) => c.sql.startsWith('UPDATE')), false)
      assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
    })
  }

  it('rejeita chaves de protótipo sem alterar objetos ou executar SQL de escrita', async () => {
    autorizar()
    const { chamadas } = banco()
    const resposta = await editar('{"ficha":{"dados":{"__proto__":{"poluido":true}}}}', { raw: true })
    assert.equal(resposta.status, 400)
    assert.equal(typeof (await resposta.json()).detalhes['ficha.dados.__proto__'], 'string')
    assert.equal({}.poluido, undefined)
    assert.equal(chamadas.some((c) => c.sql.startsWith('UPDATE')), false)
  })

  it('produto sem ficha especializada exige preenchimento completo, sem inventar dados', async () => {
    autorizar()
    const { chamadas } = banco({ atual: { ...peixe, ficha: null } })
    const resposta = await editar({ nome: 'Outro nome' })
    assert.equal(resposta.status, 400)
    assert.equal(typeof (await resposta.json()).detalhes.ficha, 'string')
    assert.equal(chamadas.some((c) => c.sql.startsWith('UPDATE')), false)
  })

  it('categoria sem tabela não aceita ficha', async () => {
    autorizar()
    banco({ atual: { ...peixe, categoria: 'acessorios', ficha: null } })
    assert.equal((await editar({ ficha: { dados: { nomeCientifico: 'Tentativa' } } })).status, 400)
  })

  it('inexistente ou inativo retorna 404 sem tentar editar', async () => {
    autorizar()
    const { chamadas } = banco({ atual: null })
    const resposta = await editar({ preco: 100 })
    assert.equal(resposta.status, 404)
    assert.deepEqual(await resposta.json(), { erro: 'Produto não encontrado' })
    assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
  })

  for (const id of ['0', '-1', '1.5', '01', '2147483648', 'betta', '1 OR true']) {
    it(`recusa ID ${id} antes de conectar`, async () => {
      autorizar()
      const { connect } = banco()
      assert.equal((await editar({ preco: 100 }, { id: encodeURIComponent(id) })).status, 400)
      assert.equal(connect.mock.callCount(), 0)
    })
  }

  it('duplica nome científico: 409 com rollback', async () => {
    autorizar()
    const { chamadas } = banco({ erroEtapa: 'UPDATE peixes', erro: Object.assign(new Error('Detalhe PostgreSQL'),
      { code: '23505', constraint: 'peixes_nome_cientifico_key' }) })
    const resposta = await editar({ preco: 5000, ficha: { dados: { nomeCientifico: 'Duplicado' } } })
    assert.equal(resposta.status, 409)
    assert.equal(typeof (await resposta.json()).detalhes['ficha.dados.nomeCientifico'], 'string')
    assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
  })

  for (const erroEtapa of ['BEGIN', 'FOR NO KEY UPDATE', 'FOR SHARE', 'UPDATE produtos', 'UPDATE peixes', 'COMMIT']) {
    it(`falha em ${erroEtapa} não retorna dados internos e desfaz a edição`, async () => {
      autorizar()
      mock.method(console, 'error', () => {})
      const { chamadas, client } = banco({ erroEtapa })
      const resposta = await editar({ preco: 5000, ficha: { dados: { origem: 'Brasil' } } })
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
      assert.equal(client.release.mock.callCount(), 1)
    })
  }
  for (const erroLeitura of [1, 2]) {
    it(`falha na leitura ${erroLeitura} provoca rollback`, async () => {
      autorizar()
      mock.method(console, 'error', () => {})
      const { chamadas } = banco({ erroLeitura })
      assert.equal((await editar({ preco: 5000 })).status, 500)
      assert.equal(chamadas.at(-1).sql, 'ROLLBACK')
    })
  }

  it('falha na sessão não adquire conexão nem libera escrita', async () => {
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => { throw new Error('Banco secreto') })
    mock.method(console, 'error', () => {})
    const { connect } = banco()
    assert.equal((await editar({ preco: 100 })).status, 500)
    assert.equal(connect.mock.callCount(), 0)
  })

  it('JSON malformado e corpo nulo preservam o erro 400 do parser', async () => {
    const { connect } = banco()
    for (const body of ['{', 'null']) {
      const resposta = await editar(body, { raw: true })
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), { erro: 'JSON inválido' })
    }
    assert.equal(connect.mock.callCount(), 0)
  })

  it('payload acima de 100 KiB retorna 413 sem consultar sessão/banco ou logar o corpo', async () => {
    const { connect } = banco()
    const sessao = autorizar()
    const log = mock.method(console, 'error', () => {})
    const resposta = await editar({ descricao: 'x'.repeat(103000) })
    assert.equal(resposta.status, 413)
    assert.deepEqual(await resposta.json(), { erro: 'Corpo da requisição excede o limite de 100 KiB' })
    assert.equal(connect.mock.callCount(), 0)
    assert.equal(sessao.mock.callCount(), 0)
    assert.equal(log.mock.callCount(), 0)
  })

  for (const caminho of ['/api/produtos/42', '/api/produtos', '/api/auth/login']) {
    it(`rejeita JSON comprimido antes da descompressão em ${caminho}`, async () => {
      const { connect } = banco()
      const resposta = await fetch(`${origem}${caminho}`, { method: caminho.endsWith('/42') ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, body: gzipSync('{"preco":100}') })
      assert.equal(resposta.status, 415)
      assert.deepEqual(await resposta.json(), { erro: 'Codificação de corpo não suportada. Envie JSON sem compressão.' })
      assert.equal(connect.mock.callCount(), 0)
    })
  }
})
