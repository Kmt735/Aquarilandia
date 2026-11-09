import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { authService } from '../auth/auth.service.js'
import { estoqueService } from '../estoque/estoque.service.js'
import { vendaRepository } from './venda.repository.js'
import { podeTransicionar } from './venda.transicoes.js'

// Tarefas agendadas do módulo vendas (#32, D-16): a cada 5 minutos, cancela as vendas não pagas vencidas e devolve o
// estoque, e apaga as sessões e os links de recuperação de senha vencidos.

const intervaloMs = 5 * 60 * 1000
const primeiraRodadaMs = 30 * 1000
const vendasPorRodada = 100
const observacaoExpiracao = 'Pagamento não recebido no prazo.'

let rodando = false

// O log leva só um código curto: o código do PostgreSQL, a mensagem de um AppError (textos nossos, sem dados) ou
// 'erro inesperado'. Nunca a mensagem crua de outro erro, que pode trazer dados da linha
function descreverErro(err: unknown): string {
  if (err instanceof AppError) return err.message
  if (typeof err === 'object' && err !== null) {
    const { code } = err as { code?: unknown }
    if (typeof code === 'string') return code
  }
  return 'erro inesperado'
}

// 409 do estornarVenda (Dev 2) para venda sem baixa: o único jeito de distinguir é a mensagem, que faz parte do
// contrato da seção 8 do api.md
function semBaixaDeEstoque(err: unknown): boolean {
  return err instanceof AppError && err.statusCode === 409 && err.message === 'Venda sem baixa original de estoque'
}

// Cancela UMA venda e devolve o estoque na mesma transação: os dois ficam, ou nenhum.
// true = cancelada nesta chamada; false = alguém mudou o status antes (foi paga ou cancelada nesse meio-tempo).
async function expirarVenda(vendaId: number): Promise<boolean> {
  return comTransacao(async (client) => {
    // Sempre true pela tabela de transições; fica explícito para a regra não depender só de quem escreveu a tarefa
    if (!podeTransicionar('aguardando_pagamento', 'cancelada', 'sistema')) {
      throw new Error('Transição aguardando_pagamento → cancelada proibida para o sistema.')
    }

    // Trava otimista (WHERE status = 'aguardando_pagamento'): se o webhook marcou a venda como paga, ou outra
    // rodada já a cancelou, nenhuma linha muda e a venda fica como está
    const cancelou = await vendaRepository.mudarStatus(vendaId, 'aguardando_pagamento', 'cancelada', {
      ator: 'sistema',
      clienteId: null,
      observacao: observacaoExpiracao,
    }, client)
    if (!cancelou) return false

    try {
      await estoqueService.estornarVenda(vendaId, client)
    } catch (err) {
      // Venda sem baixa (dado inconsistente, ex.: inserida à mão): não havia estoque baixado para devolver, então o
      // cancelamento fica. O estornarVenda lança antes de escrever qualquer coisa, e a transação continua válida
      if (!semBaixaDeEstoque(err)) throw err
      console.error(`[expiracao] venda ${vendaId} sem baixa de estoque`)
    }
    return true
  })
}

// Exportada para os testes. Cada venda tem a sua transação: o erro numa não desfaz nem impede as outras.
export async function executarExpiracao(): Promise<{ canceladas: number; erros: number }> {
  // Folga de 5 minutos: o Pix vence junto com a venda, mas o aviso da AbacatePay pode chegar com atraso; a folga evita
  // cancelar uma venda paga no último segundo. A reconsulta do pagamento no gateway antes de cancelar entra na #47.
  const ids = await vendaRepository.buscarVencidas(vendasPorRodada)
  let canceladas = 0
  let erros = 0
  for (const id of ids) {
    try {
      if (await expirarVenda(id)) canceladas++
    } catch (err) {
      erros++
      console.error(`[expiracao] venda ${id}: ${descreverErro(err)}`)
    }
  }
  return { canceladas, erros }
}

// Pela seção 8 do api.md, a tarefa chama o service do auth, nunca os repositories dele
export async function executarLimpezas(): Promise<void> {
  await authService.limparSessoesVencidas()
  await authService.limparTokensVencidos()
}

// Uma rodada nunca rejeita: cada parte tem o próprio catch, e um erro numa não impede a outra
async function rodarTarefas(): Promise<void> {
  if (rodando) return
  rodando = true
  try {
    try {
      await executarExpiracao()
    } catch (err) {
      console.error(`[expiracao] rodada falhou: ${descreverErro(err)}`)
    }
    try {
      await executarLimpezas()
    } catch (err) {
      console.error(`[limpezas] rodada falhou: ${descreverErro(err)}`)
    }
  } finally {
    rodando = false
  }
}

// Chamada uma vez pelo server.ts. Com NODE_ENV=test não agenda nada: os testes chamam executarExpiracao direto.
// O flag "rodando" impede duas rodadas ao mesmo tempo NESTE processo (uma rodada lenta e o próximo intervalo). Com
// mais de uma instância do servidor, as rodadas podem coincidir; o WHERE status = $de do mudarStatus impede cancelar
// a mesma venda duas vezes, e o estornarVenda é idempotente.
// unref(): os timers não seguram o processo vivo sozinhos (o servidor HTTP é que segura).
export function iniciarTarefasVendas(): void {
  if (env.nodeEnv === 'test') return
  setTimeout(() => void rodarTarefas(), primeiraRodadaMs).unref()
  setInterval(() => void rodarTarefas(), intervaloMs).unref()
}
