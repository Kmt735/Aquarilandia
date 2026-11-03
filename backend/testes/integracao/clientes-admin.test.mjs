import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'
import { gerarHash } from '../../src/modulos/clientes/senha.ts'

const urlTeste = process.env.TEST_DATABASE_URL
describe('Clientes — rotas de admin com sessões, papéis e vendas reais no PostgreSQL (#36, #37, #38)', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para verificar as rotas de admin de clientes no PostgreSQL.',
}, () => {
  const schema = `teste_clientes_admin_${randomUUID().replaceAll('-', '')}`
  const ids = new Map(), tokens = new Map()
  // Senhas fictícias só deste teste (a de login real é a mesma para todos)
  const senha = 'senhaFicticia123'
  const msgAdmin = 'Este cliente tem compras em andamento. Aguarde a entrega ou o cancelamento antes de remover a conta.'
  const msgCliente = 'Você tem compras em andamento. Aguarde a entrega ou cancele antes de apagar a conta.'
  let cliente, pool, servidor, origem, origemCors, schemaCriado = false

  async function criarConta(chave, nome, papel = 'cliente', hash = 'hash-fixture-sem-login') {
    const { rows } = await cliente.query(
      'INSERT INTO clientes (nome, email, senha_hash, telefone, papel) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [nome, `teste.adm.${chave}@exemplo.com`, hash, '32999990000', papel])
    ids.set(chave, rows[0].id)
    return rows[0].id
  }
  async function criarSessao(chave, nomeToken = chave) {
    const token = randomUUID(); tokens.set(nomeToken, token)
    await cliente.query("INSERT INTO sessoes (token_hash, cliente_id, expira_em) VALUES ($1, $2, now() + interval '1 hour')",
      [hashToken(token), ids.get(chave)])
  }
  async function criarVenda(chave, status, total) {
    const { rows } = await cliente.query(
      `INSERT INTO vendas (cliente_id, status, subtotal, frete, total, tipo_entrega, entrega_destinatario,
                           entrega_telefone, prazo_entrega_dias)
       VALUES ($1, $2, $3, 0, $3, 'retirada', 'Pessoa Fictícia', '32999999999', 1) RETURNING id`,
      [ids.get(chave), status, total])
    return rows[0].id
  }

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste }); await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`); schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
      await cliente.query(await readFile(new URL(`../../db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    const hash = await gerarHash(senha)
    await criarConta('chefe', 'Chefe Admin', 'admin')
    await criarConta('outro', 'Outro Admin', 'admin')
    await criarConta('ana', 'Ana 50% Silva_Teste', 'cliente', hash)
    await criarConta('bia', 'Bia Teste', 'cliente', hash)
    await criarConta('caio', 'Caio Teste', 'cliente')
    await criarConta('removido', 'Removido Teste', 'cliente')
    for (const chave of ['chefe', 'outro', 'ana', 'caio']) await criarSessao(chave)
    await criarSessao('bia', 'bia1'); await criarSessao('bia', 'bia2')
    await cliente.query("INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em) VALUES ($1, $2, now() + interval '30 minutes')",
      [ids.get('bia'), hashToken(randomUUID())])
    await cliente.query(
      `INSERT INTO enderecos_cliente (cliente_id, cep, logradouro, numero, bairro, cidade, uf, principal)
       VALUES ($1, '36300000', 'Rua Fictícia', '10', 'Centro', 'São João del-Rei', 'MG', true)`, [ids.get('bia')])
    await criarVenda('bia', 'paga', 5000)
    await criarVenda('bia', 'cancelada', 3000)
    // Anonimizado direto no banco, como a #24 deixaria
    await cliente.query(`UPDATE clientes SET nome = 'Cliente removido', email = NULL, telefone = NULL, senha_hash = NULL,
      ativo = false, anonimizado_em = now() WHERE id = $1`, [ids.get('removido')])

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

  function requisitar(sessao, method, caminho, body, { comOrigem = true } = {}) {
    const headers = {}
    if (sessao) headers.Cookie = `sid=${tokens.get(sessao) ?? sessao}`
    if (method !== 'GET' && comOrigem) headers.Origin = origemCors
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    return fetch(`${origem}/api/clientes${caminho}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10_000),
    })
  }
  const listar = (query = '', sessao = 'chefe') => requisitar(sessao, 'GET', `/${query}`)
  const linhaDe = async (chave) => (await cliente.query(
    'SELECT nome, email, papel, ativo, anonimizado_em, atualizado_em FROM clientes WHERE id = $1', [ids.get(chave)])).rows[0]
  const contar = async (tabela, chave) => (await cliente.query(
    `SELECT count(*)::int AS n FROM ${tabela} WHERE cliente_id = $1`, [ids.get(chave)])).rows[0].n
  const login = (email) => fetch(`${origem}/api/auth/login`, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origemCors }, body: JSON.stringify({ email, senha }) })
  function semSegredo(texto) {
    assert.equal(texto.includes('senha'), false, 'nenhuma chave de senha na resposta')
    assert.equal(texto.includes('$argon2'), false, 'nenhum hash na resposta')
  }

  describe('guarda única depois das /me', () => {
    for (const [method, caminho] of [['GET', '/'], ['GET', '/xyz'], ['GET', '/1'], ['PATCH', '/1'], ['DELETE', '/1']]) {
      it(`${method} ${caminho}: sem login 401, cliente 403`, async () => {
        const visitante = await requisitar(null, method, caminho, method === 'PATCH' ? { ativo: false } : undefined)
        assert.equal(visitante.status, 401)
        assert.deepEqual(await visitante.json(), { erro: 'Faça login para continuar.' })
        const comoCliente = await requisitar('ana', method, caminho, method === 'PATCH' ? { ativo: false } : undefined)
        assert.equal(comoCliente.status, 403)
        assert.deepEqual(await comoCliente.json(), { erro: 'Acesso permitido somente para administradores.' })
      })
    }
    it('as rotas /me continuam do cliente (regressão)', async () => {
      const resposta = await requisitar('ana', 'GET', '/me')
      assert.equal(resposta.status, 200)
      assert.equal((await resposta.json()).id, ids.get('ana'))
      assert.equal((await requisitar('ana', 'GET', '/me/enderecos')).status, 200)
    })
    it('GET /:id/vendas ainda não existe: admin recebe 404, atrás da guarda', async () => {
      assert.equal((await requisitar('ana', 'GET', `/${ids.get('bia')}/vendas`)).status, 403)
      assert.equal((await requisitar('chefe', 'GET', `/${ids.get('bia')}/vendas`)).status, 404)
    })
  })

  describe('GET /api/clientes (#36)', () => {
    it('lista paginada só de clientes não anonimizados, com quantidadeVendas e no-store', async () => {
      const resposta = await listar()
      assert.equal(resposta.status, 200)
      assert.equal(resposta.headers.get('cache-control'), 'no-store')
      const texto = await resposta.text(); semSegredo(texto)
      const corpo = JSON.parse(texto)
      assert.deepEqual(Object.keys(corpo).sort(), ['dados', 'limite', 'pagina', 'total'])
      assert.equal(corpo.pagina, 1); assert.equal(corpo.limite, 20); assert.equal(corpo.total, 3)
      assert.deepEqual(corpo.dados.map((c) => c.id).sort(), [ids.get('ana'), ids.get('bia'), ids.get('caio')].sort())
      for (const item of corpo.dados) {
        assert.deepEqual(Object.keys(item).sort(),
          ['ativo', 'criadoEm', 'email', 'id', 'nome', 'papel', 'quantidadeVendas', 'telefone'])
        assert.equal(item.papel, 'cliente')
      }
      const porId = new Map(corpo.dados.map((c) => [c.id, c]))
      assert.equal(porId.get(ids.get('bia')).quantidadeVendas, 2)
      assert.equal(porId.get(ids.get('caio')).quantidadeVendas, 0)
    })
    it('ordena por criado_em DESC, id DESC e pagina com o mesmo total', async () => {
      const todos = (await (await listar()).json()).dados.map((c) => c.id)
      assert.deepEqual(todos, [...todos].sort((a, b) => b - a), 'mesmo criado_em na fixture: desempata por id DESC')
      const pagina2 = await (await listar('?limite=1&pagina=2')).json()
      assert.deepEqual(pagina2, { ...pagina2, total: 3, pagina: 2, limite: 1 })
      assert.deepEqual(pagina2.dados.map((c) => c.id), [todos[1]])
    })
    const buscar = async (busca) => (await (await listar(`?busca=${encodeURIComponent(busca)}`)).json()).dados.map((c) => c.id)
    it('busca por nome e por e-mail, sem diferenciar maiúsculas e com trim', async () => {
      assert.deepEqual(await buscar('ana'), [ids.get('ana')])
      assert.deepEqual(await buscar('ANA 50'), [ids.get('ana')])
      assert.deepEqual(await buscar('teste.adm.bia'), [ids.get('bia')])
      assert.deepEqual(await buscar('  caio  '), [ids.get('caio')])
      assert.equal((await buscar('   ')).length, 3, 'busca só com espaços = sem filtro')
      assert.deepEqual(await buscar('Cliente removido'), [], 'anonimizado não aparece')
    })
    it('% , _ e \\ são texto literal, não curingas', async () => {
      assert.deepEqual(await buscar('50%'), [ids.get('ana')])
      assert.deepEqual(await buscar('%'), [ids.get('ana')])
      assert.deepEqual(await buscar('_'), [ids.get('ana')])
      assert.deepEqual(await buscar('a_a'), [], '_ não casa com "qualquer letra"')
      assert.deepEqual(await buscar('\\'), [])
      assert.deepEqual(await buscar('\\%'), [])
    })
    it('?papel=admin lista só os admins; parâmetros inválidos dão 400', async () => {
      const admins = await (await listar('?papel=admin')).json()
      assert.deepEqual(admins.dados.map((c) => c.id).sort(), [ids.get('chefe'), ids.get('outro')].sort())
      for (const [query, detalhes] of [
        ['?papel=xyz', { papel: 'Use cliente ou admin.' }],
        ['?papel=cliente&papel=admin', { papel: 'Use cliente ou admin.' }],
        [`?busca=${'a'.repeat(101)}`, { busca: 'A busca pode ter até 100 caracteres.' }],
        ['?busca=a&busca=b', { busca: 'Informe um único texto de busca.' }],
        ['?limite=500', { limite: 'O limite precisa ser um número inteiro de 1 a 100.' }],
        ['?pagina=0', { pagina: 'A página precisa ser um número inteiro a partir de 1.' }],
      ]) {
        const resposta = await listar(query)
        assert.equal(resposta.status, 400, query)
        assert.deepEqual(await resposta.json(), { erro: 'Parâmetros inválidos', detalhes }, query)
      }
      assert.equal((await listar(`?busca=${'a'.repeat(100)}`)).status, 200, '100 caracteres ainda vale')
    })
  })

  describe('GET /api/clientes/:id (#37)', () => {
    it('detalhe com endereços, totalVendas e totalGasto só das vendas pagas', async () => {
      const resposta = await requisitar('chefe', 'GET', `/${ids.get('bia')}`)
      assert.equal(resposta.status, 200)
      assert.equal(resposta.headers.get('cache-control'), 'no-store')
      const texto = await resposta.text(); semSegredo(texto)
      const corpo = JSON.parse(texto)
      assert.deepEqual(Object.keys(corpo).sort(), ['anonimizadoEm', 'ativo', 'atualizadoEm', 'criadoEm', 'email',
        'enderecos', 'id', 'nome', 'papel', 'telefone', 'totalGasto', 'totalVendas'])
      assert.equal(corpo.email, 'teste.adm.bia@exemplo.com'); assert.equal(corpo.anonimizadoEm, null)
      assert.equal(corpo.enderecos.length, 1); assert.equal(corpo.enderecos[0].cidade, 'São João del-Rei')
      assert.equal(corpo.totalVendas, 2)
      assert.equal(corpo.totalGasto, 5000, 'a cancelada (3000) fica fora')
    })
    it('cliente sem venda: zeros; anonimizado aparece como "Cliente removido"', async () => {
      const caio = await (await requisitar('chefe', 'GET', `/${ids.get('caio')}`)).json()
      assert.equal(caio.totalVendas, 0); assert.equal(caio.totalGasto, 0); assert.deepEqual(caio.enderecos, [])
      const removido = await (await requisitar('chefe', 'GET', `/${ids.get('removido')}`)).json()
      assert.equal(removido.nome, 'Cliente removido')
      assert.equal(removido.email, null); assert.equal(removido.telefone, null)
      assert.equal(removido.ativo, false); assert.notEqual(removido.anonimizadoEm, null)
    })
    it('id inválido 400, inexistente 404', async () => {
      const invalido = await requisitar('chefe', 'GET', '/abc')
      assert.equal(invalido.status, 400); assert.deepEqual(await invalido.json(), { erro: 'Id inválido.' })
      const inexistente = await requisitar('chefe', 'GET', '/999999')
      assert.equal(inexistente.status, 404); assert.deepEqual(await inexistente.json(), { erro: 'Cliente não encontrado.' })
    })
  })

  describe('PATCH /api/clientes/:id (#38)', () => {
    it('desativar derruba as sessões e os tokens na hora e bloqueia o login', async () => {
      assert.equal((await requisitar('bia1', 'GET', '/me')).status, 200)
      const resposta = await requisitar('chefe', 'PATCH', `/${ids.get('bia')}`, { ativo: false })
      assert.equal(resposta.status, 200)
      assert.equal(resposta.headers.get('cache-control'), 'no-store')
      const texto = await resposta.text(); semSegredo(texto)
      const corpo = JSON.parse(texto)
      assert.equal(corpo.id, ids.get('bia')); assert.equal(corpo.ativo, false); assert.equal(corpo.anonimizadoEm, null)
      assert.equal(await contar('sessoes', 'bia'), 0)
      assert.equal(await contar('tokens_recuperacao_senha', 'bia'), 0)
      for (const sessao of ['bia1', 'bia2']) assert.equal((await requisitar(sessao, 'GET', '/me')).status, 401)
      assert.equal((await login('teste.adm.bia@exemplo.com')).status, 401)
    })
    it('repetir é idempotente (não escreve); reativar devolve o login', async () => {
      const antes = await linhaDe('bia')
      const repetido = await requisitar('chefe', 'PATCH', `/${ids.get('bia')}`, { ativo: false })
      assert.equal(repetido.status, 200); assert.equal((await repetido.json()).ativo, false)
      assert.deepEqual(await linhaDe('bia'), antes, 'nem o atualizado_em muda')

      const reativado = await requisitar('chefe', 'PATCH', `/${ids.get('bia')}`, { ativo: true })
      assert.equal(reativado.status, 200); assert.equal((await reativado.json()).ativo, true)
      const entrada = await login('teste.adm.bia@exemplo.com')
      assert.equal(entrada.status, 200)
      const sid = /sid=([^;]+)/.exec(entrada.headers.get('set-cookie'))[1]
      tokens.set('bia3', sid)
      assert.equal((await requisitar('bia3', 'GET', '/me')).status, 200)
    })
    it('reativar apaga sessões órfãs criadas enquanto o cliente estava inativo', async () => {
      await criarConta('orfao', 'Órfão Teste')
      await cliente.query('UPDATE clientes SET ativo = false WHERE id = $1', [ids.get('orfao')])
      // Simula a corrida: a sessão do login entrou depois da desativação
      await criarSessao('orfao')
      assert.equal(await contar('sessoes', 'orfao'), 1)
      assert.equal((await requisitar('orfao', 'GET', '/me')).status, 401, 'inativo: a sessão não vale')

      const resposta = await requisitar('chefe', 'PATCH', `/${ids.get('orfao')}`, { ativo: true })
      assert.equal(resposta.status, 200); assert.equal((await resposta.json()).ativo, true)
      assert.equal(await contar('sessoes', 'orfao'), 0)
      assert.equal((await requisitar('orfao', 'GET', '/me')).status, 401, 'a sessão órfã não volta a valer')
    })
    it('ativo precisa ser exatamente true ou false; outras chaves são ignoradas', async () => {
      for (const [body, detalhes] of [
        [{ ativo: 'false' }, { ativo: 'Informe true ou false.' }],
        [{ ativo: 0 }, { ativo: 'Informe true ou false.' }],
        [{ ativo: null }, { ativo: 'Informe true ou false.' }],
        [{}, { ativo: 'Informe true ou false.' }],
        [[], { body: 'Formato de dados inválido.' }],
      ]) {
        const resposta = await requisitar('chefe', 'PATCH', `/${ids.get('caio')}`, body)
        assert.equal(resposta.status, 422, JSON.stringify(body))
        assert.deepEqual(await resposta.json(), { erro: 'Dados inválidos', detalhes }, JSON.stringify(body))
      }
      const semCorpo = await requisitar('chefe', 'PATCH', `/${ids.get('caio')}`)
      assert.equal(semCorpo.status, 422)

      const resposta = await requisitar('chefe', 'PATCH', `/${ids.get('caio')}`,
        { ativo: false, papel: 'admin', nome: 'X', email: 'x@x.com', anonimizadoEm: null })
      assert.equal(resposta.status, 200)
      const linha = await linhaDe('caio')
      assert.equal(linha.ativo, false); assert.equal(linha.papel, 'cliente')
      assert.equal(linha.nome, 'Caio Teste'); assert.equal(linha.email, 'teste.adm.caio@exemplo.com')
    })
    it('admin não altera outro admin nem a si mesmo; sem Origin 403; 404 e 400', async () => {
      for (const alvo of ['outro', 'chefe']) {
        const resposta = await requisitar('chefe', 'PATCH', `/${ids.get(alvo)}`, { ativo: false })
        assert.equal(resposta.status, 409, alvo)
        assert.deepEqual(await resposta.json(), { erro: 'Não é possível alterar uma conta de administrador.' })
        assert.equal((await linhaDe(alvo)).ativo, true)
      }
      const semOrigem = await requisitar('chefe', 'PATCH', `/${ids.get('ana')}`, { ativo: false }, { comOrigem: false })
      assert.equal(semOrigem.status, 403)
      assert.deepEqual(await semOrigem.json(), { erro: 'Origem da requisição não permitida.' })
      assert.equal((await linhaDe('ana')).ativo, true)
      assert.equal((await requisitar('chefe', 'PATCH', '/999999', { ativo: false })).status, 404)
      assert.equal((await requisitar('chefe', 'PATCH', `/${ids.get('removido')}`, { ativo: true })).status, 404)
      assert.equal((await requisitar('chefe', 'PATCH', '/abc', { ativo: false })).status, 400)
    })
  })

  describe('DELETE /api/clientes/:id (#38)', () => {
    it('anonimiza um cliente desativado (a trava nova aceita inativo); repetir dá 404', async () => {
      assert.equal((await linhaDe('caio')).ativo, false, 'desativado no PATCH acima')
      const resposta = await requisitar('chefe', 'DELETE', `/${ids.get('caio')}`)
      assert.equal(resposta.status, 204); assert.equal(await resposta.text(), '')
      const linha = await linhaDe('caio')
      assert.equal(linha.nome, 'Cliente removido'); assert.equal(linha.email, null); assert.notEqual(linha.anonimizado_em, null)
      assert.equal(await contar('sessoes', 'caio'), 0)
      const repetido = await requisitar('chefe', 'DELETE', `/${ids.get('caio')}`)
      assert.equal(repetido.status, 404); assert.deepEqual(await repetido.json(), { erro: 'Cliente não encontrado.' })
    })
    it('admin não remove outro admin nem a si mesmo; sem Origin 403', async () => {
      for (const alvo of ['outro', 'chefe']) {
        const resposta = await requisitar('chefe', 'DELETE', `/${ids.get(alvo)}`)
        assert.equal(resposta.status, 409, alvo)
        assert.deepEqual(await resposta.json(), { erro: 'Não é possível alterar uma conta de administrador.' })
        assert.equal((await linhaDe(alvo)).anonimizado_em, null)
      }
      assert.equal((await requisitar('chefe', 'DELETE', `/${ids.get('ana')}`, undefined, { comOrigem: false })).status, 403)
      assert.equal((await linhaDe('ana')).anonimizado_em, null)
    })
    it('cliente com venda paga: 409 com a mensagem de admin e a conta continua igual', async () => {
      const antes = await linhaDe('bia')
      const resposta = await requisitar('chefe', 'DELETE', `/${ids.get('bia')}`)
      assert.equal(resposta.status, 409)
      assert.deepEqual(await resposta.json(), { erro: msgAdmin })
      assert.deepEqual(await linhaDe('bia'), antes)
      assert.equal(await contar('enderecos_cliente', 'bia'), 1)
      assert.equal((await requisitar('bia3', 'GET', '/me')).status, 200, 'a sessão continua')
    })
    it('regressão da #24: o DELETE /me mantém a mensagem de cliente e anonimiza com a senha', async () => {
      const venda = await criarVenda('ana', 'aguardando_pagamento', 1000)
      const bloqueado = await requisitar('ana', 'DELETE', '/me', { senha })
      assert.equal(bloqueado.status, 409)
      assert.deepEqual(await bloqueado.json(), { erro: msgCliente })
      await cliente.query('DELETE FROM vendas WHERE id = $1', [venda])
      const apagado = await requisitar('ana', 'DELETE', '/me', { senha })
      assert.equal(apagado.status, 204)
      assert.notEqual((await linhaDe('ana')).anonimizado_em, null)
    })
  })

  it('PATCH desativar e DELETE em paralelo no mesmo cliente: sem 500, sem travar, banco coerente (5 rodadas)', async () => {
    for (let rodada = 0; rodada < 5; rodada++) {
      const chave = `paralelo${rodada}`
      await criarConta(chave, `Paralelo ${rodada}`); await criarSessao(chave)
      const [patch, remocao] = await Promise.all([
        requisitar('chefe', 'PATCH', `/${ids.get(chave)}`, { ativo: false }),
        requisitar('chefe', 'DELETE', `/${ids.get(chave)}`),
      ])
      assert.ok([200, 404].includes(patch.status), `rodada ${rodada}: PATCH ${patch.status}`)
      assert.equal(remocao.status, 204, `rodada ${rodada}: DELETE`)
      if (patch.status === 200) assert.equal((await patch.json()).ativo, false)
      else assert.deepEqual(await patch.json(), { erro: 'Cliente não encontrado.' })
      const linha = await linhaDe(chave)
      assert.equal(linha.ativo, false); assert.notEqual(linha.anonimizado_em, null)
      assert.equal(linha.email, null)
      assert.equal(await contar('sessoes', chave), 0)
    }
  })
})
