import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { it } from 'node:test'

const executar = promisify(execFile)
const raiz = fileURLToPath(new URL('../..', import.meta.url))
const base = { PATH: process.env.PATH, NODE_ENV: 'test', DATABASE_URL: 'postgres://fixture@127.0.0.1:1/fixture' }
const carregar = (extras = {}) => executar(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
  "const {env}=await import('./src/config/env.ts'); console.log(env.imagensDir ?? 'ausente')"],
{ cwd: join(raiz, 'backend'), env: { ...base, ...extras }, timeout: 10000 })

it('IMAGENS_DIR é opcional e aceita diretório externo temporário somente para testes', async () => {
  assert.equal((await carregar()).stdout.trim(), 'ausente')
  assert.equal((await carregar({ IMAGENS_DIR: '/tmp/imagem-fixture-config' })).stdout.trim(), '/tmp/imagem-fixture-config')
})
it('configuração recusa caminho relativo, raiz e fontes sem imprimir o caminho na mensagem', async () => {
  for (const IMAGENS_DIR of ['imagem-fixture-relativa', '/', join(raiz, 'backend/dist/imagens-fixture')]) {
    await assert.rejects(carregar({ IMAGENS_DIR }), (e) => {
      assert.match(e.stderr, /IMAGENS_DIR precisa ser/)
      assert.doesNotMatch(e.stderr, /imagem-fixture-relativa|dist\/imagens-fixture/)
      return true
    })
  }
})
it('configuração recusa build externo e diretório temporário em produção', async () => {
  const pasta = await mkdtemp(join(tmpdir(), 'imagem-build-fixture-'))
  try {
    await writeFile(join(pasta, 'index.html'), '<html></html>')
    await assert.rejects(carregar({ FRONTEND_DIST: pasta, IMAGENS_DIR: join(pasta, 'fotos') }), /IMAGENS_DIR precisa ser/)
    const producao = { DATABASE_URL: 'postgres://fixture:senha-ficticia-com-pelo-menos-32-caracteres@127.0.0.1:1/fixture', NODE_ENV: 'production', CORS_ORIGIN: 'https://fixture.example', FRONTEND_URL: 'https://fixture.example',
      API_URL: 'https://fixture.example', GATEWAY_ACCESS_TOKEN: 'fixture', GATEWAY_WEBHOOK_SECRET: 'f'.repeat(32),
      EMAIL_API_KEY: 'fixture', EMAIL_REMETENTE: 'fixture@fixture.example' }
    for (const IMAGENS_DIR of ['/tmp/imagem-fixture', '/var/tmp/imagem-fixture']) {
      await assert.rejects(carregar({ ...producao, IMAGENS_DIR }), /IMAGENS_DIR precisa ser/)
    }
    assert.equal((await carregar({ ...producao, IMAGENS_DIR: '/var/lib/aquarilandia/imagens' })).stdout.trim(), '/var/lib/aquarilandia/imagens')
  } finally { await rm(pasta, { recursive: true, force: true }) }
})
