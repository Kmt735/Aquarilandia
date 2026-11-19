import assert from 'node:assert/strict'
import { test } from 'node:test'
import origemLocalCanonica, { redirecionarOrigemLocal } from '../vite/origem-local.mjs'

function requisitar({ host = '127.0.0.1:5173', method = 'GET', accept = 'text/html', url = '/criar-conta?voltar=%2Fminha-conta' } = {}) {
  const resultado = { proximo: false, terminou: false }
  redirecionarOrigemLocal({ headers: { host, accept }, method, url }, {
    writeHead(status, headers) { Object.assign(resultado, { status, headers }) },
    end() { resultado.terminou = true },
  }, () => { resultado.proximo = true })
  return resultado
}

test('abertura por IPv4 ou IPv6 local preserva rota e destino do login na origem configurada', () => {
  for (const host of ['127.0.0.1:5173', '[::1]:5173']) {
    const r = requisitar({ host })
    assert.equal(r.status, 307)
    assert.equal(r.headers.Location, 'http://localhost:5173/criar-conta?voltar=%2Fminha-conta')
    assert.equal(r.headers['Cache-Control'], 'no-store')
    assert.equal(r.terminou, true); assert.equal(r.proximo, false)
  }
})
test('API, envios de formulário e assets continuam chegando aos handlers originais', () => {
  for (const dados of [{ url: '/api/auth/cadastro' }, { url: '/api?teste=1' }, { method: 'POST' }, { accept: 'application/json' }, { accept: '*/*' }]) {
    assert.equal(requisitar(dados).proximo, true)
  }
})
test('não redireciona outros hosts, portas ou a origem já correta', () => {
  for (const host of ['localhost:5173', '127.0.0.1:5174', '127.0.0.1.evil.example:5173', 'evil.example:5173']) {
    assert.equal(requisitar({ host }).proximo, true)
  }
})
test('servidores efêmeros e HTTPS conservam a própria configuração de origem', () => {
  for (const server of [{ port: 0 }, { port: 5173, https: {} }]) {
    let instalou = false
    origemLocalCanonica().configureServer({ config: { server }, middlewares: { use() { instalou = true } } })
    assert.equal(instalou, false)
  }
})
