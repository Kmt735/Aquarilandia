import { env } from '../config/env.js'

// Envio de e-mail (D-09, D-54). Provedor: Resend, pela API HTTP com o fetch nativo (nenhum pacote novo).
// Só TEXTO: nenhum e-mail sai em HTML, então o nome ou o endereço de um cliente nunca viram marcação no e-mail.
// Quem chama manda DEPOIS do COMMIT e sem esperar (void ... .catch): uma falha aqui nunca desfaz a operação nem muda
// a resposta da rota, e o log de quem chama não leva o e-mail do cliente.
// As mensagens de erro daqui nunca repetem a chave, o destinatário nem o texto (pode ter o link com o token).
export interface MensagemEmail {
  para: string
  assunto: string
  texto: string
}

const urlResend = 'https://api.resend.com/emails'
const timeoutMs = 10_000

// Em produção o env.ts já exige EMAIL_API_KEY e EMAIL_REMETENTE (D-54): este aviso fica só como defesa, se alguém
// carregar o módulo com o env montado à mão
if (env.nodeEnv === 'production' && !env.emailApiKey) {
  console.warn('[email] EMAIL_API_KEY ausente: e-mails não serão enviados.')
}

// Erro comum (não AppError): mensagem inválida é erro de programação, não do usuário.
// As mensagens de erro nunca repetem o valor recebido (pode ser o e-mail do cliente ou o texto com o token).
function validarMensagem(mensagem: MensagemEmail): void {
  const { para, assunto, texto } = mensagem

  // \r e \n no destinatário ou no assunto permitem injeção de cabeçalho: um "\r\nBcc: outro@..." escondido
  // no endereço viraria um destinatário extra. Recusa antes de qualquer outra coisa.
  if (typeof para !== 'string' || /[\r\n]/.test(para)) throw new Error('E-mail inválido: "para" com quebra de linha.')
  if (typeof assunto !== 'string' || /[\r\n]/.test(assunto)) {
    throw new Error('E-mail inválido: "assunto" com quebra de linha.')
  }

  // Um único endereço: um @, algo antes e depois, sem espaço e sem separador de lista (, ;)
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+$/.test(para)) {
    throw new Error('E-mail inválido: "para" precisa ser um único endereço, com @ e sem espaços.')
  }
  if (assunto.trim() === '') throw new Error('E-mail inválido: "assunto" obrigatório.')
  if (assunto.length > 200) throw new Error('E-mail inválido: "assunto" com mais de 200 caracteres.')
  if (typeof texto !== 'string' || texto.trim() === '') throw new Error('E-mail inválido: "texto" obrigatório.')
  // Só texto (D-54): um html vindo de quem chama é erro de programação, nunca é enviado
  if ((mensagem as MensagemEmail & { html?: unknown }).html !== undefined) {
    throw new Error('E-mail inválido: só texto; "html" não é enviado.')
  }
}

// POST https://api.resend.com/emails com { from, to: [para], subject, text }. Erro de rede, timeout ou HTTP fora de 2xx
// → Error com uma mensagem curta e o status, nunca a chave nem o corpo (o do pedido ou o da resposta)
async function enviarPeloProvedor(mensagem: MensagemEmail, chave: string): Promise<void> {
  const remetente = env.emailRemetente
  if (!remetente) throw new Error('Remetente de e-mail não configurado.')

  let resposta: Response
  try {
    resposta = await fetch(urlResend, {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ from: remetente, to: [mensagem.para], subject: mensagem.assunto, text: mensagem.texto }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err) {
    const tempoEsgotado = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    throw new Error(tempoEsgotado ? 'Provedor de e-mail sem resposta em 10 s.' : 'Provedor de e-mail inacessível.')
  }
  // O corpo da resposta não é lido nem repassado (pode repetir o destinatário)
  await resposta.body?.cancel().catch(() => undefined)
  if (!resposta.ok) throw new Error(`Provedor de e-mail recusou o envio: HTTP ${resposta.status}.`)
}

export async function enviarEmail(mensagem: MensagemEmail): Promise<void> {
  validarMensagem(mensagem)

  if (env.emailApiKey) return enviarPeloProvedor(mensagem, env.emailApiKey)

  // Produção sem chave (o env.ts já impede): nada do conteúdo vai para o log (o e-mail da recuperação leva o token)
  if (env.nodeEnv === 'production') throw new Error('Provedor de e-mail não configurado.')

  // Desenvolvimento sem chave: o e-mail aparece no terminal, o que permite testar a recuperação de senha sem provedor
  console.info(`[email:dev] para ${mensagem.para} | assunto ${mensagem.assunto} | texto ${mensagem.texto}`)
}
