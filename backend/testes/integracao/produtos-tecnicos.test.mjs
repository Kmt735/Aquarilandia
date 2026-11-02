import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, before, describe, it, mock } from 'node:test'
import pg from 'pg'

const urlTeste = process.env.TEST_DATABASE_URL

describe('GET /api/produtos — filtros técnicos no PostgreSQL', {
  skip: !urlTeste && 'Defina TEST_DATABASE_URL para executar a integração com PostgreSQL.',
}, () => {
  const schema = `teste_tecnicos_${randomUUID().replaceAll('-', '')}`
  const produtos = new Map()
  let cliente
  let pool
  let servidor
  let origem
  let schemaCriado = false

  function fichaPeixe(nome, tipoAgua) {
    return {
      nome_cientifico: nome, tipo_agua: tipoAgua, tamanho_adulto_cm: 6.5,
      temp_min_c: 24.5, temp_max_c: 28.5, ph_min: 6, ph_max: 7.5,
      aquario_min_litros: 20, temperamento: 'pacifico', dificuldade: 'iniciante',
    }
  }
  function fichaAquario(tipoAgua, volume) {
    return { tipo_agua: tipoAgua, volume_litros: volume, comprimento_cm: 50, largura_cm: 25, altura_cm: 32, material: 'vidro' }
  }
  function fichaPlanta(luz, co2) {
    return { nome: 'Planta', posicao: 'frente', iluminacao_exigida: luz, precisa_co2: co2, dificuldade: 'iniciante' }
  }

  async function inserirFicha(id, tabela, dados) {
    const colunas = Object.keys(dados)
    // Identificadores vêm somente das fixtures constantes desta suíte.
    await cliente.query(
      `INSERT INTO ${tabela} (produto_id, ${colunas.join(', ')})
       VALUES ($1, ${colunas.map((_coluna, i) => `$${i + 2}`).join(', ')})`,
      [id, ...Object.values(dados)],
    )
  }

  async function inserir(chave, categoria, dados, opcoes = {}) {
    const { rows } = await cliente.query(
      `INSERT INTO produtos (categoria_id, nome, preco, estoque, ativo)
       VALUES ((SELECT id FROM categorias WHERE slug = $1), $2, $3, $4, $5) RETURNING id`,
      [categoria, opcoes.nome ?? chave, opcoes.preco ?? 10000, 1, opcoes.ativo ?? true],
    )
    const produto = { id: rows[0].id, ativo: opcoes.ativo ?? true }
    produtos.set(chave, produto)
    if (dados) await inserirFicha(produto.id, categoria, dados)
    return produto
  }

  before(async () => {
    cliente = new pg.Client({ connectionString: urlTeste })
    await cliente.connect()
    await cliente.query(`CREATE SCHEMA ${schema}`)
    schemaCriado = true
    await cliente.query(`SET search_path TO ${schema}`)
    await cliente.query(await readFile(new URL('../../db/init/01_catalogo.sql', import.meta.url), 'utf8'))

    await inserir('peixeD', 'peixes', fichaPeixe('Doce testus', 'doce'))
    await inserir('peixeS', 'peixes', fichaPeixe('Salobra testus', 'salobra'))
    await inserir('peixeM', 'peixes', fichaPeixe('Marinho testus', 'marinho'))
    await inserir('aquarioD', 'aquarios', fichaAquario('doce', 60), { nome: 'Aquario base' })
    await inserir('aquarioA', 'aquarios', fichaAquario('ambos', 60), { nome: 'Aquario base' })
    await inserir('aquarioM', 'aquarios', fichaAquario('marinho', 100), { preco: 20000 })
    await inserir('aquarioP', 'aquarios', fichaAquario('doce', 39), { preco: 5000 })
    for (const [sufixo, tipo] of [['D', 'doce'], ['A', 'ambos'], ['M', 'marinho']]) {
      await inserir(`racao${sufixo}`, 'racoes', { formato: 'flocos', peso_g: 100, tipo_agua: tipo })
      await inserir(`cond${sufixo}`, 'condicionadores', { tipo: 'condicionador', tipo_agua: tipo })
    }
    await inserir('decorS', 'decoracoes', { material: 'resina', seguro_marinho: true })
    await inserir('decorC', 'decoracoes', { material: 'tronco', seguro_marinho: false })
    for (const vazao of [399, 400, 800]) {
      await inserir(`filtro${vazao}`, 'filtros', { tipo: 'canister', vazao_lh: vazao }, { preco: 8990 })
    }
    for (const vazao of [399, 400]) {
      await inserir(`bomba${vazao}`, 'bombas', { tipo: 'submersa', vazao_lh: vazao })
    }
    await inserir('substratoF', 'substratos', { tipo: 'fertil', peso_kg: 2, altera_ph: false })
    await inserir('substratoA', 'substratos', { tipo: 'areia', peso_kg: 2, altera_ph: false })
    await inserir('substratoArgila', 'substratos', { tipo: 'argila', peso_kg: 2, altera_ph: true })
    await inserir('plantaB', 'plantas', fichaPlanta('baixa', false))
    await inserir('plantaM', 'plantas', fichaPlanta('media', false))
    await inserir('plantaA', 'plantas', fichaPlanta('alta', true))
    await inserir('plantaBCo2', 'plantas', fichaPlanta('baixa', true))
    for (const categoria of ['peixes', 'aquarios', 'racoes', 'condicionadores', 'decoracoes', 'filtros', 'bombas', 'substratos', 'plantas']) {
      await inserir(`semFicha-${categoria}`, categoria, null)
    }
    await inserir('inativoAquario', 'aquarios', fichaAquario('doce', 60), { nome: 'Aquario base', ativo: false })
    await inserir('inativoPlanta', 'plantas', fichaPlanta('baixa', false), { ativo: false })
    await inserir('inativoSubstrato', 'substratos', { tipo: 'fertil', peso_kg: 2 }, { ativo: false })
    await inserir('inativoFiltro', 'filtros', { tipo: 'canister', vazao_lh: 400 }, { ativo: false })
    await inserir('inativoPeixe', 'peixes', fichaPeixe('Inativo testus', 'doce'), { ativo: false })

    // Fichas de várias categorias no mesmo acessório não podem furar os filtros de categoria.
    const confuso = await inserir('confuso', 'acessorios', null)
    for (const [tabela, dados] of [
      ['aquarios', fichaAquario('ambos', 60)], ['peixes', fichaPeixe('Confuso testus', 'doce')],
      ['filtros', { tipo: 'canister', vazao_lh: 400 }], ['bombas', { tipo: 'submersa', vazao_lh: 400 }],
      ['substratos', { tipo: 'fertil', peso_kg: 2 }], ['plantas', fichaPlanta('baixa', false)],
      ['racoes', { formato: 'flocos', peso_g: 100, tipo_agua: 'ambos' }],
      ['condicionadores', { tipo: 'condicionador', tipo_agua: 'ambos' }],
      ['decoracoes', { material: 'resina', seguro_marinho: true }],
    ]) await inserirFicha(confuso.id, tabela, dados)

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
    const resposta = await fetch(`${origem}/api/produtos?${new URLSearchParams({ limite: '100', ...query })}`)
    assert.equal(resposta.status, 200)
    return resposta.json()
  }
  async function esperar(query, chaves) {
    const corpo = await listar(query)
    assert.equal(corpo.total, chaves.length)
    assert.equal(corpo.itens.length, chaves.length)
    assert.deepEqual(corpo.itens.map((p) => p.id).sort((a, b) => a - b),
      chaves.map((chave) => produtos.get(chave).id).sort((a, b) => a - b))
  }

  for (const [tipo, chaves] of [
    ['doce', ['peixeD', 'aquarioD', 'aquarioA', 'aquarioP', 'racaoD', 'racaoA', 'condD', 'condA', 'decorS', 'decorC']],
    ['marinho', ['peixeM', 'aquarioA', 'aquarioM', 'racaoA', 'racaoM', 'condA', 'condM', 'decorS']],
    ['salobra', ['peixeS']],
  ]) {
    it(`filtra tipo_agua=${tipo} nas categorias aplicáveis, incluindo a regra de ambos`, async () => {
      await esperar({ tipo_agua: tipo }, chaves)
    })
  }

  for (const [categoria, chaves] of [
    ['peixes', ['peixeD']], ['aquarios', ['aquarioD', 'aquarioA', 'aquarioP']],
    ['racoes', ['racaoD', 'racaoA']], ['condicionadores', ['condD', 'condA']], ['decoracoes', ['decorS', 'decorC']],
  ]) {
    it(`combina tipo_agua com categoria ${categoria}`, async () => esperar({ categoria, tipo_agua: 'doce' }, chaves))
  }

  it('usa seguro_marinho para decorações e não infere água salobra', async () => {
    await esperar({ categoria: 'decoracoes', tipo_agua: 'marinho' }, ['decorS'])
    await esperar({ categoria: 'decoracoes', tipo_agua: 'salobra' }, [])
    await esperar({ categoria: 'aquarios', tipo_agua: 'salobra' }, [])
  })

  it('aplica limites inclusivos de volume em litros somente em aquários', async () => {
    await esperar({ volume_min: '60' }, ['aquarioD', 'aquarioA', 'aquarioM'])
    await esperar({ volume_max: '60' }, ['aquarioD', 'aquarioA', 'aquarioP'])
    await esperar({ volume_min: '60', volume_max: '60' }, ['aquarioD', 'aquarioA'])
    await esperar({ volume_min: '61' }, ['aquarioM'])
    await esperar({ volume_max: '59' }, ['aquarioP'])
    await esperar({ volume_min: '100', volume_max: '100' }, ['aquarioM'])
  })

  it('aplica vazão mínima inclusiva em L/h a filtros e bombas', async () => {
    await esperar({ vazao_min: '400' }, ['filtro400', 'filtro800', 'bomba400'])
    await esperar({ vazao_min: '401' }, ['filtro800'])
    await esperar({ vazao_min: '399' }, ['filtro399', 'filtro400', 'filtro800', 'bomba399', 'bomba400'])
    await esperar({ categoria: 'filtros', vazao_min: '400' }, ['filtro400', 'filtro800'])
    await esperar({ categoria: 'bombas', vazao_min: '400' }, ['bomba400'])
  })

  it('deriva indicado_plantado de tipo fertil, inclusive para false e independentemente de altera_ph', async () => {
    await esperar({ indicado_plantado: 'true' }, ['substratoF'])
    await esperar({ indicado_plantado: 'false' }, ['substratoA', 'substratoArgila'])
  })

  it('aplica precisa_co2 verdadeiro/falso e os três valores de iluminação somente em plantas', async () => {
    await esperar({ precisa_co2: 'false' }, ['plantaB', 'plantaM'])
    await esperar({ precisa_co2: 'true' }, ['plantaA', 'plantaBCo2'])
    await esperar({ iluminacao: 'baixa' }, ['plantaB', 'plantaBCo2'])
    await esperar({ iluminacao: 'media' }, ['plantaM'])
    await esperar({ iluminacao: 'alta' }, ['plantaA'])
    await esperar({ precisa_co2: 'false', iluminacao: 'baixa' }, ['plantaB'])
    await esperar({ precisa_co2: 'true', iluminacao: 'baixa', categoria: 'plantas' }, ['plantaBCo2'])
  })

  for (const [query, categoria] of [
    [{ tipo_agua: 'doce' }, 'plantas'], [{ volume_min: '1' }, 'peixes'],
    [{ vazao_min: '1' }, 'aquarios'], [{ indicado_plantado: 'false' }, 'filtros'],
    [{ precisa_co2: 'false' }, 'substratos'], [{ iluminacao: 'baixa' }, 'iluminacao'],
  ]) {
    it(`não ignora ${JSON.stringify(query)} em categoria incompatível`, async () => esperar({ ...query, categoria }, []))
  }

  it('combina filtros técnicos por interseção, sem ignorar domínios incompatíveis', async () => {
    await esperar({ tipo_agua: 'doce', volume_min: '60', volume_max: '60' }, ['aquarioD', 'aquarioA'])
    await esperar({ tipo_agua: 'marinho', volume_min: '60', volume_max: '100' }, ['aquarioA', 'aquarioM'])
    await esperar({ tipo_agua: 'doce', vazao_min: '400' }, [])
    await esperar({ indicado_plantado: 'true', precisa_co2: 'false' }, [])
    await esperar({ precisa_co2: 'false', tipo_agua: 'doce' }, [])
  })

  for (const ordem of ['nome', 'preco', '-preco']) {
    it(`preserva busca, preços, total e paginação com desempate por ID em ordem ${ordem}`, async () => {
      const filtros = {
        categoria: 'aquarios', busca: 'base', preco_min: '10000', preco_max: '10000',
        tipo_agua: 'doce', volume_min: '60', volume_max: '60', ordem, limite: '1',
      }
      const ids = []
      for (const pagina of ['1', '2']) {
        const corpo = await listar({ ...filtros, pagina })
        assert.equal(corpo.total, 2)
        assert.equal(corpo.itens.length, 1)
        assert.equal(corpo.itens[0].preco, 10000)
        ids.push(corpo.itens[0].id)
      }
      assert.deepEqual(ids, ['aquarioD', 'aquarioA'].map((chave) => produtos.get(chave).id))
      assert.deepEqual(await listar({ ...filtros, pagina: '3' }), { itens: [], total: 2 })
    })
  }

  it('não aplica filtros ausentes, mas exclui fichas ausentes quando há filtro técnico', async () => {
    const corpo = await listar()
    assert.equal(corpo.total, [...produtos.values()].filter((p) => p.ativo).length)
    assert.equal(corpo.itens.some((p) => p.id === produtos.get('semFicha-aquarios').id), true)
    await esperar({ categoria: 'aquarios', volume_min: '1' }, ['aquarioD', 'aquarioA', 'aquarioM', 'aquarioP'])
    await esperar({ categoria: 'acessorios', tipo_agua: 'doce' }, [])
    await esperar({ categoria: 'acessorios', volume_min: '60' }, [])
  })

  it('recusa dados inválidos e inclusão administrativa de inativos com 400', async () => {
    for (const query of ['volume_min=61&volume_max=60', 'vazao_min=0', 'precisa_co2=1',
      'tipo_agua=ambos', 'iluminacao=led']) {
      const resposta = await fetch(`${origem}/api/produtos?${query}`)
      assert.equal(resposta.status, 400)
      assert.equal((await resposta.json()).erro, 'Parâmetros inválidos')
    }
  })

  it('preserva o detalhe de produto, atalhos de peixes e categorias', async () => {
    const id = produtos.get('peixeD').id
    const produto = await fetch(`${origem}/api/produtos/${id}`)
    const peixe = await fetch(`${origem}/api/peixes/${id}`)
    assert.equal(produto.status, 200)
    assert.equal(peixe.status, 200)
    assert.deepEqual(await peixe.json(), await produto.json())
    const listaPeixes = await fetch(`${origem}/api/peixes`)
    assert.equal(listaPeixes.status, 200)
    assert.equal((await listaPeixes.json()).total, 3)
    assert.equal((await (await fetch(`${origem}/api/categorias`)).json()).total, 12)
  })

  it('mantém erro genérico na falha real de uma tabela de ficha', async () => {
    const log = mock.method(console, 'error', () => {})
    await cliente.query('ALTER TABLE plantas RENAME TO plantas_indisponiveis')
    try {
      const resposta = await fetch(`${origem}/api/produtos?precisa_co2=false`)
      assert.equal(resposta.status, 500)
      assert.deepEqual(await resposta.json(), { erro: 'Erro interno do servidor' })
    } finally {
      await cliente.query('ALTER TABLE plantas_indisponiveis RENAME TO plantas')
      log.mock.restore()
    }
  })
})
