import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import pg from 'pg'

const urlTeste = process.env.TEST_DATABASE_URL

describe('GET /api/peixes e /api/peixes/:id — PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_peixes_${randomUUID().replaceAll('-', '')}`
  const produtos = new Map()
  const ordemPublica = ['salobra', 'betta', 'cardinalA', 'cardinalB', 'marinho', 'literal']
  let cliente
  let pool
  let servidor
  let origem
  let schemaCriado = false

  async function inserir(chave, nome, cientifico, ficha = {}, opcoes = {}) {
    const categoria = opcoes.categoria ?? 'peixes'
    const { rows } = await cliente.query(
      `INSERT INTO produtos (categoria_id, nome, descricao, marca, preco, estoque, ativo)
       VALUES ((SELECT id FROM categorias WHERE slug = $1), $2, $3, $4, $5, $6, $7)
       RETURNING id, categoria_id AS "categoriaId", nome, descricao, marca, preco,
                 imagem_url AS "imagemUrl", (estoque > 0) AS "emEstoque"`,
      [categoria, nome, 'Texto exclusivo da descricao', 'MarcaExclusiva', opcoes.preco ?? 2000,
        opcoes.estoque ?? 1, opcoes.ativo ?? true],
    )
    const produto = { ...rows[0], categoria }
    produtos.set(chave, produto)
    if (opcoes.semFicha) return
    const dados = {
      nome_cientifico: cientifico, origem: null, tipo_agua: 'doce', tamanho_adulto_cm: 6.5,
      temp_min_c: 24.5, temp_max_c: 28.5, ph_min: 6, ph_max: 7.5, aquario_min_litros: 20,
      temperamento: 'semi_agressivo', nivel_natacao: null, cardume_minimo: 1, dieta: null,
      dificuldade: 'iniciante', ...ficha,
    }
    const colunas = Object.keys(dados)
    await cliente.query(
      `INSERT INTO peixes (produto_id, ${colunas.join(', ')})
       VALUES ($1, ${colunas.map((_coluna, i) => `$${i + 2}`).join(', ')})`,
      [produto.id, ...Object.values(dados)],
    )
  }

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    await cliente.query(await readFile(new URL('../../db/init/01_catalogo.sql', import.meta.url), 'utf8'))
    await inserir('betta', 'Betta', 'Betta splendens')
    await inserir('cardinalA', 'Cardinal', 'Paracheirodon axelrodi', {
      tamanho_adulto_cm: 4, aquario_min_litros: 60, dificuldade: 'intermediario', temperamento: 'pacifico',
    }, { estoque: 0, preco: 1500 })
    await inserir('cardinalB', 'Cardinal', 'Paracheirodon innesi', {
      temp_min_c: 20, temp_max_c: 26, ph_min: 5, ph_max: 7, tamanho_adulto_cm: 3.5,
      aquario_min_litros: 40, temperamento: 'pacifico',
    }, { preco: 1000 })
    await inserir('marinho', 'Palhaco', 'Amphiprion ocellaris', {
      temp_min_c: 24, temp_max_c: 27, ph_min: 8, ph_max: 8.5, tamanho_adulto_cm: 11,
      aquario_min_litros: 100, tipo_agua: 'marinho', dificuldade: 'intermediario',
    }, { preco: 8000 })
    await inserir('salobra', 'Baiacu', 'Tetraodon nigroviridis', {
      temp_min_c: 22, temp_max_c: 28, ph_min: 7, ph_max: 8.2, tamanho_adulto_cm: 15,
      aquario_min_litros: 120, tipo_agua: 'salobra', dificuldade: 'avancado', temperamento: 'agressivo',
    }, { preco: 6000 })
    // Valores sintéticos para testar os limites permitidos pelo schema, não uma ficha biológica real.
    await inserir('literal', 'Peixe 100%_!', 'Literal testus', {
      temp_min_c: 0, temp_max_c: 0, ph_min: 0, ph_max: 14, tamanho_adulto_cm: 0.1,
      aquario_min_litros: 1, dificuldade: 'avancado', temperamento: 'pacifico',
    }, { preco: 0 })
    await inserir('inativo', 'Peixe inativo', 'Inactivus testus', {}, { ativo: false, estoque: 99 })
    await inserir('semFicha', 'Peixe sem ficha', '', {}, { semFicha: true })
    await inserir('categoriaErrada', 'Peixe de outra categoria', 'Incompatible testus', {}, { categoria: 'acessorios' })
    await inserir('comum', 'Aquario', '', {}, { categoria: 'aquarios', semFicha: true })
    await cliente.query("ALTER TABLE peixes ADD COLUMN anotacao_interna TEXT DEFAULT 'nao publicar'")

    const urlAplicacao = new URL(urlTeste)
    urlAplicacao.searchParams.set('options', `-c search_path=${schema}`)
    process.env.DATABASE_URL = urlAplicacao.toString()
    const { app } = await import('../../src/app.ts')
    const { db } = await import('../../src/config/db.ts')
    pool = db
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
        try {
          if (schemaCriado) await cliente.query(`DROP SCHEMA ${schema} CASCADE`)
        } finally {
          await cliente.end()
        }
      }
    }
  })

  async function listar(query = {}) {
    const resposta = await fetch(`${origem}/api/peixes?${new URLSearchParams(query)}`)
    assert.equal(resposta.status, 200)
    return resposta.json()
  }

  async function esperar(query, chaves) {
    const corpo = await listar(query)
    assert.equal(corpo.total, chaves.length)
    assert.deepEqual(corpo.itens.map((p) => p.id), chaves.map((chave) => produtos.get(chave).id))
  }

  it('lista somente produtos ativos de peixes com ficha e campos públicos coerentes', async () => {
    await esperar({}, ordemPublica)
    const corpo = await listar()
    for (const peixe of corpo.itens) {
      assert.equal(peixe.categoria, 'peixes')
      assert.equal(peixe.ficha.tipo, 'peixes')
      assert.equal(Number.isInteger(peixe.preco), true)
      assert.deepEqual(Object.keys(peixe).sort(),
        ['categoria', 'categoriaId', 'descricao', 'emEstoque', 'ficha', 'id', 'imagemUrl', 'marca', 'nome', 'preco'])
      assert.equal('anotacao_interna' in peixe.ficha.dados, false)
      assert.equal('produtoId' in peixe.ficha.dados, false)
    }
    assert.equal(corpo.itens.find((p) => p.id === produtos.get('cardinalA').id).emEstoque, false)
    assert.equal(corpo.itens.find((p) => p.id === produtos.get('literal').id).preco, 0)
  })

  it('detalhe e itens são idênticos ao detalhe de produto; campos básicos coincidem com a listagem', async () => {
    const produtosPublicos = await (await fetch(`${origem}/api/produtos?limite=100`)).json()
    for (const item of (await listar()).itens) {
      const respostaPeixe = await fetch(`${origem}/api/peixes/${item.id}`)
      const respostaProduto = await fetch(`${origem}/api/produtos/${item.id}`)
      assert.equal(respostaPeixe.status, 200)
      assert.equal(respostaProduto.status, 200)
      assert.deepEqual(await respostaPeixe.json(), item)
      assert.deepEqual(await respostaProduto.json(), item)
      const { ficha, ...basicos } = item
      assert.deepEqual(basicos, produtosPublicos.itens.find((p) => p.id === item.id))
      assert.equal(typeof ficha.dados.tempMinC, 'number')
    }
  })

  for (const [query, chaves] of [
    [{ temperatura: '26' }, ['salobra', 'betta', 'cardinalA', 'cardinalB', 'marinho']],
    [{ ph: '7' }, ['salobra', 'betta', 'cardinalA', 'cardinalB', 'literal']],
    [{ tamanho_max: '3.5' }, ['cardinalB', 'literal']],
    [{ aquario_litros: '60' }, ['betta', 'cardinalA', 'cardinalB', 'literal']],
    [{ dificuldade: 'iniciante' }, ['betta', 'cardinalB']],
    [{ temperamento: 'pacifico' }, ['cardinalA', 'cardinalB', 'literal']],
    [{ tipo_agua: 'doce' }, ['betta', 'cardinalA', 'cardinalB', 'literal']],
    [{ tipo_agua: 'salobra' }, ['salobra']],
    [{ tipo_agua: 'marinho' }, ['marinho']],
  ]) {
    it(`aplica isoladamente ${JSON.stringify(query)}`, async () => esperar(query, chaves))
  }

  for (const [campo, dentro, fora] of [
    ['temperatura', ['24.5', '28.5'], ['24.49', '28.51']],
    ['ph', ['6', '7.5'], ['5.99', '7.51']],
    ['tamanho_max', ['6.5'], ['6.49']],
    ['aquario_litros', ['20'], ['19']],
  ]) {
    it(`inclui os limites exatos de ${campo} e exclui valores imediatamente fora`, async () => {
      for (const valor of dentro) await esperar({ busca: 'Betta', [campo]: valor }, ['betta'])
      for (const valor of fora) await esperar({ busca: 'Betta', [campo]: valor }, [])
    })
  }

  it('aceita pH 0 e 14 e temperatura zero sem transformar zero em filtro ausente', async () => {
    await esperar({ ph: '0' }, ['literal'])
    await esperar({ ph: '14' }, ['literal'])
    await esperar({ temperatura: '0' }, ['literal'])
    await esperar({ temperatura: '-0.01' }, [])
  })

  it('combina todos os filtros técnicos e busca antes da paginação e da contagem', async () => {
    await esperar({
      temperatura: '26', ph: '7', tamanho_max: '4', aquario_litros: '60', dificuldade: 'intermediario',
      temperamento: 'pacifico', tipo_agua: 'doce', busca: 'AXEL', limite: '1',
    }, ['cardinalA'])
    await esperar({ tipo_agua: 'marinho', dificuldade: 'iniciante' }, [])
  })

  it('busca por nome popular ou científico sem diferenciar caixa, sem buscar descrição ou marca', async () => {
    await esperar({ busca: 'cArDiNaL' }, ['cardinalA', 'cardinalB'])
    await esperar({ busca: 'AXELRODI' }, ['cardinalA'])
    await esperar({ busca: 'MarcaExclusiva' }, [])
    await esperar({ busca: 'Texto exclusivo' }, [])
  })

  it('trata curingas e tentativas de SQL como texto literal na busca', async () => {
    for (const busca of ['%', '_', '100%_!']) await esperar({ busca }, ['literal'])
    await esperar({ busca: "%' OR true --" }, [])
    await esperar({}, ordemPublica)
  })

  it('pagina em ordem nome/id, inclusive com nomes iguais, mantendo total filtrado', async () => {
    const ids = []
    for (let pagina = 1; pagina <= 6; pagina++) {
      const corpo = await listar({ pagina: String(pagina), limite: '1' })
      assert.equal(corpo.total, 6)
      assert.equal(corpo.itens.length, 1)
      ids.push(corpo.itens[0].id)
    }
    assert.deepEqual(ids, ordemPublica.map((chave) => produtos.get(chave).id))
    const segunda = await listar({ busca: 'cardinal', pagina: '2', limite: '1' })
    assert.equal(segunda.total, 2)
    assert.equal(segunda.itens[0].id, produtos.get('cardinalB').id)
    assert.deepEqual(await listar({ busca: 'cardinal', pagina: '3', limite: '1' }), { itens: [], total: 2 })
  })

  it('exclui produto sem ficha dos atalhos mas mantém o detalhe genérico com ficha null', async () => {
    const id = produtos.get('semFicha').id
    const peixe = await fetch(`${origem}/api/peixes/${id}`)
    assert.equal(peixe.status, 404)
    assert.deepEqual(await peixe.json(), { erro: 'Peixe não encontrado' })
    const produto = await fetch(`${origem}/api/produtos/${id}`)
    assert.equal(produto.status, 200)
    assert.equal((await produto.json()).ficha, null)
    await esperar({ busca: 'sem ficha' }, [])
  })

  it('retorna 404 para ID inexistente, inativo ou de outra categoria, mesmo com ficha e cookie', async () => {
    for (const id of [2147483647, produtos.get('inativo').id, produtos.get('categoriaErrada').id, produtos.get('comum').id]) {
      const resposta = await fetch(`${origem}/api/peixes/${id}?incluir_inativos=true&categoria=peixes`, {
        headers: { Cookie: 'sid=teste' },
      })
      assert.equal(resposta.status, 404)
      assert.deepEqual(await resposta.json(), { erro: 'Peixe não encontrado' })
    }
    await esperar({ busca: 'inativo' }, [])
    await esperar({ busca: 'Incompatible' }, [])
  })

  it('recusa IDs e filtros inválidos com 400 sem modificar outras rotas', async () => {
    for (const caminho of ['/peixes/betta-splendens', '/peixes/2147483648', '/peixes/0', '/peixes?ph=15',
      '/peixes?tipo_agua=salgada', '/peixes?filtros=doce', '/peixes?aquario_litros=0']) {
      const resposta = await fetch(`${origem}/api${caminho}`)
      assert.equal(resposta.status, 400)
      assert.equal((await resposta.json()).erro, 'Parâmetros inválidos')
    }
    const categorias = await fetch(`${origem}/api/categorias`)
    assert.equal(categorias.status, 200)
    assert.equal((await categorias.json()).total, 12)
    assert.equal((await fetch(`${origem}/api/produtos`)).status, 200)
  })

  it('trata falha real do banco nos dois atalhos com erro genérico, sem fallback', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE peixes RENAME TO peixes_indisponiveis')
    try {
      for (const caminho of ['/peixes', `/peixes/${produtos.get('betta').id}`]) {
        const resposta = await fetch(`${origem}/api${caminho}`)
        assert.equal(resposta.status, 500)
        assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
      }
    } finally {
      await cliente.query('ALTER TABLE peixes_indisponiveis RENAME TO peixes')
      log.mock.restore()
    }
  })

  it('retorna catálogo vazio após remover as fichas, sem perder os produtos genéricos', async () => {
    await cliente.query('DELETE FROM peixes')
    assert.deepEqual(await listar(), { itens: [], total: 0 })
    const produto = await fetch(`${origem}/api/produtos/${produtos.get('betta').id}`)
    assert.equal(produto.status, 200)
    assert.equal((await produto.json()).ficha, null)
  })
})
