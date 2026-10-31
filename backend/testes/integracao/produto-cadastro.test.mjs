import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'
import { entradaProduto, fichasCadastro } from '../fixtures/produto-cadastro.mjs'

const urlTeste = process.env.TEST_DATABASE_URL

describe('POST /api/produtos — PostgreSQL e sessões reais', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_cadastro_${randomUUID().replaceAll('-', '')}`
  const categorias = new Map()
  const tokens = new Map()
  const criados = new Map()
  let cliente
  let pool
  let servidor
  let origem
  let origemCors
  let urlAplicacao
  let schemaCriado = false

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    for (const categoria of (await cliente.query('SELECT id, slug FROM categorias')).rows) categorias.set(categoria.slug, categoria.id)
    for (const [chave, papel, ativo, validade] of [
      ['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'],
      ['inativo', 'admin', false, '1 hour'], ['expirado', 'admin', true, '-1 hour'],
    ]) {
      const { rows } = await cliente.query(
        'INSERT INTO clientes (nome, email, senha_hash, papel, ativo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [chave, `${chave}@teste.example`, 'hash-fixture-sem-login', papel, ativo],
      )
      const token = randomUUID()
      tokens.set(chave, token)
      await cliente.query('INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + $3::interval)',
        [hashToken(token), rows[0].id, validade])
    }
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
        try { if (schemaCriado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`) }
        finally { await cliente.end() }
      }
    }
  })
  function criar(body, sessao = 'admin', origin = origemCors) {
    const headers = { 'Content-Type': 'application/json' }
    if (sessao) headers.Cookie = `sid=${tokens.get(sessao) ?? sessao}`
    if (origin) headers.Origin = origin
    return fetch(`${origem}/api/produtos`, { method: 'POST', headers, body: JSON.stringify(body) })
  }
  async function total() {
    return (await cliente.query('SELECT COUNT(*)::integer AS total FROM produtos')).rows[0].total
  }
  async function ler(caminho) {
    const resposta = await fetch(`${origem}${caminho}`)
    assert.equal(resposta.status, 200)
    return resposta.json()
  }
  async function invalido(body) {
    const antes = await total()
    const resposta = await criar(body)
    assert.equal(resposta.status, 400, JSON.stringify(body))
    assert.equal((await resposta.json()).erro, 'Dados inválidos')
    assert.equal(await total(), antes)
  }

  it('mantém o health consultando o banco trazido pelo pull', async () => {
    assert.deepEqual(await ler('/api/health'), { status: 'ok', banco: 'ok' })
  })

  for (const [descricao, sessao, origin, status] of [
    ['sem sessão', null, undefined, 401], ['token inventado', 'inventada', undefined, 401],
    ['sessão vencida', 'expirado', undefined, 401], ['conta inativa', 'inativo', undefined, 401],
    ['cliente', 'cliente', undefined, 403], ['sem Origin', 'admin', null, 403],
    ['Origin incorreto', 'admin', 'https://invalida.example', 403],
  ]) {
    it(`recusa ${descricao} com sessão real e não grava produto`, async () => {
      const antes = await total()
      assert.equal((await criar(entradaProduto(categorias.get('acessorios')), sessao, origin)).status, status)
      assert.equal(await total(), antes)
    })
  }

  it('preserva cadastro/login do pull e usa a sessão emitida para autorizar pelo papel atual', async () => {
    const dados = { nome: 'Cliente do pull', email: 'pull@teste.example', senha: 'SenhaTeste123!',
      telefone: '32999999999', aceiteTermos: true, papel: 'admin' }
    const cadastro = await fetch(`${origem}/api/auth/cadastro`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origemCors }, body: JSON.stringify(dados),
    })
    assert.equal(cadastro.status, 201)
    const usuario = await cadastro.json()
    assert.equal(usuario.papel, 'cliente')
    assert.equal('senhaHash' in usuario, false)
    const duplicado = await fetch(`${origem}/api/auth/cadastro`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origemCors }, body: JSON.stringify(dados),
    })
    assert.equal(duplicado.status, 409)
    async function login(senha) {
      return fetch(`${origem}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origemCors }, body: JSON.stringify({ email: dados.email, senha }),
      })
    }
    assert.equal((await login('SenhaErrada')).status, 401)
    const respostaLogin = await login(dados.senha)
    assert.equal(respostaLogin.status, 200)
    assert.equal('senhaHash' in await respostaLogin.json(), false)
    const cookie = respostaLogin.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=Lax/i)
    const token = cookie.match(/^sid=([^;]+)/)[1]
    assert.equal((await cliente.query('SELECT COUNT(*)::integer AS total FROM sessoes WHERE token_hash = $1', [hashToken(token)])).rows[0].total, 1)
    const produto = entradaProduto(categorias.get('acessorios'))
    assert.equal((await criar(produto, token)).status, 403)
    // Promoção feita exclusivamente pela fixture SQL; a API não cria admins.
    await cliente.query("UPDATE clientes SET papel = 'admin' WHERE id = $1", [usuario.id])
    assert.equal((await criar(produto, token)).status, 201)
    await cliente.query('DELETE FROM sessoes WHERE cliente_id = $1', [usuario.id])
    assert.equal((await criar(produto, token)).status, 401)
  })

  for (const fixture of fichasCadastro) {
    for (const completa of [false, true]) {
      it(`cadastra ${fixture.tipo} com ficha ${completa ? 'completa' : 'mínima'} e lê o mesmo DTO`, async () => {
        const dados = { ...fixture.minimos, ...(completa ? fixture.extras : {}) }
        if (fixture.tipo === 'peixes') dados.nomeCientifico += completa ? ' completa' : ' mínima'
        const entrada = { ...entradaProduto(categorias.get(fixture.tipo), { tipo: fixture.tipo, dados }),
          nome: `Produto ${fixture.tipo} ${completa}`, descricao: 'Descrição pública', marca: 'Marca' }
        const resposta = await criar(entrada)
        assert.equal(resposta.status, 201)
        const produto = await resposta.json()
        const esperado = { id: produto.id, categoriaId: entrada.categoriaId, categoria: fixture.tipo,
          nome: entrada.nome, descricao: entrada.descricao, marca: entrada.marca, preco: 8990,
          imagemUrl: null, emEstoque: false, ficha: { tipo: fixture.tipo, dados: { ...fixture.padroes, ...dados } } }
        assert.deepEqual(produto, esperado)
        assert.deepEqual(await ler(`/api/produtos/${produto.id}`), produto)
        const { ficha, ...basicos } = produto
        const lista = await ler(`/api/produtos?categoria=${fixture.tipo}&limite=100`)
        assert.deepEqual(lista.itens.find((item) => item.id === produto.id), basicos)
        const banco = (await cliente.query('SELECT estoque, ativo, imagem_url FROM produtos WHERE id = $1', [produto.id])).rows[0]
        assert.deepEqual(banco, { estoque: 0, ativo: true, imagem_url: null })
        assert.equal((await cliente.query(`SELECT COUNT(*)::integer AS total FROM ${fixture.tipo} WHERE produto_id = $1`, [produto.id])).rows[0].total, 1)
        if (fixture.tipo === 'peixes') {
          assert.deepEqual(await ler(`/api/peixes/${produto.id}`), produto)
          assert.equal((await ler('/api/peixes')).itens.some((item) => item.id === produto.id), true)
        }
        criados.set(`${fixture.tipo}-${completa}`, produto)
      })
    }
    it(`rejeita ficha ausente, campos obrigatórios inválidos e limites em ${fixture.tipo} sem resíduos`, async () => {
      const categoriaId = categorias.get(fixture.tipo)
      await invalido(entradaProduto(categoriaId))
      for (const campo of fixture.obrigatorios) {
        const dados = { ...fixture.minimos }
        delete dados[campo]
        await invalido(entradaProduto(categoriaId, { tipo: fixture.tipo, dados }))
      }
      for (const valores of fixture.invalidos) {
        await invalido(entradaProduto(categoriaId, { tipo: fixture.tipo, dados: { ...fixture.minimos, ...valores } }))
      }
    })
  }

  it('permite acessórios e nova categoria sem tabela, com ficha ausente/nula', async () => {
    const categoria = await fetch(`${origem}/api/categorias`, { method: 'POST',
      headers: { Cookie: `sid=${tokens.get('admin')}`, Origin: origemCors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: 'Categoria extra', slug: 'categoria-extra' }) })
    assert.equal(categoria.status, 201)
    const nova = await categoria.json()
    assert.equal((await ler('/api/categorias')).itens.some((item) => item.id === nova.id), true)
    for (const categoriaId of [categorias.get('acessorios'), nova.id]) {
      const resposta = await criar({ categoriaId, nome: 'Redinha', preco: 0 })
      assert.equal(resposta.status, 201)
      const produto = await resposta.json()
      assert.equal(produto.ficha, null)
      assert.equal(produto.preco, 0)
      assert.deepEqual(await ler(`/api/produtos/${produto.id}`), produto)
      assert.equal((await fetch(`${origem}/api/peixes/${produto.id}`)).status, 404)
      await invalido(entradaProduto(categoriaId, { tipo: 'peixes', dados: fichasCadastro[0].minimos }))
    }
  })

  it('recusa categoria inexistente e associação cruzada de fichas', async () => {
    await invalido(entradaProduto(2147483647))
    for (const [tipo, ficha] of [['peixes', fichasCadastro[1]], ['aquarios', fichasCadastro[0]]]) {
      await invalido(entradaProduto(categorias.get(tipo), { tipo: ficha.tipo, dados: ficha.minimos }))
    }
  })

  it('aceita centavos zero/máximo, limites NUMERIC exatos e VARCHAR em caracteres Unicode', async () => {
    const casos = [
      ['peixes', { ...fichasCadastro[0].minimos, nomeCientifico: 'x'.repeat(120), origem: 'y'.repeat(120),
        tempMinC: -999.9, tempMaxC: 999.9, phMin: 0, phMax: 14, tamanhoAdultoCm: 9999.9, aquarioMinLitros: 2147483647 }],
      ['aquarios', { ...fichasCadastro[1].minimos, volumeLitros: 2147483647, comprimentoCm: 99999.9, larguraCm: 0.1, alturaCm: 99999.9 }],
      ['bombas', { ...fichasCadastro[3].minimos, alturaMaxM: 99.99, potenciaW: 0, saidas: 2147483647, vazaoLh: 2147483647 }],
      ['substratos', { ...fichasCadastro[8].minimos, pesoKg: 999.99, granulometriaMm: 'x'.repeat(20), cor: 'y'.repeat(40) }],
    ]
    for (const [tipo, dados] of casos) {
      const resposta = await criar({ ...entradaProduto(categorias.get(tipo), { tipo, dados }), preco: 2147483647,
        nome: '🐟'.repeat(150), marca: 'm'.repeat(80) })
      assert.equal(resposta.status, 201)
      const produto = await resposta.json()
      assert.equal(produto.preco, 2147483647)
      assert.equal(produto.nome, '🐟'.repeat(150))
      for (const [campo, valor] of Object.entries(dados)) assert.equal(produto.ficha.dados[campo], valor)
    }
  })

  it('recusa básicos inválidos e qualquer estoque diferente de zero sem gravar', async () => {
    const base = entradaProduto(categorias.get('acessorios'))
    for (const campos of [{ categoriaId: '12' }, { preco: '8990' }, { preco: 89.9 }, { preco: -1 },
      { preco: 2147483648 }, { nome: ' ' }, { nome: 'x'.repeat(151) }, { marca: 'x'.repeat(81) },
      { estoque: 10 }, { estoque: -1 }, { estoque: '0' }, { estoque: null }, { ativo: false },
      { imagemUrl: 'https://foto.example' }, { id: 1 }]) await invalido({ ...base, ...campos })
    assert.equal((await criar({ ...base, estoque: 0 })).status, 201)
  })

  it('duplicidade científica provoca rollback de produto e ficha', async () => {
    const antes = await total()
    const original = criados.get('peixes-false')
    const resposta = await criar({ ...entradaProduto(original.categoriaId, original.ficha), nome: 'Não deve permanecer' })
    assert.equal(resposta.status, 409)
    assert.equal(typeof (await resposta.json()).detalhes['ficha.dados.nomeCientifico'], 'string')
    assert.equal(await total(), antes)
    assert.equal((await cliente.query("SELECT COUNT(*)::integer AS total FROM produtos WHERE nome = 'Não deve permanecer'")).rows[0].total, 0)
    assert.deepEqual(await ler(`/api/peixes/${original.id}`), original)
  })

  it('duas criações simultâneas do mesmo peixe deixam somente um produto completo', async () => {
    const antes = await total()
    const body = entradaProduto(categorias.get('peixes'), { tipo: 'peixes', dados: { ...fichasCadastro[0].minimos, nomeCientifico: 'Peixe concorrente' } })
    const respostas = await Promise.all([criar(body), criar(body)])
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409])
    assert.equal(await total(), antes + 1)
    const produto = await respostas.find((r) => r.status === 201).json()
    assert.deepEqual(await ler(`/api/peixes/${produto.id}`), produto)
  })

  it('falha real ao inserir ficha desfaz o produto e mantém o pool utilizável', async () => {
    const antes = await total()
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE filtros ADD CONSTRAINT teste_falha_cadastro CHECK (vazao_lh <> 777)')
    try {
      const resposta = await criar(entradaProduto(categorias.get('filtros'), { tipo: 'filtros', dados: { tipo: 'canister', vazaoLh: 777 } }))
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      assert.equal(await total(), antes)
    } finally {
      await cliente.query('ALTER TABLE filtros DROP CONSTRAINT teste_falha_cadastro')
      log.mock.restore()
    }
    assert.equal((await criar(entradaProduto(categorias.get('acessorios')))).status, 201)
  })

  it('falha na leitura final também desfaz produto e ficha já inseridos', async () => {
    const antes = await total()
    const fichasAntes = (await cliente.query('SELECT COUNT(*)::integer AS total FROM peixes')).rows[0].total
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE decoracoes RENAME TO decoracoes_indisponiveis')
    try {
      const resposta = await criar(entradaProduto(categorias.get('peixes'), { tipo: 'peixes',
        dados: { ...fichasCadastro[0].minimos, nomeCientifico: 'Rollback da leitura' } }))
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      assert.equal(await total(), antes)
      assert.equal((await cliente.query('SELECT COUNT(*)::integer AS total FROM peixes')).rows[0].total, fichasAntes)
    } finally {
      await cliente.query('ALTER TABLE decoracoes_indisponiveis RENAME TO decoracoes')
      log.mock.restore()
    }
  })

  it('aguarda exclusão concorrente da categoria e então recusa o cadastro sem órfãos', async () => {
    const { rows } = await cliente.query("INSERT INTO categorias (nome, slug) VALUES ('Categoria concorrente', 'categoria-concorrente') RETURNING id")
    const id = rows[0].id
    const antes = await total()
    const concorrente = new pg.Client({ connectionString: urlAplicacao.toString() })
    let pendente
    await concorrente.connect()
    try {
      await concorrente.query('BEGIN')
      await concorrente.query('DELETE FROM categorias WHERE id = $1', [id])
      pendente = criar(entradaProduto(id))
      const prazo = Date.now() + 5000
      let aguardando = false
      while (Date.now() < prazo) {
        const { rows } = await cliente.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
          WHERE application_name = $1 AND wait_event_type = 'Lock' AND query LIKE 'SELECT id, nome, slug FROM categorias%') AS aguardando`, [schema])
        if (rows[0].aguardando) { aguardando = true; break }
        await esperar(20)
      }
      assert.equal(aguardando, true)
      await concorrente.query('COMMIT')
      assert.equal((await pendente).status, 400)
      assert.equal(await total(), antes)
    } finally {
      await concorrente.query('ROLLBACK')
      if (pendente) await pendente.catch(() => {})
      await concorrente.end()
    }
  })

  it('as consultas e filtros técnicos continuam lendo os produtos criados', async () => {
    const produtos = await ler('/api/produtos?categoria=plantas&precisa_co2=true&iluminacao=baixa&limite=100')
    assert.equal(produtos.total, 1)
    assert.equal(produtos.itens[0].id, criados.get('plantas-true').id)
    const peixes = await ler('/api/peixes?temperatura=24.5&ph=6&busca=Betta&limite=100')
    assert.equal(peixes.total, 2)
    for (const peixe of peixes.itens) assert.deepEqual(await ler(`/api/produtos/${peixe.id}`), await ler(`/api/peixes/${peixe.id}`))
    assert.equal((await fetch(`${origem}/api/produtos?incluir_inativos=true`)).status, 400)
    assert.equal((await fetch(`${origem}/api/produtos/peixe-textual`)).status, 400)
    assert.equal((await fetch(`${origem}/api/categorias/2147483647`)).status, 404)
  })
})
