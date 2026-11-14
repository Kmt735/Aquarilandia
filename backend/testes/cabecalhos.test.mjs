import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

// Lote 13, PASSO 2: os cabeçalhos do helmet numa resposta da API e numa página do site (fora de produção: sem HSTS).
// Um index.html de mentira com um <script> inline, como o do frontend (o tema): a CSP libera só o hash dele.
const raiz = mkdtempSync(join(tmpdir(), 'cabecalhos-'))
mkdirSync(join(raiz, 'assets'))
const inline = "\n      document.documentElement.classList.add('dark')\n    "
writeFileSync(join(raiz, 'index.html'), `<!doctype html><script>${inline}</script><script type="module" src="/assets/a.js"></script><div id="root"></div>`)
process.env.FRONTEND_DIST = raiz
const { app } = await import('../src/app.ts')
const hash = `'sha256-${createHash('sha256').update(inline, 'utf8').digest('base64')}'`

describe('Cabeçalhos de segurança (helmet)', () => {
  let servidor, base
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}`
  })
  after(async () => {
    await new Promise((r) => servidor.close(r))
    rmSync(raiz, { recursive: true, force: true })
  })
  const diretivas = (csp) => Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([nome, ...valores]) => [nome, valores]))

  for (const caminho of ['/api/categorias?pagina=abc', '/api/inexistente', '/', '/loja']) {
    it(`${caminho}: CSP, nosniff, Referrer-Policy, frame-ancestors, sem X-Powered-By e sem HSTS fora de produção`, async () => {
      const r = await fetch(`${base}${caminho}`)
      const h = r.headers
      const csp = diretivas(h.get('content-security-policy'))
      assert.deepEqual(csp['default-src'], ["'self'"])
      assert.deepEqual(csp['img-src'], ["'self'", 'data:', 'https:'])
      assert.deepEqual(csp['script-src'], ["'self'", hash])
      assert.deepEqual(csp['style-src'], ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'])
      assert.deepEqual(csp['font-src'], ["'self'", 'data:', 'https://fonts.gstatic.com'])
      assert.deepEqual(csp['connect-src'], ["'self'"])
      assert.deepEqual(csp['frame-ancestors'], ["'none'"])
      assert.deepEqual(csp['object-src'], ["'none'"])
      assert.deepEqual(csp['base-uri'], ["'self'"])
      assert.deepEqual(csp['form-action'], ["'self'"])
      assert.equal(h.get('content-security-policy').includes('unsafe-eval'), false)
      assert.equal(csp['script-src'].includes("'unsafe-inline'"), false)
      assert.equal(h.get('x-content-type-options'), 'nosniff')
      assert.equal(h.get('referrer-policy'), 'strict-origin-when-cross-origin')
      assert.equal(h.get('x-frame-options'), 'SAMEORIGIN')
      assert.equal(h.get('x-powered-by'), null)
      assert.equal(h.get('strict-transport-security'), null, 'HSTS só em produção')
      await r.arrayBuffer()
    })
  }
})
