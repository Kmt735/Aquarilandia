import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect } from './sistema.mjs'

async function entrarAdmin(page, sistema) {
  const { gerarHash } = await import('../../../backend/dist/modulos/clientes/senha.js')
  const email = `${randomUUID()}@admin.example`, senha = 'SenhaAdminOperacoes123!'
  await sistema.cliente.query("INSERT INTO clientes(nome,email,senha_hash,papel) VALUES('Admin operações',$1,$2,'admin')", [email, await gerarHash(senha)])
  await page.goto('/entrar')
  await page.locator('#login-email').fill(email)
  await page.locator('#login-senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/admin/)
}

test('admin registra estoque pela tela, persiste histórico e não permite saída acima do saldo', async ({ page, sistema }) => {
  await entrarAdmin(page, sistema)
  const produto = (await sistema.cliente.query('SELECT nome,estoque FROM produtos WHERE id=$1', [sistema.ids.aquario])).rows[0]
  await page.goto('/admin/estoque')
  await page.getByLabel('Buscar produto').fill(produto.nome)
  await page.getByRole('button', { name: `Dar entrada no estoque: ${produto.nome}`, exact: true }).click()
  await page.locator('#entrada-quantidade').fill('2')
  await page.locator('#entrada-motivo').fill('Entrada pelo painel de operações')
  const entrada = page.waitForResponse(r => r.url().endsWith('/api/estoque/movimentacoes') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Registrar entrada', exact: true }).click()
  expect((await entrada).status()).toBe(201)
  await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  await page.getByRole('row').filter({ hasText: produto.nome }).getByRole('button', { name: 'Saídas e ajustes', exact: true }).click()
  await expect(page.getByText('Entrada pelo painel de operações', { exact: true })).toBeVisible()
  expect((await sistema.cliente.query('SELECT estoque FROM produtos WHERE id=$1', [sistema.ids.aquario])).rows[0].estoque).toBe(produto.estoque + 2)
  await page.getByLabel('Tipo de movimentação').selectOption('saida')
  await page.getByLabel('Quantidade', { exact: true }).fill(String(produto.estoque + 100))
  await page.getByLabel('Motivo', { exact: true }).fill('Saída acima do saldo deve falhar')
  const saida = page.waitForResponse(r => r.url().endsWith('/api/estoque/movimentacoes') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Registrar movimentação', exact: true }).click()
  expect((await saida).status()).toBe(409)
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await sistema.cliente.query('SELECT estoque FROM produtos WHERE id=$1', [sistema.ids.aquario])).rows[0].estoque).toBe(produto.estoque + 2)
})

test('catálogo administrativo cria e edita produto; foto usa upload separado e não é apagada pela edição', async ({ page, sistema }) => {
  const { env } = await import('../../../backend/dist/config/env.js')
  const anterior = env.imagensDir, pasta = await mkdtemp(join(tmpdir(), 'admin-foto-'))
  try {
    env.imagensDir = pasta
    await entrarAdmin(page, sistema)
    const categoria = (await sistema.cliente.query("SELECT id FROM categorias WHERE slug='acessorios'")).rows[0].id
    await page.goto('/admin/produtos/novo')
    await page.locator('#item-categoria').selectOption(String(categoria))
    await page.locator('#item-nome').fill('Acessório cadastrado no navegador')
    await page.locator('#item-preco').fill('14,90')
    const criacao = page.waitForResponse(r => r.url().endsWith('/api/produtos') && r.request().method() === 'POST')
    await page.getByRole('button', { name: 'Cadastrar item', exact: true }).click()
    const criada = await criacao
    expect(criada.status()).toBe(201)
    const produto = await criada.json()
    await page.goto(`/admin/produtos/${produto.id}/editar`)
    const sharp = createRequire(new URL('../../../backend/package.json', import.meta.url))('sharp')
    const buffer = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#087f8c' } }).png().toBuffer()
    await page.getByLabel('Arquivo da foto').setInputFiles({ name: 'produto.png', mimeType: 'image/png', buffer })
    await page.getByRole('button', { name: 'Enviar foto', exact: true }).click()
    await expect(page.getByText('Foto salva.', { exact: true })).toBeVisible()
    const url = await page.getByAltText('Foto atual do produto').getAttribute('src')
    await page.locator('#item-preco').fill('15,90')
    await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
    await expect(page).toHaveURL(/\/admin\/produtos$/)
    const salvo = (await sistema.cliente.query('SELECT preco,imagem_arquivo_id FROM produtos WHERE id=$1', [produto.id])).rows[0]
    expect(salvo.preco).toBe(1590); expect(salvo.imagem_arquivo_id).toBeTruthy()
    await page.goto(`/admin/produtos/${produto.id}/editar`)
    await expect(page.getByAltText('Foto atual do produto')).toHaveAttribute('src', url)
    await page.getByRole('button', { name: 'Remover foto', exact: true }).click()
    await expect(page.getByText('Foto removida.', { exact: true })).toBeVisible()
    expect((await sistema.cliente.query('SELECT imagem_arquivo_id FROM produtos WHERE id=$1', [produto.id])).rows[0].imagem_arquivo_id).toBeNull()
  } finally { env.imagensDir = anterior; await rm(pasta, { recursive: true, force: true }) }
})

test('solicitação pública aparece no painel e mudança de atendimento fica no PostgreSQL', async ({ page, sistema }) => {
  const resposta = await page.request.post(`${sistema.origem}/api/orcamentos`, {
    headers: { Origin: sistema.origem }, data: { nome: 'Solicitante do painel', telefone: '32999990000', servico: 'Manutenção', mensagem: 'Orçamento real do teste administrativo' },
  })
  expect(resposta.status()).toBe(201)
  const pedido = await resposta.json()
  await entrarAdmin(page, sistema)
  await page.goto('/admin/orcamentos')
  await expect(page.getByText('Orçamento real do teste administrativo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ver e editar' }).click()
  await page.getByLabel('Nome do cliente').fill('Solicitante atualizado')
  await page.getByLabel('Telefone', { exact: true }).fill('32988887777')
  await page.getByLabel('Serviço', { exact: true }).selectOption('Consultoria')
  await page.getByLabel('Mensagem e detalhes da solicitação').fill('Detalhes revisados pelo administrador')
  await page.getByLabel('Andamento', { exact: true }).selectOption('em_atendimento')
  const atualizada = page.waitForResponse(r => r.url().endsWith(`/api/orcamentos/${pedido.id}`) && r.request().method() === 'PATCH')
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  expect((await atualizada).status()).toBe(200)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Solicitante atualizado' })).toBeVisible()
  await page.reload()
  await page.getByLabel('Buscar orçamento').fill('Solicitante atualizado')
  await page.getByRole('button', { name: 'Buscar', exact: true }).click()
  await expect(page.getByText('Detalhes revisados pelo administrador', { exact: true })).toBeVisible()
  const salvo = (await sistema.cliente.query('SELECT nome,telefone,servico,mensagem FROM orcamentos WHERE id=$1', [pedido.id])).rows[0]
  expect(salvo).toEqual({ nome: 'Solicitante atualizado', telefone: '32988887777', servico: 'Consultoria', mensagem: 'Detalhes revisados pelo administrador' })
  await page.getByRole('button', { name: 'Concluído', exact: true }).click()
  await expect(page.getByText('Nenhum orçamento encontrado', { exact: true })).toBeVisible()
  expect((await sistema.cliente.query('SELECT status FROM orcamentos WHERE id=$1', [pedido.id])).rows[0].status).toBe('em_atendimento')
})

test('admin desativa e reativa cliente pela tela; a sessão antiga permanece revogada', async ({ page, browser, sistema }) => {
  const { gerarHash } = await import('../../../backend/dist/modulos/clientes/senha.js')
  const email = `${randomUUID()}@cliente.example`, senha = 'SenhaClienteOperacoes123!'
  const id = (await sistema.cliente.query("INSERT INTO clientes(nome,email,senha_hash,papel) VALUES('Cliente teste bloqueio',$1,$2,'cliente') RETURNING id", [email, await gerarHash(senha)])).rows[0].id
  const contextoCliente = await browser.newContext()
  try {
    expect((await contextoCliente.request.post(`${sistema.origem}/api/auth/login`, { headers: { Origin: sistema.origem }, data: { email, senha } })).status()).toBe(200)
    await entrarAdmin(page, sistema)
    await page.goto('/admin/clientes')
    await page.getByLabel('Buscar cliente').fill(email)
    await page.getByRole('button', { name: 'Desativar cliente', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar alteração', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Reativar cliente', exact: true })).toBeVisible()
    expect((await sistema.cliente.query('SELECT ativo FROM clientes WHERE id=$1', [id])).rows[0].ativo).toBe(false)
    expect((await contextoCliente.request.get(`${sistema.origem}/api/auth/sessao`)).status()).toBe(401)
    expect((await contextoCliente.request.get(`${sistema.origem}/api/estoque`)).status()).toBe(401)
    await page.getByRole('button', { name: 'Reativar cliente', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar alteração', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Desativar cliente', exact: true })).toBeVisible()
    expect((await contextoCliente.request.get(`${sistema.origem}/api/auth/sessao`)).status()).toBe(401)
  } finally { await contextoCliente.close() }
})
