import { test, expect } from './sistema.mjs'

test('home → categoria real → produto → detalhe com preço em centavos e ficha', async ({ page, sistema }) => {
  const consultas = []
  page.on('response', (r) => { if (r.url().includes('/api/')) consultas.push(r.url()) })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Encontre pelo que você precisa' })).toBeVisible()
  await expect(page.getByText('Categoria API nova', { exact: true })).toBeVisible()
  await page.locator('#lista-categorias').getByRole('link', { name: /Aquários/ }).click()
  await expect(page).toHaveURL(/categoria=aquarios/)
  await page.getByRole('link', { name: 'Aquário API Ciclo 1', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/loja/${sistema.ids.aquario}$`))
  await expect(page.getByRole('heading', { name: 'Aquário API Ciclo 1', exact: true })).toBeVisible()
  await expect(page.getByText('R$ 123,45', { exact: true })).toBeVisible()
  await expect(page.getByText('60 L', { exact: true })).toBeVisible()
  await expect(page.getByText('Foto em breve', { exact: true })).toBeVisible()
  await expect(page.getByText('Descrição ainda não disponível.')).toBeVisible()
  expect(consultas.some((u) => u.includes('/api/categorias'))).toBeTruthy()
  expect(consultas.some((u) => u.includes('/api/produtos?'))).toBeTruthy()
  expect(consultas.some((u) => u.endsWith(`/api/produtos/${sistema.ids.aquario}`))).toBeTruthy()
  await page.screenshot({ path: 'test-results/catalogo-detalhe.png', fullPage: true })
})

test('listagem pagina e aplica busca e faixa em centavos no backend', async ({ page }) => {
  await page.goto('/loja?categoria=aquarios')
  await expect(page.getByText('12 produtos encontrados', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Página 2', exact: true }).click()
  await expect(page).toHaveURL(/pagina=2/)
  await expect(page.getByRole('link', { name: 'Aquário Paginação 11', exact: true })).toBeVisible()
  await page.goto('/loja?categoria=aquarios&preco=50-200&ordem=menor-preco&busca=Ciclo')
  await expect(page.getByRole('link', { name: 'Aquário API Ciclo 1', exact: true })).toBeVisible()
  await expect(page.getByText('1 produto encontrado', { exact: true })).toBeVisible()
})

test('ausência de ficha, imagem e estoque é explícita; inativo e link inexistente retornam 404', async ({ page, sistema }) => {
  await page.goto(`/loja/${sistema.ids.semFicha}`)
  await expect(page.getByText('Ficha técnica ainda não disponível.')).toBeVisible()
  await expect(page.getByText('Foto em breve')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Esgotado', exact: true })).toBeDisabled()
  await expect(page.getByText('R$ 10,50', { exact: true })).toBeVisible()
  for (const id of [sistema.ids.inativo, 2147483647]) {
    await page.goto(`/loja/${id}`)
    await expect(page.getByText('Não encontramos esse produto', { exact: true })).toBeVisible()
  }
  await page.goto('/loja?busca=desativado')
  await expect(page.getByText('Nenhum resultado', { exact: true })).toBeVisible()
})

test('peixes: busca científica, filtros reais e navegação ao mesmo ID/ficha', async ({ page, sistema, request }) => {
  await page.goto('/peixes?agua=doce&temperamento=pacifico&dificuldade=iniciante&busca=Species')
  await expect(page.getByRole('link', { name: 'Peixe API Pacífico', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Peixe API Marinho', exact: true })).toHaveCount(0)
  await page.getByRole('link', { name: 'Peixe API Pacífico', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/peixes/${sistema.ids.peixe}$`))
  await expect(page.getByText('Species ciclo1 dulcis', { exact: true })).toBeVisible()
  await expect(page.getByText('24–28 °C', { exact: true })).toBeVisible()
  await expect(page.getByText('6–7', { exact: true })).toBeVisible()
  const produto = await (await request.get(`${sistema.backend}/api/produtos/${sistema.ids.peixe}`)).json()
  const peixe = await (await request.get(`${sistema.backend}/api/peixes/${sistema.ids.peixe}`)).json()
  expect(peixe).toEqual(produto)
  await page.goto('/peixes?preco=acima-200&ordem=maior-preco&disponibilidade=esgotado')
  await expect(page.getByRole('link', { name: 'Peixe API Marinho', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Peixe API Pacífico', exact: true })).toHaveCount(0)
  await page.goto(`/peixes/${sistema.ids.peixeSemFicha}`)
  await expect(page.getByText('Não encontramos esse peixe', { exact: true })).toBeVisible()
})

test('comparação e busca do cabeçalho consultam fichas reais', async ({ page, sistema }) => {
  await page.goto('/peixes')
  await expect(page.getByRole('link', { name: 'Peixe API sem ficha', exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Comparar Peixe API Pacífico', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Comparar Peixe API Marinho', exact: true }).check()
  await page.getByRole('link', { name: 'Comparar agora', exact: true }).click()
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByText('R$ 49,99', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Buscar (atalho: tecla /)' }).click()
  await page.getByRole('combobox', { name: 'Buscar produtos, peixes ou categorias' }).fill('Species ciclo1 dulcis')
  await expect(page.getByRole('option', { name: /Peixe API Pacífico/ })).toBeVisible()
  await page.getByRole('option', { name: /Peixe API Pacífico/ }).click()
  await expect(page).toHaveURL(new RegExp(`/peixes/${sistema.ids.peixe}$`))
})

test('carrinho preserva o inteiro em centavos e apresenta subtotal correto', async ({ page, sistema }) => {
  await page.goto(`/loja/${sistema.ids.aquario}`)
  await page.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('aquarilandia-carrinho')))).toEqual({ versao: 2, itens: [{ id: sistema.ids.aquario, qtd: 1 }] })
  await page.getByRole('button', { name: /Carrinho, 1 item, total/  }).filter({ visible: true }).first().click()
  await expect(page.getByRole('dialog').getByText('R$ 123,45', { exact: true }).first()).toBeVisible()
})

test('carregamento e falha de rede são visíveis e nunca substituídos por mocks', async ({ page }) => {
  let liberar
  const espera = new Promise((resolve) => { liberar = resolve })
  await page.route('**/api/produtos?**', async (route) => { await espera; await route.abort('failed') })
  await page.goto('/loja')
  await expect(page.getByText('Carregando…', { exact: true }).first()).toBeVisible()
  liberar()
  await expect(page.getByText('Não conseguimos carregar a lista', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Aquário API Ciclo 1', exact: true })).toHaveCount(0)
  await page.unroute('**/api/produtos?**')
  await page.getByRole('button', { name: 'Tentar de novo', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Aquário API Ciclo 1', exact: true })).toBeVisible()
  await page.goto('/loja?busca=sem-resultados-ciclo1')
  await expect(page.getByText('Nenhum resultado', { exact: true })).toBeVisible()
})

test('desativação no banco remove o item das telas e do detalhe', async ({ page, sistema }) => {
  await sistema.cliente.query('UPDATE produtos SET ativo=false WHERE id=$1', [sistema.ids.aquario])
  try {
    await page.goto('/loja?busca=Ciclo')
    await expect(page.getByText('Nenhum resultado', { exact: true })).toBeVisible()
    await page.goto(`/loja/${sistema.ids.aquario}`)
    await expect(page.getByText('Não encontramos esse produto', { exact: true })).toBeVisible()
  } finally {
    await sistema.cliente.query('UPDATE produtos SET ativo=true WHERE id=$1', [sistema.ids.aquario])
  }
})

test('menu móvel usa categorias do banco e leva à listagem existente', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Loja', exact: true }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'Categoria API nova', exact: true }).click()
  await expect(page).toHaveURL(/categoria=categoria-api-nova/)
  await expect(page.getByRole('heading', { name: 'Categoria API nova', exact: true })).toBeVisible()
  await expect(page.getByText('Nenhum resultado', { exact: true })).toBeVisible()
})

test('falha na consulta de categorias é visível na home, sem lista estática', async ({ page }) => {
  await page.route('**/api/categorias?**', (route) => route.abort('failed'))
  await page.goto('/')
  await expect(page.getByText('Não conseguimos carregar as categorias.', { exact: false }).first()).toBeVisible()
  await expect(page.locator('#lista-categorias').getByRole('link')).toHaveCount(0)
})

test('endereço textual antigo é tratado como link inválido sem mock de detalhe', async ({ page }) => {
  await page.goto('/peixes/betta-splendens')
  await expect(page.getByText('Não encontramos esse peixe', { exact: true })).toBeVisible()
  await page.goto('/loja/aquario-exemplo')
  await expect(page.getByText('Não encontramos esse produto', { exact: true })).toBeVisible()
})
