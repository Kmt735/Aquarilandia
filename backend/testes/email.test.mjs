import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { env } from '../src/config/env.ts'
import { enviarEmail } from '../src/utils/email.ts'

// O email.ts lê env.nodeEnv e env.emailApiKey na hora de cada envio, então os modos são trocados mexendo no
// objeto env (o mesmo que o módulo importa). Só o aviso de carga roda uma vez, no import: para testá-lo, o
// módulo é importado de novo com um parâmetro de busca diferente na URL, o que cria uma instância nova do
// módulo (o env.ts, com a URL de sempre, continua o mesmo objeto).
const original = { nodeEnv: env.nodeEnv, emailApiKey: env.emailApiKey, emailRemetente: env.emailRemetente, fetch: globalThis.fetch }
const mensagem = {
  para: 'cliente.teste@exemplo.com',
  assunto: 'Redefinir sua senha',
  texto: 'Use o link https://exemplo.test/redefinir?token=TOKEN-SECRETO-DE-TESTE',
}
const metodos = ['debug', 'error', 'info', 'log', 'warn']
let espioes

beforeEach(() => {
  espioes = Object.fromEntries(metodos.map((nome) => [nome, mock.method(console, nome, () => {})]))
})
afterEach(() => {
  mock.restoreAll()
  env.nodeEnv = original.nodeEnv
  env.emailApiKey = original.emailApiKey
  env.emailRemetente = original.emailRemetente
  globalThis.fetch = original.fetch
})
const chamadas = (nome) => espioes[nome].mock.calls.map((chamada) => chamada.arguments.join(' '))
const tudoQueFoiImpresso = () => metodos.flatMap(chamadas).join('\n')

describe('E-mail — enviarEmail (#19a; desde o Lote 14a, com o Resend)', () => {
  it('desenvolvimento sem chave: imprime o e-mail com [email:dev] e resolve', async () => {
    env.nodeEnv = 'development'; env.emailApiKey = undefined
    await enviarEmail(mensagem)
    assert.equal(espioes.info.mock.callCount(), 1)
    const [linha] = chamadas('info')
    assert.ok(linha.startsWith('[email:dev] '))
    for (const parte of [mensagem.para, mensagem.assunto, mensagem.texto]) assert.ok(linha.includes(parte))
  })

  it('desenvolvimento com chave vazia também imprime (chave vazia = sem chave)', async () => {
    env.nodeEnv = 'development'; env.emailApiKey = ''
    await enviarEmail(mensagem)
    assert.equal(espioes.info.mock.callCount(), 1)
  })

  it('produção sem chave: lança erro e não imprime nada do conteúdo', async () => {
    env.nodeEnv = 'production'; env.emailApiKey = undefined
    await assert.rejects(enviarEmail(mensagem), { message: 'Provedor de e-mail não configurado.' })
    assert.equal(espioes.info.mock.callCount(), 0)
    assert.equal(espioes.log.mock.callCount(), 0)
    const impresso = tudoQueFoiImpresso()
    for (const parte of [mensagem.para, mensagem.assunto, 'TOKEN-SECRETO-DE-TESTE']) {
      assert.equal(impresso.includes(parte), false)
    }
  })

  // Lote 14a: antes, "com chave: lança 'provedor ainda não escolhido' sem imprimir". Agora a chave envia pelo Resend
  for (const nodeEnv of ['development', 'production']) {
    it(`com chave (${nodeEnv}): envia pelo Resend (fetch falso) sem imprimir`, async () => {
      env.nodeEnv = nodeEnv; env.emailApiKey = 'chave-ficticia-de-teste'; env.emailRemetente = 'Loja <loja@remetente.example>'
      const pedidos = []
      globalThis.fetch = async (url, opcoes) => { pedidos.push({ url, opcoes }); return new Response('{"id":"x"}', { status: 200 }) }
      await enviarEmail(mensagem)
      assert.equal(pedidos.length, 1)
      assert.equal(tudoQueFoiImpresso(), '')
    })
  }

  describe('mensagem inválida: erro antes de qualquer envio ou impressão', () => {
    for (const [descricao, alteracao, erro] of [
      ['para com \\n (injeção de cabeçalho)', { para: 'cliente@exemplo.com\nBcc: outro@exemplo.com' }, /quebra de linha/],
      ['para com \\r\\n', { para: 'cliente@exemplo.com\r\nBcc: outro@exemplo.com' }, /quebra de linha/],
      ['assunto com \\r', { assunto: 'Oi\rBcc: outro@exemplo.com' }, /quebra de linha/],
      ['assunto com \\n', { assunto: 'Oi\nBcc: outro@exemplo.com' }, /quebra de linha/],
      ['para sem @', { para: 'cliente.exemplo.com' }, /único endereço/],
      ['para com espaço', { para: 'cliente @exemplo.com' }, /único endereço/],
      ['para com dois endereços', { para: 'a@exemplo.com,b@exemplo.com' }, /único endereço/],
      ['para com dois @', { para: 'a@b@exemplo.com' }, /único endereço/],
      ['para vazio', { para: '' }, /único endereço/],
      ['assunto vazio', { assunto: '   ' }, /assunto/],
      ['assunto com 201 caracteres', { assunto: 'a'.repeat(201) }, /200 caracteres/],
      ['texto vazio', { texto: '' }, /texto/],
      ['texto ausente', { texto: undefined }, /texto/],
      ['html que não é texto', { html: 123 }, /html/],
    ]) {
      for (const [modo, chave] of [['development', undefined], ['production', 'chave-ficticia-de-teste']]) {
        it(`${descricao} (${modo})`, async () => {
          env.nodeEnv = modo; env.emailApiKey = chave
          await assert.rejects(enviarEmail({ ...mensagem, ...alteracao }), (err) => {
            assert.equal(err.constructor, Error, 'Error comum, não AppError')
            assert.match(err.message, erro)
            assert.doesNotMatch(err.message, /Provedor/, 'parou na validação, antes do envio')
            assert.equal(err.message.includes('outro@exemplo.com'), false, 'a mensagem não repete o valor')
            return true
          })
          assert.equal(tudoQueFoiImpresso(), '')
        })
      }
    }
    it('assunto com exatamente 200 caracteres é aceito', async () => {
      env.nodeEnv = 'development'; env.emailApiKey = undefined
      await enviarEmail({ ...mensagem, assunto: 'a'.repeat(200) })
      assert.equal(espioes.info.mock.callCount(), 1)
    })
  })

  describe('aviso de carga do módulo', () => {
    let recarga = 0
    const carregar = () => import(`../src/utils/email.ts?recarga=${++recarga}`)
    it('produção sem chave: um console.warn único e sem dados', async () => {
      env.nodeEnv = 'production'; env.emailApiKey = undefined
      await carregar()
      assert.deepEqual(chamadas('warn'), ['[email] EMAIL_API_KEY ausente: e-mails não serão enviados.'])
    })
    it('produção com chave e desenvolvimento sem chave: sem aviso', async () => {
      env.nodeEnv = 'production'; env.emailApiKey = 'chave-ficticia-de-teste'
      await carregar()
      env.nodeEnv = 'development'; env.emailApiKey = undefined
      await carregar()
      assert.equal(espioes.warn.mock.callCount(), 0)
    })
  })
})

describe('E-mail — Resend pela API HTTP (Lote 14a, D-54)', () => {
  const chave = 're_CHAVE_FICTICIA_DE_TESTE_123456'
  const remetente = 'Aquarilândia <nao-responda@loja.example>'
  let pedidos
  beforeEach(() => {
    env.nodeEnv = 'production'; env.emailApiKey = chave; env.emailRemetente = remetente
    pedidos = []
  })
  const responder = (status, corpo = '{"id":"4ef9a417-02e9-4d39-ad75-9611e0fcc33c"}') => {
    globalThis.fetch = async (url, opcoes) => { pedidos.push({ url, opcoes }); return new Response(corpo, { status }) }
  }

  it('POST https://api.resend.com/emails com Bearer, JSON { from, to: [para], subject, text } e mais nada (sem html)', async () => {
    responder(200)
    const timeout = mock.method(AbortSignal, 'timeout')
    await enviarEmail(mensagem)
    assert.equal(pedidos.length, 1)
    const [{ url, opcoes }] = pedidos
    assert.equal(url, 'https://api.resend.com/emails')
    assert.equal(opcoes.method, 'POST')
    assert.equal(opcoes.headers.Authorization, `Bearer ${chave}`)
    assert.equal(opcoes.headers['Content-Type'], 'application/json')
    assert.deepEqual(JSON.parse(opcoes.body), { from: remetente, to: [mensagem.para], subject: mensagem.assunto, text: mensagem.texto })
    assert.ok(opcoes.signal instanceof AbortSignal)
    assert.deepEqual(timeout.mock.calls.map((c) => c.arguments), [[10000]], 'timeout de 10 s')
    assert.equal(tudoQueFoiImpresso(), '')
  })

  for (const status of [400, 401, 403, 422, 429, 500, 503]) {
    it(`HTTP ${status} → Error curto com o status, sem a chave, o destinatário, o texto nem o corpo da resposta`, async () => {
      responder(status, JSON.stringify({ name: 'validation_error', message: `chave ${chave} inválida para ${mensagem.para}` }))
      await assert.rejects(enviarEmail(mensagem), (err) => {
        assert.equal(err.message, `Provedor de e-mail recusou o envio: HTTP ${status}.`)
        for (const proibido of [chave, mensagem.para, 'TOKEN-SECRETO-DE-TESTE', 'validation_error']) {
          assert.equal(err.message.includes(proibido), false, proibido)
        }
        return true
      })
      assert.equal(tudoQueFoiImpresso(), '')
    })
  }

  it('timeout (o fetch aborta) → "sem resposta em 10 s"; falha de rede → "inacessível"; sem dados', async () => {
    globalThis.fetch = async () => { throw new DOMException('The operation timed out.', 'TimeoutError') }
    await assert.rejects(enviarEmail(mensagem), { message: 'Provedor de e-mail sem resposta em 10 s.' })
    globalThis.fetch = async () => { throw new TypeError(`fetch failed ${chave}`) }
    await assert.rejects(enviarEmail(mensagem), (err) => err.message === 'Provedor de e-mail inacessível.' && !err.message.includes(chave))
  })

  it('com a chave e sem o remetente → Error, sem chamar o fetch', async () => {
    responder(200)
    env.emailRemetente = undefined
    await assert.rejects(enviarEmail(mensagem), { message: 'Remetente de e-mail não configurado.' })
    assert.equal(pedidos.length, 0)
  })

  it('mensagem com html → recusada antes do envio (só texto)', async () => {
    responder(200)
    await assert.rejects(enviarEmail({ ...mensagem, html: '<b>oi</b>' }), /só texto/)
    assert.equal(pedidos.length, 0)
  })
})
