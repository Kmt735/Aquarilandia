import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

// #33, #34 e #37: compras do cliente (/me/vendas) e do admin (/:id/vendas), com sessões e vendas reais no PostgreSQL
// descartável. As vendas nascem pelo POST /api/vendas; status, datas, rastreio e pagamentos são ajustados no schema
// exclusivo para cobrir cada caso.
const url = process.env.TEST_DATABASE_URL
describe('Compras do cliente (#33, #34, #37) — PostgreSQL real', { skip: !url && 'Defina TEST_DATABASE_URL para PostgreSQL descartável.' }, () => {
  const schema = `clientes_vendas_${randomUUID().replaceAll('-', '')}`
  let c, pool, server, api, origem, estoque, repo, tx, limites, criado = false
  let admin, ana, bia

  before(async () => {
    c = new pg.Client({ connectionString: url }); await c.connect()
    await c.query(`CREATE SCHEMA ${schema}`); criado = true; await c.query(`SET search_path TO ${schema}`)
    for (const f of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql', '21_vendas_idempotencia.sql', '30_estoque.sql', '31_estoque_vendas.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`, import.meta.url), 'utf8'))
    }
    const urlApp = new URL(url); urlApp.searchParams.set('options', `-c search_path=${schema}`); urlApp.searchParams.set('application_name', schema)
    process.env.DATABASE_URL = urlApp.toString()
    const { app } = await import('../../src/app.ts')
    pool = (await import('../../src/config/db.ts')).db
    origem = (await import('../../src/config/env.ts')).env.corsOrigin
    estoque = (await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    repo = (await import('../../src/modulos/vendas/venda.repository.ts')).vendaRepository
    tx = (await import('../../src/utils/transacao.ts')).comTransacao
    limites = await import('../../src/middlewares/rateLimit.ts')
    server = app.listen(0, '127.0.0.1'); await once(server, 'listening')
    api = `http://127.0.0.1:${server.address().port}/api`
    admin = await conta('admin'); ana = await conta(); bia = await conta()
  })
  after(async () => {
    try { if (server) await new Promise((r) => server.close(r)); if (pool) await pool.end() }
    finally { if (c) { try { if (criado) await c.query(`DROP SCHEMA ${schema} CASCADE`) } finally { await c.end() } } }
  })

  // ---------- fixtures (só no schema descartável) ----------
  async function conta(papel = 'cliente') {
    const id = (await c.query("INSERT INTO clientes (nome, email, senha_hash, telefone, papel) VALUES ($1, $2, 'hash', '32999990000', $3) RETURNING id",
      [`Conta ${randomUUID().slice(0, 6)}`, `${randomUUID()}@compras.example`, papel])).rows[0].id
    const token = randomUUID()
    await c.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')", [hashToken(token), id])
    return { id, token }
  }
  async function produto(nome = `Produto ${randomUUID().slice(0, 8)}`, preco = 1000) {
    const id = (await c.query("INSERT INTO produtos (categoria_id, nome, preco, ativo) SELECT id, $1, $2, true FROM categorias WHERE slug = 'acessorios' RETURNING id",
      [nome, preco])).rows[0].id
    await estoque.registrarMovimentacao(admin.id, { produtoId: id, tipo: 'entrada', quantidade: 100, motivo: 'Saldo de teste' }, randomUUID(), {})
    return id
  }
  async function endereco(clienteId, cep) {
    return (await c.query(`INSERT INTO enderecos_cliente (cliente_id, apelido, cep, logradouro, numero, complemento, bairro, cidade, uf)
      VALUES ($1, 'Casa', $2, 'Rua Teste', '10', NULL, 'Centro', 'Cidade Teste', 'MG') RETURNING id`, [clienteId, cep])).rows[0].id
  }
  async function pedir(caminho, quem, { metodo = 'GET', body } = {}) {
    const r = await fetch(`${api}${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Origin: origem, ...(quem ? { Cookie: `sid=${quem.token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const texto = await r.text()
    return { status: r.status, cache: r.headers.get('cache-control'), texto, corpo: texto ? JSON.parse(texto) : null }
  }
  // Compra pelo POST /api/vendas, com o totalEsperado da cotação do mesmo carrinho e da mesma entrega
  async function comprar(quem, pares, enderecoId) {
    const itens = pares.map(([produtoId, quantidade]) => ({ produtoId, quantidade }))
    const destino = enderecoId ? { enderecoId } : { retirada: true }
    const cep = enderecoId && (await c.query('SELECT cep FROM enderecos_cliente WHERE id = $1', [enderecoId])).rows[0].cep
    limites.limiteFrete.resetKey('127.0.0.1')
    const cotacao = await pedir('/frete/calcular', null, { metodo: 'POST', body: { itens, ...(cep ? { cep } : { retirada: true }) } })
    assert.equal(cotacao.status, 200, cotacao.texto)
    const r = await fetch(`${api}/vendas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origem, Cookie: `sid=${quem.token}`, 'Idempotency-Key': randomUUID() },
      body: JSON.stringify({ itens, ...destino, totalEsperado: cotacao.corpo.total }),
    })
    const corpo = await r.json()
    assert.equal(r.status, 201, JSON.stringify(corpo))
    return corpo.id
  }
  const datar = (id, horasAtras) => c.query('UPDATE vendas SET criado_em = now() - make_interval(hours => $2) WHERE id = $1', [id, horasAtras])
  const mudar = (id, de, para, autoria) => tx((client) => repo.mudarStatus(id, de, para, autoria, client))
  const sistema = { ator: 'sistema', clienteId: null }

  // ---------- #33 GET /api/clientes/me/vendas ----------
  describe('#33 /me/vendas', () => {
    let doCarlos, carlos, filtro, racao, aquario
    before(async () => {
      carlos = await conta()
      filtro = await produto('Filtro Hang-On'); racao = await produto('Ração Flocos'); aquario = await produto('Aquário 60 L')
      // Três compras com 1, 2 e 3 itens, em ordem de criação diferente da ordem de id
      const umItem = await comprar(carlos, [[filtro, 1]])
      const doisItens = await comprar(carlos, [[racao, 2], [filtro, 1]])
      const tresItens = await comprar(carlos, [[aquario, 1], [racao, 1], [filtro, 3]])
      await datar(umItem, 1); await datar(doisItens, 3); await datar(tresItens, 2)
      await mudar(doisItens, 'aguardando_pagamento', 'cancelada', sistema)
      doCarlos = { umItem, doisItens, tresItens }
      // A Bia tem compras também: nenhuma pode aparecer para o Carlos
      await comprar(bia, [[filtro, 1]]); await comprar(bia, [[racao, 1]])
    })

    it('9. o cliente vê só as próprias compras', async () => {
      const r = await pedir('/clientes/me/vendas', carlos)
      assert.equal(r.status, 200)
      assert.equal(r.corpo.total, 3)
      const dasBia = (await c.query('SELECT id FROM vendas WHERE cliente_id = $1', [bia.id])).rows.map((l) => l.id)
      assert.ok(dasBia.length >= 2)
      assert.equal(r.corpo.dados.some((v) => dasBia.includes(v.id)), false)
    })

    it('10. mais recentes primeiro, paginação com total, ?status filtra, status/limite inválidos → 400', async () => {
      const r = await pedir('/clientes/me/vendas', carlos)
      assert.equal(r.cache, 'no-store')
      assert.deepEqual(r.corpo.dados.map((v) => v.id), [doCarlos.umItem, doCarlos.tresItens, doCarlos.doisItens])
      assert.deepEqual([r.corpo.pagina, r.corpo.limite], [1, 20])

      const pagina2 = await pedir('/clientes/me/vendas?limite=2&pagina=2', carlos)
      assert.deepEqual(pagina2.corpo, { dados: [r.corpo.dados[2]], total: 3, pagina: 2, limite: 2 })
      const alemDoFim = await pedir('/clientes/me/vendas?limite=2&pagina=5', carlos)
      assert.deepEqual([alemDoFim.corpo.dados, alemDoFim.corpo.total], [[], 3])

      const canceladas = await pedir('/clientes/me/vendas?status=cancelada', carlos)
      assert.deepEqual([canceladas.corpo.total, canceladas.corpo.dados.map((v) => v.id)], [1, [doCarlos.doisItens]])
      const abertas = await pedir('/clientes/me/vendas?status=aguardando_pagamento&limite=1', carlos)
      assert.deepEqual([abertas.corpo.total, abertas.corpo.dados.map((v) => v.id)], [2, [doCarlos.umItem]])

      const invalido = { erro: 'Parâmetros inválidos' }
      assert.deepEqual((await pedir('/clientes/me/vendas?status=xyz', carlos)).corpo, { ...invalido, detalhes: { status: 'Status inválido.' } })
      assert.equal((await pedir('/clientes/me/vendas?status=paga&status=cancelada', carlos)).status, 400)
      assert.deepEqual((await pedir('/clientes/me/vendas?limite=500', carlos)).corpo,
        { ...invalido, detalhes: { limite: 'O limite precisa ser um número inteiro de 1 a 100.' } })
      const juntos = await pedir('/clientes/me/vendas?status=xyz&pagina=0', carlos)
      assert.equal(juntos.status, 400)
      assert.deepEqual(Object.keys(juntos.corpo.detalhes).sort(), ['pagina', 'status'])
    })

    it('11. resumo: 1 item → o nome; 2 → "X e mais 1 item"; 3 → "X e mais 2 itens" (X = primeiro item da compra)', async () => {
      const { corpo } = await pedir('/clientes/me/vendas', carlos)
      const porId = new Map(corpo.dados.map((v) => [v.id, v]))
      assert.deepEqual([porId.get(doCarlos.umItem).resumo, porId.get(doCarlos.umItem).quantidadeItens], ['Filtro Hang-On', 1])
      assert.deepEqual([porId.get(doCarlos.doisItens).resumo, porId.get(doCarlos.doisItens).quantidadeItens], ['Ração Flocos e mais 1 item', 2])
      assert.deepEqual([porId.get(doCarlos.tresItens).resumo, porId.get(doCarlos.tresItens).quantidadeItens], ['Aquário 60 L e mais 2 itens', 3])
      const venda = porId.get(doCarlos.tresItens)
      assert.deepEqual(Object.keys(venda).sort(), ['criadoEm', 'id', 'quantidadeItens', 'resumo', 'status', 'tipoEntrega', 'total'])
      assert.deepEqual([venda.status, venda.tipoEntrega, venda.total], ['aguardando_pagamento', 'retirada', 5000])
    })

    it('12. sem login → 401', async () => {
      assert.deepEqual(await pedir('/clientes/me/vendas', null).then((r) => [r.status, r.corpo]), [401, { erro: 'Faça login para continuar.' }])
    })
  })

  // ---------- #34 GET /api/clientes/me/vendas/:id ----------
  describe('#34 /me/vendas/:id', () => {
    let dani, enviada, retirada, peixeId
    before(async () => {
      dani = await conta()
      peixeId = await produto('Bomba Submersa')
      // Correios (CEP fora de São João del Rei): passa por paga → em_separacao → enviada, com código de rastreio
      enviada = await comprar(dani, [[peixeId, 2]], await endereco(dani.id, '01001000'))
      await mudar(enviada, 'aguardando_pagamento', 'paga', { ator: 'gateway', clienteId: null })
      await mudar(enviada, 'paga', 'em_separacao', { ator: 'admin', clienteId: admin.id, observacao: 'Separado por Fulano' })
      await c.query("UPDATE vendas SET codigo_rastreio = 'BR123456789BR' WHERE id = $1", [enviada])
      await mudar(enviada, 'em_separacao', 'enviada', { ator: 'admin', clienteId: admin.id })
      retirada = await comprar(dani, [[peixeId, 1]])
    })

    it('13. detalhe da própria compra: itens, entrega, histórico cronológico sem autoria, pagamento null e rastreio', async () => {
      const r = await pedir(`/clientes/me/vendas/${enviada}`, dani)
      assert.equal(r.status, 200, r.texto)
      assert.equal(r.cache, 'no-store')
      const v = r.corpo
      assert.deepEqual([v.id, v.status, v.tipoEntrega, v.codigoRastreio, v.pagamento], [enviada, 'enviada', 'correios', 'BR123456789BR', null])
      assert.deepEqual(v.itens.map((i) => [i.produtoId, i.nomeProduto, i.quantidade, i.precoUnitario, i.subtotal]), [[peixeId, 'Bomba Submersa', 2, 1000, 2000]])
      assert.deepEqual(v.entrega, { cep: '01001000', logradouro: 'Rua Teste', numero: '10', complemento: null, bairro: 'Centro',
        cidade: 'Cidade Teste', uf: 'MG', destinatario: (await c.query('SELECT nome FROM clientes WHERE id = $1', [dani.id])).rows[0].nome, telefone: '32999990000' })
      assert.deepEqual(v.historico.map((h) => h.status), ['aguardando_pagamento', 'paga', 'em_separacao', 'enviada'])
      for (const etapa of v.historico) assert.deepEqual(Object.keys(etapa).sort(), ['data', 'status'])
      const datas = v.historico.map((h) => Date.parse(h.data))
      assert.deepEqual(datas, [...datas].sort((a, b) => a - b))
      for (const proibido of ['origem', 'alteradoPor', 'alterado_por', 'observacao', 'Separado por Fulano']) {
        assert.equal(r.texto.includes(proibido), false, `vazou ${proibido}`)
      }

      const naLoja = await pedir(`/clientes/me/vendas/${retirada}`, dani)
      assert.deepEqual([naLoja.corpo.entrega, naLoja.corpo.codigoRastreio, naLoja.corpo.historico.length], [null, null, 1])
    })

    it('14. pagamento: o aprovado mais velho vence o recusado mais novo; sem aprovado, o mais recente; nada do gateway', async () => {
      const segredos = ['cob_SEGREDO_1', 'pay_SEGREDO_1', 'cob_SEGREDO_2', 'pay_SEGREDO_2', 'cc_rejected_SEGREDO', 'erro de estorno SEGREDO']
      await c.query(`INSERT INTO pagamentos (venda_id, gateway, gateway_cobranca_id, gateway_pagamento_id, metodo, status, status_detalhe,
        valor, estorno_tentativas, estorno_ultimo_erro, criado_em) VALUES
        ($1, 'abacatepay', $2, $3, 'pix', 'aprovado', NULL, 2000, 1, $7, now() - interval '2 hours'),
        ($1, 'abacatepay', $4, $5, 'credit_card', 'recusado', $6, 2000, 0, NULL, now() - interval '1 hour')`,
      [enviada, ...segredos])
      const r = await pedir(`/clientes/me/vendas/${enviada}`, dani)
      assert.deepEqual(Object.keys(r.corpo.pagamento).sort(), ['criadoEm', 'metodo', 'status'])
      assert.deepEqual([r.corpo.pagamento.status, r.corpo.pagamento.metodo], ['aprovado', 'pix'])
      for (const segredo of [...segredos, 'gateway', 'estorno', 'statusDetalhe', 'abacatepay']) {
        assert.equal(r.texto.includes(segredo), false, `vazou ${segredo}`)
      }

      await c.query(`INSERT INTO pagamentos (venda_id, gateway, gateway_cobranca_id, metodo, status, valor, criado_em) VALUES
        ($1, 'abacatepay', 'cob_a', 'pix', 'pendente', 1000, now() - interval '2 hours'),
        ($1, 'abacatepay', 'cob_b', 'pix', 'cancelado', 1000, now() - interval '1 hour')`, [retirada])
      assert.equal((await pedir(`/clientes/me/vendas/${retirada}`, dani)).corpo.pagamento.status, 'cancelado')
    })

    it('15. compra de outro cliente ou inexistente → 404; id abc → 400; sem login → 401', async () => {
      const deOutro = await pedir(`/clientes/me/vendas/${enviada}`, ana)
      assert.deepEqual([deOutro.status, deOutro.corpo], [404, { erro: 'Compra não encontrada.' }])
      assert.equal(deOutro.texto.includes('BR123456789BR'), false)
      assert.deepEqual((await pedir('/clientes/me/vendas/2147483647', dani)).corpo, { erro: 'Compra não encontrada.' })
      const abc = await pedir('/clientes/me/vendas/abc', dani)
      assert.deepEqual([abc.status, abc.corpo], [400, { erro: 'Id inválido.' }])
      assert.equal((await pedir(`/clientes/me/vendas/${enviada}`, null)).status, 401)
    })
  })

  // ---------- #37 GET /api/clientes/:id/vendas ----------
  describe('#37 /:id/vendas (admin)', () => {
    it('16. admin vê as compras de um cliente, inclusive de conta anonimizada; cliente 403; inexistente 404', async () => {
      const eva = await conta(), p = await produto()
      const primeira = await comprar(eva, [[p, 1]]), segunda = await comprar(eva, [[p, 2]])
      await datar(primeira, 2)

      const r = await pedir(`/clientes/${eva.id}/vendas?limite=1`, admin)
      assert.equal(r.status, 200, r.texto)
      assert.equal(r.cache, 'no-store')
      assert.deepEqual([r.corpo.total, r.corpo.pagina, r.corpo.limite, r.corpo.dados.map((v) => v.id)], [2, 1, 1, [segunda]])
      // O mesmo formato do /me/vendas
      const comoDona = await pedir('/clientes/me/vendas?limite=1', eva)
      assert.deepEqual(r.corpo, comoDona.corpo)

      // Conta anonimizada pelo próprio admin (DELETE /:id), depois de as compras saírem de andamento
      for (const id of [primeira, segunda]) await mudar(id, 'aguardando_pagamento', 'cancelada', sistema)
      assert.equal((await pedir(`/clientes/${eva.id}`, admin, { metodo: 'DELETE' })).status, 204)
      assert.ok((await c.query('SELECT anonimizado_em FROM clientes WHERE id = $1', [eva.id])).rows[0].anonimizado_em)
      const anonimizada = await pedir(`/clientes/${eva.id}/vendas?status=cancelada`, admin)
      assert.deepEqual([anonimizada.status, anonimizada.corpo.total], [200, 2])

      assert.deepEqual(await pedir(`/clientes/${eva.id}/vendas`, ana).then((x) => [x.status, x.corpo]),
        [403, { erro: 'Acesso permitido somente para administradores.' }])
      assert.equal((await pedir(`/clientes/${eva.id}/vendas`, null)).status, 401)
      assert.deepEqual(await pedir('/clientes/2147483647/vendas', admin).then((x) => [x.status, x.corpo]), [404, { erro: 'Cliente não encontrado.' }])
      assert.deepEqual((await pedir('/clientes/abc/vendas', admin)).corpo, { erro: 'Id inválido.' })
      // A query é conferida antes de procurar o cliente
      assert.equal((await pedir('/clientes/2147483647/vendas?status=xyz', admin)).status, 400)
    })

    it('regressão: as rotas /me continuam do cliente e a guarda continua valendo', async () => {
      assert.equal((await pedir('/clientes/me', ana)).corpo.id, ana.id)
      assert.equal((await pedir('/clientes/me/enderecos', ana)).status, 200)
      assert.equal((await pedir('/clientes', ana)).status, 403)
      assert.equal((await pedir(`/clientes/${bia.id}`, ana)).status, 403)
      // Admin em /me/vendas vê só as compras da própria conta (nenhuma)
      assert.deepEqual((await pedir('/clientes/me/vendas', admin)).corpo, { dados: [], total: 0, pagina: 1, limite: 20 })
    })
  })
})
