import { test, expect } from './sistema.mjs'

async function preparar(page, valor) {
  await page.addInitScript((valor) => {
    if (localStorage.getItem('aquarilandia-carrinho') === null) localStorage.setItem('aquarilandia-carrinho', valor)
  }, valor)
}
const ler = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('aquarilandia-carrinho')))
async function abrir(page) {
  await page.getByRole('button', { name: /Carrinho,/ }).filter({ visible: true }).first().click()
  return page.getByRole('dialog', { name: /Seu carrinho/ })
}

test('carrinho antigo/misto agrupa IDs reais, remove textuais/inativos/esgotados e usa preço da API', async ({ page, sistema }) => {
  await preparar(page, JSON.stringify([
    { id: 'betta-splendens', qtd: 1, item: { id: 'betta-splendens', nome: 'Nome mock que não deve aparecer', preco: 20 } },
    { id: sistema.ids.aquario, qtd: 2, item: { id: sistema.ids.aquario, nome: 'Nome antigo', preco: 1.5 } },
    { id: sistema.ids.aquario, qtd: 1, item: { id: sistema.ids.aquario, preco: 99999999, centavos: true } },
    { id: sistema.ids.inativo, qtd: 1, item: { id: sistema.ids.inativo, preco: 1, emEstoque: true } },
    { id: sistema.ids.semFicha, qtd: 1, item: { id: sistema.ids.semFicha, preco: 1, emEstoque: true } },
  ]))
  await page.goto('/loja')
  await expect.poll(() => ler(page)).toEqual({ versao: 2, itens: [{ id: sistema.ids.aquario, qtd: 3 }] })
  const gaveta = await abrir(page)
  await expect(gaveta.getByText('R$ 370,35', { exact: true }).first()).toBeVisible()
  await expect(gaveta.getByText(/Itens antigos sem identificação numérica/)).toBeVisible()
  await expect(gaveta.getByText(/Produtos que saíram do catálogo/)).toBeVisible()
  await expect(gaveta.getByText('Nome antigo', { exact: true })).toHaveCount(0)
  await expect(gaveta.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeEnabled()
  await page.reload()
  await expect.poll(() => ler(page)).toEqual({ versao: 2, itens: [{ id: sistema.ids.aquario, qtd: 3 }] })
  await expect(page.getByText('Seu carrinho foi atualizado.', { exact: false })).toHaveCount(0)
})

test('carrinho novo consulta preço alterado sem depender de snapshot persistido', async ({ page, sistema }) => {
  await preparar(page, JSON.stringify({ versao: 2, itens: [{ id: sistema.ids.aquario, qtd: 2 }] }))
  await sistema.cliente.query('UPDATE produtos SET preco=19999 WHERE id=$1', [sistema.ids.aquario])
  try {
    await page.goto('/loja')
    const gaveta = await abrir(page)
    await expect(gaveta.getByText('R$ 399,98', { exact: true }).first()).toBeVisible()
    await expect(gaveta.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeEnabled()
    expect(await ler(page)).toEqual({ versao: 2, itens: [{ id: sistema.ids.aquario, qtd: 2 }] })
  } finally { await sistema.cliente.query('UPDATE produtos SET preco=12345 WHERE id=$1', [sistema.ids.aquario]) }
})

test('falha de rede preserva intenção, não soma preço salvo e impede continuar até nova consulta', async ({ page, sistema }) => {
  await preparar(page, JSON.stringify({ versao: 2, itens: [{ id: sistema.ids.aquario, qtd: 1 }, { id: sistema.ids.peixe, qtd: 1 }] }))
  await page.route(`**/api/produtos/${sistema.ids.aquario}`, (route) => route.abort('failed'))
  await page.goto('/loja')
  const gaveta = await abrir(page)
  await expect(gaveta.getByText(/Não conseguimos conferir todos os produtos/)).toBeVisible()
  await expect(gaveta.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeDisabled()
  await expect(gaveta.getByText('Aguardando conferência', { exact: true }).first()).toBeVisible()
  await expect(gaveta.getByText('R$ 49,99', { exact: true }).first()).toBeVisible()
  expect((await ler(page)).itens).toHaveLength(2)
  await page.unroute(`**/api/produtos/${sistema.ids.aquario}`)
  await gaveta.getByRole('button', { name: 'Tentar conferir carrinho novamente' }).click()
  await expect(gaveta.getByText('R$ 173,44', { exact: true }).first()).toBeVisible()
  await expect(gaveta.getByText(/Não conseguimos conferir todos os produtos/)).toHaveCount(0)
  await expect(gaveta.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeEnabled()
})

test('armazenamento malformado é informado e migrado para vazio sem quebrar o catálogo', async ({ page }) => {
  await preparar(page, '{json-incompleto')
  await page.goto('/loja')
  const gaveta = await abrir(page)
  await expect(gaveta.getByText(/O carrinho salvo estava malformado/)).toBeVisible()
  await expect(gaveta.getByText('Seu carrinho está vazio', { exact: true })).toBeVisible()
  expect(await ler(page)).toEqual({ versao: 2, itens: [] })
})

test('versão desconhecida é preservada até limpeza explícita', async ({ page }) => {
  const futuro = JSON.stringify({ versao: 3, itens: [{ id: 1, qtd: 2 }] })
  await preparar(page, futuro)
  await page.goto('/loja')
  const gaveta = await abrir(page)
  await expect(gaveta.getByText(/Não reconhecemos o formato/)).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('aquarilandia-carrinho'))).toBe(futuro)
  await gaveta.getByRole('button', { name: 'Limpar carrinho salvo' }).click()
  await expect.poll(() => ler(page)).toEqual({ versao: 2, itens: [] })
})

test('produto desativado durante a sessão sai do carrinho ao reconferir', async ({ page, sistema }) => {
  await preparar(page, JSON.stringify({ versao: 2, itens: [{ id: sistema.ids.aquario, qtd: 1 }] }))
  await page.goto('/loja')
  const gaveta = await abrir(page)
  await expect(gaveta.getByRole('button', { name: 'Finalizar compra', exact: true })).toBeEnabled()
  await sistema.cliente.query('UPDATE produtos SET ativo=false WHERE id=$1', [sistema.ids.aquario])
  try {
    await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')))
    await expect(gaveta.getByText('Seu carrinho está vazio', { exact: true })).toBeVisible()
    await expect(gaveta.getByText(/Produtos que saíram do catálogo/)).toBeVisible()
    await expect(gaveta.getByRole('button', { name: 'Finalizar compra', exact: true })).toHaveCount(0)
    await expect.poll(() => ler(page)).toEqual({ versao: 2, itens: [] })
  } finally { await sistema.cliente.query('UPDATE produtos SET ativo=true WHERE id=$1', [sistema.ids.aquario]) }
})
