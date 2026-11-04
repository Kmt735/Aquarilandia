import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const url = process.env.TEST_DATABASE_URL
describe('Estoque administrativo — HTTP e PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `estoque_${randomUUID().replaceAll('-', '')}`
  let cliente, pool, servidor, origem, cors, urlApp, criado = false
  const usuarios = new Map(), tokens = new Map()
  before(async () => {
    cliente = new pg.Client({ connectionString: url }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); criado = true; await cliente.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '30_estoque.sql', '31_estoque_vendas.sql']) await cliente.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    for (const [nome, papel, ativo, prazo] of [['admin', 'admin', true, '1 hour'], ['outro', 'admin', true, '1 hour'],
      ['cliente', 'cliente', true, '1 hour'], ['mutavel', 'admin', true, '1 hour'], ['vencido', 'admin', true, '-1 hour'], ['inativo', 'admin', false, '1 hour']]) {
      const id = (await cliente.query('INSERT INTO clientes(nome,email,senha_hash,papel,ativo) VALUES($1,$2,$3,$4,$5) RETURNING id', [nome, `${nome}@fixture.example`, 'hash-fixture', papel, ativo])).rows[0].id
      usuarios.set(nome, id); const token = randomUUID(); tokens.set(nome, token)
      await cliente.query('INSERT INTO sessoes(token_hash,cliente_id,expira_em) VALUES($1,$2,now()+$3::interval)', [hashToken(token), id, prazo])
    }
    urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts'); const { db } = await import('../../src/config/db.ts'); const { env } = await import('../../src/config/env.ts')
    pool = db; cors = env.corsOrigin; servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening'); origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    try { if (servidor) await new Promise((r) => servidor.close(r)); if (pool) await pool.end() }
    finally { if (cliente) { try { if (criado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await cliente.end() } } }
  })
  async function novo({ ativo = true, tipo = 'acessorios', ficha = false } = {}) {
    const id = (await cliente.query('INSERT INTO produtos(categoria_id,nome,preco,ativo) SELECT id,$2,12345,$3 FROM categorias WHERE slug=$1 RETURNING id', [tipo, `Produto ${randomUUID()}`, ativo])).rows[0].id
    if (ficha) await cliente.query(`INSERT INTO peixes(produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)
      VALUES($1,$2,'doce',5,24,28,6,7,40,'pacifico','iniciante')`, [id, `Species ${randomUUID()}`])
    return id
  }
  function movimento(id, { tipo = 'entrada', quantidade = 1, motivo = 'Movimento de teste', chave = randomUUID(), sessao = 'admin', origin = cors, extra = {} } = {}) {
    const headers = { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': chave }
    if (sessao) headers.Cookie = `sid=${tokens.get(sessao) ?? sessao}`
    return fetch(`${origem}/api/estoque/movimentacoes`, { method: 'POST', headers,
      body: JSON.stringify({ produtoId: id, tipo, quantidade, motivo, ...extra }) })
  }
  const ler = async (id) => (await cliente.query('SELECT nome,preco,estoque,ativo,atualizado_em FROM produtos WHERE id=$1', [id])).rows[0]
  const contagem = async () => (await cliente.query(`SELECT (SELECT count(*)::int FROM operacoes_estoque) AS operacoes,
    (SELECT count(*)::int FROM movimentacoes_estoque) AS movimentos`)).rows[0]
  async function aplicar(id, opcoes = {}) { const r = await movimento(id, opcoes); assert.equal(r.status, 201, await r.clone().text()); return r.json() }
  async function reconciliar() {
    const divergencias = (await cliente.query(`SELECT p.id FROM produtos p LEFT JOIN
      (SELECT produto_id,sum(delta) AS saldo FROM movimentacoes_estoque GROUP BY produto_id) m ON m.produto_id=p.id
      WHERE p.estoque::bigint <> COALESCE(m.saldo,0)`)).rows
    assert.deepEqual(divergencias, [])
  }
  async function aguardarLock(prefixo, total = 1) {
    for (let n = 0; n < 300; n++) {
      const { rows } = await cliente.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE $2", [schema, `${prefixo}%`])
      if (rows[0].n >= total) return
      await esperar(10)
    }
    assert.fail(`Não observou o lock de ${prefixo}`)
  }
  for (const [sessao, status] of [[null, 401], ['inventada', 401], ['vencido', 401], ['inativo', 401], ['cliente', 403]]) {
    it(`sessão ${sessao} não movimenta nem revela saldo (${status})`, async () => {
      const id = await novo(); const antes = await contagem()
      const r = await movimento(id, { sessao }); assert.equal(r.status, status)
      assert.doesNotMatch(await r.text(), /saldo|12345|Movimento de teste/)
      assert.equal((await ler(id)).estoque, 0); assert.deepEqual(await contagem(), antes)
    })
  }
  for (const origin of ['', 'null', 'https://invalida.example']) {
    it(`admin com Origin ${JSON.stringify(origin)} não grava`, async () => {
      const id = await novo(); const antes = await contagem()
      assert.equal((await movimento(id, { origin })).status, 403); assert.deepEqual(await contagem(), antes)
    })
  }
  it('papel atual e revogação são revalidados também no replay', async () => {
    const id = await novo(), chave = randomUUID(); await aplicar(id, { sessao: 'mutavel', chave })
    await cliente.query("UPDATE clientes SET papel='cliente' WHERE id=$1", [usuarios.get('mutavel')])
    try {
      assert.equal((await movimento(id, { sessao: 'mutavel', chave })).status, 403)
      await cliente.query('DELETE FROM sessoes WHERE cliente_id=$1', [usuarios.get('mutavel')])
      assert.equal((await movimento(id, { sessao: 'mutavel', chave })).status, 401)
      assert.equal((await ler(id)).estoque, 1)
    } finally { await cliente.query("UPDATE clientes SET papel='admin' WHERE id=$1", [usuarios.get('mutavel')]) }
  })
  it('os quatro tipos geram sinal, autoria, snapshot e histórico conciliável', async () => {
    const id = await novo(); const resultados = []
    resultados.push(await aplicar(id, { quantidade: 10 }))
    resultados.push(await aplicar(id, { tipo: 'ajuste_positivo', quantidade: 3 }))
    resultados.push(await aplicar(id, { tipo: 'ajuste_negativo', quantidade: 2 }))
    resultados.push(await aplicar(id, { tipo: 'saida', quantidade: 11 }))
    assert.deepEqual(resultados.map((r) => [r.saldoAnterior, r.saldoAtual]), [[0, 10], [10, 13], [13, 11], [11, 0]])
    const hist = (await cliente.query(`SELECT m.delta,o.autor_id,o.origem,m.motivo FROM movimentacoes_estoque m JOIN operacoes_estoque o ON o.id=m.operacao_id WHERE produto_id=$1 ORDER BY m.id`, [id])).rows
    assert.deepEqual(hist.map((m) => m.delta), [10, 3, -2, -11]); assert.ok(hist.every((m) => m.autor_id === usuarios.get('admin') && m.origem === 'admin'))
    assert.equal((await ler(id)).preco, 12345); await reconciliar()
  })
  it('permite entrada/saída em inativo sem reativar nem expor o produto publicamente', async () => {
    const id = await novo({ ativo: false }); await aplicar(id, { quantidade: 3 }); await aplicar(id, { tipo: 'saida' })
    assert.equal((await ler(id)).estoque, 2); assert.equal((await ler(id)).ativo, false)
    assert.equal((await fetch(`${origem}/api/produtos/${id}`)).status, 404)
    await reconciliar()
  })
  it('motivo com aspas e aparência de SQL permanece texto literal, sem executar conteúdo', async () => {
    const id = await novo(), motivo = "Reposição '); DROP TABLE produtos; -- %_"
    const resultado = await aplicar(id, { motivo })
    assert.equal(resultado.saldoAtual, 1)
    assert.equal((await cliente.query('SELECT motivo FROM movimentacoes_estoque WHERE operacao_id=$1', [resultado.operacaoId])).rows[0].motivo, motivo)
    assert.equal((await ler(id)).estoque, 1); await reconciliar()
  })
  it('inexistente, saldo insuficiente, zero e overflow não deixam operação nem movimento', async () => {
    const id = await novo(); const antes = await contagem()
    assert.equal((await movimento(2147483647)).status, 404)
    assert.equal((await movimento(id, { tipo: 'saida' })).status, 409)
    assert.equal((await movimento(id, { quantidade: 0 })).status, 400)
    assert.deepEqual(await contagem(), antes)
    await aplicar(id, { quantidade: 2147483647 }); const apos = await contagem()
    assert.equal((await movimento(id)).status, 409)
    assert.equal((await ler(id)).estoque, 2147483647); assert.deepEqual(await contagem(), apos)
    await reconciliar()
  })
  it('recusa campos protegidos, tipos internos, números e texto inválidos sem gravar', async () => {
    const id = await novo(); const antes = await contagem()
    for (const opcoes of [{ quantidade: -1 }, { quantidade: 1.1 }, { quantidade: '1' }, { quantidade: 2147483648 },
      { motivo: '' }, { motivo: 'x'.repeat(301) }, { motivo: 'Linha\nquebrada' }, { tipo: 'abertura' }, { tipo: 'reserva' },
      { extra: { estoque: 10 } }, { extra: { ativo: true } }, { extra: { preco: 1 } }, { extra: { vendaId: 1 } },
      { extra: { autorId: usuarios.get('outro') } }, { chave: 'nao-uuid' }]) {
      assert.equal((await movimento(id, opcoes)).status, 400)
    }
    assert.deepEqual(await contagem(), antes); assert.equal((await ler(id)).estoque, 0)
  })
  it('replay devolve saldo histórico mesmo após outro movimento e o mesmo UUID é independente por admin', async () => {
    const id = await novo(), chave = randomUUID(); const r = await aplicar(id, { quantidade: 10, chave, motivo: '  Reposição  ' })
    await aplicar(id, { quantidade: 5 })
    const antes = await contagem()
    assert.deepEqual(await aplicar(id, { quantidade: 10, chave, motivo: 'Reposic\u0327a\u0303o' }), r)
    assert.equal((await ler(id)).estoque, 15); assert.deepEqual(await contagem(), antes)
    for (const opcoes of [{ quantidade: 11 }, { tipo: 'saida' }, { motivo: 'Outra intenção' }]) {
      assert.equal((await movimento(id, { chave, quantidade: 10, motivo: 'Reposição', ...opcoes })).status, 409)
    }
    const outroId = await novo()
    assert.equal((await movimento(outroId, { chave, quantidade: 10, motivo: 'Reposição' })).status, 409)
    const outro = await aplicar(id, { quantidade: 10, chave, motivo: 'Reposição', sessao: 'outro' })
    assert.notEqual(outro.operacaoId, r.operacaoId); assert.equal((await ler(id)).estoque, 25)
    await reconciliar()
  })
  it('uma falha após UPDATE desfaz saldo, operação e histórico; mesma chave pode ser tentada novamente', async () => {
    const id = await novo(), chave = randomUUID(); const antes = await contagem(), estado = await ler(id)
    const logs = mock.method(console, 'error', () => {})
    await cliente.query(`CREATE FUNCTION falhar_movimento() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'NAO_LOGAR_SQL_SENHA_MOTIVO'; END $$`)
    await cliente.query('CREATE TRIGGER falhar_movimento BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION falhar_movimento()')
    try {
      const r = await movimento(id, { chave, motivo: 'NAO_LOGAR_MOTIVO' }); assert.equal(r.status, 500)
      assert.deepEqual(await r.json(), { erro: 'Erro interno do servidor' })
      assert.deepEqual(await ler(id), estado); assert.deepEqual(await contagem(), antes)
      assert.doesNotMatch(JSON.stringify(logs.mock.calls), /NAO_LOGAR|INSERT|UPDATE/)
    } finally { await cliente.query('DROP TRIGGER falhar_movimento ON movimentacoes_estoque'); await cliente.query('DROP FUNCTION falhar_movimento()') }
    assert.equal((await aplicar(id, { chave })).saldoAtual, 1); await reconciliar()
  })
  for (const iguais of [true, false]) {
    it(`duas requisições simultâneas com a mesma chave e ${iguais ? 'mesma intenção' : 'intenções diferentes'}`, async () => {
      const id = await novo(), chave = randomUUID(); const antes = await contagem()
      const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect()
      let primeira, segunda
      try {
        await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [id])
        primeira = movimento(id, { chave, quantidade: 2 }); await aguardarLock('SELECT estoque FROM produtos')
        segunda = movimento(id, { chave, quantidade: iguais ? 2 : 3 }); await aguardarLock('INSERT INTO operacoes_estoque')
        await gate.query('COMMIT')
        const respostas = await Promise.all([primeira, segunda])
        assert.deepEqual(respostas.map((r) => r.status), [201, iguais ? 201 : 409])
        if (iguais) assert.deepEqual(await respostas[0].json(), await respostas[1].json())
        assert.equal((await ler(id)).estoque, 2)
        const depois = await contagem(); assert.equal(depois.operacoes - antes.operacoes, 1); assert.equal(depois.movimentos - antes.movimentos, 1)
      } finally { await gate.query('ROLLBACK'); await Promise.allSettled([primeira, segunda].filter(Boolean)); await gate.end() }
      await reconciliar()
    })
  }
  it('duas saídas simultâneas disputando a última unidade: uma 201, outra 409 e saldo zero', async () => {
    const id = await novo(); await aplicar(id); const antes = await contagem()
    const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); let pendentes = []
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [id])
      pendentes = [movimento(id, { tipo: 'saida' }), movimento(id, { tipo: 'saida' })]
      await aguardarLock('SELECT estoque FROM produtos', 2); await gate.query('COMMIT')
      assert.deepEqual((await Promise.all(pendentes)).map((r) => r.status).sort(), [201, 409])
      assert.equal((await ler(id)).estoque, 0)
      const depois = await contagem(); assert.equal(depois.operacoes - antes.operacoes, 1); assert.equal(depois.movimentos - antes.movimentos, 1)
    } finally { await gate.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end() }
    await reconciliar()
  })
  it('se a primeira transação com a chave falha, a concorrente prossegue sem perder nem duplicar saldo', async () => {
    const id = await novo(), chave = randomUUID(); const antes = await contagem()
    mock.method(console, 'error', () => {})
    await cliente.query('CREATE SEQUENCE falha_uma_vez')
    await cliente.query(`CREATE FUNCTION falhar_uma_vez() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF nextval('falha_uma_vez')=1 THEN RAISE EXCEPTION 'falha controlada'; END IF; RETURN NEW; END $$`)
    await cliente.query('CREATE TRIGGER falha_uma_vez BEFORE INSERT ON movimentacoes_estoque FOR EACH ROW EXECUTE FUNCTION falhar_uma_vez()')
    const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect(); let pendentes = []
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [id])
      pendentes.push(movimento(id, { chave, quantidade: 2 })); await aguardarLock('SELECT estoque FROM produtos')
      pendentes.push(movimento(id, { chave, quantidade: 2 })); await aguardarLock('INSERT INTO operacoes_estoque')
      await gate.query('COMMIT')
      assert.deepEqual((await Promise.all(pendentes)).map((r) => r.status), [500, 201])
      assert.equal((await ler(id)).estoque, 2)
      const depois = await contagem(); assert.equal(depois.operacoes - antes.operacoes, 1); assert.equal(depois.movimentos - antes.movimentos, 1)
    } finally {
      await gate.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end()
      await cliente.query('DROP TRIGGER falha_uma_vez ON movimentacoes_estoque'); await cliente.query('DROP FUNCTION falhar_uma_vez()'); await cliente.query('DROP SEQUENCE falha_uma_vez')
    }
    await reconciliar()
  })
  it('movimentos serializam com PATCH, DELETE e reativação sem sobrescrever preço, nome ou ativo', async () => {
    const id = await novo(); const gate = new pg.Client({ connectionString: urlApp.toString() }); await gate.connect()
    let pendentes = []
    try {
      await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [id])
      const cabecalhos = { Origin: cors, Cookie: `sid=${tokens.get('admin')}`, 'Content-Type': 'application/json' }
      const editar = fetch(`${origem}/api/produtos/${id}`, { method: 'PATCH', headers: cabecalhos, body: JSON.stringify({ nome: 'Nome atualizado', preco: 9999 }) })
      await aguardarLock('SELECT categoria_id')
      pendentes = [editar, movimento(id, { quantidade: 3 })]; await aguardarLock('SELECT estoque FROM produtos')
      await gate.query('COMMIT')
      assert.deepEqual((await Promise.all(pendentes)).map((r) => r.status), [200, 201])
      assert.equal((await ler(id)).preco, 9999); assert.equal((await ler(id)).nome, 'Nome atualizado')
      await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [id])
      const remover = fetch(`${origem}/api/produtos/${id}`, { method: 'DELETE', headers: cabecalhos })
      await aguardarLock('UPDATE produtos SET ativo = false')
      pendentes = [remover, movimento(id, { tipo: 'saida' })]; await aguardarLock('SELECT estoque FROM produtos')
      await gate.query('COMMIT')
      assert.deepEqual((await Promise.all(pendentes)).map((r) => r.status), [204, 201])
      assert.equal((await ler(id)).ativo, false); assert.equal((await ler(id)).estoque, 2)
      await gate.query('BEGIN'); await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE', [id])
      const reativar = fetch(`${origem}/api/produtos/${id}/reativar`, { method: 'POST', headers: cabecalhos })
      await aguardarLock('SELECT ativo FROM produtos')
      pendentes = [reativar, movimento(id)]; await aguardarLock('SELECT estoque FROM produtos')
      await gate.query('COMMIT')
      assert.deepEqual((await Promise.all(pendentes)).map((r) => r.status), [200, 201])
      assert.equal((await ler(id)).ativo, true); assert.equal((await ler(id)).estoque, 3); assert.equal((await ler(id)).preco, 9999)
    } finally { await gate.query('ROLLBACK'); await Promise.allSettled(pendentes); await gate.end() }
    await reconciliar()
  })
  it('entrada/saída alteram emEstoque e a consulta exata da vitrine, sem expor histórico ou quantidade pública', async () => {
    const peixe = await novo({ tipo: 'peixes', ficha: true }), semFicha = await novo({ tipo: 'peixes' }), inativo = await novo({ tipo: 'peixes', ficha: true, ativo: false })
    await aplicar(peixe, { quantidade: 2 }); await aplicar(semFicha); await aplicar(inativo)
    const consultar = async () => {
      const r = await fetch(`${origem}/api/peixes?em_estoque=true&pagina=1&limite=3`); assert.equal(r.status, 200); return r.json()
    }
    const lista = await consultar(); assert.deepEqual(lista.itens.map((p) => p.id), [peixe]); assert.equal(lista.total, 1)
    for (const caminho of [`produtos/${peixe}`, `peixes/${peixe}`, 'produtos?categoria=peixes']) {
      const r = await fetch(`${origem}/api/${caminho}`); assert.equal(r.status, 200)
      const body = await r.json(); const item = body.itens ? body.itens.find((p) => p.id === peixe) : body
      assert.equal(item.emEstoque, true)
      for (const campo of ['estoque', 'saldoAtual', 'movimentacoes', 'autorId', 'hashRequisicao', 'motivo']) assert.equal(campo in item, false)
    }
    await aplicar(peixe, { tipo: 'saida', quantidade: 2 })
    assert.deepEqual(await consultar(), { itens: [], total: 0 })
    assert.equal((await (await fetch(`${origem}/api/peixes/${peixe}`)).json()).emEstoque, false)
    assert.equal((await fetch(`${origem}/api/peixes/${semFicha}`)).status, 404)
    assert.equal((await fetch(`${origem}/api/peixes/${inativo}`)).status, 404)
    assert.equal((await fetch(`${origem}/api/categorias`)).status, 200)
    await reconciliar()
  })
})
