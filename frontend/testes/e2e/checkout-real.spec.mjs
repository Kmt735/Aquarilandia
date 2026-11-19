import { createHash, randomUUID } from 'node:crypto'
import { test, expect } from './sistema.mjs'

test('cadastro, login, Pix, confirmação e estorno usam API, sessão e estoque reais', async ({ page, sistema }) => {
  const email = `${randomUUID()}@checkout.example`, senha = 'SenhaFicticiaCheckout123!'
  await page.addInitScript((id) => localStorage.setItem('aquarilandia-carrinho', JSON.stringify({ versao: 2, itens: [{ id, qtd: 1 }] })), sistema.ids.aquario)
  await page.goto('/criar-conta?voltar=/checkout/entrega')
  await page.locator('#cad-nome').fill('Cliente E2E')
  await page.locator('#cad-email').fill(email)
  await page.locator('#cad-senha').fill(senha)
  await page.locator('#cad-tel').fill('32999990000')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click()
  await expect(page).toHaveURL(/\/entrar\?/)
  await page.locator('#login-email').fill(email)
  await page.locator('#login-senha').fill(senha)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/checkout\/entrega/)
  await page.getByRole('radio', { name: /Retirar na loja/ }).check()
  await page.getByRole('radio', { name: /Aquarilândia Centro/ }).check()
  await page.getByRole('button', { name: /Continuar para o pagamento/ }).click()
  const criada = page.waitForResponse((r) => /\/api\/vendas$/.test(r.url()) && r.request().method() === 'POST')
  await page.getByRole('button', { name: /Gerar Pix de/ }).click()
  const venda = await (await criada).json()
  expect(venda.unidadeRetirada.id).toBe('centro')
  await expect(page.getByLabel('Pix copia e cola')).toHaveValue(/PIX-FICTICIO/)
  expect((await sistema.cliente.query('SELECT status FROM vendas WHERE id=$1', [venda.id])).rows[0].status).toBe('aguardando_pagamento')
  const saldo = (await sistema.cliente.query('SELECT estoque FROM produtos WHERE id=$1', [sistema.ids.aquario])).rows[0].estoque
  await page.reload()
  const repetida = page.waitForResponse((r) => /\/api\/vendas$/.test(r.url()) && r.request().method() === 'POST')
  await page.getByRole('button', { name: /Gerar Pix de/ }).click()
  const resposta = await repetida
  expect(resposta.headers()['idempotent-replayed']).toBe('true')
  expect((await resposta.json()).id).toBe(venda.id)
  expect((await sistema.cliente.query('SELECT estoque FROM produtos WHERE id=$1', [sistema.ids.aquario])).rows[0].estoque).toBe(saldo)
  await sistema.confirmarPagamento(venda.id)
  await expect(page.getByRole('heading', { name: 'Pagamento aprovado!' })).toBeVisible()
  await page.getByRole('link', { name: 'Acompanhar a compra' }).click()
  await page.getByRole('button', { name: 'Cancelar compra', exact: true }).click()
  await page.getByRole('button', { name: 'Sim, cancelar', exact: true }).click()
  await expect(page.getByText('Cancelada', { exact: true }).first()).toBeVisible()
  expect((await sistema.cliente.query('SELECT estoque FROM produtos WHERE id=$1', [sistema.ids.aquario])).rows[0].estoque).toBe(saldo + 1)
  expect(await page.evaluate(() => localStorage.getItem('aquarilandia-pedidos-exemplo'))).toBeNull()
})

test('storage forjado não concede sessão nem acesso administrativo', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('aquarilandia-sessao-exemplo', JSON.stringify({ id: 1, nome: 'Admin falso', papel: 'admin' })))
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/entrar\?/)
  await expect(page.getByRole('heading', { name: 'Painel do administrador' })).toHaveCount(0)
})

test('recuperação envia token real, remove-o da URL e troca a senha no backend', async ({ page, sistema }) => {
  const email = `${randomUUID()}@recuperacao.example`, senha = 'SenhaFicticiaOriginal123!', nova = 'SenhaFicticiaNova123!'
  const headers = { Origin: sistema.origem }
  const cadastro = await page.request.post(`${sistema.origem}/api/auth/cadastro`, {
    headers, data: { nome: 'Recuperação E2E', email, senha, telefone: '32999990000', aceiteTermos: true },
  })
  expect(cadastro.status()).toBe(202)
  await page.goto('/esqueci-a-senha')
  await page.locator('#esq-email').fill(email)
  await page.getByRole('button', { name: /Enviar/ }).click()
  await expect.poll(() => sistema.emails.find((m) => m.to.includes(email))?.text).toContain('/redefinir-senha?token=')
  const texto = sistema.emails.find((m) => m.to.includes(email)).text
  const link = texto.match(/http[^\s]+\/redefinir-senha\?token=[^\s]+/)[0]
  await page.goto(link)
  await expect(page).toHaveURL(/\/redefinir-senha$/)
  await page.locator('input[type=password]').nth(0).fill(nova)
  await page.locator('input[type=password]').nth(1).fill(nova)
  await page.getByRole('button', { name: 'Salvar senha nova' }).click()
  await expect(page.getByText('Senha alterada', { exact: true })).toBeVisible()
  expect((await page.request.post(`${sistema.origem}/api/auth/login`, { headers, data: { email, senha } })).status()).toBe(401)
  expect((await page.request.post(`${sistema.origem}/api/auth/login`, { headers, data: { email, senha: nova } })).status()).toBe(200)
})


test('admin com sessão real lista a compra e avança retirada somente após pagamento', async ({ page, sistema }) => {
  const email = `${randomUUID()}@admin-fluxo.example`, senha = 'SenhaFicticiaAdminFluxo123!'
  const headers = { Origin: sistema.origem }
  expect((await page.request.post('/api/auth/cadastro', { headers,
    data: { nome: 'Cliente admin fluxo', email, senha, telefone: '32999990000', aceiteTermos: true } })).status()).toBe(202)
  expect((await page.request.post('/api/auth/login', { headers, data: { email, senha } })).status()).toBe(200)
  const preco = (await sistema.cliente.query('SELECT preco FROM produtos WHERE id=$1', [sistema.ids.aquario])).rows[0].preco
  const resposta = await page.request.post('/api/vendas', { headers: { ...headers, 'Idempotency-Key': randomUUID() },
    data: { itens: [{ produtoId: sistema.ids.aquario, quantidade: 1 }], retirada: true, unidadeRetirada: 'matosinhos', totalEsperado: preco } })
  expect(resposta.status()).toBe(201)
  const venda = await resposta.json()
  expect((await page.request.post(`/api/vendas/${venda.id}/pagamentos`, { headers })).status()).toBe(201)
  const admin = (await sistema.cliente.query("INSERT INTO clientes (nome,email,senha_hash,papel) VALUES ('Admin E2E',$1,'hash-fixture','admin') RETURNING id", [`${randomUUID()}@admin.example`])).rows[0].id
  const token = randomUUID(), hash = createHash('sha256').update(token).digest('hex')
  await sistema.cliente.query("INSERT INTO sessoes (token_hash,cliente_id,expira_em) VALUES ($1,$2,now()+interval '1 hour')", [hash, admin])
  await page.context().addCookies([{ name: 'sid', value: token, url: sistema.origem }])
  await page.goto(`/admin/produtos/${sistema.ids.aquario}/editar`)
  await page.locator('#logistica-pesoG').fill('500')
  await page.getByRole('button',{name:'Salvar dados de envio',exact:true}).click()
  await expect(page.getByText('Dados de envio salvos.',{exact:true})).toBeVisible()
  await page.goto('/admin/pedidos')
  await page.getByRole('link', { name: new RegExp(`Pedido ${venda.id} ·`) }).click()
  await expect(page.getByRole('button', { name: /Avançar para/ })).toHaveCount(0)
  await sistema.confirmarPagamento(venda.id)
  await page.reload()
  for (const nome of ['Preparando o pedido', 'Pronta para retirada na loja', 'Chegou']) {
    await page.getByRole('button', { name: `Avançar para: ${nome}`, exact: true }).click()
  }
  await expect(page.getByText('Chegou', { exact: true }).first()).toBeVisible()
  expect((await sistema.cliente.query('SELECT status FROM vendas WHERE id=$1', [venda.id])).rows[0].status).toBe('entregue')
})


test('cliente escolhe serviço com peso cubado e pedido grava transportadora e tarifa do servidor', async ({ page, sistema }) => {
  const email = `${randomUUID()}@entrega.example`, senha = 'SenhaFicticiaEntrega123!'
  const headers = { Origin:sistema.origem }
  expect((await page.request.post('/api/auth/cadastro',{headers,data:{nome:'Cliente entrega',email,senha,telefone:'32999990000',aceiteTermos:true}})).status()).toBe(202)
  expect((await page.request.post('/api/auth/login',{headers,data:{email,senha}})).status()).toBe(200)
  expect((await page.request.post('/api/clientes/me/enderecos',{headers,data:{apelido:'Casa SP',cep:'01001000',logradouro:'Rua Teste',numero:'10',bairro:'Centro',cidade:'São Paulo',uf:'SP',principal:true}})).status()).toBe(201)
  await page.addInitScript((id)=>localStorage.setItem('aquarilandia-carrinho',JSON.stringify({versao:2,itens:[{id,qtd:1}]})),sistema.ids.aquario)
  await page.goto('/checkout/entrega')
  await expect(page.getByRole('combobox',{name:'Modalidade de entrega'})).toBeVisible()
  await page.getByRole('combobox',{name:'Modalidade de entrega'}).selectOption('rapido')
  await page.getByRole('button',{name:/Continuar para o pagamento/}).click()
  const resposta=page.waitForResponse(r=>/\/api\/vendas$/.test(r.url()) && r.request().method()==='POST')
  await page.getByRole('button',{name:/Gerar Pix de/}).click()
  const criada=await resposta
  expect(criada.status()).toBe(201)
  const pedido=await criada.json()
  expect(pedido.frete).toBe(4500)
  expect(pedido.servicoFrete.id).toBe('rapido')
  expect(pedido.servicoFrete.transportadora).toBe('Transportadora fixture')
  await expect(page.getByLabel('Pix copia e cola')).toHaveValue(/PIX-FICTICIO/)
  const gravado=(await sistema.cliente.query('SELECT servico_frete,frete FROM vendas WHERE id=$1',[pedido.id])).rows[0]
  expect(gravado.servico_frete.id).toBe('rapido');expect(gravado.frete).toBe(4500)
})
