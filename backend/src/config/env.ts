// Configuração do backend: falhar cedo (D-52).
//
// O ambiente é validado UMA vez, quando este módulo é carregado. Faltou uma variável obrigatória, ou ela veio
// com um valor proibido, e o módulo lança um Error: o processo para antes do app.listen, com uma mensagem que
// diz QUAL variável falta. Um servidor que não sobe é visto na hora; um que sobe com um padrão silencioso
// só é descoberto quando o estrago já aconteceu.
//
// NODE_ENV e DATABASE_URL não têm padrão:
// - NODE_ENV ausente virava 'development'. Em produção, isso fazia o utils/email.ts imprimir no log o link de
//   recuperação de senha (com o token), tirava o Secure do cookie sid e deixava o trust proxy desligado.
// - DATABASE_URL ausente virava o banco local com a senha publicada no GitHub. Foi assim que o
//   test:integration gravou no banco de dev.
//
// As mensagens de erro citam só o NOME da variável, nunca o valor (pode ser senha, token ou segredo).

const AMBIENTES = ['development', 'test', 'production'] as const
type Ambiente = (typeof AMBIENTES)[number]

function obrigatoria(nome: string): string {
  const valor = process.env[nome]
  if (valor === undefined || valor.trim() === '') {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}. Veja o .env.example.`)
  }
  return valor
}

// Ausente ou vazia → undefined. Uma linha "NOME=" no .env conta como ausente.
function opcional(nome: string): string | undefined {
  const valor = process.env[nome]
  return valor === undefined || valor.trim() === '' ? undefined : valor
}

function lerAmbiente(): Ambiente {
  const valor = obrigatoria('NODE_ENV')
  if (!(AMBIENTES as readonly string[]).includes(valor)) {
    throw new Error('Variável de ambiente inválida: NODE_ENV precisa ser development, test ou production. Veja o .env.example.')
  }
  return valor as Ambiente
}

function lerPorta(): number {
  const valor = opcional('PORT')
  if (valor === undefined) return 3333
  const porta = Number(valor)
  if (!/^\d+$/.test(valor) || porta > 65535) {
    throw new Error('Variável de ambiente inválida: PORT precisa ser um número de 0 a 65535. Veja o .env.example.')
  }
  return porta
}

const nodeEnv = lerAmbiente()
const databaseUrl = obrigatoria('DATABASE_URL')
const port = lerPorta()
const producao = nodeEnv === 'production'

// Em produção, obrigatória; fora dela, opcional (o padrão de desenvolvimento, quando houver, fica no campo do env)
function obrigatoriaEmProducao(nome: string): string | undefined {
  return producao ? obrigatoria(nome) : opcional(nome)
}

function exigirHttpsEmProducao(nome: string, valor: string | undefined): void {
  if (producao && !valor?.startsWith('https://')) {
    throw new Error(`Variável de ambiente inválida: ${nome} precisa começar com https:// em produção. Veja o .env.example.`)
  }
}

const corsOrigin = obrigatoriaEmProducao('CORS_ORIGIN')
const frontendUrl = obrigatoriaEmProducao('FRONTEND_URL')
const apiUrl = obrigatoriaEmProducao('API_URL')
const gatewayAccessToken = obrigatoriaEmProducao('GATEWAY_ACCESS_TOKEN')
const gatewayWebhookSecret = obrigatoriaEmProducao('GATEWAY_WEBHOOK_SECRET')

exigirHttpsEmProducao('CORS_ORIGIN', corsOrigin)
exigirHttpsEmProducao('FRONTEND_URL', frontendUrl)
exigirHttpsEmProducao('API_URL', apiUrl)
if (producao && gatewayWebhookSecret !== undefined && gatewayWebhookSecret.length < 32) {
  throw new Error('Variável de ambiente inválida: GATEWAY_WEBHOOK_SECRET precisa ter pelo menos 32 caracteres em produção. Veja o .env.example.')
}

export const env = {
  nodeEnv,
  databaseUrl,
  // Padrão 3333 em qualquer ambiente: a porta não é segredo e a hospedagem costuma definir PORT
  port,
  // Padrão só fora de produção (o Vite local); em produção já foi exigida acima, com https://
  corsOrigin: corsOrigin ?? 'http://localhost:5173',
  apiUrl,
  frontendUrl,
  // Sem token, o gateway.ts recusa a chamada ('sem chave'); sem segredo, o webhook.ts recusa toda notificação
  gatewayAccessToken,
  gatewayWebhookSecret,
  // Opcional também em produção: o email.ts avisa no log e recusa enviar sem a chave
  emailApiKey: opcional('EMAIL_API_KEY'),
  emailRemetente: opcional('EMAIL_REMETENTE'),
}
