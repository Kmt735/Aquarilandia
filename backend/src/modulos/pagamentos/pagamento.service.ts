import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { clienteRepository } from '../clientes/cliente.repository.js'
import { vendaRepository } from '../vendas/venda.repository.js'
import type { LinhaPagamento, PixGerado } from '../vendas/venda.types.js'
import { gatewayPix } from './gateway.js'
import { pagamentoRepository } from './pagamento.repository.js'

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
// Menos de 60 s até vencer: o Pix não daria tempo de pagar (e a AbacatePay exige expiresIn >= 60)
const folgaMinimaMs = 60 * 1000

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

  // O código Pix NÃO é gravado: só existe nesta resposta (e numa nova chamada com o mesmo pagamentoId)
  return { pagamentoId, codigoPix: cobranca.codigoPix, qrCodeImagem: cobranca.qrCodeImagem, expiraEm: cobranca.expiraEm }
}

export const pagamentoService = {
  gerarPix,

  // Detalhe da compra (#34): o venda.service chama por aqui, não pelo repository (seção 8)
  async listarDaVenda(vendaId: number): Promise<LinhaPagamento[]> {
    return pagamentoRepository.listarPorVenda(vendaId)
  },
}
