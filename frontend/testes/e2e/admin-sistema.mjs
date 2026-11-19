import { test as base, expect } from './sistema.mjs'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
const executar = promisify(execFile)

export const test = base.extend({
  contas: [async ({ sistema }, use) => {
    for (const arquivo of ['15_orcamentos.sql','21_vendas_idempotencia.sql','22_pagamentos_estorno.sql','30_estoque.sql','31_estoque_vendas.sql','32_produto_imagem.sql','33_estoque_consultas.sql']) {
      await sistema.cliente.query(await readFile(new URL(`../../../backend/db/init/${arquivo}`, import.meta.url), 'utf8'))
    }
    const senha = randomBytes(20).toString('base64url')
    const email = 'admin.demo@fixture.invalid', clienteEmail = 'cliente.demo@fixture.invalid'
    const cwd = fileURLToPath(new URL('../../../backend', import.meta.url))
    // Mesmo provisionamento do projeto, senha só no ambiente do subprocesso.
    await executar(process.execPath, ['--import','tsx','scripts/criar-admin.ts','--nome','Admin Fictício','--email',email],
      { cwd, env: { ...process.env, SENHA_ADMIN: senha } })
    const { gerarHash } = await import('../../../backend/dist/modulos/clientes/senha.js')
    await sistema.cliente.query("INSERT INTO clientes (nome,email,senha_hash,papel) VALUES ('Cliente Fictício',$1,$2,'cliente')", [clienteEmail, await gerarHash(senha)])
    await use({ email, senha, clienteEmail })
  }, { scope: 'worker' }],
})
export { expect }
export async function entrar(page, contas, cliente = false) {
  await page.goto('/entrar')
  await page.locator('#login-email').fill(cliente ? contas.clienteEmail : contas.email)
  await page.locator('#login-senha').fill(contas.senha)
  const resposta = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST')
  await page.getByRole('button',{name:'Entrar',exact:true}).click()
  expect((await resposta).status()).toBe(200)
}
