import { test as base, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const requireBackend = createRequire(new URL('../../../backend/package.json', import.meta.url))
const pg = requireBackend('pg')
export const test = base.extend({
  sistema: [async ({ browserName }, use) => {
    if (browserName !== 'chromium') throw new Error('Este ciclo homologa o Chromium.')
    if (!process.env.TEST_DATABASE_URL) throw new Error('Defina TEST_DATABASE_URL apontando para PostgreSQL descartável. Nenhum teste de navegador será marcado como aprovado sem banco.')
    const schema = `ciclo1_${randomUUID().replaceAll('-', '')}`
    const cliente = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL })
    let servidor, vite, pool
    await cliente.connect()
    try {
      await cliente.query(`CREATE SCHEMA ${schema}`)
      await cliente.query(`SET search_path TO ${schema}`)
      for (const arquivo of ['01_catalogo.sql', '10_clientes.sql', '20_vendas.sql']) {
        await cliente.query(await readFile(new URL(`../../../backend/db/init/${arquivo}`, import.meta.url), 'utf8'))
      }
      const inserir = async (nome, slug, preco, estoque = 3, ativo = true) => (await cliente.query(
        'INSERT INTO produtos (nome,categoria_id,preco,estoque,ativo) SELECT $1,id,$3,$4,$5 FROM categorias WHERE slug=$2 RETURNING id',
        [nome, slug, preco, estoque, ativo],
      )).rows[0].id
      const aquario = await inserir('Aquário API Ciclo 1', 'aquarios', 12345)
      await cliente.query("INSERT INTO aquarios (produto_id,volume_litros,comprimento_cm,largura_cm,altura_cm,material,tipo_agua) VALUES ($1,60,60,30,35,'vidro','doce')", [aquario])
      const semFicha = await inserir('Acessório API sem ficha', 'acessorios', 1050, 0)
      const peixe = await inserir('Peixe API Pacífico', 'peixes', 4999)
      const outroPeixe = await inserir('Peixe API Marinho', 'peixes', 20000, 0)
      for (const [id, cientifico, agua, dificuldade] of [[peixe, 'Species ciclo1 dulcis', 'doce', 'iniciante'], [outroPeixe, 'Species ciclo1 marina', 'marinho', 'avancado']]) {
        await cliente.query(`INSERT INTO peixes (produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)
          VALUES ($1,$2,$3,5,24,28,6,7,40,'pacifico',$4)`, [id, cientifico, agua, dificuldade])
      }
      const inativo = await inserir('Produto API desativado', 'aquarios', 1000, 3, false)
      const peixeSemFicha = await inserir('Peixe API sem ficha', 'peixes', 1000)
      for (let n = 1; n <= 11; n++) await inserir(`Aquário Paginação ${String(n).padStart(2, '0')}`, 'aquarios', 5000 + n)
      await cliente.query("INSERT INTO categorias (nome,slug) VALUES ('Categoria API nova','categoria-api-nova')")
      const url = new URL(process.env.TEST_DATABASE_URL)
      url.searchParams.set('options', `-c search_path=${schema}`)
      process.env.DATABASE_URL = url.toString()
      const { app } = await import('../../../backend/dist/app.js')
      const { db } = await import('../../../backend/dist/config/db.js')
      pool = db
      servidor = app.listen(0, '127.0.0.1')
      await once(servidor, 'listening')
      const backend = `http://127.0.0.1:${servidor.address().port}`
      const root = fileURLToPath(new URL('../..', import.meta.url))
      // Mesmo proxy do projeto, apontado para a porta efêmera do backend de testes.
      vite = await createServer({ root, configFile: `${root}/vite.config.js`, server: { host: '127.0.0.1', port: 0, proxy: { '/api': backend } } })
      await vite.listen()
      const origem = `http://127.0.0.1:${vite.httpServer.address().port}`
      await use({ origem, backend, cliente, ids: { aquario, semFicha, peixe, outroPeixe, inativo, peixeSemFicha } })
    } finally {
      if (vite) await vite.close()
      if (servidor) await new Promise((resolve) => servidor.close(resolve))
      if (pool) await pool.end()
      await cliente.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`)
      await cliente.end()
    }
  }, { scope: 'worker' }],
  baseURL: async ({ sistema }, use) => use(sistema.origem),
  page: async ({ page }, use) => {
    const erros = []
    page.on('pageerror', (erro) => erros.push(erro.message))
    await use(page)
    expect(erros, 'A navegação não deve causar erros React/JavaScript').toEqual([])
  },
})
export { expect }
