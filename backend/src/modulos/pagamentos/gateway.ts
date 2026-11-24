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
const padraoCobrancaId = /^(?:pix_char_|bill_)[A-Za-z0-9]{1,90}$/
// Códigos de erro da AbacatePay (ex.: INSUFFICIENT_FUNDS) podem ir para o log e para estorno_ultimo_erro
const padraoCodigoErro = /^[A-Z][A-Z_]{2,49}$/
const msgJaReembolsada = 'Esta cobrança já foi reembolsada.'
// Mensagens em texto que a API devolve no lugar do código documentado, traduzidas para um código curto.
// Texto que não está aqui nunca vai para o log nem para o banco: vira 'HTTP <status>'.
const codigosDeMensagens: Readonly<Record<string, string>> = {
  // Visto no Dev mode (02/11/2026): a documentação promete INSUFFICIENT_FUNDS, a API manda este texto
  'Billing not found': 'CHECKOUT_NAO_ENCONTRADO',
  'Product with externalId already exists': 'PRODUTO_EXISTENTE',
  'CARD is not available for this store': 'CARTAO_INDISPONIVEL',
  'Saldo insuficiente para realizar o reembolso.': 'INSUFFICIENT_FUNDS',
}

// Chave de TESTE (Dev mode) da AbacatePay: começa com este prefixo. A de produção não. Conferido só pelo prefixo,
// sem guardar nem imprimir a chave
const prefixoChaveDeTeste = 'abc_dev_'

export function ehChaveDeTeste(): boolean {
  return env.gatewayAccessToken?.startsWith(prefixoChaveDeTeste) ?? false
}

// A simulação de pagamento pela API (POST /api/pagamentos/:id/simular, Lote 13) exige as DUAS travas: a variável
// PERMITIR_SIMULACAO_PIX=true e a chave de teste. Com uma chave de produção, nunca: simular pagamento numa conta real
// confirmaria uma venda sem dinheiro nenhum
export function simulacaoPixPermitida(): boolean {
  return env.permitirSimulacaoPix && ehChaveDeTeste()
}

// Na subida (este módulo é carregado pelo app): a variável ligada com uma chave que não é de teste é configuração
// errada. A simulação fica desligada (a rota responde 404) e o log avisa, sem a chave. Exportada para os testes
export function avisarSimulacaoComChaveDeProducao(): void {
  if (env.permitirSimulacaoPix && !ehChaveDeTeste()) {
    console.error('[gateway] PERMITIR_SIMULACAO_PIX=true com uma chave que não é de teste: a simulação fica desligada')
  }
}
avisarSimulacaoComChaveDeProducao()

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
  constructor(public readonly codigo: string, public readonly definitiva = false) {
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
    throw new Error('Id de cobrança fora dos padrões pix_char_ ou bill_.')
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
    throw new FalhaGateway('sem chave', true)
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
    if (erro && Object.hasOwn(codigosDeMensagens, erro)) throw new FalhaGateway(codigosDeMensagens[erro], [400, 401, 403, 404, 422].includes(resposta.status))
    throw new FalhaGateway(erro && padraoCodigoErro.test(erro) ? erro : `HTTP ${resposta.status}`, [400, 401, 403, 404, 422].includes(resposta.status))
  }
  // A documentação manda conferir success antes de usar data, sem confiar só no status HTTP
  if (!ehObjeto(json) || json.success !== true || !('data' in json)) {
    const erro = ehObjeto(json) && typeof json.error === 'string' ? json.error : null
    if (erro && Object.hasOwn(codigosDeMensagens, erro)) throw new FalhaGateway(codigosDeMensagens[erro], true)
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
    typeof id !== 'string' || !/^pix_char_[A-Za-z0-9]{1,91}$/.test(id) ||
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
  if (id.startsWith('bill_')) return consultarCheckout(id)
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
  if (id.startsWith('bill_')) return (await consultarCheckout(id)).status
  const data = await chamarOu502('consultar-status', { metodo: 'GET', caminho: '/transparents/check', query: { id } })
  if (!ehObjeto(data) || data.id !== id) throw respostaInvalida('consultar-status')
  return paraStatusDoProjeto('consultar-status', data.status)
}

// NUNCA lança por falha do gateway: devolve aprovado false com um erro curto (sem dados pessoais), porque quem
// chama registra a tentativa (pagamentos.estorno_tentativas e estorno_ultimo_erro; #35, #47, #49).
// A AbacatePay não documenta chave de idempotência no estorno. Repetir é seguro porque ela recusa o segundo com
// 'Esta cobrança já foi reembolsada.', tratado como sucesso. Só existe estorno total, o que serve ao cancelamento.
export async function estornar(cobrancaId: string, motivo?: string, valorEsperado?: number): Promise<ResultadoEstorno> {
  const id = conferirCobrancaId(cobrancaId)
  if (motivo !== undefined && (typeof motivo !== 'string' || motivo.length > 500)) {
    throw new Error('Motivo do estorno precisa ter até 500 caracteres.')
  }

  try {
    const data = await chamar('estornar', {
      metodo: 'POST',
      caminho: id.startsWith('bill_') ? '/checkouts/refund' : '/transparents/refund',
      body: motivo ? { id, reason: motivo } : { id },
    })
    if (!ehObjeto(data) || data.originalId !== id || data.status !== 'COMPLETE'
      || !Number.isSafeInteger(data.amount) || (data.amount as number) < 100
      || (valorEsperado !== undefined && data.amount !== valorEsperado)) {
      console.error('[gateway] estornar: resposta inválida')
      return { aprovado: false, jaEstornado: false, erro: 'resposta inválida' }
    }
    return { aprovado: true, jaEstornado: false }
  } catch (err) {
    if (err instanceof FalhaGateway && err.codigo === msgJaReembolsada) return { aprovado: true, jaEstornado: true }
    return { aprovado: false, jaEstornado: false, erro: err instanceof FalhaGateway ? err.codigo : 'erro inesperado' }
  }
}

// Simula o pagamento de um Pix em Dev mode (scripts/gateway-dev.ts e a rota de simulação da demonstração). Fora de
// produção, como antes. Em produção, SÓ com PERMITIR_SIMULACAO_PIX=true e a chave de teste (simulacaoPixPermitida): a
// demonstração do dia 19 roda com NODE_ENV=production e a chave de teste. Com a chave de produção a AbacatePay recusaria
// de qualquer jeito, e aqui nem chega a chamar
export async function simularPagamentoPix(cobrancaId: string): Promise<void> {
  conferirCobrancaId(cobrancaId)
  if (!/^pix_char_[A-Za-z0-9]+$/.test(cobrancaId)) throw new AppError('A simulação está disponível somente para Pix.', 409)
  if (env.nodeEnv === 'production' && !simulacaoPixPermitida()) {
    throw new Error('Simular pagamento só existe fora de produção (Dev mode), ou na demonstração com a chave de teste.')
  }
  const id = conferirCobrancaId(cobrancaId)
  await chamarOu502('simular', { metodo: 'POST', caminho: '/transparents/simulate-payment', query: { id } })
}

// O "seam" dos testes: o pagamento.service chama o gateway SEMPRE por este objeto (gatewayPix.consultarCobranca(...)),
// nunca pelas funções importadas direto. Um import de ES module não pode ser trocado depois de carregado, mas a
// propriedade de um objeto pode: os testes de integração trocam as três por falsas com
// mock.method(gatewayPix, 'consultarCobranca', ...), e nenhum teste fala com a AbacatePay de verdade.
// Em produção o objeto aponta para as funções reais acima; nada mais muda.
export const gatewayPix = { criarCobrancaPix, consultarCobranca, estornar }
// O mesmo "seam" para a simulação (Lote 13), separado: o gatewayPix continua só com as três funções da venda real
export const simuladorPix = { simularPagamentoPix }

export interface NovoCheckoutCartao {
  pagamentoId: number
  vendaId: number
  valor: number
  referencia: string
}
export interface CheckoutCartao extends ConsultaCobranca { url: string }

// Uma rejeição explícita permite tentar novamente; timeout ou resposta ambígua só permitem reconsultar.
export class CheckoutRecusado extends AppError {
  constructor(indisponivelNaConta = false) {
    super(indisponivelNaConta ? 'O pagamento com cartão ainda não está disponível. Escolha Pix ou tente mais tarde.' : msgIndisponivel, 502)
  }
}

function lerCheckout(data: unknown): CheckoutCartao {
  if (!ehObjeto(data) || typeof data.id !== 'string' || !/^bill_[A-Za-z0-9]{1,90}$/.test(data.id)
    || !Number.isSafeInteger(data.amount) || (data.amount as number) < 100 || typeof data.url !== 'string') {
    throw respostaInvalida('checkout')
  }
  let url: URL
  try { url = new URL(data.url) } catch { throw respostaInvalida('checkout-url') }
  if (url.origin !== 'https://app.abacatepay.com' || url.pathname !== `/pay/${data.id}` || url.username || url.password) {
    throw respostaInvalida('checkout-url')
  }
  const status = paraStatusDoProjeto('checkout', data.status)
  if (status === 'aprovado' && data.paidAmount !== data.amount) throw respostaInvalida('checkout-valor-pago')
  const extra = ehObjeto(data.metadata) ? data.metadata : {}
  return { cobrancaId: data.id, url: url.href, valor: data.amount as number, status,
    externalId: typeof data.externalId === 'string' ? data.externalId : null,
    vendaId: inteiroPositivo(extra.vendaId), pagamentoId: inteiroPositivo(extra.pagamentoId) }
}

async function consultarCheckout(id: string): Promise<CheckoutCartao> {
  const checkout = lerCheckout(await chamarOu502('consultar-checkout', { metodo: 'GET', caminho: '/checkouts/get', query: { id } }))
  if (checkout.cobrancaId !== id) throw respostaInvalida('consultar-checkout')
  return checkout
}

async function recuperarCheckout(referencia: string): Promise<CheckoutCartao | null> {
  try {
    const checkout = lerCheckout(await chamar('recuperar-checkout', { metodo: 'GET', caminho: '/checkouts/get', query: { externalId: referencia } }))
    if (checkout.externalId !== referencia) throw respostaInvalida('recuperar-checkout')
    return checkout
  } catch (err) {
    if (err instanceof FalhaGateway && err.codigo === 'CHECKOUT_NAO_ENCONTRADO') return null
    if (err instanceof FalhaGateway) throw indisponivel()
    throw err
  }
}

async function prepararProdutoCheckout(dados: NovoCheckoutCartao): Promise<void> {
  const { referencia, vendaId, valor } = dados
  try {
    const produto = await chamar('produto-checkout', { metodo: 'POST', caminho: '/products/create', body: {
      externalId: referencia, name: `Aquarilândia: pedido #${vendaId}`, price: valor, currency: 'BRL',
      description: 'Produtos e entrega do pedido.',
    } })
    if (!ehObjeto(produto) || produto.price !== valor || produto.externalId !== referencia) throw respostaInvalida('produto-checkout')
  } catch (err) {
    if (err instanceof FalhaGateway && err.codigo === 'PRODUTO_EXISTENTE') {
      const produto = await chamarOu502('consultar-produto-checkout', { metodo: 'GET', caminho: '/products/get', query: { externalId: referencia } })
      if (!ehObjeto(produto) || produto.price !== valor || produto.externalId !== referencia) throw respostaInvalida('produto-checkout')
      return
    }
    if (err instanceof FalhaGateway) throw indisponivel()
    throw err
  }
}

async function criarCheckout(dados: NovoCheckoutCartao): Promise<CheckoutCartao> {
  const { referencia, vendaId, pagamentoId, valor } = dados
  const origem = env.frontendUrl ?? env.corsOrigin
  let data: unknown
  try {
    data = await chamar('criar-checkout', { metodo: 'POST', caminho: '/checkouts/create', body: {
      items: [{ id: referencia, quantity: 1 }], methods: ['CARD'], card: { maxInstallments: 1, passFeesToCustomer: false },
      externalId: referencia, metadata: { vendaId, pagamentoId },
      returnUrl: new URL(`/pagamento/pendente?pedido=${vendaId}`, origem).href,
      completionUrl: new URL(`/pagamento/sucesso?pedido=${vendaId}`, origem).href,
    } })
  } catch (err) {
    if (err instanceof FalhaGateway && err.definitiva) throw new CheckoutRecusado(err.codigo === 'CARTAO_INDISPONIVEL')
    if (err instanceof FalhaGateway) throw indisponivel()
    throw err
  }
  const checkout = lerCheckout(data)
  if (checkout.valor !== valor || checkout.externalId !== referencia) throw respostaInvalida('criar-checkout')
  return checkout
}

export const gatewayCartao = { recuperarCheckout, prepararProdutoCheckout, criarCheckout }
