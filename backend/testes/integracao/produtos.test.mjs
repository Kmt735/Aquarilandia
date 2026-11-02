import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import pg from 'pg'

const urlTeste = process.env.TEST_DATABASE_URL

describe('GET /api/produtos — PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_produtos_${randomUUID().replaceAll('-', '')}`
  const produtos = new Map()
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

    const fixtures = [
      ['aquario', 'aquarios', 'Aquario 40L', 'Kit completo', 'Aqua', 24990, 3, true],
      ['filtroA', 'filtros', 'Filtro externo', 'Compacto silencioso', 'Aqua', 8990, 2, true],
      ['filtroB', 'filtros', 'Filtro externo', 'Compacto', 'OceanTech', 8990, 0, true],
      ['premium', 'filtros', 'Filtro premium', 'Canister compacto', 'Aqua', 18900, 1, true],
      ['inativo', 'filtros', 'Filtro secreto', 'Compacto silencioso', 'Aqua', 1, 99, false],
      ['planta', 'plantas', 'Anubias', 'Planta', null, 2490, 10, true],
      ['peixe', 'peixes', 'Betta', null, null, 2000, 2, true],
      ['literal', 'acessorios', 'Kit 100%_!', null, null, 0, 0, true],
      ['similar', 'acessorios', 'Kit 100ABCX!', null, null, 100, 1, true],
      ['apostrofo', 'acessorios', "D'água", null, null, 250, 1, true],
      ['maximo', 'acessorios', 'Produto maximo', null, null, 2147483647, 1, true],
    ]
    for (const [chave, categoria, nome, descricao, marca, preco, estoque, ativo] of fixtures) {
      const { rows } = await cliente.query(
        `INSERT INTO produtos (categoria_id, nome, descricao, marca, preco, estoque, ativo, imagem_url)
         VALUES ((SELECT id FROM categorias WHERE slug = $1), $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, categoria_id AS "categoriaId"`,
        [categoria, nome, descricao, marca, preco, estoque, ativo,
          chave === 'filtroA' ? '/imagens/filtro-externo.jpg' : null],
      )
      produtos.set(chave, { ...rows[0], nome, descricao, marca, preco, ativo })
    }

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
          // Remove também todos os produtos de teste, mesmo se algum caso falhar.
          if (schemaCriado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`)
        } finally {
          await cliente.end()
        }
      }
    }
  })

  async function listar(query = {}) {
    const resposta = await fetch(`${origem}/api/produtos?${new URLSearchParams(query)}`)
    assert.equal(resposta.status, 200)
    return resposta.json()
  }

  it('consulta os produtos inseridos, retorna o DTO e preserva centavos inteiros e campos nulos', async () => {
    const corpo = await listar()
    assert.deepEqual(Object.keys(corpo).sort(), ['itens', 'total'])
    assert.equal(corpo.total, 10)
    assert.equal(corpo.itens.length, 10)
    const filtro = produtos.get('filtroA')
    assert.deepEqual(corpo.itens.find((p) => p.id === filtro.id), {
      id: filtro.id, categoriaId: filtro.categoriaId, categoria: 'filtros', nome: 'Filtro externo',
      descricao: 'Compacto silencioso', marca: 'Aqua', preco: 8990,
      imagemUrl: '/imagens/filtro-externo.jpg', emEstoque: true,
    })
    const planta = corpo.itens.find((p) => p.id === produtos.get('planta').id)
    assert.equal(planta.marca, null)
    assert.equal(planta.imagemUrl, null)
    assert.equal(planta.preco, 2490)
    for (const produto of corpo.itens) {
      assert.equal(Number.isInteger(produto.preco), true)
      assert.equal(typeof produto.id, 'number')
      assert.deepEqual(Object.keys(produto).sort(),
        ['categoria', 'categoriaId', 'descricao', 'emEstoque', 'id', 'imagemUrl', 'marca', 'nome', 'preco'])
    }
  })

  it('omite inativos dos itens e do total mesmo quando correspondem aos filtros', async () => {
    const corpo = await listar({ categoria: 'filtros' })
    assert.equal(corpo.total, 3)
    assert.equal(corpo.itens.length, 3)
    assert.equal(corpo.itens.some((p) => p.id === produtos.get('inativo').id), false)
    assert.deepEqual(await listar({ busca: 'secreto' }), { itens: [], total: 0 })
  })

  it('combina categoria, busca e preços inclusivos antes da paginação e do total', async () => {
    const corpo = await listar({
      categoria: 'filtros', busca: 'COMPACTO', preco_min: '8990', preco_max: '8990',
      ordem: 'preco', pagina: '2', limite: '1',
    })
    assert.equal(corpo.total, 2)
    assert.equal(corpo.itens.length, 1)
    assert.equal(corpo.itens[0].id, produtos.get('filtroB').id)
    assert.equal(corpo.itens[0].emEstoque, false)
  })

  it('pagina o catálogo inteiro sem repetições ou omissões', async () => {
    const itens = []
    for (let pagina = 1; pagina <= 4; pagina++) {
      const corpo = await listar({ pagina: String(pagina), limite: '3' })
      assert.equal(corpo.total, 10)
      assert.equal(corpo.itens.length, pagina === 4 ? 1 : 3)
      itens.push(...corpo.itens)
    }
    assert.deepEqual(itens, (await listar()).itens)
    assert.equal(new Set(itens.map((p) => p.id)).size, 10)
  })

  for (const [ordem, chaves] of [
    ['nome', ['filtroA', 'filtroB', 'premium']],
    ['preco', ['filtroA', 'filtroB', 'premium']],
    ['-preco', ['premium', 'filtroA', 'filtroB']],
  ]) {
    it(`ordena por ${ordem} com desempate por id entre páginas`, async () => {
      const ids = []
      for (let pagina = 1; pagina <= 3; pagina++) {
        const corpo = await listar({ categoria: 'filtros', ordem, pagina: String(pagina), limite: '1' })
        assert.equal(corpo.total, 3)
        assert.equal(corpo.itens.length, 1)
        ids.push(corpo.itens[0].id)
      }
      assert.deepEqual(ids, chaves.map((chave) => produtos.get(chave).id))
      const primeira = await listar({ categoria: 'filtros', ordem, limite: '1' })
      assert.equal(primeira.itens[0].id, ids[0])
    })
  }

  it('busca sem diferenciar caixa no nome, na descrição e na marca', async () => {
    for (const [busca, chaves] of [
      ['EXTERNO', ['filtroA', 'filtroB']],
      ['SILENCIOSO', ['filtroA']],
      ['oceantech', ['filtroB']],
    ]) {
      const corpo = await listar({ busca })
      assert.equal(corpo.total, chaves.length)
      assert.deepEqual(corpo.itens.map((p) => p.id), chaves.map((chave) => produtos.get(chave).id))
    }
  })

  it('trata %, _ e o caractere de escape como texto literal', async () => {
    for (const busca of ['%', '_', '100%_!']) {
      const corpo = await listar({ busca })
      assert.equal(corpo.total, 1)
      assert.equal(corpo.itens[0].id, produtos.get('literal').id)
    }
  })

  it('parametriza apóstrofos e não interpreta busca como SQL', async () => {
    const corpo = await listar({ busca: "d'água" })
    assert.equal(corpo.total, 1)
    assert.equal(corpo.itens[0].id, produtos.get('apostrofo').id)
    assert.deepEqual(await listar({ busca: "%' OR true --" }), { itens: [], total: 0 })
    assert.equal((await listar()).total, 10)
  })

  it('aceita preço zero e o limite do tipo INTEGER sem converter a unidade', async () => {
    for (const [preco, chave] of [['0', 'literal'], ['2147483647', 'maximo']]) {
      const corpo = await listar({ preco_min: preco, preco_max: preco })
      assert.equal(corpo.total, 1)
      assert.equal(corpo.itens[0].id, produtos.get(chave).id)
      assert.equal(corpo.itens[0].preco, Number(preco))
    }
    assert.equal((await listar({ preco_max: '0' })).total, 1)
    assert.equal((await listar({ preco_min: '2147483647' })).total, 1)
  })

  it('mantém o total filtrado quando a página está além do fim', async () => {
    assert.deepEqual(await listar({ categoria: 'filtros', pagina: '99', limite: '2' }), { itens: [], total: 3 })
  })

  it('retorna vazio para categoria inexistente ou combinação sem resultados', async () => {
    assert.deepEqual(await listar({ categoria: 'inexistente' }), { itens: [], total: 0 })
    assert.deepEqual(await listar({ categoria: 'plantas', busca: 'filtro' }), { itens: [], total: 0 })
  })

  it('permite filtrar a categoria peixes sem implementar fichas técnicas', async () => {
    const corpo = await listar({ categoria: 'peixes' })
    assert.equal(corpo.total, 1)
    assert.equal(corpo.itens[0].id, produtos.get('peixe').id)
    assert.equal(corpo.itens[0].preco, 2000)
  })

  it('mantém inativos ocultos com false e rejeita true ou filtros inválidos com 400', async () => {
    assert.equal((await listar({ incluir_inativos: 'false' })).total, 10)
    for (const query of ['preco_min=10&preco_max=9', 'ordem=nome;DROP%20TABLE%20produtos']) {
      const resposta = await fetch(`${origem}/api/produtos?${query}`)
      assert.equal(resposta.status, 400)
      assert.equal((await resposta.json()).erro, 'Parâmetros inválidos')
    }
    assert.equal((await listar()).total, 10)
  })

  it('preserva categorias e mantém os campos básicos do detalhe iguais aos da listagem', async () => {
    const categorias = await fetch(`${origem}/api/categorias`)
    assert.equal(categorias.status, 200)
    assert.equal((await categorias.json()).total, 12)
    const id = produtos.get('aquario').id
    const produto = await fetch(`${origem}/api/produtos/${id}`)
    assert.equal(produto.status, 200)
    const { ficha, ...basicos } = await produto.json()
    assert.equal(ficha, null)
    assert.deepEqual(basicos, (await listar()).itens.find((item) => item.id === id))
  })

  it('trata falha real da consulta sem expor mensagens do PostgreSQL', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE produtos RENAME TO produtos_indisponiveis')
    try {
      const resposta = await fetch(`${origem}/api/produtos`)
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    } finally {
      await cliente.query('ALTER TABLE produtos_indisponiveis RENAME TO produtos')
      log.mock.restore()
    }
  })

  it('retorna itens vazios e total zero sem produtos', async () => {
    await cliente.query('DELETE FROM produtos')
    assert.deepEqual(await listar(), { itens: [], total: 0 })
  })
})
