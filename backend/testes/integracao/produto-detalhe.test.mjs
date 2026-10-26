import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import pg from 'pg'

const fichas = [
  {
    tipo: 'peixes',
    banco: {
      nome_cientifico: 'Betta splendens', origem: 'Asia', tipo_agua: 'doce', tamanho_adulto_cm: 6.5,
      temp_min_c: 24.5, temp_max_c: 28.5, ph_min: 6, ph_max: 7.5, aquario_min_litros: 20,
      temperamento: 'semi_agressivo', nivel_natacao: null, cardume_minimo: 1, dieta: 'carnivoro',
      dificuldade: 'iniciante',
    },
    dados: {
      nomeCientifico: 'Betta splendens', origem: 'Asia', tipoAgua: 'doce', tamanhoAdultoCm: 6.5,
      tempMinC: 24.5, tempMaxC: 28.5, phMin: 6, phMax: 7.5, aquarioMinLitros: 20,
      temperamento: 'semi_agressivo', nivelNatacao: null, cardumeMinimo: 1, dieta: 'carnivoro',
      dificuldade: 'iniciante',
    },
  },
  {
    tipo: 'aquarios',
    banco: { volume_litros: 40, comprimento_cm: 50, largura_cm: 25, altura_cm: 32, material: 'vidro', tipo_agua: 'doce' },
    dados: { volumeLitros: 40, comprimentoCm: 50, larguraCm: 25, alturaCm: 32, material: 'vidro', tipoAgua: 'doce' },
  },
  {
    tipo: 'filtros',
    banco: { tipo: 'canister', vazao_lh: 500, aquario_max_litros: 100, potencia_w: 12.5, voltagem: null, midias_inclusas: 'Ceramica' },
    dados: { tipo: 'canister', vazaoLh: 500, aquarioMaxLitros: 100, potenciaW: 12.5, voltagem: null, midiasInclusas: 'Ceramica' },
  },
  {
    tipo: 'bombas',
    banco: { tipo: 'submersa', vazao_lh: 400, altura_max_m: 1.25, saidas: null, potencia_w: 8.5, voltagem: 'bivolt' },
    dados: { tipo: 'submersa', vazaoLh: 400, alturaMaxM: 1.25, saidas: null, potenciaW: 8.5, voltagem: 'bivolt' },
  },
  {
    tipo: 'iluminacao',
    banco: { tecnologia: 'led', potencia_w: 20.5, comprimento_cm: 60.5, espectro: 'plantado', temperatura_cor_k: 6500, voltagem: null },
    dados: { tecnologia: 'led', potenciaW: 20.5, comprimentoCm: 60.5, espectro: 'plantado', temperaturaCorK: 6500, voltagem: null },
  },
  {
    tipo: 'termostatos',
    banco: { potencia_w: 100, aquario_min_litros: 40, aquario_max_litros: 100, temp_min_c: null, temp_max_c: null, ajustavel: false, voltagem: '220' },
    dados: { potenciaW: 100, aquarioMinLitros: 40, aquarioMaxLitros: 100, tempMinC: null, tempMaxC: null, ajustavel: false, voltagem: '220' },
  },
  {
    tipo: 'racoes',
    banco: { formato: 'flocos', peso_g: 100, tipo_agua: 'ambos', indicada_para: null },
    dados: { formato: 'flocos', pesoG: 100, tipoAgua: 'ambos', indicadaPara: null },
  },
  {
    tipo: 'condicionadores',
    banco: { tipo: 'condicionador', volume_ml: 250, dosagem: '5 ml por 20 L', principio_ativo: null, tipo_agua: 'doce' },
    dados: { tipo: 'condicionador', volumeMl: 250, dosagem: '5 ml por 20 L', principioAtivo: null, tipoAgua: 'doce' },
  },
  {
    tipo: 'substratos',
    banco: { tipo: 'fertil', peso_kg: 2.25, granulometria_mm: '1-3 mm', cor: null, altera_ph: true },
    dados: { tipo: 'fertil', pesoKg: 2.25, granulometriaMm: '1-3 mm', cor: null, alteraPh: true },
  },
  {
    tipo: 'plantas',
    banco: { nome: 'Anubias nana', posicao: 'epifita', iluminacao_exigida: 'baixa', precisa_co2: false, crescimento: null, dificuldade: 'iniciante', temp_min_c: 22.5, temp_max_c: 28 },
    dados: { nome: 'Anubias nana', posicao: 'epifita', iluminacaoExigida: 'baixa', precisaCo2: false, crescimento: null, dificuldade: 'iniciante', tempMinC: 22.5, tempMaxC: 28 },
  },
  {
    tipo: 'decoracoes',
    banco: { material: 'tronco', material_natural: true, comprimento_cm: 15.5, largura_cm: null, altura_cm: null, seguro_marinho: false },
    dados: { material: 'tronco', materialNatural: true, comprimentoCm: 15.5, larguraCm: null, alturaCm: null, seguroMarinho: false },
  },
]

const urlTeste = process.env.TEST_DATABASE_URL

describe('GET /api/produtos/:id — PostgreSQL real', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_detalhe_${randomUUID().replaceAll('-', '')}`
  const produtos = new Map()
  let cliente
  let pool
  let servidor
  let origem
  let schemaCriado = false

  async function inserirProduto(categoria, nome, estoque = 3, ativo = true) {
    const { rows } = await cliente.query(
      `INSERT INTO produtos (categoria_id, nome, preco, estoque, ativo)
       VALUES ((SELECT id FROM categorias WHERE slug = $1), $2, $3, $4, $5)
       RETURNING id, categoria_id AS "categoriaId", nome, descricao, marca, preco,
                 imagem_url AS "imagemUrl", (estoque > 0) AS "emEstoque"`,
      [categoria, nome, 8990, estoque, ativo],
    )
    return { ...rows[0], categoria }
  }

  async function inserirFicha(id, ficha) {
    const colunas = Object.keys(ficha.banco)
    // Tabela e colunas vêm exclusivamente das fixtures constantes acima.
    await cliente.query(
      `INSERT INTO ${ficha.tipo} (produto_id, ${colunas.join(', ')})
       VALUES ($1, ${colunas.map((_coluna, i) => `$${i + 2}`).join(', ')})`,
      [id, ...Object.values(ficha.banco)],
    )
  }

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    await cliente.query(await readFile(new URL('../../db/init/01_catalogo.sql', import.meta.url), 'utf8'))
    for (const ficha of fichas) {
      const produto = await inserirProduto(ficha.tipo, `Produto ${ficha.tipo}`)
      await inserirFicha(produto.id, ficha)
      produtos.set(ficha.tipo, produto)
    }
    produtos.set('comum', await inserirProduto('acessorios', 'Redinha', 0))
    produtos.set('semFicha', await inserirProduto('filtros', 'Filtro sem ficha'))
    const inativo = await inserirProduto('aquarios', 'Aquario inativo', 99, false)
    await inserirFicha(inativo.id, fichas.find((ficha) => ficha.tipo === 'aquarios'))
    produtos.set('inativo', inativo)
    await cliente.query('INSERT INTO categorias (nome, slug) VALUES ($1, $2)', ['Especial', 'especial'])
    produtos.set('especial', await inserirProduto('especial', 'Produto sem tabela especializada'))

    // O schema permite fichas incompatíveis: a consulta deve ignorá-las pela categoria do produto.
    await inserirFicha(produtos.get('peixes').id, fichas.find((ficha) => ficha.tipo === 'aquarios'))
    await inserirFicha(produtos.get('comum').id, fichas.find((ficha) => ficha.tipo === 'filtros'))
    await cliente.query("ALTER TABLE peixes ADD COLUMN anotacao_interna TEXT DEFAULT 'reservado'")

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

  it('retorna produto comum, preço em centavos, disponibilidade e ficha null', async () => {
    const produto = produtos.get('comum')
    const resposta = await fetch(`${origem}/api/produtos/${produto.id}`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { ...produto, ficha: null })
    assert.equal(produto.preco, 8990)
    assert.equal(produto.emEstoque, false)
  })

  for (const ficha of fichas) {
    it(`consulta a ficha de ${ficha.tipo} com campos públicos, números e nulos corretos`, async () => {
      const produto = produtos.get(ficha.tipo)
      const resposta = await fetch(`${origem}/api/produtos/${produto.id}`)
      assert.equal(resposta.status, 200)
      assert.deepEqual(await resposta.json(), { ...produto, ficha: { tipo: ficha.tipo, dados: ficha.dados } })
    })
  }

  it('usa os mesmos IDs e campos básicos da listagem para todos os produtos ativos', async () => {
    const resposta = await fetch(`${origem}/api/produtos?limite=100`)
    assert.equal(resposta.status, 200)
    const lista = await resposta.json()
    assert.equal(lista.total, produtos.size - 1)
    for (const item of lista.itens) {
      const respostaDetalhe = await fetch(`${origem}/api/produtos/${item.id}`)
      assert.equal(respostaDetalhe.status, 200)
      const { ficha, ...basicos } = await respostaDetalhe.json()
      assert.deepEqual(basicos, item)
      assert.equal(ficha === null || typeof ficha === 'object', true)
    }
  })

  it('retorna 200 e ficha null quando falta o registro da categoria especializada', async () => {
    const produto = produtos.get('semFicha')
    const resposta = await fetch(`${origem}/api/produtos/${produto.id}`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { ...produto, ficha: null })
  })

  it('retorna ficha null para categoria sem tabela de detalhe', async () => {
    const produto = produtos.get('especial')
    const resposta = await fetch(`${origem}/api/produtos/${produto.id}`)
    assert.equal(resposta.status, 200)
    assert.deepEqual(await resposta.json(), { ...produto, ficha: null })
  })

  it('ignora a ficha de outra categoria mesmo com query tentando selecioná-la', async () => {
    const resposta = await fetch(`${origem}/api/produtos/${produtos.get('peixes').id}?categoria=aquarios`)
    const corpo = await resposta.json()
    assert.equal(resposta.status, 200)
    assert.equal(corpo.categoria, 'peixes')
    assert.deepEqual(corpo.ficha, { tipo: 'peixes', dados: fichas[0].dados })
    assert.equal('anotacao_interna' in corpo.ficha.dados, false)
    assert.equal('produtoId' in corpo.ficha.dados, false)
    assert.equal('estoque' in corpo, false)
    assert.equal('ativo' in corpo, false)
  })

  it('retorna 404 para produto inexistente', async () => {
    const resposta = await fetch(`${origem}/api/produtos/2147483647`)
    assert.equal(resposta.status, 404)
    assert.deepEqual(await resposta.json(), { erro: 'Produto não encontrado' })
  })

  it('nunca expõe produto inativo, mesmo com ficha, cookie ou parâmetros alternativos', async () => {
    for (const query of ['', '?incluir_inativos=true&ativo=true&categoria=aquarios']) {
      const resposta = await fetch(`${origem}/api/produtos/${produtos.get('inativo').id}${query}`, {
        headers: { Cookie: 'sid=teste' },
      })
      assert.equal(resposta.status, 404)
      assert.deepEqual(await resposta.json(), { erro: 'Produto não encontrado' })
    }
  })

  it('recusa IDs inválidos e o antigo ID textual com 400', async () => {
    for (const id of ['0', '-1', '1.5', '2147483648', 'aquario-vidro-40l', '1 OR true']) {
      const resposta = await fetch(`${origem}/api/produtos/${encodeURIComponent(id)}`)
      assert.equal(resposta.status, 400)
      assert.equal((await resposta.json()).erro, 'Parâmetros inválidos')
    }
  })

  it('trata falha real do banco com 500, sem fallback ou detalhes internos', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE produtos RENAME TO produtos_indisponiveis')
    try {
      const resposta = await fetch(`${origem}/api/produtos/${produtos.get('peixes').id}`)
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    } finally {
      await cliente.query('ALTER TABLE produtos_indisponiveis RENAME TO produtos')
      log.mock.restore()
    }
  })
})
