import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'

// Lote 13, PASSO 1: com FRONTEND_DIST, o backend serve o site no mesmo endereço da API. Uma pasta de build de mentira
// é criada no diretório temporário do sistema, com um arquivo SECRETO ao lado (fora dela) que nunca pode ser servido.
// O runner executa cada arquivo em processo separado: o FRONTEND_DIST daqui não afeta as outras suítes.
const raiz = mkdtempSync(join(tmpdir(), 'site-estatico-'))
const pasta = join(raiz, 'dist')
mkdirSync(join(pasta, 'assets'), { recursive: true })
writeFileSync(join(pasta, 'index.html'), '<!doctype html><title>Aquarilândia</title><div id="root"></div>')
writeFileSync(join(pasta, 'assets', 'index-AbC123.js'), 'console.log("app")')
writeFileSync(join(pasta, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
writeFileSync(join(pasta, '.env'), 'SEGREDO_DOTFILE=nao')
writeFileSync(join(raiz, 'segredo.txt'), 'CONTEUDO_SECRETO_FORA_DA_PASTA')
process.env.FRONTEND_DIST = pasta
const { app } = await import('../src/app.ts')

describe('Site servido pelo backend (FRONTEND_DIST)', () => {
  let servidor, base
  before(async () => {
    servidor = app.listen(0, '127.0.0.1'); await once(servidor, 'listening')
    base = `http://127.0.0.1:${servidor.address().port}`
  })
  after(async () => {
    await new Promise((r) => servidor.close(r))
    rmSync(raiz, { recursive: true, force: true })
  })
  const pedir = async (caminho, opcoes) => {
    const r = await fetch(`${base}${caminho}`, opcoes)
    return { status: r.status, tipo: r.headers.get('content-type') ?? '', cache: r.headers.get('cache-control'), texto: await r.text() }
  }

  it('GET / e qualquer rota do React → index.html com no-cache', async () => {
    for (const caminho of ['/', '/loja', '/qualquer/rota', '/minha-conta/compras/42', '/loja?categoria=filtros']) {
      const r = await pedir(caminho)
      assert.equal(r.status, 200, caminho)
      assert.match(r.tipo, /text\/html/, caminho)
      assert.match(r.texto, /<div id="root">/, caminho)
      assert.equal(r.cache, 'no-cache', caminho)
    }
  })
  it('/api/inexistente e /api → 404 em JSON, nunca o index.html; /api de verdade continua funcionando', async () => {
    for (const caminho of ['/api/inexistente', '/api', '/api/', '/api/loja/qualquer']) {
      const r = await pedir(caminho)
      assert.equal(r.status, 404, caminho)
      assert.match(r.tipo, /application\/json/, caminho)
      assert.equal(r.texto.includes('<div id="root">'), false, caminho)
    }
    const categorias = await pedir('/api/categorias?pagina=abc')
    assert.equal(categorias.status, 400, 'a rota da API responde ela mesma')
  })
  it('GET /assets/<hash>.js → o arquivo, com cache longo; /assets/ que não existe → 404 (não vira HTML)', async () => {
    const r = await pedir('/assets/index-AbC123.js')
    assert.equal(r.status, 200)
    assert.equal(r.texto, 'console.log("app")')
    assert.equal(r.cache, 'public, max-age=31536000, immutable')
    const faltando = await pedir('/assets/index-velho.js')
    assert.equal(faltando.status, 404)
    assert.equal(faltando.texto.includes('<div id="root">'), false)
    const favicon = await pedir('/favicon.svg')
    assert.deepEqual([favicon.status, favicon.cache], [200, 'no-cache'])
  })
  it('arquivo fora da pasta (../, codificado ou não) e dotfiles → nunca servidos', async () => {
    for (const caminho of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/assets/..%2f..%2fsegredo.txt', '/%2e%2e%2fsegredo.txt', '/..%5csegredo.txt', '/.env']) {
      const r = await pedir(caminho)
      assert.equal(r.texto.includes('CONTEUDO_SECRETO_FORA_DA_PASTA'), false, caminho)
      assert.equal(r.texto.includes('SEGREDO_DOTFILE'), false, caminho)
    }
  })
  it('POST fora de /api não recebe o index.html (404)', async () => {
    const r = await pedir('/loja', { method: 'POST' })
    assert.equal(r.status, 404)
    assert.equal(r.texto.includes('<div id="root">'), false)
  })
})

describe('FRONTEND_DIST inválido', () => {
  it('uma pasta sem index.html para o servidor na subida, e a mensagem não repete o caminho', () => {
    const vazia = mkdtempSync(join(tmpdir(), 'dist-vazio-'))
    const processo = spawnSync(process.execPath, ['--import', 'tsx', '-e', "await import('./src/config/env.ts')"], {
      cwd: new URL('..', import.meta.url).pathname,
      env: { PATH: process.env.PATH, NODE_ENV: 'test', DATABASE_URL: 'postgres://x@127.0.0.1:1/x', FRONTEND_DIST: vazia },
      encoding: 'utf8',
    })
    rmSync(vazia, { recursive: true, force: true })
    assert.notEqual(processo.status, 0)
    assert.match(processo.stderr, /FRONTEND_DIST precisa apontar para a pasta do build do frontend/)
    assert.equal(processo.stderr.includes(vazia), false, 'a mensagem repetiu o caminho')
  })
})
