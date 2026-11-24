import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// Avaliações de produto e do site com o SQL real (36_avaliacoes.sql): criação pública, moderação no painel e o
// que o site mostra antes e depois de aprovar. Schema próprio e descartável, como os outros testes de integração.
const urlTeste = process.env.TEST_DATABASE_URL
describe('Avaliações — HTTP com PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para verificar as avaliações no PostgreSQL.',
}, () => {
  const schema = `teste_avaliacoes_${randomUUID().replaceAll('-', '')}`
  const tokens = new Map()
  let cliente, pool, servidor, origem, origemCors, schemaCriado = false
  let produtoId, peixeId, inativoId

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '36_avaliacoes.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    // Idempotente: aplicar de novo (a migração de um banco que já existe) não falha
    await cliente.query(await readFile(new URL('../../db/init/36_avaliacoes.sql', import.meta.url), 'utf8'))

    // O 01_catalogo.sql já cadastra as categorias
    const { rows: cats } = await cliente.query(`SELECT id FROM categorias WHERE slug IN ('filtros', 'peixes') ORDER BY slug`)
    const { rows: prods } = await cliente.query(
      `INSERT INTO produtos (categoria_id, nome, preco, ativo) VALUES ($1, 'Filtro Teste', 1000, true), ($2, 'Peixe Teste', 500, true),
         ($1, 'Produto Inativo', 100, false) RETURNING id`, [cats[0].id, cats[1].id])
    ;[produtoId, peixeId, inativoId] = prods.map((p) => p.id)

    for (const [chave, papel] of [['admin', 'admin'], ['cliente', 'cliente']]) {
      const { rows } = await cliente.query('INSERT INTO clientes (nome,email,senha_hash,papel,ativo) VALUES ($1,$2,$3,$4,true) RETURNING id',
        [chave, `${chave}@teste.example`, 'hash-fixture-sem-login', papel])
      const token = randomUUID(); tokens.set(chave, token)
      await cliente.query(`INSERT INTO sessoes (token_hash,cliente_id,expira_em) VALUES ($1,$2,now()+'1 hour'::interval)`, [hashToken(token), rows[0].id])
    }

    const urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlAplicacao.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    origemCors = (await import('../../src/config/env.ts')).env.corsOrigin
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
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

  function pedir(method, caminho, { corpo, sessao, semOrigem = false } = {}) {
    const headers = {}
    if (corpo !== undefined) headers['Content-Type'] = 'application/json'
    if (!semOrigem && method !== 'GET') headers.Origin = origemCors
    if (sessao) headers.Cookie = `sid=${tokens.get(sessao)}`
    return fetch(`${origem}/api${caminho}`, { method, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) })
  }

  let avaliacaoId, siteId

  it('cria avaliação de produto como pendente, com HTML removido, e ela não aparece no site', async () => {
    const r = await pedir('POST', `/produtos/${produtoId}/avaliacoes`, {
      corpo: { nota: 5, nome: '  Ana <b>Maria</b> ', comentario: 'Ótimo <script>alert(1)</script>filtro', status: 'aprovada', produtoId: 999 },
    })
    assert.equal(r.status, 201)
    const corpo = await r.json()
    assert.deepEqual(Object.keys(corpo).sort(), ['comentario', 'criadaEm', 'id', 'nome', 'nota', 'status'])
    assert.equal(corpo.status, 'pendente')
    assert.equal(corpo.nome, 'Ana Maria')
    assert.equal(corpo.comentario.includes('<'), false)
    avaliacaoId = corpo.id

    const lista = await (await pedir('GET', `/produtos/${produtoId}/avaliacoes`)).json()
    assert.deepEqual(lista, { itens: [], resumo: { total: 0, media: 0, distribuicao: [5, 4, 3, 2, 1].map((nota) => ({ nota, qtd: 0 })) } })
  })

  it('recusa nota inválida, texto longo, produto inativo e pedido de outra origem', async () => {
    for (const nota of [0, 6, 3.5, '5', null]) {
      const r = await pedir('POST', `/produtos/${produtoId}/avaliacoes`, { corpo: { nota } })
      assert.equal(r.status, 422)
    }
    assert.equal((await pedir('POST', `/produtos/${produtoId}/avaliacoes`, { corpo: { nota: 4, comentario: 'x'.repeat(501) } })).status, 422)
    assert.equal((await pedir('POST', `/produtos/${inativoId}/avaliacoes`, { corpo: { nota: 4 } })).status, 404)
    assert.equal((await pedir('GET', `/produtos/${inativoId}/avaliacoes`)).status, 404)
    assert.equal((await pedir('POST', `/produtos/${produtoId}/avaliacoes`, { corpo: { nota: 4 }, semOrigem: true })).status, 403)
  })

  it('cria avaliação do site como pendente e ignora opções fora da lista', async () => {
    const r = await pedir('POST', '/avaliacoes-site', {
      corpo: { nota: 4, motivo: 'comprar', encontrou: 'inventado', comentario: 'Gostei', origem: 'rodape', pagina: '/loja?x=<a>' },
    })
    assert.equal(r.status, 201)
    const corpo = await r.json()
    assert.equal(corpo.status, 'pendente'); siteId = corpo.id
    const resumo = await (await pedir('GET', '/avaliacoes-site')).json()
    assert.equal(resumo.total, 0); assert.deepEqual(resumo.comentarios, [])
  })

  it('visitante e cliente não acessam o painel', async () => {
    assert.equal((await pedir('GET', '/avaliacoes/resumo')).status, 401)
    assert.equal((await pedir('GET', '/avaliacoes/produtos', { sessao: 'cliente' })).status, 403)
    assert.equal((await pedir('PATCH', `/avaliacoes/produtos/${avaliacaoId}`, { sessao: 'cliente', corpo: { status: 'aprovada' } })).status, 403)
    assert.equal((await pedir('DELETE', `/avaliacoes/site/${siteId}`, { sessao: 'cliente' })).status, 403)
  })

  it('admin vê o resumo e a fila com nome e categoria do produto', async () => {
    const resumo = await (await pedir('GET', '/avaliacoes/resumo', { sessao: 'admin' })).json()
    assert.equal(resumo.pendentes, 2)
    assert.equal(resumo.site.media, 4)
    const r = await pedir('GET', '/avaliacoes/produtos?status=pendente', { sessao: 'admin' })
    assert.equal(r.headers.get('cache-control'), 'no-store')
    const { dados, total } = await r.json()
    assert.equal(total, 1)
    assert.equal(dados[0].produtoNome, 'Filtro Teste'); assert.equal(dados[0].produtoCategoria, 'filtros')
    const site = await (await pedir('GET', '/avaliacoes/site?nota=4', { sessao: 'admin' })).json()
    assert.equal(site.dados[0].encontrou, null); assert.equal(site.dados[0].pagina, null); assert.equal(site.dados[0].origem, 'rodape')
    assert.equal((await pedir('GET', '/avaliacoes/site?status=qualquer', { sessao: 'admin' })).status, 400)
  })

  it('PATCH sem Origin é recusado antes da sessão', async () => {
    assert.equal((await pedir('PATCH', `/avaliacoes/produtos/${avaliacaoId}`, { sessao: 'admin', corpo: { status: 'aprovada' }, semOrigem: true })).status, 403)
  })

  it('aprovada aparece no site com média e distribuição; oculta some de novo', async () => {
    const r = await pedir('PATCH', `/avaliacoes/produtos/${avaliacaoId}`, { sessao: 'admin', corpo: { status: 'aprovada' } })
    assert.equal(r.status, 200); assert.equal((await r.json()).status, 'aprovada')
    let lista = await (await pedir('GET', `/produtos/${produtoId}/avaliacoes`)).json()
    assert.equal(lista.itens.length, 1)
    assert.deepEqual(Object.keys(lista.itens[0]).sort(), ['comentario', 'criadaEm', 'id', 'nome', 'nota'])
    assert.equal(lista.resumo.media, 5); assert.equal(lista.resumo.distribuicao[0].qtd, 1)
    // A avaliação de um produto não aparece em outro (peixe é produto: mesma tabela)
    assert.equal((await (await pedir('GET', `/produtos/${peixeId}/avaliacoes`)).json()).itens.length, 0)

    await pedir('PATCH', `/avaliacoes/site/${siteId}`, { sessao: 'admin', corpo: { status: 'aprovada' } })
    const site = await (await pedir('GET', '/avaliacoes-site')).json()
    assert.equal(site.total, 1); assert.equal(site.media, 4)
    assert.equal(site.motivos.find((m) => m.valor === 'comprar').qtd, 1)
    assert.equal(site.comentarios[0].comentario, 'Gostei')

    await pedir('PATCH', `/avaliacoes/produtos/${avaliacaoId}`, { sessao: 'admin', corpo: { status: 'oculta' } })
    lista = await (await pedir('GET', `/produtos/${produtoId}/avaliacoes`)).json()
    assert.equal(lista.itens.length, 0)
    assert.equal((await pedir('PATCH', `/avaliacoes/produtos/${avaliacaoId}`, { sessao: 'admin', corpo: { status: 'publicada' } })).status, 422)
  })

  it('excluir apaga de vez; excluir de novo é 404', async () => {
    assert.equal((await pedir('DELETE', `/avaliacoes/produtos/${avaliacaoId}`, { sessao: 'admin' })).status, 204)
    assert.equal((await pedir('DELETE', `/avaliacoes/produtos/${avaliacaoId}`, { sessao: 'admin' })).status, 404)
    const { rows } = await cliente.query('SELECT count(*)::int AS n FROM avaliacoes_produto')
    assert.equal(rows[0].n, 0)
  })

  it('o limite por IP barra o excesso de envios', async () => {
    // Até aqui foram 4 envios aceitos pelo limite (2 com 201, nota inválida e texto longo contam também)
    let ultima
    for (let i = 0; i < 12; i++) ultima = await pedir('POST', '/avaliacoes-site', { corpo: { nota: 3 } })
    assert.equal(ultima.status, 429)
  })
})
