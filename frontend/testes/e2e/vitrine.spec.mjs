import { test, expect } from './sistema.mjs'

const vitrine = (page) => page.getByRole('region', { name: 'Peixes em destaque', exact: true })

// Somente o schema descartável criado por sistema.mjs é alterado; restaura mesmo após falha.
async function comCatalogo(sistema, dados, executar) {
  const anteriores = (await sistema.cliente.query('SELECT id,ativo FROM produtos')).rows
  const ids = []
  try {
    await sistema.cliente.query('UPDATE produtos SET ativo=false')
    for (const [i, dado] of dados.entries()) {
      const { rows } = await sistema.cliente.query(`
        INSERT INTO produtos (categoria_id,nome,preco,estoque,ativo,imagem_url)
        SELECT id,$2,$3,$4,$5,$6 FROM categorias WHERE slug=$1 RETURNING id`,
      [dado.categoria ?? 'peixes', dado.nome ?? `Destaque ${String(i).padStart(3, '0')}`,
        dado.preco ?? 4999, dado.estoque ?? 1, dado.ativo ?? true, dado.imagem ?? null])
      ids.push(rows[0].id)
      if (dado.semFicha) continue
      await sistema.cliente.query(`INSERT INTO peixes
        (produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,
         ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)
        VALUES ($1,$2,'doce',5,24,28,6,7,40,'pacifico','iniciante')`,
      [rows[0].id, `Species vitrine ${i}`])
    }
    await executar(ids)
  } finally {
    await sistema.cliente.query('DELETE FROM produtos WHERE id=ANY($1::int[])', [ids])
    for (const p of anteriores) await sistema.cliente.query('UPDATE produtos SET ativo=$2 WHERE id=$1', [p.id, p.ativo])
  }
}

for (const [tela, viewport] of [['desktop', { width: 1440, height: 1000 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`vitrine ${tela}: três cartões de 106 disponíveis, ordem/ID, centavos, imagem e detalhe reais`, async ({ page, sistema }, testInfo) => {
    await page.setViewportSize(viewport)
    const dados = Array.from({ length: 106 }, (_, i) => ({ nome: `Destaque Z${String(i).padStart(3, '0')}` }))
    dados[0] = { nome: 'Destaque Alpha', preco: 12345, imagem: '/src/assets/favicon-32.png' }
    dados[1] = { nome: 'Destaque Beta', preco: 4999 }
    dados[2] = { nome: 'Destaque Beta', preco: 20000 }
    const consultas = []
    page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/api/')) consultas.push(r) })
    await comCatalogo(sistema, dados, async (ids) => {
      await page.goto('/')
      const secao = vitrine(page)
      await expect(secao.locator('article')).toHaveCount(3)
      await expect(secao.locator('article').first()).toHaveAttribute('id', String(ids[0]))
      expect(await secao.locator('article').evaluateAll((itens) => itens.map((p) => Number(p.id)))).toEqual(ids.slice(0, 3))
      for (const preco of ['R$ 123,45', 'R$ 49,99', 'R$ 200,00']) await expect(secao.getByText(preco, { exact: true })).toBeVisible()
      await expect(secao.getByText('Disponível', { exact: true })).toHaveCount(3)
      await expect(secao.getByRole('button', { name: /Adicionar ao carrinho/ })).toHaveCount(3)
      await secao.scrollIntoViewIfNeeded()
      await expect.poll(() => secao.getByRole('img', { name: 'Destaque Alpha' }).evaluate((img) => img.naturalWidth)).toBeGreaterThan(0)
      await expect(secao.getByText('Foto em breve', { exact: true })).toHaveCount(2)
      await expect(secao.getByRole('link', { name: 'Ver todos os peixes' })).toHaveAttribute('href', '/peixes')
      const requisicoes = consultas.filter((r) => new URL(r.url()).pathname === '/api/peixes')
      expect(requisicoes.length).toBeGreaterThan(0)
      for (const r of requisicoes) {
        expect(Object.fromEntries(new URL(r.url()).searchParams)).toEqual({ em_estoque: 'true', pagina: '1', limite: '3' })
        expect((await r.allHeaders()).cookie).toBeUndefined()
        const resposta = await r.response()
        expect(resposta.status()).toBe(200)
        const corpo = await resposta.json()
        expect(corpo.total).toBe(106)
        expect(corpo.itens.map((p) => p.id)).toEqual(ids.slice(0, 3))
        for (const item of corpo.itens) {
          expect(item).not.toHaveProperty('ativo')
          expect(item).not.toHaveProperty('estoque')
        }
      }
      expect(consultas.every((r) => r.method() === 'GET' && !r.url().includes('incluir_inativos') && !r.url().includes('/admin'))).toBeTruthy()
      await secao.screenshot({ path: testInfo.outputPath(`vitrine-${tela}.png`) })
      await secao.getByRole('link', { name: 'Destaque Alpha', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/peixes/${ids[0]}$`))
      await expect(page.getByRole('heading', { name: 'Destaque Alpha', exact: true })).toBeVisible()
      await expect(page.getByText('R$ 123,45', { exact: true })).toBeVisible()
    })
  })

  test(`vitrine ${tela}: catálogo legitimamente vazio não mostra erro de carregamento`, async ({ page, sistema }) => {
    await page.setViewportSize(viewport)
    await comCatalogo(sistema, [], async () => {
      await page.goto('/')
      await expect(vitrine(page).getByRole('status')).toHaveText('Nenhum peixe disponível no momento.')
      await expect(vitrine(page).getByRole('alert')).toHaveCount(0)
      await expect(vitrine(page).locator('article')).toHaveCount(0)
      await expect(vitrine(page).getByRole('link', { name: 'Ver todos os peixes' })).toBeVisible()
    })
  })

  test(`vitrine ${tela}: esgotado, inativo, sem ficha ou de outra categoria não é destacado`, async ({ page, sistema, request }) => {
    await page.setViewportSize(viewport)
    await comCatalogo(sistema, [{ estoque: 0 }, { ativo: false }, { semFicha: true }, { categoria: 'acessorios' }], async () => {
      const resposta = await request.get(`${sistema.backend}/api/peixes`)
      expect(resposta.status()).toBe(200)
      const geral = await resposta.json()
      expect(geral.total).toBe(1)
      expect(geral.itens[0].emEstoque).toBe(false)
      await page.goto('/')
      await expect(vitrine(page).getByRole('status')).toHaveText('Nenhum peixe disponível no momento.')
      await expect(vitrine(page).locator('article')).toHaveCount(0)
      await expect(vitrine(page).getByRole('alert')).toHaveCount(0)
    })
  })
}

test('falha real do endpoint de categorias não impede vitrine nem detalhe de peixe', async ({ page, sistema, request }) => {
  await sistema.cliente.query('ALTER TABLE categorias RENAME COLUMN nome TO nome_indisponivel')
  try {
    expect((await request.get(`${sistema.backend}/api/categorias`)).status()).toBe(500)
    await page.goto('/')
    await expect(page.getByText('Não conseguimos carregar as categorias agora.', { exact: true })).toBeVisible()
    await expect(vitrine(page).getByRole('link', { name: 'Peixe API Pacífico', exact: true })).toBeVisible()
    await expect(vitrine(page).getByRole('alert')).toHaveCount(0)
    await vitrine(page).getByRole('link', { name: 'Peixe API Pacífico', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Peixe API Pacífico', exact: true })).toBeVisible()
  } finally {
    await sistema.cliente.query('ALTER TABLE categorias RENAME COLUMN nome_indisponivel TO nome')
  }
})

test('falha real do banco exibe erro neutro; retry recupera sem dados estáticos nem detalhes internos', async ({ page, sistema }) => {
  await sistema.cliente.query('ALTER TABLE peixes RENAME TO peixes_indisponiveis')
  try {
    await page.goto('/')
    await expect(vitrine(page).getByRole('alert')).toContainText('Não conseguimos carregar os peixes agora.')
    await expect(vitrine(page).getByRole('status')).toHaveCount(0)
    await expect(vitrine(page).locator('article')).toHaveCount(0)
    await expect(vitrine(page)).not.toContainText(/Confira sua conexão|SELECT|senha|peixes_indisponiveis/)
  } finally {
    await sistema.cliente.query('ALTER TABLE peixes_indisponiveis RENAME TO peixes')
  }
  await vitrine(page).getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(vitrine(page).getByRole('link', { name: 'Peixe API Pacífico', exact: true })).toBeVisible()
  await expect(vitrine(page).getByRole('alert')).toHaveCount(0)
})

test('resposta real atrasada mantém loading antes dos cartões, sem estado vazio prematuro', async ({ page }) => {
  let liberar
  const espera = new Promise((resolve) => { liberar = resolve })
  await page.route('**/api/peixes?**', async (route) => {
    const resposta = await route.fetch()
    await espera
    await route.fulfill({ response: resposta })
  })
  try {
    await page.goto('/')
    await expect(vitrine(page).getByRole('list').first()).toHaveAttribute('aria-busy', 'true')
    await expect(vitrine(page).getByRole('status')).toHaveCount(0)
    await expect(vitrine(page).getByRole('alert')).toHaveCount(0)
    liberar()
    await expect(vitrine(page).getByRole('link', { name: 'Peixe API Pacífico', exact: true })).toBeVisible()
    await expect(vitrine(page).getByRole('list').first()).toHaveAttribute('aria-busy', 'false')
  } finally {
    liberar()
    await page.unrouteAll({ behavior: 'wait' })
  }
})
