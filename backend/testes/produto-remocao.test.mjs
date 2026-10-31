import assert from 'node:assert/strict'
import { once } from 'node:events'
import { gzipSync } from 'node:zlib'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { hashToken } from '../src/modulos/auth/sessao.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'

describe('DELETE /api/produtos/:id — desativação administrativa HTTP', () => {
  let servidor, origem
  const token = 'sessao-remocao-produto'
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })
  function autorizar(papel = 'admin') {
    return mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async (hash) => (
      hash === hashToken(token) && papel ? { id: 7, papel } : null
    ))
  }
  function remover(id = '42', headers = {}, body, query = '') {
    return fetch(`${origem}/api/produtos/${encodeURIComponent(id)}${query}`, { method: 'DELETE',
      headers: { Cookie: `sid=${token}`, Origin: env.corsOrigin, ...headers }, body })
  }
  for (const [descricao, papel, headers, status] of [
    ['sem sessão', 'admin', { Cookie: '' }, 401], ['sessão inválida', 'admin', { Cookie: 'sid=inventada' }, 401],
    ['cliente com header de admin forjado', 'cliente', { 'X-Role': 'admin' }, 403],
    ['sem Origin', 'admin', { Origin: '' }, 403], ['Origin incorreto', 'admin', { Origin: 'https://invalida.example' }, 403],
    ['Origin null', 'admin', { Origin: 'null' }, 403],
  ]) {
    it(`recusa ${descricao} antes de alterar produtos`, async () => {
      autorizar(papel)
      const consulta = mock.method(db, 'query', async () => ({ rows: [{ id: 42 }] }))
      const resposta = await remover('42', headers)
      assert.equal(resposta.status, status)
      assert.deepEqual(await resposta.json(), { erro: status === 401 ? 'Faça login para continuar.'
        : papel === 'cliente' ? 'Acesso permitido somente para administradores.' : 'Origem da requisição não permitida.' })
      assert.equal(consulta.mock.callCount(), 0)
    })
  }
  for (const id of ['0', '-1', '01', '1.0', '1e2', '2147483648', 'abc', ' 42', '42 ', "1' OR 1=1--"]) {
    it(`recusa ID ${JSON.stringify(id)} com 400 antes do banco`, async () => {
      autorizar()
      const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
      const resposta = await remover(id)
      assert.equal(resposta.status, 400)
      assert.deepEqual(await resposta.json(), { erro: 'Parâmetros inválidos',
        detalhes: { id: 'Informe um ID inteiro entre 1 e 2147483647.' } })
      assert.equal(consulta.mock.callCount(), 0)
    })
  }
  it('valida a sessão antes do ID malformado', async () => {
    assert.equal((await remover('inválido', { Cookie: '' })).status, 401)
  })
  for (const id of ['42', '2147483647']) {
    it(`desativa por ID parametrizado ${id} e retorna 204 sem JSON`, async () => {
      autorizar()
      const consulta = mock.method(db, 'query', async () => ({ rows: [{ id: Number(id) }] }))
      const resposta = await remover(id)
      assert.equal(resposta.status, 204)
      assert.equal(await resposta.text(), '')
      assert.equal(resposta.headers.get('content-type'), null)
      assert.equal(consulta.mock.callCount(), 1)
      const [sql, params] = consulta.mock.calls[0].arguments
      assert.match(sql, /UPDATE produtos/)
      assert.match(sql, /WHERE id = \$1 AND ativo/)
      assert.deepEqual(params, [Number(id)])
      assert.doesNotMatch(sql, /DELETE FROM|SET estoque|SET nome|SET preco/i)
    })
  }
  it('não usa corpo ou query para mudar estoque, preço, categoria ou outro ID', async () => {
    autorizar()
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ id: 42 }] }))
    const resposta = await remover('42', { 'Content-Type': 'application/json' },
      JSON.stringify({ id: 99, ativo: true, estoque: 0, preco: 1, categoriaId: 2, ficha: null }), '?id=99&ativo=true&estoque=0')
    assert.equal(resposta.status, 204)
    const [sql, params] = consulta.mock.calls[0].arguments
    assert.deepEqual(params, [42])
    assert.doesNotMatch(sql, /estoque\s*=|preco\s*=|categoria_id\s*=|DELETE FROM/i)
  })
  it('retorna o mesmo 404 para ID inexistente, inativo ou repetido', async () => {
    autorizar()
    mock.method(db, 'query', async () => ({ rows: [] }))
    for (let i = 0; i < 2; i++) {
      const resposta = await remover()
      assert.equal(resposta.status, 404)
      assert.deepEqual(await resposta.json(), { erro: 'Produto não encontrado' })
    }
  })
  it('reconsulta o papel e a validade da sessão a cada chamada com o mesmo cookie', async () => {
    let usuario = { id: 7, papel: 'admin' }
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => usuario)
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ id: 42 }] }))
    assert.equal((await remover()).status, 204)
    usuario = { id: 7, papel: 'cliente' }; assert.equal((await remover()).status, 403)
    usuario = null; assert.equal((await remover()).status, 401)
    assert.equal(consulta.mock.callCount(), 1)
  })
  for (const etapa of ['sessão', 'produto']) {
    it(`falha do banco na consulta de ${etapa} retorna 500 sem detalhes internos`, async () => {
      autorizar()
      const log = mock.method(console, 'error', () => {})
      const erro = new Error('senha=segredo; SQL interno de teste')
      if (etapa === 'sessão') {
        sessaoRepository.buscarUsuarioPorTokenHash.mock.restore()
        mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => { throw erro })
      }
      const consulta = mock.method(db, 'query', async () => { throw erro })
      const resposta = await remover()
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      assert.equal(consulta.mock.callCount(), etapa === 'sessão' ? 0 : 1)
      assert.equal(log.mock.callCount(), 1)
    })
  }
  it('preserva 413 e 415 globais antes da sessão também no DELETE', async () => {
    const sessao = autorizar()
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const grande = await remover('42', { 'Content-Type': 'application/json' }, JSON.stringify({ dados: 'x'.repeat(102400) }))
    assert.equal(grande.status, 413)
    assert.deepEqual(await grande.json(), { erro: 'Corpo da requisição excede o limite de 100 KiB' })
    const comprimido = await remover('42', { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' }, gzipSync('{}'))
    assert.equal(comprimido.status, 415)
    assert.deepEqual(await comprimido.json(), { erro: 'Codificação de corpo não suportada. Envie JSON sem compressão.' })
    assert.equal(sessao.mock.callCount(), 0); assert.equal(consulta.mock.callCount(), 0)
  })
})
