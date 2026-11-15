import { existsSync } from 'node:fs'
import { isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

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

// FRONTEND_DIST (opcional, Lote 13): a pasta do build do frontend (vite build). Com ela, o backend serve o site no
// MESMO endereço da API (o cookie de sessão SameSite=Lax depende disso). Sem ela, nada muda: em desenvolvimento o
// site vem do Vite. Definida, a pasta precisa ter o index.html: um caminho errado para o servidor na subida, e não
// num 404 no meio da demonstração. A mensagem não repete o caminho
function lerFrontendDist(): string | undefined {
  const valor = opcional('FRONTEND_DIST')
  if (valor === undefined) return undefined
  const pasta = resolve(valor)
  if (!existsSync(join(pasta, 'index.html'))) {
    throw new Error('Variável de ambiente inválida: FRONTEND_DIST precisa apontar para a pasta do build do frontend (com o index.html). Veja o .env.example.')
  }
  return pasta
}

const frontendDist = lerFrontendDist()

// Opcional para a API existente; as operações de imagem respondem 503 sem configuração.
// Em operação, usar volume/diretório persistente fora do repositório, nunca /tmp.
function lerImagensDir(): string | undefined {
  const valor = opcional('IMAGENS_DIR')
  if (!valor) return undefined
  const raizProjeto = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '')
  const pasta = resolve(valor)
  if (!isAbsolute(valor) || pasta === '/' || pasta === raizProjeto || pasta.startsWith(raizProjeto + sep)
    || (frontendDist && (pasta === frontendDist || pasta.startsWith(frontendDist + sep)))
    || (producao && (pasta === '/tmp' || pasta.startsWith('/tmp/') || pasta === '/var/tmp' || pasta.startsWith('/var/tmp/')))) {
    throw new Error('Variável de ambiente inválida: IMAGENS_DIR precisa ser um diretório persistente absoluto fora do projeto. Veja o .env.example.')
  }
  return pasta
}
const imagensDir = lerImagensDir()

// PERMITIR_SIMULACAO_PIX (opcional, Lote 13): só 'true' liga a simulação de pagamento Pix pela API (a demonstração do
// dia 19 roda em produção com a chave de TESTE da AbacatePay, porque a loja ainda não tem conta). Mesmo ligada, ela
// só funciona com a chave de teste (gateway.ts). Qualquer valor que não seja true ou false é erro: um "sim" ou "1"
// não liga nada por engano
function lerPermitirSimulacaoPix(): boolean {
  const valor = opcional('PERMITIR_SIMULACAO_PIX')
  if (valor === undefined || valor === 'false') return false
  if (valor === 'true') return true
  throw new Error('Variável de ambiente inválida: PERMITIR_SIMULACAO_PIX precisa ser true ou false. Veja o .env.example.')
}

const permitirSimulacaoPix = lerPermitirSimulacaoPix()

// E-mail (Lote 14a, D-54): o envio é pelo Resend (utils/email.ts). Em produção, EMAIL_API_KEY e EMAIL_REMETENTE são
// obrigatórias: sem elas a recuperação de senha e os avisos de compra não saem, e isso tem que aparecer na subida, não
// no dia em que um cliente pedir o link. Fora de produção são opcionais (sem a chave, o e-mail aparece no terminal);
// com a chave, o remetente passa a ser obrigatório também. O remetente é "email@dominio" ou "Nome <email@dominio>",
// sem quebra de linha. Nenhuma mensagem repete o valor
const emailApiKey = obrigatoriaEmProducao('EMAIL_API_KEY')
const emailRemetente = emailApiKey === undefined ? opcional('EMAIL_REMETENTE') : obrigatoria('EMAIL_REMETENTE')
const padraoRemetente = /^(?:[^<>\r\n]{1,80} <[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+>|[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+)$/
if (emailRemetente !== undefined && !padraoRemetente.test(emailRemetente.trim())) {
  throw new Error('Variável de ambiente inválida: EMAIL_REMETENTE precisa ser um e-mail (email@dominio ou Nome <email@dominio>). Veja o .env.example.')
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
  // Obrigatórias em produção (D-54); fora dela, sem a chave o email.ts imprime o e-mail no terminal
  emailApiKey,
  emailRemetente: emailRemetente?.trim(),
  // Caminho absoluto da pasta do build do frontend, ou undefined (o site não é servido pelo backend)
  frontendDist,
  imagensDir,
  permitirSimulacaoPix,
}
