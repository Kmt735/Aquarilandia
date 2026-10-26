import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const urlTeste = process.env.TEST_DATABASE_URL

describe('Categorias — CRUD com sessão e PostgreSQL reais', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_categorias_admin_${randomUUID().replaceAll('-', '')}`
  const tokens = new Map()
  const usuarios = new Map()
  let cliente
  let pool
  let servidor
  let origem
  let origemCors
  let urlAplicacao
  let schemaCriado = false
  let peixeId

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    for (const [chave, papel, ativo, validade] of [
      ['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'],
      ['expirado', 'admin', true, '-1 hour'], ['inativo', 'admin', false, '1 hour'],
      ['rebaixado', 'admin', true, '1 hour'], ['revogado', 'admin', true, '1 hour'],
    ]) {
      const { rows } = await cliente.query(
        'INSERT INTO clientes (nome, email, senha_hash, papel, ativo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [chave, `${chave}@teste.example`, 'hash-ficticio-nao-usado-no-login', papel, ativo],
      )
      usuarios.set(chave, rows[0].id)
      const token = randomUUID()
      tokens.set(chave, token)
      await cliente.query(
        "INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + $3::interval)",
        [hashToken(token), rows[0].id, validade],
      )
    }
    const { rows } = await cliente.query(
      `INSERT INTO produtos (categoria_id, nome, preco, estoque)
       VALUES ((SELECT id FROM categorias WHERE slug = 'peixes'), 'Betta', 2000, 2) RETURNING id`,
    )
    peixeId = rows[0].id
    await cliente.query(
      `INSERT INTO peixes (produto_id, nome_cientifico, tipo_agua, tamanho_adulto_cm, temp_min_c,
                           temp_max_c, ph_min, ph_max, aquario_min_litros, temperamento, dificuldade)
       VALUES ($1, 'Betta splendens', 'doce', 6.5, 24.5, 28.5, 6, 7.5, 20, 'semi_agressivo', 'iniciante')`,
      [peixeId],
    )
    urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    urlAplicacao.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlAplicacao.toString()
    const { app } = await import('../../src/app.ts')
    const { db } = await import('../../src/config/db.ts')
    const { env } = await import('../../src/config/env.ts')
    pool = db
    origemCors = env.corsOrigin
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

  function escrever(method, caminho, body, sessao = 'admin', origin = origemCors) {
    const headers = { 'Content-Type': 'application/json' }
    if (origin) headers.Origin = origin
    if (sessao !== null) headers.Cookie = `sid=${tokens.get(sessao) ?? sessao}`
    return fetch(`${origem}${caminho}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  async function criar(nome, slug) {
    const resposta = await escrever('POST', '/api/categorias', { nome, slug })
    assert.equal(resposta.status, 201)
    return resposta.json()
  }
  async function lista() {
    const resposta = await fetch(`${origem}/api/categorias?limite=100`)
    assert.equal(resposta.status, 200)
    return resposta.json()
  }

  it('mantém lista e detalhe públicos sem sessão', async () => {
    const corpo = await lista()
    assert.equal(corpo.total, 12)
    const peixe = corpo.itens.find((c) => c.slug === 'peixes')
    const resposta = await fetch(`${origem}/api/categorias/${peixe.id}`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), peixe)
  })

  const escritas = [
    ['POST', '/api/categorias', { nome: 'Sem permissão', slug: 'sem-permissao' }],
    ['PATCH', '/api/categorias/1', { nome: 'Sem permissão' }],
    ['DELETE', '/api/categorias/1', undefined],
  ]
  for (const [method, caminho, body] of escritas) {
    it(`${method} retorna 401 sem sessão, com token inventado, vencido ou usuário inativo`, async () => {
      for (const sessao of [null, 'inventada', 'expirado', 'inativo']) {
        const resposta = await escrever(method, caminho, body, sessao)
        assert.equal(resposta.status, 401)
        assert.deepEqual(await resposta.json(), { erro: 'Faça login para continuar.' })
      }
    })

    it(`${method} retorna 403 para cliente autenticado, sem aceitar papel fornecido pelo cliente`, async () => {
      const resposta = await escrever(method, `${caminho}?papel=admin`, body, 'cliente')
      assert.equal(resposta.status, 403)
      assert.deepEqual(await resposta.json(), { erro: 'Acesso permitido somente para administradores.' })
    })

    it(`${method} exige Origin configurado mesmo para sessão admin válida`, async () => {
      for (const origin of [null, 'https://origem-invalida.example']) {
        const resposta = await escrever(method, caminho, body, 'admin', origin)
        assert.equal(resposta.status, 403)
        assert.deepEqual(await resposta.json(), { erro: 'Origem da requisição não permitida.' })
      }
    })
  }

  it('consulta o papel atual e a existência da sessão no banco a cada escrita', async () => {
    await cliente.query("UPDATE clientes SET papel = 'cliente' WHERE id = $1", [usuarios.get('rebaixado')])
    assert.equal((await escrever('POST', '/api/categorias', { nome: 'Teste', slug: 'teste' }, 'rebaixado')).status, 403)
    await cliente.query('DELETE FROM sessoes WHERE cliente_id = $1', [usuarios.get('revogado')])
    assert.equal((await escrever('POST', '/api/categorias', { nome: 'Teste', slug: 'teste' }, 'revogado')).status, 401)
    assert.equal((await lista()).total, 12)
  })

  it('cria, edita parcialmente e exclui, refletindo cada alteração na listagem', async () => {
    const categoria = await criar(' Nova Categoria ', ' nova-categoria ')
    assert.equal(typeof categoria.id, 'number')
    assert.deepEqual(categoria, { id: categoria.id, nome: 'Nova Categoria', slug: 'nova-categoria' })
    assert.equal((await lista()).total, 13)
    assert.deepEqual((await lista()).itens.find((c) => c.id === categoria.id), categoria)
    let resposta = await escrever('PATCH', `/api/categorias/${categoria.id}`, { nome: ' Nome novo ' })
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { ...categoria, nome: 'Nome novo' })
    resposta = await escrever('PATCH', `/api/categorias/${categoria.id}`, { slug: ' slug-novo ' })
    assert.equal(resposta.status, 200)
    const atualizada = { id: categoria.id, nome: 'Nome novo', slug: 'slug-novo' }
    assert.deepEqual(await resposta.json(), atualizada)
    assert.deepEqual((await lista()).itens.find((c) => c.id === categoria.id), atualizada)
    assert.deepEqual(await (await fetch(`${origem}/api/categorias/${categoria.id}`)).json(), atualizada)
    resposta = await escrever('DELETE', `/api/categorias/${categoria.id}`)
    assert.equal(resposta.status, 204)
    assert.equal(await resposta.text(), '')
    assert.equal((await fetch(`${origem}/api/categorias/${categoria.id}`)).status, 404)
    assert.equal((await lista()).itens.some((c) => c.id === categoria.id), false)
    assert.equal((await lista()).total, 12)
  })

  it('aceita os limites reais de 80 caracteres no nome e slug', async () => {
    const categoria = await criar('N'.repeat(80), 's'.repeat(80))
    assert.equal(categoria.nome.length, 80)
    assert.equal(categoria.slug.length, 80)
    assert.equal((await escrever('DELETE', `/api/categorias/${categoria.id}`)).status, 204)
  })

  it('preserva slugs estruturais para não quebrar fichas, mas permite editar seus nomes', async () => {
    const categorias = (await lista()).itens.filter((categoria) => categoria.slug !== 'acessorios')
    for (const categoria of categorias) {
      const resposta = await escrever('PATCH', `/api/categorias/${categoria.id}`, { slug: `novo-${categoria.slug}` })
      assert.equal(resposta.status, 409)
      assert.equal(typeof (await resposta.json()).detalhes.slug, 'string')
      assert.deepEqual(await (await fetch(`${origem}/api/categorias/${categoria.id}`)).json(), categoria)
    }
    const peixe = categorias.find((categoria) => categoria.slug === 'peixes')
    const resposta = await escrever('PATCH', `/api/categorias/${peixe.id}`, { nome: 'Peixes ornamentais', slug: 'peixes' })
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { ...peixe, nome: 'Peixes ornamentais' })
    assert.equal((await escrever('PATCH', `/api/categorias/${peixe.id}`, { nome: peixe.nome })).status, 200)
  })

  for (const [body, campo] of [
    [{ nome: 'Peixes', slug: 'slug-unico' }, 'nome'],
    [{ nome: 'Nome único', slug: 'peixes' }, 'slug'],
  ]) {
    it(`retorna 409 por duplicidade de ${campo} na criação`, async () => {
      const resposta = await escrever('POST', '/api/categorias', body)
      assert.equal(resposta.status, 409)
      assert.equal(typeof (await resposta.json()).detalhes[campo], 'string')
      assert.equal((await lista()).total, 12)
    })
  }

  it('trata duplicidade na edição, preserva o registro e permite reenviar os próprios valores', async () => {
    const a = await criar('Categoria A', 'categoria-a')
    const b = await criar('Categoria B', 'categoria-b')
    for (const body of [{ nome: a.nome }, { slug: a.slug }]) {
      const resposta = await escrever('PATCH', `/api/categorias/${b.id}`, body)
      assert.equal(resposta.status, 409)
      assert.deepEqual(await (await fetch(`${origem}/api/categorias/${b.id}`)).json(), b)
    }
    const resposta = await escrever('PATCH', `/api/categorias/${a.id}`, { nome: a.nome, slug: a.slug })
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), a)
    for (const categoria of [a, b]) assert.equal((await escrever('DELETE', `/api/categorias/${categoria.id}`)).status, 204)
  })

  it('resolve duas criações simultâneas pela unicidade do banco', async () => {
    const respostas = await Promise.all([1, 2].map(() => escrever('POST', '/api/categorias', { nome: 'Concorrente', slug: 'concorrente' })))
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409])
    const categoria = await respostas.find((r) => r.status === 201).json()
    assert.equal((await escrever('DELETE', `/api/categorias/${categoria.id}`)).status, 204)
  })

  it('recusa dados e IDs inválidos sem alterar categorias', async () => {
    for (const body of [{}, { nome: 'A', slug: 'ok' }, { nome: 'Nome', slug: 'INVÁLIDO' },
      { nome: 'N'.repeat(81), slug: 'ok' }, { nome: 'Nome', slug: 's'.repeat(81) },
      { nome: 'Nome', slug: 'ok', papel: 'admin' }]) {
      assert.equal((await escrever('POST', '/api/categorias', body)).status, 400)
    }
    assert.equal((await escrever('PATCH', '/api/categorias/1', {})).status, 400)
    for (const id of ['0', '1.5', '2147483648', 'peixes']) {
      assert.equal((await fetch(`${origem}/api/categorias/${id}`)).status, 400)
      assert.equal((await escrever('PATCH', `/api/categorias/${id}`, { nome: 'Nome' })).status, 400)
      assert.equal((await escrever('DELETE', `/api/categorias/${id}`)).status, 400)
    }
    assert.equal((await lista()).total, 12)
  })

  it('retorna 404 nas operações por ID inexistente', async () => {
    assert.equal((await fetch(`${origem}/api/categorias/2147483647`)).status, 404)
    assert.equal((await escrever('PATCH', '/api/categorias/2147483647', { nome: 'Nome' })).status, 404)
    assert.equal((await escrever('DELETE', '/api/categorias/2147483647')).status, 404)
  })

  for (const ativo of [true, false]) {
    it(`bloqueia exclusão de categoria com produto ${ativo ? 'ativo' : 'inativo'}`, async () => {
      const categoria = await criar(`Categoria produto ${ativo}`, `categoria-produto-${ativo}`)
      await cliente.query('INSERT INTO produtos (categoria_id, nome, preco, ativo) VALUES ($1, $2, $3, $4)',
        [categoria.id, 'Produto vinculado', 100, ativo])
      const resposta = await escrever('DELETE', `/api/categorias/${categoria.id}`)
      assert.equal(resposta.status, 409)
      assert.deepEqual(await resposta.json(), { erro: 'Categoria possui produtos vinculados e não pode ser excluída.' })
      assert.deepEqual(await (await fetch(`${origem}/api/categorias/${categoria.id}`)).json(), categoria)
      await cliente.query('DELETE FROM produtos WHERE categoria_id = $1', [categoria.id])
      assert.equal((await escrever('DELETE', `/api/categorias/${categoria.id}`)).status, 204)
    })
  }

  it('a FK impede a exclusão quando um produto concorrente é confirmado durante o DELETE', async () => {
    const categoria = await criar('Categoria corrida', 'categoria-corrida')
    const concorrente = new pg.Client({ connectionString: urlAplicacao.toString() })
    let pendente
    await concorrente.connect()
    try {
      await concorrente.query('BEGIN')
      await concorrente.query('INSERT INTO produtos (categoria_id, nome, preco, ativo) VALUES ($1, $2, $3, $4)',
        [categoria.id, 'Produto concorrente', 100, false])
      pendente = escrever('DELETE', `/api/categorias/${categoria.id}`)
      const prazo = Date.now() + 5000
      let aguardando = false
      while (Date.now() < prazo) {
        const { rows } = await cliente.query(
          `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
                           WHERE application_name = $1 AND wait_event_type = 'Lock'
                             AND query LIKE 'DELETE FROM categorias%') AS aguardando`,
          [schema],
        )
        if (rows[0].aguardando) { aguardando = true; break }
        await esperar(20)
      }
      assert.equal(aguardando, true, 'O DELETE deve aguardar a transação que referencia a categoria')
      await concorrente.query('COMMIT')
      const resposta = await pendente
      assert.equal(resposta.status, 409)
      assert.deepEqual(await resposta.json(), { erro: 'Categoria possui produtos vinculados e não pode ser excluída.' })
      assert.equal((await fetch(`${origem}/api/categorias/${categoria.id}`)).status, 200)
    } finally {
      await concorrente.query('ROLLBACK')
      if (pendente) await pendente.catch(() => {})
      await concorrente.end()
      await cliente.query('DELETE FROM produtos WHERE categoria_id = $1', [categoria.id])
      await cliente.query('DELETE FROM categorias WHERE id = $1', [categoria.id])
    }
  })

  it('preserva produtos e peixes após alterações administrativas em outras categorias', async () => {
    const categoria = await criar('Categoria auxiliar', 'categoria-auxiliar')
    assert.equal((await escrever('PATCH', `/api/categorias/${categoria.id}`, { nome: 'Categoria editada' })).status, 200)
    const produto = await fetch(`${origem}/api/produtos/${peixeId}`)
    const peixe = await fetch(`${origem}/api/peixes/${peixeId}`)
    assert.equal(produto.status, 200)
    assert.equal(peixe.status, 200)
    assert.deepEqual(await produto.json(), await peixe.json())
    const produtos = await (await fetch(`${origem}/api/produtos?tipo_agua=doce`)).json()
    const peixes = await (await fetch(`${origem}/api/peixes?temperatura=24.5`)).json()
    assert.equal(produtos.total, 1)
    assert.equal(peixes.total, 1)
    assert.equal(produtos.itens[0].id, peixeId)
    assert.equal(peixes.itens[0].id, peixeId)
    assert.equal((await escrever('DELETE', `/api/categorias/${categoria.id}`)).status, 204)
  })

  it('falhas reais de consulta não expõem detalhes do banco ou liberam escrita', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE categorias RENAME TO categorias_indisponiveis')
    try {
      const respostas = [await fetch(`${origem}/api/categorias/1`),
        await escrever('POST', '/api/categorias', { nome: 'Teste', slug: 'teste' }),
        await escrever('PATCH', '/api/categorias/1', { nome: 'Teste' }),
        await escrever('DELETE', '/api/categorias/1')]
      for (const resposta of respostas) {
        assert.equal(resposta.status, 500)
        assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      }
    } finally {
      await cliente.query('ALTER TABLE categorias_indisponiveis RENAME TO categorias')
      log.mock.restore()
    }
    await cliente.query('ALTER TABLE sessoes RENAME TO sessoes_indisponiveis')
    const logSessao = mock.method(console, 'error', () => {})
    try {
      const resposta = await escrever('POST', '/api/categorias', { nome: 'Teste', slug: 'teste' })
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    } finally {
      await cliente.query('ALTER TABLE sessoes_indisponiveis RENAME TO sessoes')
      logSessao.mock.restore()
    }
    assert.equal((await lista()).total, 12)
  })
})
