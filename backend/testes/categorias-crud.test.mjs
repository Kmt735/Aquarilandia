import assert from 'node:assert/strict'
import { once } from 'node:events'
import { after, afterEach, before, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { db } from '../src/config/db.ts'
import { env } from '../src/config/env.ts'
import { hashToken } from '../src/modulos/auth/sessao.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'

describe('Categorias — leitura e escritas autorizadas HTTP', () => {
  let servidor
  let origem
  const categoria = { id: 42, nome: 'Nova Categoria', slug: 'nova-categoria' }
  const token = 'sessao-http-categorias'

  before(async () => {
    servidor = app.listen(0, '127.0.0.1')
    await once(servidor, 'listening')
    origem = `http://127.0.0.1:${servidor.address().port}`
  })
  afterEach(() => mock.restoreAll())
  after(async () => {
    if (servidor) await new Promise((resolve) => servidor.close(resolve))
    await db.end()
  })

  function autorizar(papel = 'admin') {
    return mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async (hash) => (
      hash === hashToken(token) ? { id: 7, papel } : null
    ))
  }
  function escrever(method, caminho, body, headers = {}) {
    return fetch(`${origem}${caminho}`, {
      method,
      headers: { Origin: env.corsOrigin, Cookie: `sid=${token}`, 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  it('consulta por ID sem exigir sessão ou origem', async () => {
    const consulta = mock.method(db, 'query', async () => ({ rows: [categoria] }))
    const sessao = mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => { throw new Error('Rota pública') })
    const resposta = await fetch(`${origem}/api/categorias/42`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), categoria)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [42])
    assert.equal(sessao.mock.callCount(), 0)
  })

  it('retorna 404 para categoria inexistente', async () => {
    mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await fetch(`${origem}/api/categorias/2147483647`)
    assert.equal(resposta.status, 404)
    assert.deepEqual(await resposta.json(), { erro: 'Categoria não encontrada' })
  })

  const escritas = [
    ['POST', '/api/categorias', { nome: 'Nova Categoria', slug: 'nova-categoria' }],
    ['PATCH', '/api/categorias/42', { nome: 'Nome novo' }],
    ['DELETE', '/api/categorias/42', undefined],
  ]
  for (const [method, caminho, body] of escritas) {
    it(`${method} exige sessão com 401 antes de acessar categorias`, async () => {
      const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
      const sessao = autorizar()
      const resposta = await escrever(method, caminho, body, { Cookie: '' })
      assert.equal(resposta.status, 401)
      assert.equal(consulta.mock.callCount(), 0)
      assert.equal(sessao.mock.callCount(), 0)
    })

    it(`${method} recusa sessão inválida com 401`, async () => {
      autorizar()
      const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
      const resposta = await escrever(method, caminho, body, { Cookie: 'sid=inventada' })
      assert.equal(resposta.status, 401)
      assert.equal(consulta.mock.callCount(), 0)
    })

    it(`${method} recusa cliente com 403 mesmo que tente informar papel admin`, async () => {
      autorizar('cliente')
      const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
      const resposta = await escrever(method, `${caminho}?papel=admin`, body, { 'X-Role': 'admin' })
      assert.equal(resposta.status, 403)
      assert.equal(consulta.mock.callCount(), 0)
    })

    it(`${method} recusa origem diferente da configurada`, async () => {
      autorizar()
      const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
      const resposta = await escrever(method, caminho, body, { Origin: 'https://origem-invalida.example' })
      assert.equal(resposta.status, 403)
      assert.deepEqual(await resposta.json(), { erro: 'Origem da requisição não permitida.' })
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  it('recusa escrita admin sem Origin, conforme convenção local', async () => {
    autorizar()
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await escrever('POST', '/api/categorias', categoria, { Origin: '' })
    assert.equal(resposta.status, 403)
    assert.equal(consulta.mock.callCount(), 0)
  })

  it('cria com 201, normaliza campos e usa o hash da sessão existente', async () => {
    const sessao = autorizar()
    const consulta = mock.method(db, 'query', async () => ({ rows: [categoria] }))
    const resposta = await escrever('POST', '/api/categorias', { nome: ' Nova Categoria ', slug: ' nova-categoria ' })
    assert.equal(resposta.status, 201)
    assert.deepEqual(await resposta.json(), categoria)
    assert.deepEqual(sessao.mock.calls[0].arguments, [hashToken(token)])
    assert.deepEqual(consulta.mock.calls[0].arguments[1], ['Nova Categoria', 'nova-categoria'])
  })

  for (const [body, parametros] of [
    [{ nome: ' Nome novo ' }, [42, 'Nome novo', null]],
    [{ slug: ' slug-novo ' }, [42, null, 'slug-novo']],
    [{ nome: 'Nome novo', slug: 'slug-novo' }, [42, 'Nome novo', 'slug-novo']],
  ]) {
    it(`atualiza somente os campos enviados: ${Object.keys(body).join(', ')}`, async () => {
      autorizar()
      const consulta = mock.method(db, 'query', async () => ({ rows: [categoria] }))
      const resposta = await escrever('PATCH', '/api/categorias/42', body)
      assert.equal(resposta.status, 200)
      assert.deepEqual(await resposta.json(), categoria)
      assert.deepEqual(consulta.mock.calls[0].arguments[1].slice(0, 3), parametros)
      assert.equal(consulta.mock.calls[0].arguments[1][3].includes('peixes'), true)
    })
  }

  it('exclui com 204 sem consulta prévia nem corpo de resposta', async () => {
    autorizar()
    const consulta = mock.method(db, 'query', async () => ({ rows: [{ id: 42 }] }))
    const resposta = await escrever('DELETE', '/api/categorias/42')
    assert.equal(resposta.status, 204)
    assert.equal(await resposta.text(), '')
    assert.equal(consulta.mock.callCount(), 1)
    assert.match(consulta.mock.calls[0].arguments[0], /^DELETE FROM categorias/)
    assert.deepEqual(consulta.mock.calls[0].arguments[1], [42])
  })

  for (const method of ['PATCH', 'DELETE']) {
    it(`${method} retorna 404 se o registro não existe`, async () => {
      autorizar()
      mock.method(db, 'query', async () => ({ rows: [] }))
      const resposta = await escrever(method, '/api/categorias/42', method === 'PATCH' ? { nome: 'Nome novo' } : undefined)
      assert.equal(resposta.status, 404)
      assert.deepEqual(await resposta.json(), { erro: 'Categoria não encontrada' })
    })
  }

  for (const method of ['POST', 'PATCH']) {
    for (const campo of ['nome', 'slug']) {
      it(`${method} converte a unicidade real de ${campo} em 409`, async () => {
        autorizar()
        mock.method(db, 'query', async () => {
          throw Object.assign(new Error('Detalhe interno do PostgreSQL'), { code: '23505', constraint: `categorias_${campo}_key` })
        })
        const resposta = await escrever(method, `/api/categorias${method === 'PATCH' ? '/42' : ''}`, { nome: 'Nome novo', slug: 'slug-novo' })
        const corpo = await resposta.json()
        assert.equal(resposta.status, 409)
        assert.equal(corpo.erro, 'Categoria já cadastrada')
        assert.equal(typeof corpo.detalhes[campo], 'string')
      })
    }
  }

  it('converte a violação da FK na exclusão em 409, inclusive na corrida com outro escritor', async () => {
    autorizar()
    mock.method(db, 'query', async () => {
      throw Object.assign(new Error('Detalhe interno: produto ativo ou inativo'), { code: '23503', constraint: 'produtos_categoria_id_fkey' })
    })
    const resposta = await escrever('DELETE', '/api/categorias/42')
    assert.equal(resposta.status, 409)
    assert.deepEqual(await resposta.json(), { erro: 'Categoria possui produtos vinculados e não pode ser excluída.' })
  })

  const invalidos = [
    ['POST', {}, ['nome', 'slug']],
    ['POST', [], ['body']],
    ['POST', { nome: 'Nome' }, ['slug']],
    ['POST', { nome: 123, slug: 'valido' }, ['nome']],
    ['POST', { nome: ' ', slug: 'valido' }, ['nome']],
    ['POST', { nome: 'A', slug: 'valido' }, ['nome']],
    ['POST', { nome: 'a'.repeat(81), slug: 'valido' }, ['nome']],
    ['POST', { nome: 'No\u0000me', slug: 'valido' }, ['nome']],
    ['POST', { nome: 'Nome', slug: null }, ['slug']],
    ['POST', { nome: 'Nome', slug: '' }, ['slug']],
    ['POST', { nome: 'Nome', slug: 'Slug-Invalido' }, ['slug']],
    ['POST', { nome: 'Nome', slug: '-invalido' }, ['slug']],
    ['POST', { nome: 'Nome', slug: 'slug--invalido' }, ['slug']],
    ['POST', { nome: 'Nome', slug: 'a'.repeat(81) }, ['slug']],
    ['POST', { nome: 'Nome', slug: 'valido', papel: 'admin' }, ['papel']],
    ['PATCH', {}, ['body']],
    ['PATCH', { nome: null }, ['nome']],
    ['PATCH', { slug: null }, ['slug']],
    ['PATCH', { id: 99 }, ['body', 'id']],
    ['PATCH', { slug: 'válido' }, ['slug']],
  ]
  for (const [method, body, campos] of invalidos) {
    it(`valida corpo ${method}: ${JSON.stringify(body).slice(0, 90)}`, async () => {
      autorizar()
      const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
      const resposta = await escrever(method, `/api/categorias${method === 'PATCH' ? '/42' : ''}`, body)
      const corpo = await resposta.json()
      assert.equal(resposta.status, 400)
      assert.equal(corpo.erro, 'Dados inválidos')
      assert.deepEqual(Object.keys(corpo.detalhes).sort(), campos.sort())
      assert.equal(consulta.mock.callCount(), 0)
    })
  }

  for (const method of ['GET', 'PATCH', 'DELETE']) {
    for (const id of ['0', '-1', '1.5', '01', '2147483648', 'categoria', '1 OR true']) {
      it(`recusa ID inválido ${id} em ${method} sem consultar categorias`, async () => {
        autorizar()
        const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
        const caminho = `/api/categorias/${encodeURIComponent(id)}`
        const resposta = method === 'GET' ? await fetch(`${origem}${caminho}`)
          : await escrever(method, caminho, method === 'PATCH' ? { nome: 'Nome novo' } : undefined)
        assert.equal(resposta.status, 400)
        assert.equal(typeof (await resposta.json()).detalhes.id, 'string')
        assert.equal(consulta.mock.callCount(), 0)
      })
    }
  }

  it('falha de consulta de sessão não libera escrita', async () => {
    mock.method(console, 'error', () => {})
    mock.method(sessaoRepository, 'buscarUsuarioPorTokenHash', async () => { throw new Error('Banco indisponível') })
    const consulta = mock.method(db, 'query', async () => ({ rows: [] }))
    const resposta = await escrever('POST', '/api/categorias', { nome: 'Nome novo', slug: 'slug-novo' })
    assert.equal(resposta.status, 500)
    assert.equal(consulta.mock.callCount(), 0)
  })

  for (const method of ['GET', 'POST', 'PATCH', 'DELETE']) {
    it(`mantém erro genérico na falha do banco em ${method}`, async () => {
      autorizar()
      mock.method(console, 'error', () => {})
      mock.method(db, 'query', async () => { throw new Error('Falha interna: senha=segredo') })
      const caminho = `/api/categorias${method === 'POST' ? '' : '/42'}`
      const resposta = method === 'GET' ? await fetch(`${origem}${caminho}`)
        : await escrever(method, caminho, method === 'DELETE' ? undefined : { nome: 'Nome novo', slug: 'slug-novo' })
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    })
  }
})
