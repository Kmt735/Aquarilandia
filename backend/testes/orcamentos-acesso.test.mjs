import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { hashToken } from '../src/modulos/auth/sessao.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'
import { orcamentoRepository } from '../src/modulos/orcamentos/orcamento.repository.ts'
import { orcamentoService } from '../src/modulos/orcamentos/orcamento.service.ts'

describe('Orçamentos — criação pública e consulta administrativa HTTP', () => {
  let servidor, origem, criado
  const token = 'sessao-teste-orcamentos'
  const fixture = { nome: 'Pessoa Sintética Privada', telefone: '32999999999', servico: 'Outro', mensagem: 'Mensagem privada de teste' }
  const campos = ['id', 'criadoEm', 'atualizadoEm', 'nome', 'telefone', 'servico', 'mensagem', 'status'].sort()
  const banco = []
  // Os orçamentos ficam no PostgreSQL: aqui o repository grava numa lista e qualquer outro acesso ao banco falha,
  // para o teste HTTP nunca encostar no banco de desenvolvimento (o SQL real fica na suíte de integração)
  function simularBanco() {
    mock.method(db, 'query', async () => { throw new Error('O teste unitário não acessa o banco') })
    mock.method(orcamentoRepository, 'inserir', async (dados) => {
      const agora = new Date()
      const registro = { id: banco.length + 1, ...dados, status: 'novo', criadoEm: agora, atualizadoEm: agora }
      banco.push(registro); return registro
    })
    mock.method(orcamentoRepository, 'listar', async ({ status, limite, offset }) => {
      const filtrados = banco.filter((item) => !status || item.status === status).reverse()
      return { dados: filtrados.slice(offset, offset + limite), total: filtrados.length }
    })
    mock.method(orcamentoRepository, 'atualizarStatus', async (id, status) => {
      const registro = banco.find((item) => item.id === id)
      if (!registro) return null
      Object.assign(registro, { status, atualizadoEm: new Date() }); return registro
    })
  }
  before(async () => {
    simularBanco()
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
    const resposta = await fetch(`${origem}/api/orcamentos`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: env.corsOrigin }, body: JSON.stringify(fixture) })
    assert.equal(resposta.status, 201); criado = await resposta.json()
  })
  beforeEach(() => simularBanco())
  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })
  function sessao(papel = 'admin') {
    simularBanco()
    return mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async (hash) => (
      hash === hashToken(token) && papel !== null ? { id: 7, papel } : null
    ))
  }
  function requisitar(method = 'GET', caminho = '/api/orcamentos', cookie = `sid=${token}`, headers = {}) {
    return fetch(`${origem}${caminho}`, { method, headers: { Cookie: cookie, ...headers } })
  }
  async function negar(resposta, status) {
    assert.equal(resposta.status, status)
    const corpo = await resposta.json()
    assert.deepEqual(corpo, { erro: status === 401 ? 'Faça login para continuar.' : 'Acesso permitido somente para administradores.' })
    const texto = JSON.stringify(corpo)
    for (const valor of [...Object.values(fixture), criado.id]) assert.equal(texto.includes(valor), false)
    assert.equal('dados' in corpo || 'itens' in corpo || 'token' in corpo, false)
  }

  it('mantém o POST público sem consulta de sessão e ignora campos de credenciais enviados no corpo', async () => {
    const consulta = mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => { throw new Error('Não consultar sessão na criação pública') })
    const resposta = await fetch(`${origem}/api/orcamentos`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: env.corsOrigin }, body: JSON.stringify({ ...fixture, senha: 'segredo-ficticio',
        tokenHash: 'token-ficticio', papel: 'admin', id: 'id-forjado' }) })
    assert.equal(resposta.status, 201)
    const corpo = await resposta.json()
    assert.deepEqual(Object.keys(corpo).sort(), campos)
    assert.notEqual(corpo.id, 'id-forjado'); assert.equal(consulta.mock.callCount(), 0)
  })

  it('visitante recebe 401 antes de chamar a listagem', async () => {
    const consulta = sessao()
    const listar = mock.method(orcamentoService, 'listar', () => { throw new Error('Acesso indevido') })
    await negar(await requisitar('GET', '/api/orcamentos', ''), 401)
    assert.equal(listar.mock.callCount(), 0); assert.equal(consulta.mock.callCount(), 0)
  })
  it('token inventado recebe 401 sem dados pessoais', async () => {
    sessao()
    await negar(await requisitar('GET', '/api/orcamentos', 'sid=inventada'), 401)
  })
  it('cliente recebe 403 mesmo com Origin permitido e tentativa de informar papel admin', async () => {
    sessao('cliente')
    const listar = mock.method(orcamentoService, 'listar', () => { throw new Error('Acesso indevido') })
    await negar(await requisitar('GET', '/api/orcamentos?papel=admin', `sid=${token}`, { Origin: env.corsOrigin, 'X-Role': 'admin' }), 403)
    assert.equal(listar.mock.callCount(), 0)
  })
  it('admin pode listar sem Origin e recebe só o DTO administrativo, sem cache', async () => {
    const consulta = sessao()
    const resposta = await requisitar()
    assert.equal(resposta.status, 200); assert.equal(resposta.headers.get('cache-control'), 'no-store')
    const corpo = await resposta.json()
    assert.deepEqual(Object.keys(corpo).sort(), ['dados', 'limite', 'pagina', 'total'])
    const lista = corpo.dados
    assert.ok(lista.some((item) => item.id === criado.id && item.mensagem === fixture.mensagem))
    for (const item of lista) assert.deepEqual(Object.keys(item).sort(), campos)
    assert.deepEqual(consulta.mock.calls[0].arguments, [hashToken(token)])
  })
  it('metadados internos eventualmente presentes no registro não entram na listagem', async () => {
    sessao()
    const registro = await orcamentoService.criar({ ...fixture, nome: 'Fixture interna' })
    Object.assign(banco.find((item) => item.id === registro.id), { senhaHash: 'hash-ficticio', tokenHash: 'token-ficticio', sessao: { id: 'interna' }, anotacaoTecnica: 'interna' })
    const lista = (await (await requisitar()).json()).dados
    const item = lista.find((item) => item.id === registro.id)
    assert.deepEqual(Object.keys(item).sort(), campos)
    assert.equal(JSON.stringify(item).includes('ficticio'), false)
  })
  it('mudança de papel e revogação são respeitadas na próxima chamada com o mesmo cookie', async () => {
    let papel = 'admin'
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => papel === null ? null : { id: 7, papel })
    assert.equal((await requisitar()).status, 200)
    papel = 'cliente'; await negar(await requisitar(), 403)
    papel = 'admin'; assert.equal((await requisitar()).status, 200)
    papel = null; await negar(await requisitar(), 401)
  })
  it('ETag de resposta admin não permite visitante/cliente receber 304 ou dados privados', async () => {
    sessao()
    const etag = (await requisitar()).headers.get('etag')
    assert.ok(etag)
    await negar(await requisitar('GET', '/api/orcamentos', '', { 'If-None-Match': etag }), 401)
    mock.restoreAll(); sessao('cliente')
    await negar(await requisitar('GET', '/api/orcamentos', `sid=${token}`, { 'If-None-Match': etag }), 403)
  })
  it('HEAD também respeita sessão e permissão', async () => {
    sessao()
    assert.equal((await requisitar('HEAD', '/api/orcamentos', '')).status, 401)
    mock.restoreAll(); sessao('cliente')
    assert.equal((await requisitar('HEAD')).status, 403)
    mock.restoreAll(); sessao()
    const resposta = await requisitar('HEAD')
    assert.equal(resposta.status, 200); assert.equal(await resposta.text(), '')
    assert.equal(resposta.headers.get('cache-control'), 'no-store')
  })

  for (const [method, caminho] of [['GET', '/api/orcamentos/um-id'], ['DELETE', '/api/orcamentos/um-id']]) {
    it(`${method} ${caminho} está protegido e permanece incompleto para admin`, async () => {
      sessao(); await negar(await requisitar(method, caminho, ''), 401)
      mock.restoreAll(); sessao('cliente'); await negar(await requisitar(method, caminho), 403)
      mock.restoreAll(); sessao()
      const resposta = await requisitar(method, caminho)
      assert.equal(resposta.status, 404)
      const corpo = await resposta.json()
      for (const valor of Object.values(fixture)) assert.equal(JSON.stringify(corpo).includes(valor), false)
    })
  }
  function alterarStatus(id, body, { cookie = `sid=${token}`, origin = env.corsOrigin } = {}) {
    const headers = { 'Content-Type': 'application/json', Cookie: cookie }
    if (origin) headers.Origin = origin
    return fetch(`${origem}/api/orcamentos/${id}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
  }
  it('PATCH /api/orcamentos/um-id está protegido e, para admin, exige Origin e id numérico', async () => {
    const caminho = '/api/orcamentos/um-id'
    sessao(); await negar(await requisitar('PATCH', caminho, ''), 401)
    mock.restoreAll(); sessao('cliente'); await negar(await requisitar('PATCH', caminho), 403)
    mock.restoreAll(); sessao()
    const semOrigem = await requisitar('PATCH', caminho)
    assert.equal(semOrigem.status, 403)
    assert.deepEqual(await semOrigem.json(), { erro: 'Origem da requisição não permitida.' })
    const idInvalido = await alterarStatus('um-id', { status: 'concluido' })
    assert.equal(idInvalido.status, 400)
    const corpo = await idInvalido.json()
    assert.deepEqual(corpo, { erro: 'Id inválido.' })
    for (const valor of Object.values(fixture)) assert.equal(JSON.stringify(corpo).includes(valor), false)
  })
  it('PATCH: admin muda o status (200), só o status muda e o campo é exato', async () => {
    sessao()
    const resposta = await alterarStatus(criado.id, { status: 'em_atendimento', nome: 'Outro nome', telefone: '000', id: 999 })
    assert.equal(resposta.status, 200); assert.equal(resposta.headers.get('cache-control'), 'no-store')
    const corpo = await resposta.json()
    assert.deepEqual(Object.keys(corpo).sort(), campos)
    assert.equal(corpo.status, 'em_atendimento'); assert.equal(corpo.id, criado.id)
    assert.equal(corpo.nome, fixture.nome); assert.equal(corpo.telefone, fixture.telefone)
    for (const status of ['aprovado', ' novo ', 'NOVO', null, 1]) {
      const invalido = await alterarStatus(criado.id, { status })
      assert.equal(invalido.status, 422)
      assert.deepEqual(await invalido.json(), { erro: 'Dados inválidos',
        detalhes: { status: 'Escolha um status válido: novo, em_atendimento ou concluido.' } })
    }
    const lista = await alterarStatus(criado.id, [])
    assert.equal(lista.status, 422); assert.deepEqual((await lista.json()).detalhes, { body: 'Formato de dados inválido.' })
    const inexistente = await alterarStatus(999999, { status: 'novo' })
    assert.equal(inexistente.status, 404); assert.deepEqual(await inexistente.json(), { erro: 'Orçamento não encontrado.' })
    assert.equal(banco.find((item) => item.id === criado.id).status, 'em_atendimento')
  })
  it('PATCH: cliente recebe 403 e visitante 401 sem alterar o status', async () => {
    const antes = banco.find((item) => item.id === criado.id).status
    sessao('cliente'); await negar(await alterarStatus(criado.id, { status: 'concluido' }), 403)
    await negar(await alterarStatus(criado.id, { status: 'concluido' }, { cookie: '' }), 401)
    assert.equal(banco.find((item) => item.id === criado.id).status, antes)
  })
  it('falha da sessão não libera a listagem nem retorna detalhes técnicos', async () => {
    mock.method(console, 'error', () => {})
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => { throw new Error('Senha/conexão confidencial') })
    const listar = mock.method(orcamentoService, 'listar', () => { throw new Error('Não deveria executar') })
    const resposta = await requisitar()
    assert.equal(resposta.status, 500)
    assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    assert.equal(listar.mock.callCount(), 0)
  })
})
