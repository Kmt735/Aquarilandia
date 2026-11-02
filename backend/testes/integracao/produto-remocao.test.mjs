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
describe('DELETE /api/produtos/:id — preservação e concorrência no PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_desativacao_${randomUUID().replaceAll('-', '')}`
  const usuarios = new Map(), tokens = new Map(), categorias = new Map()
  let cliente, pool, servidor, origem, origemCors, urlAplicacao, protegido, schemaCriado = false

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    for (const c of (await cliente.query('SELECT id, slug FROM categorias')).rows) categorias.set(c.slug, c.id)
    for (const [chave, papel, ativo, validade] of [
      ['admin', 'admin', true, '1 hour'], ['cliente', 'cliente', true, '1 hour'],
      ['expirado', 'admin', true, '-1 hour'], ['inativo', 'admin', false, '1 hour'],
      ['mutavel', 'admin', true, '1 hour'], ['revogavel', 'admin', true, '1 hour'],
    ]) {
      const { rows } = await cliente.query('INSERT INTO clientes (nome,email,senha_hash,papel,ativo) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [chave, `${chave}@teste.example`, 'hash-fixture-sem-login', papel, ativo])
      usuarios.set(chave, rows[0].id)
      const token = randomUUID(); tokens.set(chave, token)
      await cliente.query('INSERT INTO sessoes (token_hash,cliente_id,expira_em) VALUES ($1,$2,now()+$3::interval)',
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
    protegido = await criar()
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
    if (origin !== null) headers.Origin = origin
    return fetch(`${origem}${caminho}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  function remover(id, sessao, origin) { return escrever('DELETE', `/api/produtos/${encodeURIComponent(id)}`, undefined, sessao, origin) }
  async function criar(tipo = 'acessorios') {
    const fixture = fichasCadastro.find((f) => f.tipo === tipo)
    const dados = fixture ? { ...fixture.minimos, ...fixture.extras } : null
    const nome = `Fixture ${randomUUID()}`
    if (tipo === 'peixes') dados.nomeCientifico += ` ${randomUUID()}`
    const resposta = await escrever('POST', '/api/produtos', { ...entradaProduto(categorias.get(tipo),
      dados ? { tipo, dados } : null), nome, descricao: 'Descrição preservada', marca: 'Marca preservada' })
    assert.equal(resposta.status, 201)
    const produto = await resposta.json()
    await cliente.query("UPDATE produtos SET estoque=7,imagem_url='https://teste.example/fixture.png',criado_em='2001-01-01',atualizado_em='2002-01-01' WHERE id=$1", [produto.id])
    return produto
  }
  async function estado(id) { return (await cliente.query('SELECT * FROM produtos WHERE id=$1', [id])).rows[0] }
  async function ficha(id, tipo) {
    // Identificador vem exclusivamente da lista fechada de fixtures, nunca da requisição.
    assert.ok(fichasCadastro.some((f) => f.tipo === tipo))
    return (await cliente.query(`SELECT * FROM ${tipo} WHERE produto_id=$1`, [id])).rows[0]
  }
  async function lista(caminho) {
    const r = await fetch(`${origem}${caminho}`); assert.equal(r.status, 200); return r.json()
  }
  async function sucesso(resposta) {
    assert.equal(resposta.status, 204); assert.equal(await resposta.text(), '')
    assert.equal(resposta.headers.get('content-type'), null)
  }
  async function naoEncontrado(resposta) {
    assert.equal(resposta.status, 404); assert.deepEqual(await resposta.json(), { erro: 'Produto não encontrado' })
  }
  async function preservado(id, antes) {
    const depois = await estado(id)
    assert.equal(depois.ativo, false)
    assert.ok(depois.atualizado_em > antes.atualizado_em)
    assert.deepEqual({ ...depois, ativo: antes.ativo, atualizado_em: antes.atualizado_em }, antes)
    return depois
  }
  async function aguardarLock(prefixo, quantidade = 1) {
    const fim = Date.now() + 7000
    while (Date.now() < fim) {
      const { rows } = await cliente.query(`SELECT COUNT(*)::integer AS total FROM pg_stat_activity
        WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2`, [schema, `${prefixo}%`])
      if (rows[0].total >= quantidade) return
      await esperar(20)
    }
    assert.fail(`Não observou ${quantidade} espera(s) de lock em ${prefixo}`)
  }

  for (const [descricao, sessao, status] of [['ausente', null, 401], ['inventada', 'inventada', 401],
    ['vencida', 'expirado', 401], ['conta inativa', 'inativo', 401], ['cliente', 'cliente', 403]]) {
    it(`recusa sessão ${descricao} sem mudar dados`, async () => {
      const antes = await estado(protegido.id)
      const resposta = await remover(protegido.id, sessao)
      assert.equal(resposta.status, status)
      assert.deepEqual(await resposta.json(), { erro: status === 401 ? 'Faça login para continuar.' : 'Acesso permitido somente para administradores.' })
      assert.deepEqual(await estado(protegido.id), antes)
    })
  }
  it('reconsulta papel, conta ativa e revogação no banco com o mesmo cookie', async () => {
    const antes = await estado(protegido.id)
    await cliente.query("UPDATE clientes SET papel='cliente' WHERE id=$1", [usuarios.get('mutavel')])
    assert.equal((await remover(protegido.id, 'mutavel')).status, 403)
    await cliente.query("UPDATE clientes SET papel='admin',ativo=false WHERE id=$1", [usuarios.get('mutavel')])
    assert.equal((await remover(protegido.id, 'mutavel')).status, 401)
    await cliente.query('DELETE FROM sessoes WHERE cliente_id=$1', [usuarios.get('revogavel')])
    assert.equal((await remover(protegido.id, 'revogavel')).status, 401)
    assert.deepEqual(await estado(protegido.id), antes)
  })
  it('recusa Origin ausente, null e incorreto mesmo para admin', async () => {
    const antes = await estado(protegido.id)
    for (const origin of [null, 'null', 'https://invalida.example']) {
      assert.equal((await remover(protegido.id, 'admin', origin)).status, 403)
    }
    assert.deepEqual(await estado(protegido.id), antes)
  })
  it('IDs inválidos retornam 400 sem mudar o catálogo', async () => {
    const antes = (await cliente.query('SELECT * FROM produtos ORDER BY id')).rows
    for (const id of ['0', '-1', '01', '1.5', '1e2', '2147483648', 'inválido', ' 1', "1' OR 1=1--"]) {
      const r = await remover(id); assert.equal(r.status, 400); assert.ok((await r.json()).detalhes.id)
    }
    assert.deepEqual((await cliente.query('SELECT * FROM produtos ORDER BY id')).rows, antes)
  })

  for (const fixture of fichasCadastro) {
    it(`desativa ${fixture.tipo} preservando produto completo e ficha física`, async () => {
      const produto = await criar(fixture.tipo)
      const antes = await estado(produto.id), fichaAntes = await ficha(produto.id, fixture.tipo)
      await sucesso(await remover(produto.id))
      await preservado(produto.id, antes)
      assert.deepEqual(await ficha(produto.id, fixture.tipo), fichaAntes)
      await naoEncontrado(await fetch(`${origem}/api/produtos/${produto.id}`))
    })
  }
  it('desativa produto comum e legado especializado sem ficha sem exigir reparo', async () => {
    const comum = await criar(); const antes = await estado(comum.id)
    await sucesso(await remover(comum.id)); await preservado(comum.id, antes)
    const { rows } = await cliente.query("INSERT INTO produtos (categoria_id,nome,preco) VALUES ($1,'Legado sem ficha',50) RETURNING id", [categorias.get('peixes')])
    await sucesso(await remover(rows[0].id))
    assert.equal((await estado(rows[0].id)).ativo, false)
    assert.equal(await ficha(rows[0].id, 'peixes'), undefined)
  })
  it('inexistente, previamente inativo e repetição retornam 404 sem nova escrita', async () => {
    await naoEncontrado(await remover(2147483647))
    const produto = await criar()
    await cliente.query('UPDATE produtos SET ativo=false WHERE id=$1', [produto.id])
    const antes = await estado(produto.id)
    await naoEncontrado(await remover(produto.id)); assert.deepEqual(await estado(produto.id), antes)
    const outro = await criar(); await sucesso(await remover(outro.id))
    const depois = await estado(outro.id)
    await naoEncontrado(await remover(outro.id)); assert.deepEqual(await estado(outro.id), depois)
  })
  it('remove peixe de páginas, filtros, detalhes e totais sem alterar os outros DTOs', async () => {
    const peixe = await criar('peixes'), outro = await criar('peixes')
    const nome = encodeURIComponent(peixe.nome)
    const produtoAntes = await (await fetch(`${origem}/api/produtos/${outro.id}`)).json()
    const peixeAntes = await (await fetch(`${origem}/api/peixes/${outro.id}`)).json()
    const totalProdutos = (await lista('/api/produtos')).total, totalPeixes = (await lista('/api/peixes')).total
    assert.equal((await lista(`/api/produtos?busca=${nome}&limite=1`)).total, 1)
    assert.equal((await lista(`/api/peixes?busca=${nome}&limite=1`)).total, 1)
    await sucesso(await remover(peixe.id))
    assert.equal((await lista('/api/produtos')).total, totalProdutos - 1)
    assert.equal((await lista('/api/peixes')).total, totalPeixes - 1)
    for (const caminho of [`/api/produtos?busca=${nome}&limite=1`, `/api/produtos?busca=${nome}&categoria=peixes&tipo_agua=doce`,
      `/api/peixes?busca=${nome}&temperatura=24.5&ph=6&limite=1`, `/api/peixes?busca=${nome}&pagina=2&limite=1`]) {
      assert.deepEqual(await lista(caminho), { itens: [], total: 0 })
    }
    const administrativo = await fetch(`${origem}/api/produtos/${peixe.id}?incluir_inativos=true`, { headers: { Cookie: `sid=${tokens.get('admin')}` } })
    assert.equal(administrativo.status, 200); assert.equal((await administrativo.json()).ativo, false)
    const detalhePeixe = await fetch(`${origem}/api/peixes/${peixe.id}`)
    assert.equal(detalhePeixe.status, 404); assert.deepEqual(await detalhePeixe.json(), { erro: 'Peixe não encontrado' })
    assert.deepEqual(await (await fetch(`${origem}/api/produtos/${outro.id}`)).json(), produtoAntes)
    assert.deepEqual(await (await fetch(`${origem}/api/peixes/${outro.id}`)).json(), peixeAntes)
    assert.equal((await lista('/api/categorias')).total, 12)
    assert.equal((await escrever('PATCH', `/api/produtos/${peixe.id}`, { preco: 1 })).status, 404)
  })
  it('preserva FK, cópias de nome/preço e histórico de uma venda existente', async () => {
    const produto = await criar('peixes'), antes = await estado(produto.id)
    const venda = (await cliente.query(`INSERT INTO vendas (cliente_id,subtotal,frete,total,tipo_entrega,
      entrega_destinatario,entrega_telefone,prazo_entrega_dias) VALUES ($1,8990,0,8990,'retirada','Fixture','32999999999',0) RETURNING id`, [usuarios.get('cliente')])).rows[0]
    await cliente.query('INSERT INTO itens_venda (venda_id,produto_id,nome_produto,preco_unitario,quantidade,subtotal) VALUES ($1,$2,$3,8990,1,8990)', [venda.id, produto.id, produto.nome])
    await cliente.query("INSERT INTO historico_status_venda (venda_id,status_novo,origem) VALUES ($1,'aguardando_pagamento','sistema')", [venda.id])
    const tabelas = ['vendas', 'itens_venda', 'historico_status_venda']
    const historicoAntes = await Promise.all(tabelas.map(async (t) => (await cliente.query(`SELECT * FROM ${t} ORDER BY id`)).rows))
    const fichaAntes = await ficha(produto.id, 'peixes')
    await sucesso(await remover(produto.id)); await preservado(produto.id, antes)
    assert.deepEqual(await ficha(produto.id, 'peixes'), fichaAntes)
    assert.deepEqual(await Promise.all(tabelas.map(async (t) => (await cliente.query(`SELECT * FROM ${t} ORDER BY id`)).rows)), historicoAntes)
    assert.equal((await cliente.query('SELECT p.id FROM produtos p JOIN itens_venda i ON i.produto_id=p.id WHERE i.venda_id=$1', [venda.id])).rows[0].id, produto.id)
  })
  it('falha real da tabela retorna 500 genérico e permite nova tentativa após recuperar o banco', async () => {
    const produto = await criar(), antes = await estado(produto.id)
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE produtos RENAME TO produtos_indisponiveis')
    try {
      const r = await remover(produto.id); assert.equal(r.status, 500)
      assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
    } finally { await cliente.query('ALTER TABLE produtos_indisponiveis RENAME TO produtos'); log.mock.restore() }
    assert.deepEqual(await estado(produto.id), antes)
    await sucesso(await remover(produto.id))
  })
  it('falha de trigger desfaz a escrita e preserva ativo, timestamp e ficha', async () => {
    const produto = await criar('peixes'), antes = await estado(produto.id), fichaAntes = await ficha(produto.id, 'peixes')
    const log = mock.method(console, 'error', () => {})
    await cliente.query(`CREATE FUNCTION rejeitar_desativacao() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Detalhe interno fixture'; END $$`)
    await cliente.query('CREATE TRIGGER rejeitar_desativacao BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION rejeitar_desativacao()')
    try {
      const r = await remover(produto.id); assert.equal(r.status, 500)
      assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
      assert.deepEqual(await estado(produto.id), antes); assert.deepEqual(await ficha(produto.id, 'peixes'), fichaAntes)
    } finally {
      await cliente.query('DROP TRIGGER rejeitar_desativacao ON produtos'); await cliente.query('DROP FUNCTION rejeitar_desativacao()'); log.mock.restore()
    }
  })

  async function concorrentes(modo) {
    const produto = await criar('peixes'), antes = await estado(produto.id), fichaAntes = await ficha(produto.id, 'peixes')
    const bloqueador = new pg.Client({ connectionString: urlAplicacao.toString() })
    const chave = 773130
    let primeira, segunda
    await bloqueador.connect()
    await cliente.query(`CREATE FUNCTION pausar_desativacao() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF ${modo === 'patch-primeiro' ? "NEW.nome = 'PATCH concorrente'" : 'OLD.ativo AND NOT NEW.ativo'}
        THEN PERFORM pg_advisory_xact_lock(${chave}); END IF; RETURN NEW; END $$`)
    await cliente.query('CREATE TRIGGER pausar_desativacao BEFORE UPDATE ON produtos FOR EACH ROW EXECUTE FUNCTION pausar_desativacao()')
    try {
      await bloqueador.query('BEGIN'); await bloqueador.query('SELECT pg_advisory_xact_lock($1)', [chave])
      if (modo === 'patch-primeiro') {
        primeira = escrever('PATCH', `/api/produtos/${produto.id}`, { nome: 'PATCH concorrente', ficha: { dados: { origem: 'Origem editada' } } })
      } else primeira = remover(produto.id)
      await aguardarLock('UPDATE produtos')
      segunda = modo === 'dois-deletes' ? remover(produto.id)
        : modo === 'patch-primeiro' ? remover(produto.id)
          : escrever('PATCH', `/api/produtos/${produto.id}`, { nome: 'Não aplicar', ficha: { dados: { origem: 'Não aplicar' } } })
      await aguardarLock(modo === 'delete-primeiro' ? 'SELECT categoria_id' : 'UPDATE produtos', modo === 'delete-primeiro' ? 1 : 2)
      await bloqueador.query('COMMIT')
      const r1 = await primeira, r2 = await segunda
      if (modo === 'patch-primeiro') {
        assert.equal(r1.status, 200); const dto = await r1.json(); assert.equal(dto.nome, 'PATCH concorrente')
        await sucesso(r2)
        const final = await estado(produto.id)
        assert.equal(final.nome, 'PATCH concorrente'); assert.equal(final.ativo, false); assert.equal(final.estoque, antes.estoque)
        assert.equal((await ficha(produto.id, 'peixes')).origem, 'Origem editada')
      } else {
        await sucesso(r1); await naoEncontrado(r2)
        await preservado(produto.id, antes); assert.deepEqual(await ficha(produto.id, 'peixes'), fichaAntes)
      }
      assert.equal((await fetch(`${origem}/api/produtos/${produto.id}`)).status, 404)
      assert.equal((await fetch(`${origem}/api/peixes/${produto.id}`)).status, 404)
    } finally {
      await bloqueador.query('ROLLBACK')
      await Promise.allSettled([primeira, segunda].filter(Boolean)); await bloqueador.end()
      await cliente.query('DROP TRIGGER pausar_desativacao ON produtos'); await cliente.query('DROP FUNCTION pausar_desativacao()')
    }
  }
  it('PATCH obtém o lock primeiro: edição confirma e DELETE preserva seus campos e ficha', async () => concorrentes('patch-primeiro'))
  it('DELETE obtém o lock primeiro: PATCH aguarda e retorna 404 sem editar ficha nem reativar', async () => concorrentes('delete-primeiro'))
  it('dois DELETEs concorrentes: um 204, outro 404, sem dupla alteração', async () => concorrentes('dois-deletes'))
})
