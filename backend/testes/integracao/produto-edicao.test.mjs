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
describe('PATCH /api/produtos/:id — PostgreSQL, estado final e concorrência', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_edicao_${randomUUID().replaceAll('-', '')}`
  const tokens = new Map()
  const usuarios = new Map()
  const produtos = new Map()
  let cliente, pool, servidor, origem, origemCors, urlAplicacao, schemaCriado = false
  let comum, inativo

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    for (const [chave, papel, ativo, validade] of [
      ['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'],
      ['expirado', 'admin', true, '-1 hour'], ['inativo', 'admin', false, '1 hour'],
      ['rebaixado', 'admin', true, '1 hour'], ['revogado', 'admin', true, '1 hour'],
    ]) {
      const { rows } = await cliente.query(
        'INSERT INTO clientes (nome, email, senha_hash, papel, ativo) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [chave, `${chave}@teste.example`, 'hash-fixture-sem-login', papel, ativo])
      usuarios.set(chave, rows[0].id)
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
    pool = db; origemCors = env.corsOrigin
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
    const categorias = (await cliente.query('SELECT id, slug FROM categorias')).rows
    for (const fixture of fichasCadastro) {
      const dados = { ...fixture.minimos, ...fixture.extras }
      const categoriaId = categorias.find((c) => c.slug === fixture.tipo).id
      const resposta = await escrever('POST', '/api/produtos', { ...entradaProduto(categoriaId, { tipo: fixture.tipo, dados }),
        nome: `Produto ${fixture.tipo}`, marca: 'Marca inicial', descricao: 'Descrição inicial' })
      assert.equal(resposta.status, 201)
      produtos.set(fixture.tipo, await resposta.json())
    }
    const resposta = await escrever('POST', '/api/produtos', entradaProduto(categorias.find((c) => c.slug === 'acessorios').id))
    assert.equal(resposta.status, 201); comum = await resposta.json()
    const outra = await escrever('POST', '/api/produtos', entradaProduto(comum.categoriaId))
    inativo = await outra.json()
    await cliente.query('UPDATE produtos SET ativo = false WHERE id = $1', [inativo.id])
    await cliente.query("UPDATE produtos SET estoque = 7, atualizado_em = '2020-01-01' WHERE id = $1", [produtos.get('peixes').id])
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
  function escrever(method, caminho, body, sessao = 'admin', origin = origemCors) {
    const headers = { 'Content-Type': 'application/json' }
    if (sessao) headers.Cookie = `sid=${tokens.get(sessao) ?? sessao}`
    if (origin) headers.Origin = origin
    return fetch(`${origem}${caminho}`, { method, headers, body: JSON.stringify(body) })
  }
  function editar(id, body, sessao, origin) { return escrever('PATCH', `/api/produtos/${id}`, body, sessao, origin) }
  async function ler(id) {
    const resposta = await fetch(`${origem}/api/produtos/${id}`)
    assert.equal(resposta.status, 200); return resposta.json()
  }
  async function invalido(id, body) {
    const antes = await ler(id)
    const resposta = await editar(id, body)
    assert.equal(resposta.status, 400, JSON.stringify(body))
    assert.equal((await resposta.json()).erro, 'Dados inválidos')
    assert.deepEqual(await ler(id), antes)
  }
  async function aguardarLock(prefixo) {
    const prazo = Date.now() + 5000
    while (Date.now() < prazo) {
      const { rows } = await cliente.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity
        WHERE application_name = $1 AND wait_event_type = 'Lock' AND query LIKE $2) AS aguardando`, [schema, `${prefixo}%`])
      if (rows[0].aguardando) return
      await esperar(20)
    }
    assert.fail(`A consulta ${prefixo} não aguardou o lock`)
  }

  for (const [descricao, sessao, status] of [['ausente', null, 401], ['inventada', 'invalida', 401],
    ['vencida', 'expirado', 401], ['usuário inativo', 'inativo', 401], ['cliente', 'cliente', 403]]) {
    it(`recusa sessão ${descricao} sem mudar produto`, async () => {
      const antes = await ler(comum.id)
      assert.equal((await editar(comum.id, { preco: 1 }, sessao)).status, status)
      assert.deepEqual(await ler(comum.id), antes)
    })
  }
  it('reconsulta papel e revogação a cada edição', async () => {
    await cliente.query("UPDATE clientes SET papel = 'cliente' WHERE id = $1", [usuarios.get('rebaixado')])
    assert.equal((await editar(comum.id, { preco: 1 }, 'rebaixado')).status, 403)
    await cliente.query('DELETE FROM sessoes WHERE cliente_id = $1', [usuarios.get('revogado')])
    assert.equal((await editar(comum.id, { preco: 1 }, 'revogado')).status, 401)
  })
  it('exige Origin correto mesmo com sessão admin válida', async () => {
    const antes = await ler(comum.id)
    for (const origin of [null, 'null', 'https://invalida.example']) assert.equal((await editar(comum.id, { preco: 1 }, 'admin', origin)).status, 403)
    assert.deepEqual(await ler(comum.id), antes)
  })

  it('edita comum, limpa campos opcionais e aceita limites de centavos sem mudar omitidos', async () => {
    for (const preco of [0, 2147483647, 1234]) {
      const resposta = await editar(comum.id, { preco, descricao: null, marca: null })
      assert.equal(resposta.status, 200)
      assert.deepEqual(await resposta.json(), { ...comum, preco, descricao: null, marca: null })
    }
    assert.equal((await editar(comum.id, { nome: " Redinha d'água ", marca: 'Nova marca' })).status, 200)
    assert.equal((await ler(comum.id)).nome, "Redinha d'água")
  })

  for (const fixture of fichasCadastro) {
    it(`edita ficha de ${fixture.tipo} parcialmente e mantém o restante e seus defaults atuais`, async () => {
      const id = produtos.get(fixture.tipo).id
      const antes = await ler(id)
      const campo = Object.keys(fixture.extras)[0] ?? Object.keys(fixture.minimos)[0]
      const valor = antes.ficha.dados[campo]
      const resposta = await editar(id, { nome: `Editado ${fixture.tipo}`, ficha: { dados: { [campo]: valor } } })
      assert.equal(resposta.status, 200)
      assert.deepEqual(await resposta.json(), { ...antes, nome: `Editado ${fixture.tipo}` })
      assert.deepEqual(await ler(id), { ...antes, nome: `Editado ${fixture.tipo}` })
    })
    it(`valida limites e campos protegidos da ficha de ${fixture.tipo} no estado final`, async () => {
      const id = produtos.get(fixture.tipo).id
      for (const valores of fixture.invalidos) await invalido(id, { ficha: { dados: valores } })
      await invalido(id, { ficha: { tipo: fixture.tipo, dados: fixture.minimos } })
      await invalido(id, { ficha: { dados: { produtoId: 999 } } })
    })
  }

  it('null limpa apenas campos anuláveis; omitidos não voltam a defaults', async () => {
    const id = produtos.get('termostatos').id
    const antes = await ler(id)
    const resposta = await editar(id, { descricao: null, marca: null, ficha: { dados: { tempMinC: null, voltagem: null } } })
    assert.equal(resposta.status, 200)
    const esperado = { ...antes, descricao: null, marca: null,
      ficha: { tipo: 'termostatos', dados: { ...antes.ficha.dados, tempMinC: null, voltagem: null } } }
    assert.deepEqual(await resposta.json(), esperado)
    assert.equal((await ler(id)).ficha.dados.ajustavel, false)
    await invalido(id, { ficha: { dados: { ajustavel: null } } })
    const decoracao = produtos.get('decoracoes').id
    assert.equal((await editar(decoracao, { ficha: { dados: { alturaCm: null } } })).status, 200)
    assert.equal((await ler(decoracao)).ficha.dados.materialNatural, true)
    assert.equal((await ler(decoracao)).ficha.dados.seguroMarinho, true)
  })

  it('rejeita campos básicos protegidos e inválidos, inclusive tentativa de alterar estoque para zero', async () => {
    const id = produtos.get('peixes').id
    for (const campos of [{}, { categoriaId: produtos.get('aquarios').categoriaId }, { categoriaId: 1 }, { estoque: 0 },
      { estoque: 99 }, { ativo: false }, { id: 999 }, { imagemUrl: 'https://imagem.example' },
      { atualizadoEm: '2026-10-26' }, { nome: null }, { preco: null }, { preco: 1.5 }, { preco: '1234' },
      { preco: -1 }, { preco: 2147483648 }, { nome: 'x'.repeat(151) }, { marca: 'x'.repeat(81) },
      { ficha: null }, { ficha: { dados: {} } }, { ficha: { dados: null } },
      { ficha: { tipo: 'aquarios', dados: { volumeLitros: 40 } } }]) await invalido(id, campos)
    assert.equal((await cliente.query('SELECT estoque FROM produtos WHERE id = $1', [id])).rows[0].estoque, 7)
    await invalido(comum.id, { ficha: { dados: { volumeLitros: 40 } } })
  })

  it('atualiza timestamp do produto e publica alterações na lista, detalhe e atalhos de peixes', async () => {
    const id = produtos.get('peixes').id
    const resposta = await editar(id, { nome: 'Betta atualizado', preco: 3500, ficha: { dados: { origem: 'Brasil', phMin: 6.5 } } })
    assert.equal(resposta.status, 200)
    const produto = await resposta.json()
    assert.equal(produto.preco, 3500); assert.equal(produto.emEstoque, true)
    assert.deepEqual(await ler(id), produto)
    const peixe = await fetch(`${origem}/api/peixes/${id}`)
    assert.equal(peixe.status, 200); assert.deepEqual(await peixe.json(), produto)
    const lista = await (await fetch(`${origem}/api/produtos?busca=Betta%20atualizado`)).json()
    const { ficha, ...basicos } = produto
    assert.deepEqual(lista.itens, [basicos]); assert.equal(lista.total, 1)
    const peixes = await (await fetch(`${origem}/api/peixes?busca=Betta%20atualizado&ph=6.5`)).json()
    assert.deepEqual(peixes.itens, [produto]); assert.equal(peixes.total, 1)
    const banco = (await cliente.query('SELECT estoque, categoria_id, ativo, atualizado_em FROM produtos WHERE id = $1', [id])).rows[0]
    assert.equal(banco.estoque, 7); assert.equal(banco.ativo, true)
    assert.equal(banco.categoria_id, produto.categoriaId)
    assert.ok(banco.atualizado_em > new Date('2020-01-01'))
  })

  it('inexistentes/inativos retornam 404; IDs malformados retornam 400', async () => {
    for (const id of [2147483647, inativo.id]) {
      const resposta = await editar(id, { preco: 100 })
      assert.equal(resposta.status, 404)
      assert.deepEqual(await resposta.json(), { erro: 'Produto não encontrado' })
    }
    assert.equal((await cliente.query('SELECT preco FROM produtos WHERE id = $1', [inativo.id])).rows[0].preco, inativo.preco)
    for (const id of ['0', '-1', '1.5', '01', '2147483648', 'betta', '1%20OR%20true']) assert.equal((await editar(id, { preco: 100 })).status, 400)
  })

  it('duplicidade científica desfaz edição básica, ficha e timestamp', async () => {
    const original = await ler(produtos.get('peixes').id)
    const resposta = await escrever('POST', '/api/produtos', entradaProduto(original.categoriaId,
      { tipo: 'peixes', dados: { ...original.ficha.dados, nomeCientifico: 'Outro peixe' } }))
    assert.equal(resposta.status, 201)
    const outro = await resposta.json()
    const tempo = (await cliente.query('SELECT atualizado_em FROM produtos WHERE id = $1', [outro.id])).rows[0].atualizado_em
    const edicao = await editar(outro.id, { preco: 9999, ficha: { dados: { nomeCientifico: original.ficha.dados.nomeCientifico } } })
    assert.equal(edicao.status, 409)
    assert.equal(typeof (await edicao.json()).detalhes['ficha.dados.nomeCientifico'], 'string')
    assert.deepEqual(await ler(outro.id), outro)
    assert.deepEqual((await cliente.query('SELECT atualizado_em FROM produtos WHERE id = $1', [outro.id])).rows[0].atualizado_em, tempo)
  })

  it('falha real na ficha reverte produto e timestamp sem expor o banco', async () => {
    const id = produtos.get('peixes').id
    const antes = await ler(id)
    const tempo = (await cliente.query('SELECT atualizado_em FROM produtos WHERE id = $1', [id])).rows[0].atualizado_em
    await cliente.query("ALTER TABLE peixes ADD CONSTRAINT teste_falha_edicao CHECK (origem <> 'FALHAR')")
    const log = mock.method(console, 'error', () => {})
    try {
      const resposta = await editar(id, { nome: 'Não persistir', preco: 1, ficha: { dados: { origem: 'FALHAR' } } })
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      assert.deepEqual(await ler(id), antes)
      assert.deepEqual((await cliente.query('SELECT atualizado_em FROM produtos WHERE id = $1', [id])).rows[0].atualizado_em, tempo)
    } finally {
      await cliente.query('ALTER TABLE peixes DROP CONSTRAINT teste_falha_edicao'); log.mock.restore()
    }
  })

  it('legado sem ficha exige estado completo e pode ser reparado pelo PATCH', async () => {
    const categoriaId = produtos.get('aquarios').categoriaId
    const { rows } = await cliente.query("INSERT INTO produtos (categoria_id,nome,preco) VALUES ($1,'Legado sem ficha',100) RETURNING id", [categoriaId])
    const id = rows[0].id
    await invalido(id, { nome: 'Só o nome' })
    await invalido(id, { ficha: { dados: { volumeLitros: 60 } } })
    const dados = { ...fichasCadastro[1].minimos, volumeLitros: 60 }
    const resposta = await editar(id, { ficha: { dados } })
    assert.equal(resposta.status, 200)
    assert.deepEqual((await resposta.json()).ficha, { tipo: 'aquarios', dados })
    assert.deepEqual((await ler(id)).ficha, { tipo: 'aquarios', dados })
  })

  it('duas edições HTTP concorrentes de campos diferentes preservam ambos os resultados', async () => {
    const id = produtos.get('peixes').id
    const bloqueador = new pg.Client({ connectionString: urlAplicacao.toString() })
    let primeira, segunda
    await bloqueador.connect()
    await cliente.query(`CREATE FUNCTION pausar_edicao() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.nome = 'Edição A' THEN PERFORM pg_advisory_xact_lock(773129); END IF; RETURN NEW; END $$`)
    await cliente.query('CREATE TRIGGER pausar_edicao BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION pausar_edicao()')
    try {
      await bloqueador.query('BEGIN'); await bloqueador.query('SELECT pg_advisory_xact_lock(773129)')
      primeira = editar(id, { nome: 'Edição A', ficha: { dados: { origem: 'Origem A' } } })
      await aguardarLock('UPDATE produtos')
      segunda = editar(id, { preco: 7000, ficha: { dados: { cardumeMinimo: 5 } } })
      await aguardarLock('SELECT categoria_id')
      await bloqueador.query('COMMIT')
      assert.equal((await primeira).status, 200); assert.equal((await segunda).status, 200)
      const final = await ler(id)
      assert.equal(final.nome, 'Edição A'); assert.equal(final.preco, 7000)
      assert.equal(final.ficha.dados.origem, 'Origem A'); assert.equal(final.ficha.dados.cardumeMinimo, 5)
    } finally {
      await bloqueador.query('ROLLBACK')
      await Promise.allSettled([primeira, segunda].filter(Boolean)); await bloqueador.end()
      await cliente.query('DROP TRIGGER pausar_edicao ON produtos'); await cliente.query('DROP FUNCTION pausar_edicao()')
    }
  })

  it('valida a faixa contra o commit concorrente, sem usar uma ficha antiga', async () => {
    const id = produtos.get('peixes').id
    const antes = await ler(id)
    const bloqueador = new pg.Client({ connectionString: urlAplicacao.toString() })
    let pendente
    await bloqueador.connect()
    try {
      await bloqueador.query('BEGIN')
      await bloqueador.query('SELECT id FROM produtos WHERE id = $1 FOR UPDATE', [id])
      await bloqueador.query('UPDATE peixes SET ph_min = 7 WHERE produto_id = $1', [id])
      pendente = editar(id, { nome: 'Não deve mudar', ficha: { dados: { phMax: 6.8 } } })
      await aguardarLock('SELECT categoria_id')
      await bloqueador.query('COMMIT')
      const resposta = await pendente
      assert.equal(resposta.status, 400)
      assert.equal(typeof (await resposta.json()).detalhes['ficha.dados.phMax'], 'string')
      const final = await ler(id)
      assert.equal(final.nome, antes.nome); assert.equal(final.ficha.dados.phMin, 7)
      assert.equal(final.ficha.dados.phMax, antes.ficha.dados.phMax)
    } finally {
      await bloqueador.query('ROLLBACK'); if (pendente) await pendente.catch(() => {}); await bloqueador.end()
    }
  })

  it('o lock da edição permite a FK recusar DELETE concorrente de categoria sem deadlock', async () => {
    const produto = produtos.get('peixes')
    const concorrente = new pg.Client({ connectionString: urlAplicacao.toString() })
    let pendente
    await concorrente.connect()
    try {
      await concorrente.query('BEGIN')
      await concorrente.query("SET LOCAL statement_timeout = '2s'")
      await concorrente.query('SELECT id FROM categorias WHERE id = $1 FOR UPDATE', [produto.categoriaId])
      pendente = editar(produto.id, { preco: 6800 })
      await aguardarLock('SELECT id, nome, slug FROM categorias')
      await assert.rejects(concorrente.query('DELETE FROM categorias WHERE id = $1', [produto.categoriaId]),
        (err) => err.code === '23503' && err.constraint === 'produtos_categoria_id_fkey')
      await concorrente.query('ROLLBACK')
      assert.equal((await pendente).status, 200)
      assert.equal((await ler(produto.id)).preco, 6800)
    } finally {
      await concorrente.query('ROLLBACK'); if (pendente) await pendente.catch(() => {}); await concorrente.end()
    }
  })

  it('preserva consultas gerais e categorias, sem liberar inativos, e permite desativação administrativa', async () => {
    assert.equal((await fetch(`${origem}/api/categorias`)).status, 200)
    assert.equal((await fetch(`${origem}/api/produtos?categoria=plantas&precisa_co2=true`)).status, 200)
    assert.equal((await fetch(`${origem}/api/produtos?incluir_inativos=true`)).status, 400)
    assert.equal((await fetch(`${origem}/api/produtos/${inativo.id}`)).status, 404)
    assert.equal((await escrever('DELETE', `/api/produtos/${comum.id}`, undefined)).status, 204)
    assert.equal((await fetch(`${origem}/api/produtos/${comum.id}`)).status, 404)
  })
})
