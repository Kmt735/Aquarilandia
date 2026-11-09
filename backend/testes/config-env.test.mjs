import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

// D-52: o env.ts valida o ambiente ao ser carregado e o servidor não sobe sem as variáveis obrigatórias.
// Cada caso sobe o src/server.ts num processo próprio, com um ambiente montado do zero (só PATH e as variáveis do
// caso): nada do process.env deste runner, do shell ou do .env vaza para o filho. PORT=0 evita disputar porta se
// a validação falhar em barrar; o timeout derruba o filho nesse caso e o teste acusa.
// Os valores são sentinelas fictícias: o teste confere que nenhuma delas aparece na saída.

const raiz = fileURLToPath(new URL('..', import.meta.url))

const desenvolvimento = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://usuario-sentinela:senha-sentinela-db@127.0.0.1:1/banco_sentinela',
  PORT: '0',
}
const producao = {
  ...desenvolvimento,
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://cors-sentinela.example',
  FRONTEND_URL: 'https://frontend-sentinela.example',
  API_URL: 'https://api-sentinela.example',
  GATEWAY_ACCESS_TOKEN: 'token-sentinela-do-gateway',
  GATEWAY_WEBHOOK_SECRET: 'segredo-sentinela-do-webhook-com-mais-de-32-caracteres',
}

function sem(base, ...nomes) {
  const copia = { ...base }
  for (const nome of nomes) delete copia[nome]
  return copia
}

function executar(args, variaveis) {
  return new Promise((resolve) => {
    execFile(process.execPath, ['--import', 'tsx', ...args], {
      cwd: raiz, env: { PATH: process.env.PATH, ...variaveis }, timeout: 15000,
    }, (erro, stdout, stderr) => resolve({ codigo: erro ? (erro.code ?? erro.signal) : 0, morto: Boolean(erro?.killed), saida: stdout + stderr }))
  })
}

const subirServidor = (variaveis) => executar(['src/server.ts'], variaveis)
// Controle positivo: só carrega o env.ts e imprime o que leu, sem abrir porta
const carregarEnv = (variaveis) => executar(['--input-type=module', '-e',
  "const { env } = await import('./src/config/env.ts'); console.log(JSON.stringify({ nodeEnv: env.nodeEnv, port: env.port, corsOrigin: env.corsOrigin }))"], variaveis)

// Nenhum valor passado ao filho pode aparecer na saída (o nome da variável pode)
function semValores(saida, variaveis) {
  for (const [nome, valor] of Object.entries(variaveis)) {
    // development/test/production e o PORT=0 aparecem em qualquer texto; os demais são sentinelas únicas
    if (['development', 'test', 'production'].includes(valor) || valor.length < 8) continue
    assert.equal(saida.includes(valor), false, `a saída repetiu o valor de ${nome}`)
  }
}

async function naoSobe(variaveis, mensagem) {
  const r = await subirServidor(variaveis)
  assert.equal(r.morto, false, 'o servidor subiu (o processo só parou pelo timeout)')
  assert.notEqual(r.codigo, 0)
  assert.equal(r.saida.includes('rodando em'), false)
  assert.ok(r.saida.includes(mensagem), `a saída não traz "${mensagem}"`)
  semValores(r.saida, variaveis)
}

describe('env.ts — falhar cedo (D-52)', { concurrency: true }, () => {
  it('sem NODE_ENV o servidor não sobe e a mensagem cita NODE_ENV', () =>
    naoSobe(sem(desenvolvimento, 'NODE_ENV'), 'Variável de ambiente obrigatória ausente: NODE_ENV. Veja o .env.example.'))

  it('NODE_ENV vazia conta como ausente', () =>
    naoSobe({ ...desenvolvimento, NODE_ENV: '' }, 'Variável de ambiente obrigatória ausente: NODE_ENV.'))

  it('NODE_ENV fora de development/test/production não sobe e não repete o valor', () =>
    naoSobe({ ...desenvolvimento, NODE_ENV: 'ambiente-sentinela-invalido' }, 'NODE_ENV precisa ser development, test ou production'))

  it('sem DATABASE_URL o servidor não sobe', () =>
    naoSobe(sem(desenvolvimento, 'DATABASE_URL'), 'Variável de ambiente obrigatória ausente: DATABASE_URL.'))

  it('DATABASE_URL vazia ou só com espaços também não sobe', async () => {
    await naoSobe({ ...desenvolvimento, DATABASE_URL: '' }, 'Variável de ambiente obrigatória ausente: DATABASE_URL.')
    await naoSobe({ ...desenvolvimento, DATABASE_URL: '   ' }, 'Variável de ambiente obrigatória ausente: DATABASE_URL.')
  })

  it('PORT inválida não sobe', () =>
    naoSobe({ ...desenvolvimento, PORT: 'porta-sentinela' }, 'PORT precisa ser um número de 0 a 65535'))

  for (const nome of ['CORS_ORIGIN', 'FRONTEND_URL', 'API_URL', 'GATEWAY_ACCESS_TOKEN', 'GATEWAY_WEBHOOK_SECRET']) {
    it(`em produção sem ${nome} não sobe`, () =>
      naoSobe(sem(producao, nome), `Variável de ambiente obrigatória ausente: ${nome}.`))
  }

  it('em produção com GATEWAY_WEBHOOK_SECRET curto (31 caracteres) não sobe e não repete o segredo', () =>
    naoSobe({ ...producao, GATEWAY_WEBHOOK_SECRET: 'segredo-sentinela-com-31-chars!' },
      'GATEWAY_WEBHOOK_SECRET precisa ter pelo menos 32 caracteres em produção'))

  for (const nome of ['CORS_ORIGIN', 'FRONTEND_URL', 'API_URL']) {
    it(`em produção com ${nome} em http:// não sobe`, () =>
      naoSobe({ ...producao, [nome]: 'http://endereco-sentinela.example' }, `${nome} precisa começar com https:// em produção`))
  }

  it('em produção sem EMAIL_API_KEY o env carrega (o email.ts é quem avisa e recusa enviar)', async () => {
    const r = await carregarEnv(producao)
    assert.equal(r.codigo, 0, r.saida)
    assert.deepEqual(JSON.parse(r.saida), { nodeEnv: 'production', port: 0, corsOrigin: producao.CORS_ORIGIN })
  })

  it('em produção o segredo com exatamente 32 caracteres é aceito', async () => {
    const r = await carregarEnv({ ...producao, GATEWAY_WEBHOOK_SECRET: 'x'.repeat(32) })
    assert.equal(r.codigo, 0, r.saida)
  })

  it('fora de produção bastam NODE_ENV e DATABASE_URL; PORT e CORS_ORIGIN usam o padrão local', async () => {
    for (const nodeEnv of ['development', 'test']) {
      const r = await carregarEnv({ NODE_ENV: nodeEnv, DATABASE_URL: desenvolvimento.DATABASE_URL })
      assert.equal(r.codigo, 0, r.saida)
      assert.deepEqual(JSON.parse(r.saida), { nodeEnv, port: 3333, corsOrigin: 'http://localhost:5173' })
    }
  })
})
