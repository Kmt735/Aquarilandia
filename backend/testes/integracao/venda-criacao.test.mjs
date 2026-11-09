import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { setTimeout as esperar } from 'node:timers/promises'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'
import { gerarHash } from '../../src/modulos/clientes/senha.ts'

const url = process.env.TEST_DATABASE_URL
describe('POST /api/vendas (#30, #31) — PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `venda_criacao_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, api, origem, estoque, produtos, limites, config, adminId, criado = false

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '21_vendas_idempotencia.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    adminId = (await c.query("INSERT INTO clientes (nome, email, senha_hash, papel) VALUES ('Admin', 'admin@venda.example', 'hash', 'admin') RETURNING id")).rows[0].id
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    origem = (await import('../../src/config/env.ts')).env.corsOrigin
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    produtos = (await import('../../src/modulos/catalogo/produto.service.ts')).produtoService
    limites = await import('../../src/middlewares/rateLimit.ts')
    config = (await import('../../src/modulos/vendas/frete.config.ts')).configFrete
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  // ---------- fixtures (só no schema descartável) ----------
  async function produto({ slug = 'acessorios', preco = 1000, ativo = true, saldo = 100 } = {}) {
    const nome = `Produto ${randomUUID().slice(0, 8)}`
    const id = (await c.query('INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $2, $3, true FROM categorias WHERE slug = $1 RETURNING id',
      [slug, nome, preco])).rows[0].id
    // Saldo pela entrada administrativa do Dev 2, para o histórico do estoque fechar com o saldo
    if (saldo) await estoque.registrarMovimentacao(adminId, { produtoId: id, tipo: 'entrada', quantidade: saldo, motivo: 'Saldo de teste' }, randomUUID(), {})
    if (!ativo) await c.query('UPDATE produtos SET ativo = false WHERE id = $1', [id])
    return id
  }
  async function cliente({ telefone = '32999990000', senha = null } = {}) {
    const hash = senha ? await gerarHash(senha) : 'hash-fixture-sem-login'
    const id = (await c.query('INSERT INTO clientes (nome, email, senha_hash, telefone) VALUES ($1, $2, $3, $4) RETURNING id',
      [`Comprador ${randomUUID().slice(0, 6)}`, `${randomUUID()}@venda.example`, hash, telefone])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token, senha }
  }
  async function endereco(clienteId, cep = '36307000') {
    return (await c.query(`INSERT INTO enderecos_cliente (cliente_id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf)
      VALUES ($1, 'Casa', $2, 'Rua Teste', '10', 'Apto 1', 'Centro', 'São João del Rei', 'MG') RETURNING id`, [clienteId, cep])).rows[0].id
  }
  async function pedir(metodo, caminho, body, { token, comOrigem = true, chave } = {}) {
    const resposta = await fetch(`${api}${caminho}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(comOrigem ? { Origin: origem } : {}),
        ...(token ? { Cookie: `sid=${token}` } : {}),
        ...(chave ? { 'Idempotency-Key': chave } : {}),
      },
      body: JSON.stringify(body),
    })
    const texto = await resposta.text()
    return { status: resposta.status, corpo: texto ? JSON.parse(texto) : null, repetida: resposta.headers.get('idempotent-replayed') }
  }
  // Lote 9b: como o frontend, o total esperado vem da cotação (#28) do mesmo carrinho e da mesma entrega.
  // Cotação recusada (carrinho inválido) → 0: a venda falha pela mesma validação, não pelo total
  async function totalDaCotacao(body) {
    const destino = body.enderecoId === undefined
      ? { retirada: body.retirada }
      : { cep: (await c.query('SELECT cep FROM enderecos_cliente WHERE id = $1', [body.enderecoId])).rows[0]?.cep ?? '36300000' }
    limites.limiteFrete.resetKey('127.0.0.1')
    const cotacao = await pedir('POST', '/frete/calcular', { itens: body.itens, ...destino })
    return cotacao.status === 200 ? cotacao.corpo.total : 0
  }
  // Lote 9b: o Idempotency-Key e o totalEsperado são obrigatórios; cada compra destes casos é uma tentativa nova
  // (chave nova) e, se o caso não trouxer o totalEsperado, ele vem da cotação
  async function comprar(quem, body, opcoes = {}) {
    const completo = 'totalEsperado' in body || !Array.isArray(body.itens) ? body : { ...body, totalEsperado: await totalDaCotacao(body) }
    return pedir('POST', '/vendas', completo, { token: quem.token, chave: randomUUID(), ...opcoes })
  }
  const itens = (...pares) => pares.map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
  const saldo = async (id) => (await c.query('SELECT estoque FROM produtos WHERE id = $1', [id])).rows[0].estoque
  const contagem = async () => (await c.query(`SELECT (SELECT count(*)::int FROM vendas) AS vendas, (SELECT count(*)::int FROM itens_venda) AS itens,
    (SELECT count(*)::int FROM historico_status_venda) AS historico, (SELECT count(*)::int FROM operacoes_estoque WHERE origem = 'venda') AS baixas`)).rows[0]
  const abertas = async (clienteId) => (await c.query("SELECT count(*)::int AS n FROM vendas WHERE cliente_id = $1 AND status = 'aguardando_pagamento'", [clienteId])).rows[0].n
  const comTimeout = (promessa, ms = 10000) => Promise.race([promessa, esperar(ms).then(() => assert.fail(`Timeout de ${ms} ms: possível deadlock.`))])

  // ---------- #30 ----------
  it('6. venda válida → 201; total com os preços do catálogo; estoque baixado; repetidos somados; 1 histórico; 1 baixa', async () => {
    const quem = await cliente(), end = await endereco(quem.id)
    const a = await produto({ preco: 1990, saldo: 10 }), b = await produto({ slug: 'racoes', preco: 500, saldo: 10 })
    const r = await comprar(quem, { itens: itens([a, 2], [b, 1], [a, 1]), enderecoId: end })
    assert.equal(r.status, 201, JSON.stringify(r.corpo))

    const subtotal = 1990 * 3 + 500, sjdr = config.saoJoaoDelRei
    assert.equal(r.corpo.status, 'aguardando_pagamento')
    assert.equal(r.corpo.tipoEntrega, 'propria')
    assert.deepEqual([r.corpo.subtotal, r.corpo.frete, r.corpo.total, r.corpo.prazoEntregaDias], [subtotal, sjdr.valor, subtotal + sjdr.valor, sjdr.prazoDias])
    assert.deepEqual(r.corpo.itens.map((i) => [i.produtoId, i.quantidade, i.precoUnitario, i.subtotal]), [[a, 3, 1990, 5970], [b, 1, 500, 500]])
    assert.ok(r.corpo.itens.every((i) => typeof i.nomeProduto === 'string' && i.nomeProduto.startsWith('Produto ')))
    assert.deepEqual(r.corpo.entrega, { cep: '36307000', logradouro: 'Rua Teste', numero: '10', complemento: 'Apto 1', bairro: 'Centro',
      cidade: 'São João del Rei', uf: 'MG', destinatario: (await c.query('SELECT nome FROM clientes WHERE id = $1', [quem.id])).rows[0].nome, telefone: '32999990000' })
    const minutos = (new Date(r.corpo.expiraEm) - new Date(r.corpo.criadoEm)) / 60000
    assert.ok(Math.abs(minutos - 30) < 0.1, `expira em ~30 min (veio ${minutos})`)

    const id = r.corpo.id
    assert.deepEqual([await saldo(a), await saldo(b)], [7, 9])
    const linhas = (await c.query('SELECT produto_id, quantidade, preco_unitario, subtotal FROM itens_venda WHERE venda_id = $1 ORDER BY produto_id', [id])).rows
    assert.equal(linhas.length, 2)
    const hist = (await c.query('SELECT status_anterior, status_novo, origem, alterado_por_id FROM historico_status_venda WHERE venda_id = $1', [id])).rows
    assert.deepEqual(hist, [{ status_anterior: null, status_novo: 'aguardando_pagamento', origem: 'cliente', alterado_por_id: quem.id }])
    assert.equal((await c.query("SELECT count(*)::int AS n FROM operacoes_estoque WHERE venda_id = $1 AND tipo_venda = 'baixa_venda'", [id])).rows[0].n, 1)
    const venda = (await c.query('SELECT cliente_id, entrega_cep, entrega_telefone, total FROM vendas WHERE id = $1', [id])).rows[0]
    assert.deepEqual(venda, { cliente_id: quem.id, entrega_cep: '36307000', entrega_telefone: '32999990000', total: subtotal + sjdr.valor })
  })

  it('7. precoUnitario, total, status e clienteId do body são ignorados', async () => {
    const quem = await cliente(), outro = await cliente(), p = await produto({ preco: 4000 })
    const r = await comprar(quem, {
      itens: [{ produtoId: p, quantidade: 2, precoUnitario: 1, subtotal: 1 }],
      retirada: true, total: 1, subtotal: 1, frete: 0, status: 'paga', clienteId: outro.id,
    })
    assert.equal(r.status, 201)
    assert.deepEqual([r.corpo.total, r.corpo.status, r.corpo.itens[0].precoUnitario], [8000, 'aguardando_pagamento', 4000])
    const venda = (await c.query('SELECT cliente_id, status, total FROM vendas WHERE id = $1', [r.corpo.id])).rows[0]
    assert.deepEqual(venda, { cliente_id: quem.id, status: 'aguardando_pagamento', total: 8000 })
  })

  it('8. estoque insuficiente → 409 em itens.<indiceOriginal>.quantidade; nada gravado e o estoque igual', async () => {
    const quem = await cliente(), a = await produto({ saldo: 5 }), b = await produto({ saldo: 1 })
    const antes = await contagem()
    const r = await comprar(quem, { itens: itens([a, 1], [a, 1], [b, 2]), retirada: true })
    assert.equal(r.status, 409)
    assert.deepEqual(r.corpo, { erro: 'Estoque insuficiente', detalhes: { 'itens.2.quantidade': 'Não temos essa quantidade em estoque.' } })
    assert.deepEqual(await contagem(), antes)
    assert.deepEqual([await saldo(a), await saldo(b)], [5, 1])
  })

  it('9. endereço de outro → 404; sem telefone → 422; peixe fora → 422; inativo → 422 (nunca 409); sem entrega → 422', async () => {
    const quem = await cliente(), dono = await cliente(), p = await produto(), peixe = await produto({ slug: 'peixes' })
    const inativo = await produto({ ativo: false, saldo: 0 })
    const antes = await contagem()

    const alheio = await comprar(quem, { itens: itens([p, 1]), enderecoId: await endereco(dono.id) })
    assert.deepEqual([alheio.status, alheio.corpo.erro], [404, 'Endereço não encontrado.'])
    assert.equal((await comprar(quem, { itens: itens([p, 1]), enderecoId: 2147483000 })).status, 404)

    const semTelefone = await comprar(await cliente({ telefone: null }), { itens: itens([p, 1]), retirada: true })
    assert.deepEqual([semTelefone.status, semTelefone.corpo.detalhes], [422, { telefone: 'Cadastre um celular na sua conta antes de finalizar a compra.' }])

    const longe = await comprar(quem, { itens: itens([p, 1], [p, 1], [peixe, 1]), enderecoId: await endereco(quem.id, '01001000') })
    assert.deepEqual([longe.status, longe.corpo.detalhes], [422, { 'itens.2.produtoId': 'Este peixe só pode ser entregue em São João del Rei.' }])

    const desativado = await comprar(quem, { itens: itens([p, 1], [inativo, 1]), retirada: true })
    assert.deepEqual([desativado.status, desativado.corpo.detalhes], [422, { 'itens.1.produtoId': 'Produto indisponível.' }])

    const semEntrega = await comprar(quem, { itens: itens([p, 1]) })
    assert.deepEqual([semEntrega.status, semEntrega.corpo.detalhes], [422, { entrega: 'Escolha um endereço de entrega ou retirar na loja.' }])

    assert.deepEqual(await contagem(), antes)
    assert.equal(await saldo(p), 100)
  })

  it('10. retirada → tipo_entrega retirada, frete 0, nenhum entrega_* e entrega null na resposta', async () => {
    const quem = await cliente(), p = await produto({ preco: 1500 }), peixe = await produto({ slug: 'peixes', preco: 800 })
    const r = await comprar(quem, { itens: itens([p, 1], [peixe, 2]), retirada: true })
    assert.equal(r.status, 201)
    assert.deepEqual([r.corpo.tipoEntrega, r.corpo.frete, r.corpo.total, r.corpo.entrega, r.corpo.prazoEntregaDias],
      ['retirada', 0, 3100, null, config.prazoRetiradaDias])
    const venda = (await c.query(`SELECT tipo_entrega, frete, entrega_cep, entrega_logradouro, entrega_numero, entrega_complemento,
      entrega_bairro, entrega_cidade, entrega_uf, entrega_telefone FROM vendas WHERE id = $1`, [r.corpo.id])).rows[0]
    assert.deepEqual(venda, { tipo_entrega: 'retirada', frete: 0, entrega_cep: null, entrega_logradouro: null, entrega_numero: null,
      entrega_complemento: null, entrega_bairro: null, entrega_cidade: null, entrega_uf: null, entrega_telefone: '32999990000' })
  })

  it('11. sem login → 401; sem Origin → 403', async () => {
    const quem = await cliente(), p = await produto()
    const antes = await contagem()
    assert.equal((await pedir('POST', '/vendas', { itens: itens([p, 1]), retirada: true }, { chave: randomUUID() })).status, 401)
    assert.equal((await comprar(quem, { itens: itens([p, 1]), retirada: true }, { comOrigem: false })).status, 403)
    assert.deepEqual(await contagem(), antes)
  })

  it('12. preço muda no meio: o UPDATE de outra conexão espera o COMMIT e a venda grava o preço antigo', async () => {
    const quem = await cliente(), p = await produto({ preco: 1000 })
    const original = produtos.buscarParaVenda
    let chegou, liberar
    const naTrava = new Promise((r) => { chegou = r }), portao = new Promise((r) => { liberar = r })
    // Segura a venda logo depois da leitura com trava (com executor), para o UPDATE concorrente chegar nesse ponto
    mock.method(produtos, 'buscarParaVenda', async (ids, executor) => {
      const lidos = await original.call(produtos, ids, executor)
      if (executor) { chegou(); await portao }
      return lidos
    })
    const outro = new pg.Client({ connectionString: url, application_name: `${schema}_preco` }); await outro.connect()
    try {
      await outro.query(`SET search_path TO ${schema}`)
      const venda = comprar(quem, { itens: itens([p, 2]), retirada: true })
      await naTrava
      let terminou = false
      const update = outro.query('UPDATE produtos SET preco = 9999 WHERE id = $1', [p]).then(() => { terminou = true })
      for (let i = 0; ; i++) {
        const { rows } = await c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [`${schema}_preco`])
        if (rows[0].n >= 1) break
        if (i === 300) assert.fail('O UPDATE de preço não esperou a trava da venda.')
        await esperar(10)
      }
      assert.equal(terminou, false)
      liberar()
      const r = await venda
      assert.equal(r.status, 201)
      assert.deepEqual([r.corpo.itens[0].precoUnitario, r.corpo.total], [1000, 2000])
      await update
      assert.equal((await c.query('SELECT preco_unitario FROM itens_venda WHERE venda_id = $1', [r.corpo.id])).rows[0].preco_unitario, 1000)
      assert.equal((await c.query('SELECT preco FROM produtos WHERE id = $1', [p])).rows[0].preco, 9999)
    } finally { liberar(); await outro.end() }
  })

  // ---------- #31 ----------
  it('13. 31 produtos → 422; quantidade 51 → 422; o mesmo produto em dois itens somando 51 → 422', async () => {
    const quem = await cliente(), p = await produto()
    const muitos = Array.from({ length: 31 }, (_, i) => ({ produtoId: i + 1, quantidade: 1 }))
    assert.deepEqual((await comprar(quem, { itens: muitos, retirada: true })).corpo.detalhes, { itens: 'Adicione de 1 a 30 produtos.' })
    assert.deepEqual((await comprar(quem, { itens: itens([p, 51]), retirada: true })).corpo.detalhes,
      { 'itens.0.quantidade': 'A quantidade precisa ser de 1 a 50.' })
    const somado = await comprar(quem, { itens: itens([p, 30], [p, 21]), retirada: true })
    assert.deepEqual([somado.status, somado.corpo.detalhes], [422, { 'itens.0.quantidade': 'A quantidade precisa ser de 1 a 50.' }])
    assert.equal(await abertas(quem.id), 0)
  })

  it('14. 5 vendas abertas → a 6ª 409; com uma vencida, a nova passa', async () => {
    const quem = await cliente(), p = await produto()
    const ids = []
    for (let i = 0; i < 5; i++) ids.push((await comprar(quem, { itens: itens([p, 1]), retirada: true })).corpo.id)
    const sexta = await comprar(quem, { itens: itens([p, 1]), retirada: true })
    assert.deepEqual([sexta.status, sexta.corpo.erro], [409, 'Você já tem 5 compras aguardando pagamento.'])
    assert.equal(await saldo(p), 95)

    // Vencida (a #32 ainda vai cancelar): não conta
    await c.query("UPDATE vendas SET expira_em = now() - interval '1 minute' WHERE id = $1", [ids[0]])
    assert.equal((await comprar(quem, { itens: itens([p, 1]), retirada: true })).status, 201)
    assert.equal(await abertas(quem.id), 6)
  })

  it('15. com 4 abertas, 2 vendas em paralelo → uma 201 e uma 409; ficam 5 abertas', async () => {
    const quem = await cliente(), p = await produto()
    for (let i = 0; i < 4; i++) assert.equal((await comprar(quem, { itens: itens([p, 1]), retirada: true })).status, 201)
    const r = await comTimeout(Promise.all([0, 1].map(() => comprar(quem, { itens: itens([p, 1]), retirada: true }))))
    assert.deepEqual(r.map((x) => x.status).sort(), [201, 409])
    assert.equal(await abertas(quem.id), 5)
    assert.equal(await saldo(p), 95)
  })

  // ---------- concorrência geral ----------
  it('16. duas vendas em paralelo pelo último item → uma 201 e uma 409; estoque 0, nunca negativo', async () => {
    const p = await produto({ saldo: 1 }), x = await cliente(), y = await cliente()
    const r = await comTimeout(Promise.all([x, y].map((quem) => comprar(quem, { itens: itens([p, 1]), retirada: true }))))
    assert.deepEqual(r.map((z) => z.status).sort(), [201, 409])
    assert.deepEqual(r.find((z) => z.status === 409).corpo.detalhes, { 'itens.0.quantidade': 'Não temos essa quantidade em estoque.' })
    assert.equal(await saldo(p), 0)
  })

  it('17. duas vendas em paralelo com [A, B] e [B, A] → sem deadlock e sem 500 (5 rodadas)', async () => {
    const a = await produto(), b = await produto(), x = await cliente(), y = await cliente()
    for (let rodada = 0; rodada < 5; rodada++) {
      const r = await comTimeout(Promise.all([
        comprar(x, { itens: itens([a, 1], [b, 1]), retirada: true }),
        comprar(y, { itens: itens([b, 1], [a, 1]), retirada: true }),
      ]))
      assert.deepEqual(r.map((z) => z.status), [201, 201], `rodada ${rodada + 1}: ${JSON.stringify(r.map((z) => z.corpo))}`)
      // Cada cliente fica abaixo do limite de 5 abertas: as vendas da rodada vencem direto no descartável
      await c.query("UPDATE vendas SET expira_em = now() - interval '1 minute' WHERE cliente_id = ANY($1)", [[x.id, y.id]])
    }
    assert.deepEqual([await saldo(a), await saldo(b)], [90, 90])
  })

  it('18. criar venda e apagar a conta em paralelo → nunca fica venda de conta anonimizada (5 rodadas)', async (t) => {
    const p = await produto()
    const resultados = []
    for (let rodada = 0; rodada < 5; rodada++) {
      limites.limiteTrocaSenha.resetKey('127.0.0.1')
      const quem = await cliente({ senha: 'senha-de-teste-123' })
      // Alterna quem sai na frente: o apagar conta roda o argon2 antes da transação, então às vezes a venda ganha
      const atraso = rodada % 2 === 0 ? 0 : 150
      const [venda, apagar] = await comTimeout(Promise.all([
        esperar(atraso).then(() => comprar(quem, { itens: itens([p, 1]), retirada: true })),
        pedir('DELETE', '/clientes/me', { senha: quem.senha }, { token: quem.token }),
      ]))
      resultados.push(`${venda.status}/${apagar.status}`)
      assert.ok([[201, 409], [401, 204]].some(([v, d]) => venda.status === v && apagar.status === d), `rodada ${rodada + 1}: ${resultados.at(-1)}`)
    }
    const orfas = (await c.query('SELECT count(*)::int AS n FROM vendas v JOIN clientes c ON c.id = v.cliente_id WHERE c.anonimizado_em IS NOT NULL')).rows[0].n
    assert.equal(orfas, 0, `resultados (venda/apagar): ${resultados.join(', ')}`)
    t.diagnostic(`venda/apagar por rodada: ${resultados.join(', ')}`)
  })

  it('18b. venda esperando a trava do cliente enquanto a conta é anonimizada → 401 depois do COMMIT, sem venda', async () => {
    const quem = await cliente(), p = await produto()
    const antes = await contagem()
    const outro = new pg.Client({ connectionString: url }); await outro.connect()
    try {
      await outro.query(`SET search_path TO ${schema}`)
      // Mesmo começo do apagar conta: trava a linha do cliente e anonimiza, ainda sem COMMIT
      await outro.query('BEGIN')
      await outro.query('SELECT id FROM clientes WHERE id = $1 FOR UPDATE', [quem.id])
      const venda = comprar(quem, { itens: itens([p, 1]), retirada: true })
      for (let i = 0; ; i++) {
        const { rows } = await c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = $1 AND wait_event_type = 'Lock'", [schema])
        if (rows[0].n >= 1) break
        if (i === 300) assert.fail('A venda não esperou a trava do cliente.')
        await esperar(10)
      }
      await outro.query(`UPDATE clientes SET nome = 'Cliente removido', email = NULL, telefone = NULL, senha_hash = NULL,
        ativo = FALSE, anonimizado_em = now() WHERE id = $1`, [quem.id])
      await outro.query('COMMIT')
      const r = await comTimeout(venda)
      assert.deepEqual([r.status, r.corpo.erro], [401, 'Faça login para continuar.'])
      assert.deepEqual(await contagem(), antes)
      assert.equal(await saldo(p), 100)
    } finally { await outro.query('ROLLBACK').catch(() => {}); await outro.end() }
  })
})
