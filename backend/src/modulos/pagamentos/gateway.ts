// Único arquivo que fala com a AbacatePay (D-20). Usa o fetch nativo do Node, sem SDK, e expõe só tipos do projeto:
// nenhum nome da AbacatePay (brCode, PENDING...) sai daqui, exceto o id da cobrança, tratado como texto opaco.
// A AbacatePay já trabalha em centavos (amount = 10000 é R$ 100,00), como o projeto (D-04): não há conversão.
// Os logs só levam a operação e o status HTTP: nunca o token, o corpo das respostas (pode ter dados do cliente)
// nem o código Pix.
import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'

const baseUrl = 'https://api.abacatepay.com/v2'
const timeoutMs = 5000
const msgIndisponivel = 'Não foi possível falar com o pagamento agora. Tente de novo em instantes.'
// Todo id de cobrança Pix recebido de fora passa por aqui antes de ir para uma URL ou um body
const padraoCobrancaId = /^pix_char_[A-Za-z0-9]+$/
// Códigos de erro da AbacatePay (ex.: INSUFFICIENT_FUNDS) podem ir para o log e para estorno_ultimo_erro
const padraoCodigoErro = /^[A-Z][A-Z_]{2,49}$/
const msgJaReembolsada = 'Esta cobrança já foi reembolsada.'
// Mensagens em texto que a API devolve no lugar do código documentado, traduzidas para um código curto.
// Texto que não está aqui nunca vai para o log nem para o banco: vira 'HTTP <status>'.
const codigosDeMensagens: Readonly<Record<string, string>> = {
  // Visto no Dev mode (02/11/2026): a documentação promete INSUFFICIENT_FUNDS, a API manda este texto
  'Saldo insuficiente para realizar o reembolso.': 'INSUFFICIENT_FUNDS',
}

// Os status de pagamento do projeto (CHECK de pagamentos.status, db/init/20_vendas.sql)
export type StatusCobranca = 'pendente' | 'aprovado' | 'recusado' | 'estornado' | 'cancelado' | 'em_disputa'

export interface NovaCobrancaPix {
  pagamentoId: number
  vendaId: number
  valor: number
  expiraEm: Date
}

export interface CobrancaPix {
  cobrancaId: string
  status: StatusCobranca
  codigoPix: string
  qrCodeImagem: string
  expiraEm: Date
}

export interface ConsultaCobranca {
  cobrancaId: string
  status: StatusCobranca
  valor: number
  externalId: string | null
  vendaId: number | null
  pagamentoId: number | null
}

export interface ResultadoEstorno {
  aprovado: boolean
  jaEstornado: boolean
  erro?: string
}

// Mapa FIXO da AbacatePay para o projeto. O que não está aqui (ex.: REDEEMED, documentado sem explicação) é
// desconhecido e vira 502: um status que não entendemos nunca pode virar "aprovado" por padrão.
const statusDaAbacatePay: Readonly<Record<string, StatusCobranca>> = {
  PENDING: 'pendente',
  PAID: 'aprovado',
  APPROVED: 'aprovado',
  // Pix expirado ou cancelado não foi pago e não vai ser (o comentário do 20_vendas.sql: cancelled → cancelado)
  EXPIRED: 'cancelado',
  CANCELLED: 'cancelado',
  FAILED: 'recusado',
  REFUNDED: 'estornado',
  // Disputa aberta (chargeback): o dinheiro está em questão, nem aprovado nem estornado; o banco tem em_disputa
  UNDER_DISPUTE: 'em_disputa',
}

class FalhaGateway extends Error {
  constructor(public readonly codigo: string) {
    super(codigo)
    this.name = 'FalhaGateway'
  }
}

function indisponivel(): AppError {
  return new AppError(msgIndisponivel, 502)
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function conferirCobrancaId(cobrancaId: unknown): string {
  if (typeof cobrancaId !== 'string' || !padraoCobrancaId.test(cobrancaId)) {
    throw new Error('Id de cobrança fora do padrão pix_char_.')
  }
  return cobrancaId
}

function paraStatusDoProjeto(operacao: string, status: unknown): StatusCobranca {
  if (typeof status === 'string' && Object.hasOwn(statusDaAbacatePay, status)) return statusDaAbacatePay[status]
  // O valor só vai para o log se parecer um código (letras maiúsculas e _), nunca um texto qualquer de fora
  const exibido = typeof status === 'string' && padraoCodigoErro.test(status) ? ` ${status}` : ''
  console.error(`[gateway] ${operacao}: status desconhecido${exibido}`)
  throw indisponivel()
}

interface Chamada {
  metodo: 'GET' | 'POST'
  caminho: string
  query?: Record<string, string>
  body?: Record<string, unknown>
}

// Faz a chamada e devolve o data de uma resposta { success: true, data }. Qualquer outra coisa vira FalhaGateway,
// com um código curto e sem dados: 'HTTP 503', 'sem resposta', 'resposta inválida' ou o código de erro da API.
async function chamar(operacao: string, chamada: Chamada): Promise<unknown> {
  const token = env.gatewayAccessToken
  if (!token) {
    console.error('[gateway] GATEWAY_ACCESS_TOKEN ausente')
    throw new FalhaGateway('sem chave')
  }

  // URLSearchParams escapa os valores: nada de concatenação crua na URL
  const query = chamada.query ? `?${new URLSearchParams(chamada.query).toString()}` : ''
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  if (chamada.body) headers['Content-Type'] = 'application/json'

  let resposta: Response
  let json: unknown
  try {
    resposta = await fetch(`${baseUrl}${chamada.caminho}${query}`, {
      method: chamada.metodo,
      headers,
      body: chamada.body ? JSON.stringify(chamada.body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
    json = await resposta.json().catch(() => null)
  } catch {
    console.error(`[gateway] ${operacao}: sem resposta (rede ou timeout)`)
    throw new FalhaGateway('sem resposta')
  }

  if (!resposta.ok) {
    console.error(`[gateway] ${operacao}: HTTP ${resposta.status}`)
    const erro = ehObjeto(json) && typeof json.error === 'string' ? json.error : null
    if (erro === msgJaReembolsada) throw new FalhaGateway(msgJaReembolsada)
    if (erro && Object.hasOwn(codigosDeMensagens, erro)) throw new FalhaGateway(codigosDeMensagens[erro])
    throw new FalhaGateway(erro && padraoCodigoErro.test(erro) ? erro : `HTTP ${resposta.status}`)
  }
  // A documentação manda conferir success antes de usar data, sem confiar só no status HTTP
  if (!ehObjeto(json) || json.success !== true || !('data' in json)) {
    console.error(`[gateway] ${operacao}: resposta inválida`)
    throw new FalhaGateway('resposta inválida')
  }
  return json.data
}

// Funções 1, 2 e 4: qualquer falha do gateway vira o 502 de sempre (o log já foi feito em chamar)
async function chamarOu502(operacao: string, chamada: Chamada): Promise<unknown> {
  try {
    return await chamar(operacao, chamada)
  } catch (err) {
    if (err instanceof FalhaGateway) throw indisponivel()
    throw err
  }
}

function respostaInvalida(operacao: string): AppError {
  console.error(`[gateway] ${operacao}: resposta inválida`)
  return indisponivel()
}

function inteiroPositivo(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isSafeInteger(valor) && valor > 0 ? valor : null
  // metadata pode voltar como texto
  if (typeof valor === 'string' && /^[1-9][0-9]{0,14}$/.test(valor)) return Number(valor)
  return null
}

export async function criarCobrancaPix(entrada: NovaCobrancaPix): Promise<CobrancaPix> {
  const { pagamentoId, vendaId, valor, expiraEm } = entrada
  if (!Number.isSafeInteger(valor)) throw new Error('Valor da cobrança precisa ser um inteiro em centavos.')
  if (valor < 100) throw new AppError('O valor mínimo para pagar com Pix é R$ 1,00.', 422)
  if (!Number.isSafeInteger(pagamentoId) || pagamentoId < 1 || !Number.isSafeInteger(vendaId) || vendaId < 1) {
    throw new Error('pagamentoId e vendaId precisam ser inteiros positivos.')
  }
  if (!(expiraEm instanceof Date) || Number.isNaN(expiraEm.getTime())) throw new Error('expiraEm inválido.')
  const expiresIn = Math.floor((expiraEm.getTime() - Date.now()) / 1000)
  // Quem chama (#44) responde o 409 antes; chegar aqui com menos de 1 minuto é erro de programação
  if (expiresIn < 60) throw new Error('A cobrança Pix precisa de pelo menos 60 segundos até expirar.')

  const data = await chamarOu502('criar', {
    metodo: 'POST',
    caminho: '/transparents/create',
    body: {
      method: 'PIX',
      data: {
        amount: valor,
        expiresIn,
        description: `Aquarilândia: pedido #${vendaId}`,
        // Um externalId por pagamento: a AbacatePay o documenta como chave de idempotência
        externalId: `pagamento-${pagamentoId}`,
        metadata: { vendaId, pagamentoId },
        // Sem customer: não coletamos CPF (D-31)
      },
    },
  })

  if (!ehObjeto(data)) throw respostaInvalida('criar')
  const { id, status, brCode, brCodeBase64, expiresAt, amount } = data
  const expira = typeof expiresAt === 'string' ? new Date(expiresAt) : null
  if (
    typeof id !== 'string' || !padraoCobrancaId.test(id) ||
    typeof brCode !== 'string' || brCode === '' ||
    // A imagem vai para um <img src> no frontend: só aceita um data URL de imagem
    typeof brCodeBase64 !== 'string' || !brCodeBase64.startsWith('data:image/') ||
    !expira || Number.isNaN(expira.getTime()) ||
    amount !== valor
  ) {
    throw respostaInvalida('criar')
  }
  return {
    cobrancaId: id,
    status: paraStatusDoProjeto('criar', status),
    codigoPix: brCode,
    qrCodeImagem: brCodeBase64,
    expiraEm: expira,
  }
}

// Reconsulta da #45/#47: o webhook nunca é confiado sozinho, o status vem sempre desta consulta.
// O metadata (vendaId, pagamentoId) é só uma conferência extra: na #47 o pagamento é achado no NOSSO banco pelo
// cobrancaId (pagamentos.gateway_cobranca_id) e o valor desta consulta é comparado com o valor gravado.
// Nunca se decide qual venda foi paga pelo metadata.
// Usa GET /transparents/list?id= porque o /transparents/check devolve só id, status e expiração, sem valor.
export async function consultarCobranca(cobrancaId: string): Promise<ConsultaCobranca> {
  const id = conferirCobrancaId(cobrancaId)
  const data = await chamarOu502('consultar', { metodo: 'GET', caminho: '/transparents/list', query: { id } })

  if (!Array.isArray(data)) throw respostaInvalida('consultar')
  const encontradas = data.filter((item) => ehObjeto(item) && item.id === id)
  if (encontradas.length !== 1) throw respostaInvalida('consultar')
  const cobranca = encontradas[0] as Record<string, unknown>
  const { amount, status, externalId, metadata } = cobranca
  if (!Number.isSafeInteger(amount) || (amount as number) < 0) throw respostaInvalida('consultar')

  const extra = ehObjeto(metadata) ? metadata : {}
  return {
    cobrancaId: id,
    status: paraStatusDoProjeto('consultar', status),
    valor: amount as number,
    externalId: typeof externalId === 'string' ? externalId : null,
    vendaId: inteiroPositivo(extra.vendaId),
    pagamentoId: inteiroPositivo(extra.pagamentoId),
  }
}

// Só o status, pela rota feita para isso (GET /transparents/check). Hoje usada pelo script de Dev mode para
// conferir que a listagem e o check concordam; se um dia divergirem, consultarCobranca passa a usar esta.
export async function consultarStatusCobranca(cobrancaId: string): Promise<StatusCobranca> {
  const id = conferirCobrancaId(cobrancaId)
  const data = await chamarOu502('consultar-status', { metodo: 'GET', caminho: '/transparents/check', query: { id } })
  if (!ehObjeto(data) || data.id !== id) throw respostaInvalida('consultar-status')
  return paraStatusDoProjeto('consultar-status', data.status)
}

// NUNCA lança por falha do gateway: devolve aprovado false com um erro curto (sem dados pessoais), porque quem
// chama registra a tentativa (pagamentos.estorno_tentativas e estorno_ultimo_erro; #35, #47, #49).
// A AbacatePay não documenta chave de idempotência no estorno. Repetir é seguro porque ela recusa o segundo com
// 'Esta cobrança já foi reembolsada.', tratado como sucesso. Só existe estorno total, o que serve ao cancelamento.
export async function estornar(cobrancaId: string, motivo?: string): Promise<ResultadoEstorno> {
  const id = conferirCobrancaId(cobrancaId)
  if (motivo !== undefined && (typeof motivo !== 'string' || motivo.length > 500)) {
    throw new Error('Motivo do estorno precisa ter até 500 caracteres.')
  }

  try {
    const data = await chamar('estornar', {
      metodo: 'POST',
      caminho: '/transparents/refund',
      body: motivo ? { id, reason: motivo } : { id },
    })
    if (!ehObjeto(data) || data.originalId !== id) {
      console.error('[gateway] estornar: resposta inválida')
      return { aprovado: false, jaEstornado: false, erro: 'resposta inválida' }
    }
    return { aprovado: true, jaEstornado: false }
  } catch (err) {
    if (err instanceof FalhaGateway && err.codigo === msgJaReembolsada) return { aprovado: true, jaEstornado: true }
    return { aprovado: false, jaEstornado: false, erro: err instanceof FalhaGateway ? err.codigo : 'erro inesperado' }
  }
}

// Só para testes em Dev mode: em produção a AbacatePay recusa, e aqui nem chega a chamar
export async function simularPagamentoPix(cobrancaId: string): Promise<void> {
  if (env.nodeEnv === 'production') throw new Error('Simular pagamento só existe fora de produção (Dev mode).')
  const id = conferirCobrancaId(cobrancaId)
  await chamarOu502('simular', { metodo: 'POST', caminho: '/transparents/simulate-payment', query: { id } })
}
