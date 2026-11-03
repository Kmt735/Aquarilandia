import { env } from '../config/env.js'

export interface MensagemEmail {
  para: string
  assunto: string
  texto: string
  html?: string
}

// Aviso único, sem nenhum dado, quando o módulo é carregado em produção sem chave.
// Hoje nenhum módulo importa o email.ts; o aviso passa a aparecer quando a #19b importar.
if (env.nodeEnv === 'production' && !env.emailApiKey) {
  console.warn('[email] EMAIL_API_KEY ausente: e-mails não serão enviados.')
}

// Erro comum (não AppError): mensagem inválida é erro de programação, não do usuário.
// As mensagens de erro nunca repetem o valor recebido (pode ser o e-mail do cliente ou o texto com o token).
function validarMensagem(mensagem: MensagemEmail): void {
  const { para, assunto, texto, html } = mensagem

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
  if (html !== undefined && typeof html !== 'string') throw new Error('E-mail inválido: "html" precisa ser texto.')
}

// Único lugar que vai importar o SDK do provedor, quando ele for escolhido
async function enviarPeloProvedor(_mensagem: MensagemEmail): Promise<void> {
  throw new Error('Provedor de e-mail ainda não escolhido (#19a, passo 3).')
}

export async function enviarEmail(mensagem: MensagemEmail): Promise<void> {
  validarMensagem(mensagem)

  if (env.emailApiKey) return enviarPeloProvedor(mensagem)

  // Produção sem chave: nada do conteúdo vai para o log (o e-mail da recuperação de senha leva o token)
  if (env.nodeEnv === 'production') throw new Error('Provedor de e-mail não configurado.')

  // Desenvolvimento sem chave: o e-mail aparece no terminal, o que permite testar a recuperação de senha sem provedor
  console.info(`[email:dev] para ${mensagem.para} | assunto ${mensagem.assunto} | texto ${mensagem.texto}`)
}
