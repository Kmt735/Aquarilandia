import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import type { Queryable } from '../../utils/transacao.js'
import { clienteRepository } from '../clientes/cliente.repository.js'
import { vendaRepository } from '../vendas/venda.repository.js'
import { podeTransicionar } from '../vendas/venda.transicoes.js'
import type { LinhaPagamento, PixGerado, StatusVenda } from '../vendas/venda.types.js'
import { gatewayPix } from './gateway.js'
import type { ConsultaCobranca } from './gateway.js'
import { pagamentoRepository } from './pagamento.repository.js'
import type { PagamentoDaCobranca, PagamentoTravado } from './pagamento.repository.js'

// Pagamento Pix (Lote 11): #44 gerar o Pix, #46/#47 processar o webhook, a rede de proteção (reconsulta) e a
// devolução de pagamento indevido (parte mínima da #49).
//
// Regras que valem para o arquivo todo:
//   * O gateway é chamado SEMPRE pelo objeto gatewayPix (gateway.ts explica por quê) e NUNCA dentro de comTransacao:
//     uma chamada de rede de até 5 s não pode segurar trava de venda nem conexão do pool.
//   * Quem decide se um pagamento existe, quanto vale e em que status está é a CONSULTA ao gateway, nunca o corpo do
//     webhook (que só traz o id do evento e o id da cobrança).
//   * Ordem das travas, a mesma em todo o sistema (sem deadlock):
//       #44:        cliente → venda → (pagamento)
//       webhook:              venda → pagamento
//       expiração:            venda → (itens e produtos, no estornarVenda do Dev 2)
//     Ninguém trava o pagamento e depois a venda, então duas transações nunca esperam uma pela outra em círculo.
//     As escritas fora de transação (gravar a cobrança, reservar a reconsulta, marcar o estorno) são um UPDATE só,
//     que trava uma linha de pagamentos e termina sem esperar por mais nada.
//   * Nos logs, só ids NOSSOS (pagamento, venda, evento) e códigos curtos: nunca o id da cobrança, o código Pix,
//     o token nem dado do cliente.

const nomeGateway = 'abacatepay'
const msgIndisponivel = 'Não foi possível falar com o pagamento agora. Tente de novo em instantes.'
const msgNaoPodePagar = 'Esta compra não pode mais ser paga.'
const motivoEstorno = 'Pagamento recebido para compra já cancelada ou paga.'
// O CHECK de pagamentos.estorno_tentativas vai até 5 (D-22); depois disso o admin resolve (tela no Lote 12)
const maxTentativasEstorno = 5
// Menos de 60 s até vencer: o Pix não daria tempo de pagar (e a AbacatePay exige expiresIn >= 60)
const folgaMinimaMs = 60 * 1000

export type ResultadoCobranca =
  | 'confirmado' // a venda virou paga
  | 'devolucao' // pagamento aprovado de venda cancelada ou já paga: estorno pedido
  | 'atualizado' // só o pagamento mudou (estornado, cancelado, recusado, em disputa)
  | 'sem_mudanca'
  | 'valor_divergente'
  | 'desconhecida' // nenhuma cobrança nossa com esse id

export type ResultadoEstorno = 'estornado' | 'falhou' | 'esgotado' | 'nada'

// Código curto para o log e para eventos_webhook.ultimo_erro: o SQLSTATE do PostgreSQL, GATEWAY_INDISPONIVEL para o
// 502 do gateway ou ERRO_INESPERADO. Nunca a mensagem crua, que pode trazer dados da linha ou da resposta
export function codigoDoErro(err: unknown): string {
  if (err instanceof AppError) return err.statusCode === 502 ? 'GATEWAY_INDISPONIVEL' : `HTTP_${err.statusCode}`
  if (typeof err === 'object' && err !== null) {
    const { code } = err as { code?: unknown }
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code
  }
  return 'ERRO_INESPERADO'
}

// 23505 no uq_pagamentos_gateway_cobranca: a cobrança já pertence a OUTRO pagamento
function cobrancaDeOutroPagamento(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const { code, constraint } = err as { code?: unknown; constraint?: unknown }
  return code === '23505' && constraint === 'uq_pagamentos_gateway_cobranca'
}

// ---------- #44 gerar o Pix ----------

async function gerarPix(clienteId: number, vendaId: number): Promise<PixGerado> {
  // A) Numa transação curta, sem rede: reserva o pagamento (reaproveita o pendente ou cria um novo)
  const reserva = await comTransacao(async (client) => {
    // Regra de ouro 8: a trava do cliente vem PRIMEIRO, como no POST /api/vendas
    if (!(await clienteRepository.travarParaAlteracao(clienteId, client))) {
      throw new AppError('Faça login para continuar.', 401)
    }
    // Por id E cliente_id: a venda de outro cliente cai no mesmo 404 da inexistente
    const venda = await vendaRepository.travarDoCliente(vendaId, clienteId, client)
    if (!venda) throw new AppError('Compra não encontrada.', 404)
    if (venda.status !== 'aguardando_pagamento' || !venda.podePagar) throw new AppError(msgNaoPodePagar, 409)

    // A trava da venda faz dois pedidos ao mesmo tempo passarem um de cada vez: o segundo já acha o pendente do
    // primeiro. Depois de um 'recusado' ou 'cancelado' não há pendente, e nasce um pagamento novo
    const pendente = await pagamentoRepository.buscarPendente(vendaId, client)
    if (pendente) return { pagamentoId: pendente.id, valor: pendente.valor, expiraEm: venda.expiraEm }
    const pagamentoId = await pagamentoRepository.inserirPendente(vendaId, venda.total, nomeGateway, client)
    return { pagamentoId, valor: venda.total, expiraEm: venda.expiraEm }
  })
  const { pagamentoId, valor, expiraEm } = reserva

  // O banco conferiu os 60 s com o relógio dele; o gateway confere com o deste processo. Confere de novo aqui para
  // a diferença entre os dois relógios (ou a espera na trava) virar o mesmo 409, e não um erro 500 no gateway
  if (expiraEm.getTime() - Date.now() < folgaMinimaMs) throw new AppError(msgNaoPodePagar, 409)

  // B) Fora da transação. A AbacatePay é idempotente pelo externalId 'pagamento-<id>': o mesmo pagamentoId devolve
  // a MESMA cobrança e o mesmo código. Falhou (502)? O pagamento fica pendente sem cobrança, e o próximo pedido
  // reaproveita o mesmo id, então nunca nascem duas cobranças para o mesmo pagamento
  const cobranca = await gatewayPix.criarCobrancaPix({ pagamentoId, vendaId, valor, expiraEm })

  // C) Grava a cobrança só se o pagamento ainda não tem uma (ou já tem esta). Nunca sobrescreve
  let gravou: boolean
  try {
    gravou = await pagamentoRepository.gravarCobranca(pagamentoId, cobranca.cobrancaId)
  } catch (err) {
    if (!cobrancaDeOutroPagamento(err)) throw err
    gravou = false
  }
  if (!gravou) {
    console.error(`[pagamento] pagamento ${pagamentoId}: o gateway devolveu uma cobrança diferente da gravada`)
    throw new AppError(msgIndisponivel, 502)
  }

  // Reaproveitou um pagamento cuja cobrança já não está aberta (paga, expirada ou cancelada no painel): atualiza o
  // banco pela consulta e não devolve um código que não vale mais. Se ela foi cancelada, o pagamento vira
  // 'cancelado' e o próximo pedido cria um pagamento (e uma cobrança) novos
  if (cobranca.status !== 'pendente') {
    try {
      await processarCobranca(cobranca.cobrancaId)
    } catch (err) {
      console.error(`[pagamento] pagamento ${pagamentoId}: reconsulta falhou (${codigoDoErro(err)})`)
    }
    if (cobranca.status === 'aprovado') throw new AppError(msgNaoPodePagar, 409)
    throw new AppError(msgIndisponivel, 502)
  }

  // O código Pix NÃO é gravado: só existe nesta resposta (e numa nova chamada com o mesmo pagamentoId)
  return { pagamentoId, codigoPix: cobranca.codigoPix, qrCodeImagem: cobranca.qrCodeImagem, expiraEm: cobranca.expiraEm }
}

// ---------- #46/#47 processar a cobrança (webhook e rede de proteção) ----------

// O pagamento da cobrança no NOSSO banco. Se não acha, aceita um único caso: a etapa C do #44 não chegou a gravar a
// cobrança. A consulta (autenticada, feita por nós) traz o pagamentoId e o vendaId do metadata; só vale se esse
// pagamento existe SEM cobrança, é da mesma venda e tem o mesmo valor
async function acharPagamento(cobrancaId: string, consulta: ConsultaCobranca): Promise<PagamentoDaCobranca | null> {
  const gravado = await pagamentoRepository.buscarPorCobranca(cobrancaId)
  if (gravado) return gravado
  if (consulta.pagamentoId === null || consulta.vendaId === null) return null
  return pagamentoRepository.vincularCobranca(consulta.pagamentoId, consulta.vendaId, consulta.valor, cobrancaId)
}

// Aplica a consulta ao pagamento e à venda, já travados (venda → pagamento), dentro da transação de quem chama
async function aplicarConsulta(
  consulta: ConsultaCobranca,
  vendaId: number,
  statusVenda: StatusVenda,
  pagamento: PagamentoTravado,
  client: Queryable,
): Promise<ResultadoCobranca> {
  const { id } = pagamento
  switch (consulta.status) {
    case 'aprovado': {
      // O valor que vale é o gravado no banco (vendas.total no #44). Diferente → não confirma: alguém precisa olhar
      if (consulta.valor !== pagamento.valor) {
        await pagamentoRepository.marcarDetalhe(id, 'valor divergente', client)
        console.error(`[pagamento] pagamento ${id}: valor divergente`)
        return 'valor_divergente'
      }
      // Já aprovado (outro aviso da mesma cobrança, ou a reconsulta chegou antes): nada a fazer
      if (pagamento.status === 'aprovado') return 'sem_mudanca'
      // Estornado ou em disputa é um estado posterior ao aprovado: um aviso velho não volta o pagamento para trás
      if (pagamento.status === 'estornado' || pagamento.status === 'em_disputa') return 'sem_mudanca'

      // A venda ainda espera o pagamento, mesmo vencida (se a tarefa ainda não a cancelou, o cliente pagou a tempo)
      if (statusVenda === 'aguardando_pagamento') {
        if (!podeTransicionar('aguardando_pagamento', 'paga', 'gateway')) {
          throw new Error('Transição aguardando_pagamento → paga proibida para o gateway.')
        }
        await pagamentoRepository.marcarAprovado(id, consulta.cobrancaId, false, client)
        const pagou = await vendaRepository.mudarStatus(vendaId, 'aguardando_pagamento', 'paga', {
          ator: 'gateway',
          clienteId: null,
        }, client)
        // A venda está travada desde a leitura do status: não tem como ter mudado
        if (!pagou) throw new Error('A venda travada mudou de status.')
        return 'confirmado'
      }

      // Venda cancelada, ou já paga por OUTRO pagamento (este ainda não estava aprovado): o dinheiro entrou, mas não
      // tem compra para ele. Fica aprovado + estorno pedido, e a devolução é tentada depois do COMMIT. Nunca reabre a
      // venda nem mexe no estoque
      await pagamentoRepository.marcarAprovado(id, consulta.cobrancaId, true, client)
      console.error(`[pagamento] pagamento ${id}: recebido com a venda ${vendaId} em ${statusVenda}; devolução pedida`)
      return 'devolucao'
    }
    case 'estornado': {
      const mudou = await pagamentoRepository.mudarStatus(id, ['aprovado', 'pendente'], 'estornado', client)
      // Estornado sem pedido nosso (pelo painel da AbacatePay) numa venda paga: a venda não muda sozinha
      if (mudou && pagamento.status === 'aprovado' && !pagamento.estornoSolicitadoEm && statusVenda !== 'cancelada') {
        console.error(`[pagamento] pagamento ${id}: estornado no gateway com a venda ${vendaId} em ${statusVenda}`)
      }
      return mudou ? 'atualizado' : 'sem_mudanca'
    }
    case 'cancelado':
    case 'recusado': {
      // Só o pendente muda; a venda continua como está (o cliente pode gerar outro Pix)
      const mudou = await pagamentoRepository.mudarStatus(id, ['pendente'], consulta.status, client)
      return mudou ? 'atualizado' : 'sem_mudanca'
    }
    case 'em_disputa': {
      const de = ['pendente', 'aprovado', 'estornado'] as const
      const mudou = await pagamentoRepository.mudarStatus(id, de, 'em_disputa', client)
      if (mudou) console.error(`[pagamento] pagamento ${id}: em disputa`)
      return mudou ? 'atualizado' : 'sem_mudanca'
    }
    case 'pendente':
      return 'sem_mudanca'
  }
}

// A MESMA função para o webhook (#47), a expiração e o detalhe da compra (rede de proteção).
// Lança se a consulta ao gateway falhar (quem chama decide: o webhook responde 500 e a AbacatePay reenvia).
async function processarCobranca(cobrancaId: string): Promise<ResultadoCobranca> {
  // a) Fora de transação
  const consulta = await gatewayPix.consultarCobranca(cobrancaId)

  // b) Cobrança que não é nossa: registra e para (o evento fica processado, para não ser reenviado para sempre)
  const pagamento = await acharPagamento(cobrancaId, consulta)
  if (!pagamento) {
    console.error('[pagamento] cobrança desconhecida')
    return 'desconhecida'
  }

  // c) Trava NESTA ORDEM: a venda e depois o pagamento. É a mesma ordem do #44 (cliente → venda) e da expiração
  // (venda), então nenhuma delas espera pela outra em círculo: sem deadlock
  const resultado = await comTransacao(async (client) => {
    const statusVenda = await vendaRepository.travarParaPagamento(pagamento.vendaId, client)
    const travado = await pagamentoRepository.travar(pagamento.id, client)
    if (!statusVenda || !travado) throw new Error('Venda ou pagamento não encontrado durante o processamento.')
    // d) Conforme a consulta
    return aplicarConsulta(consulta, pagamento.vendaId, statusVenda, travado, client)
  })

  // e) Depois do COMMIT: a primeira tentativa de devolução já. Falhou? A tarefa de 5 em 5 minutos tenta de novo
  if (resultado === 'devolucao') {
    try {
      await tentarEstornoPendente(pagamento.id)
    } catch (err) {
      console.error(`[estorno] pagamento ${pagamento.id}: ${codigoDoErro(err)}`)
    }
  }
  return resultado
}

// Webhook (#46): o aviso já passou pelo verificarWebhook e o controller já conferiu o formato dos dois ids.
// O payload gravado é SÓ { cobrancaId }: o corpo do aviso traz nome, e-mail e CPF mascarado do pagador, e nada
// disso é gravado. Lança (o controller responde 500) quando a falha é nossa ou do gateway, para a AbacatePay reenviar
async function processarAviso(eventoId: string, tipo: string, cobrancaId: string): Promise<void> {
  let evento = await pagamentoRepository.inserirEvento(eventoId, tipo, { cobrancaId })
  let cobranca = cobrancaId
  if (evento === null) {
    // O mesmo aviso de novo: já processado → para; ainda não (falhou antes) → reprocessa com a cobrança gravada
    const existente = await pagamentoRepository.buscarEvento(eventoId)
    if (!existente) throw new Error('Evento do webhook sumiu depois do conflito.')
    if (existente.processadoEm) return
    evento = existente.id
    cobranca = existente.cobrancaId ?? cobrancaId
  }

  try {
    await processarCobranca(cobranca)
  } catch (err) {
    const codigo = codigoDoErro(err)
    console.error(`[webhook] evento ${evento}: falhou (${codigo})`)
    try {
      await pagamentoRepository.registrarFalhaEvento(evento, codigo)
    } catch (erroRegistro) {
      console.error(`[webhook] evento ${evento}: falha ao registrar a tentativa (${codigoDoErro(erroRegistro)})`)
    }
    // Erro sem dados: o errorHandler responde o 500 genérico
    throw new Error('Falha ao processar o aviso do gateway.')
  }
  await pagamentoRepository.marcarEventoProcessado(evento)
}

// ---------- devolução de pagamento indevido (#49, parte mínima) ----------

// Uma tentativa de devolver um pagamento aprovado com estorno pedido. O gatewayPix.estornar nunca lança por falha do
// gateway; repetir é seguro, porque a AbacatePay recusa o segundo estorno com "já reembolsada" (= jaEstornado).
// Só o código curto do erro é gravado (ex.: INSUFFICIENT_FUNDS: a loja sem saldo disponível na conta, D-22)
async function tentarEstornoPendente(pagamentoId: number): Promise<ResultadoEstorno> {
  const pagamento = await pagamentoRepository.buscarParaEstorno(pagamentoId)
  if (!pagamento || pagamento.status !== 'aprovado' || !pagamento.estornoSolicitadoEm || !pagamento.cobrancaId) {
    return 'nada'
  }
  if (pagamento.tentativas >= maxTentativasEstorno) return 'esgotado'

  const resposta = await gatewayPix.estornar(pagamento.cobrancaId, motivoEstorno)
  if (resposta.aprovado || resposta.jaEstornado) {
    await pagamentoRepository.marcarEstornado(pagamentoId)
    return 'estornado'
  }

  const erro = (resposta.erro ?? 'erro desconhecido').slice(0, 50)
  const tentativas = await pagamentoRepository.registrarFalhaEstorno(pagamentoId, erro)
  if (tentativas === null) return 'nada'
  console.error(`[estorno] pagamento ${pagamentoId}: tentativa ${tentativas} falhou (${erro})`)
  if (tentativas >= maxTentativasEstorno) console.error(`[estorno] pagamento ${pagamentoId} precisa de ação do admin`)
  return 'falhou'
}

// ---------- rede de proteção (reconsulta) ----------

// Detalhe da compra: no máximo 1 consulta a cada 20 s por pagamento (reservarReconsulta), mesmo com o frontend
// perguntando sem parar. Erro aqui (gateway fora, por exemplo) não impede o detalhe: mostra o que o banco tem.
// true = a consulta mudou alguma coisa (quem chama relê a venda)
async function reconsultarPendente(vendaId: number): Promise<boolean> {
  const cobrancaId = await pagamentoRepository.reservarReconsulta(vendaId)
  if (!cobrancaId) return false
  try {
    const resultado = await processarCobranca(cobrancaId)
    return resultado !== 'sem_mudanca' && resultado !== 'desconhecida'
  } catch (err) {
    console.error(`[pagamento] reconsulta da venda ${vendaId} falhou (${codigoDoErro(err)})`)
    return false
  }
}

export const pagamentoService = {
  codigoDoErro,
  gerarPix,
  processarCobranca,
  processarAviso,
  tentarEstornoPendente,
  reconsultarPendente,

  // Detalhe da compra (#34): o venda.service chama por aqui, não pelo repository (seção 8)
  async listarDaVenda(vendaId: number): Promise<LinhaPagamento[]> {
    return pagamentoRepository.listarPorVenda(vendaId)
  },

  // #35, dentro da transação do vendaService.cancelar (a venda já travada): o Pix pendente vira cancelado
  async cancelarPendentes(vendaId: number, client: Queryable): Promise<number> {
    return pagamentoRepository.cancelarPendentes(vendaId, client)
  },

  // #35, passo 1 do cancelamento da venda paga (dentro da transação, a venda já travada): trava o pagamento que
  // confirmou a venda e pede o estorno. null = não há pagamento aprovado (quem chama responde 409)
  async pedirEstornoDoCancelamento(vendaId: number, client: Queryable): Promise<number | null> {
    const pagamentoId = await pagamentoRepository.travarConfirmador(vendaId, client)
    if (pagamentoId === null) return null
    await pagamentoRepository.pedirEstorno(pagamentoId, client)
    return pagamentoId
  },

  // Expiração: a cobrança do pagamento pendente da venda, se já foi gravada (sem cobrança não há o que consultar)
  async buscarCobrancaPendente(vendaId: number): Promise<string | null> {
    return pagamentoRepository.buscarCobrancaPendente(vendaId)
  },

  async listarEstornosPendentes(limite: number): Promise<number[]> {
    return pagamentoRepository.listarEstornosPendentes(maxTentativasEstorno, limite)
  },
}
