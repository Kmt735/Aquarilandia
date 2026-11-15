import { test, expect } from './sistema.mjs'
import { createRequire } from 'node:module'
import { randomBytes, createHash } from 'node:crypto'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const backendRequire = createRequire(new URL('../../../backend/package.json', import.meta.url))

test('imagem real do peixe e placeholder após remoção, com HTTP/PG/filesystem reais', async ({ page, sistema, request }, info) => {
  const { env } = await import('../../../backend/dist/config/env.js')
  const antes = env.imagensDir, pasta = await mkdtemp(join(tmpdir(), 'imagem-browser-'))
  const token = randomBytes(32).toString('base64url')
  try {
    env.imagensDir = pasta
    await sistema.cliente.query(await readFile(new URL('../../../backend/db/init/32_produto_imagem.sql', import.meta.url), 'utf8'))
    const admin = (await sistema.cliente.query("INSERT INTO clientes(nome,email,senha_hash,papel) VALUES('Admin fixture','imagem@browser.example','hash','admin') RETURNING id")).rows[0].id
    await sistema.cliente.query("INSERT INTO sessoes(token_hash,cliente_id,expira_em)VALUES($1,$2,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), admin])
    const sharp = backendRequire('sharp')
    const imagem = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#1488bb' } }).png().toBuffer()
    const headers = { Cookie: `sid=${token}`, Origin: env.corsOrigin }
    const r = await request.put(`${sistema.backend}/api/produtos/${sistema.ids.peixe}/imagem`, {
      headers, multipart: { imagem: { name: 'fixture.png', mimeType: 'image/png', buffer: imagem } },
    })
    expect(r.status()).toBe(200)
    const { imagemUrl } = await r.json()
    await page.goto(`/peixes/${sistema.ids.peixe}`)
    const foto = page.locator(`img[src="${imagemUrl}"]`).first()
    await expect(foto).toBeVisible()
    await expect.poll(() => foto.evaluate((el) => el.naturalWidth)).toBe(32)
    await page.screenshot({ path: info.outputPath('peixe-com-imagem.png'), fullPage: true })
    const removida = await request.delete(`${sistema.backend}/api/produtos/${sistema.ids.peixe}/imagem`, { headers })
    expect(removida.status()).toBe(200); expect((await removida.json()).imagemUrl).toBe(null)
    await page.reload()
    await expect(page.getByText('Foto em breve').first()).toBeVisible()
    await expect(page.locator(`img[src="${imagemUrl}"]`)).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('peixe-sem-imagem.png'), fullPage: true })
  } finally { env.imagensDir = antes; await rm(pasta, { recursive: true, force: true }) }
})
