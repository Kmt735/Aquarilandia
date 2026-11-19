import { test, expect } from './sistema.mjs'

// Meu Primeiro Aquário: guia (Aprender) e montador (Montar o meu) na mesma página, com endereço por aba
test('rota antiga do montador redireciona para a aba Montar, mantendo a etapa pedida', async ({ page }) => {
  await page.goto('/monte-seu-aquario?etapa=peixes')
  await expect(page).toHaveURL(/\/meu-primeiro-aquario\/montar$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Meu Primeiro Aquário' })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Montar o meu/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { level: 2, name: 'Peixes' })).toBeVisible()
  await expect(page).toHaveTitle('Montar o meu aquário · Meu Primeiro Aquário · Aquarilândia')
})

test('abas trocam pelo teclado, sem perder o foco, e o voltar do navegador retorna à aba anterior', async ({ page }) => {
  await page.goto('/meu-primeiro-aquario')
  await expect(page.getByRole('tab', { name: /Aprender/ })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('tab', { name: /Aprender/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(page).toHaveURL(/\/meu-primeiro-aquario\/montar$/)
  await expect(page.getByRole('tab', { name: /Montar o meu/ })).toBeFocused()
  await page.goBack()
  await expect(page.getByRole('tab', { name: /Aprender/ })).toHaveAttribute('aria-selected', 'true')
})

test('guia leva à etapa certa do montador, e o "Saiba mais" do montador volta ao guia', async ({ page }) => {
  await page.goto('/meu-primeiro-aquario#escolha-dos-peixes')
  await page.getByRole('link', { name: 'Escolher os meus peixes' }).click()
  await expect(page.getByRole('heading', { level: 2, name: 'Peixes' })).toBeVisible()
  await page.getByText('Saiba mais: Dicas para escolher os peixes').click()
  await expect(page.getByRole('heading', { name: 'Comece com poucos e resistentes' })).toBeVisible()
  await page.getByRole('link', { name: 'Ler no guia: Ciclagem' }).click()
  await expect(page).toHaveURL(/\/meu-primeiro-aquario#ciclagem$/)
  await expect(page.locator('#titulo-ciclagem')).toBeFocused()
})
