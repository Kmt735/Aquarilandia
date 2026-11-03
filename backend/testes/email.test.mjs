import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { env } from '../src/config/env.ts'
import { enviarEmail } from '../src/utils/email.ts'

// O email.ts lê env.nodeEnv e env.emailApiKey na hora de cada envio, então os modos são trocados mexendo no
// objeto env (o mesmo que o módulo importa). Só o aviso de carga roda uma vez, no import: para testá-lo, o
// módulo é importado de novo com um parâmetro de busca diferente na URL, o que cria uma instância nova do
// módulo (o env.ts, com a URL de sempre, continua o mesmo objeto).
const original = { nodeEnv: env.nodeEnv, emailApiKey: env.emailApiKey }
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
})
const chamadas = (nome) => espioes[nome].mock.calls.map((chamada) => chamada.arguments.join(' '))
const tudoQueFoiImpresso = () => metodos.flatMap(chamadas).join('\n')

describe('E-mail — enviarEmail (#19a, sem provedor)', () => {
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

  for (const nodeEnv of ['development', 'production']) {
    it(`com chave (${nodeEnv}): lança "provedor ainda não escolhido" sem imprimir`, async () => {
      env.nodeEnv = nodeEnv; env.emailApiKey = 'chave-ficticia-de-teste'
      await assert.rejects(enviarEmail(mensagem), { message: 'Provedor de e-mail ainda não escolhido (#19a, passo 3).' })
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
