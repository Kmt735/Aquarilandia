import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import pg from 'pg'

const urlTeste = process.env.TEST_DATABASE_URL

describe('GET /api/categorias — PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_categorias_${randomUUID().replaceAll('-', '')}`
  let cliente
  let pool
  let servidor
  let origem
  let schemaCriado = false

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    await cliente.query(await readFile(new URL('../../db/init/01_catalogo.sql', import.meta.url), 'utf8'))

    // Cada execução usa um schema próprio; a aplicação nunca acessa as tabelas do ambiente.
    const urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlAplicacao.toString()
    const { app } = await import('../../src/app.ts')
    const { db } = await import('../../src/config/db.ts')
    pool = db
    servidor = app.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })

  after(async () => {
    try {
      if (servidor) await new Promise((resolve) => servidor.close(resolve))
      if (pool) await pool.end()
    } finally {
      if (cliente) {
        try {
          if (schemaCriado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`)
        } finally {
          await cliente.end()
        }
      }
    }
  })

  it('consulta as 12 categorias do init, incluindo peixes, com DTO e ordem determinísticos', async () => {
    const resposta = await fetch(`${origem}/api/categorias`)
    const corpo = await resposta.json()

    assert.equal(resposta.status, 200)
    assert.deepEqual(Object.keys(corpo).sort(), ['itens', 'total'])
    assert.equal(corpo.total, 12)
    assert.equal(corpo.itens.length, 12)
    assert.deepEqual(corpo.itens[0], { id: 1, nome: 'Peixes', slug: 'peixes' })
    assert.deepEqual(corpo.itens.map((categoria) => categoria.id), Array.from({ length: 12 }, (_, i) => i + 1))
    for (const categoria of corpo.itens) {
      assert.deepEqual(Object.keys(categoria).sort(), ['id', 'nome', 'slug'])
      assert.equal(typeof categoria.id, 'number')
    }
    assert.deepEqual(await (await fetch(`${origem}/api/categorias`)).json(), corpo)
  })

  it('pagina sem repetição e mantém o total independente do tamanho da página', async () => {
    const paginas = []
    for (const pagina of [1, 2, 3]) {
      const resposta = await fetch(`${origem}/api/categorias?pagina=${pagina}&limite=5`)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 200)
      assert.equal(corpo.total, 12)
      assert.equal(corpo.itens.length, pagina === 3 ? 2 : 5)
      paginas.push(...corpo.itens)
    }
    assert.deepEqual(paginas.map((categoria) => categoria.id), Array.from({ length: 12 }, (_, i) => i + 1))
  })

  it('retorna página vazia sem perder o total', async () => {
    const resposta = await fetch(`${origem}/api/categorias?pagina=20&limite=5`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { itens: [], total: 12 })
  })

  it('reflete uma categoria inserida diretamente no PostgreSQL', async () => {
    const { rows } = await cliente.query(
      'INSERT INTO categorias (nome, slug) VALUES ($1, $2) RETURNING id, nome, slug',
      ['Categoria de integração', 'categoria-integracao'],
    )
    try {
      const resposta = await fetch(`${origem}/api/categorias?limite=100`)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 200)
      assert.equal(corpo.total, 13)
      assert.deepEqual(corpo.itens.at(-1), rows[0])
    } finally {
      await cliente.query('DELETE FROM categorias WHERE id = $1', [rows[0].id])
    }
  })

  it('recusa parâmetros inválidos com 400', async () => {
    const resposta = await fetch(`${origem}/api/categorias?pagina=0&limite=101`)
    const corpo = await resposta.json()
    assert.equal(resposta.status, 400)
    assert.deepEqual(Object.keys(corpo.detalhes).sort(), ['limite', 'pagina'])
  })

  it('trata erro real de consulta sem expor o erro do PostgreSQL', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE categorias RENAME TO categorias_indisponiveis')
    try {
      const resposta = await fetch(`${origem}/api/categorias`)
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    } finally {
      await cliente.query('ALTER TABLE categorias_indisponiveis RENAME TO categorias')
      log.mock.restore()
    }
  })

  it('retorna itens vazios e total zero quando não há categorias', async () => {
    await cliente.query('DELETE FROM categorias')
    const resposta = await fetch(`${origem}/api/categorias`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { itens: [], total: 0 })
  })
})
