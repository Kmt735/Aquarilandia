import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { authService } from '../auth/auth.service.js'
import { estoqueService } from '../estoque/estoque.service.js'
import { pagamentoService } from '../pagamentos/pagamento.service.js'
import { vendaRepository } from './venda.repository.js'
import { podeTransicionar } from './venda.transicoes.js'

// Tarefas agendadas do módulo vendas (#32, D-16): a cada 5 minutos, cancela as vendas não pagas vencidas e devolve o
// estoque (reconsultando o Pix antes, Lote 11), apaga as sessões e os links de recuperação de senha vencidos e tenta
// de novo a devolução dos pagamentos indevidos.

const intervaloMs = 5 * 60 * 1000
const primeiraRodadaMs = 30 * 1000
const vendasPorRodada = 100
const estornosPorRodada = 50
const observacaoExpiracao = 'Pagamento não recebido no prazo.'

let rodando = false
let estornando = false

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
    if (!(await vendaRepository.podeExpirarSobLock(vendaId, client))) return false
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

// Rede de proteção (Lote 11): antes de cancelar, se a venda tem um Pix pendente com cobrança, reconsulta no gateway
// (o mesmo pagamentoService.processarCobranca do webhook). Pago → a venda vira paga ali mesmo, e o mudarStatus do
// expirarVenda deixa de casar (não cancela). true = pode seguir para o cancelamento.
// Gateway fora do ar: não cancela nesta rodada (o aviso pode estar a caminho), a não ser que a venda tenha vencido há
// mais de 1 hora. Aí cancela: se o Pix tiver sido pago, o webhook ou a próxima reconsulta devolve o dinheiro (o
// pagamento aprovado de venda cancelada vira devolução, no processarCobranca)
async function reconsultarAntesDeExpirar(venda: { id: number; vencidaHaMaisDeUmaHora: boolean }): Promise<boolean> {
  const cobrancaId = await pagamentoService.buscarCobrancaPendente(venda.id)
  if (!cobrancaId) return true
  try {
    await pagamentoService.processarCobranca(cobrancaId)
    return true
  } catch (err) {
    if (venda.vencidaHaMaisDeUmaHora) {
      const codigo = descreverErro(err)
      console.error(`[expiracao] venda ${venda.id}: reconsulta do Pix falhou (${codigo}); vencida há mais de 1 h, cancelando`)
      return true
    }
    throw err
  }
}

// Exportada para os testes. Cada venda tem a sua transação: o erro numa não desfaz nem impede as outras.
export async function executarExpiracao(): Promise<{ canceladas: number; erros: number }> {
  // expira_em é o prazo; cinco minutos é só a periodicidade. A reconsulta financeira permanece fora dos locks.
  // Estado e prazo serão revalidados dentro da transação, depois de conseguir o lock da venda.
  const vencidas = await vendaRepository.buscarVencidas(vendasPorRodada)
  let canceladas = 0
  let erros = 0
  for (const venda of vencidas) {
    try {
      // Reconsulta que falhou (gateway fora, venda vencida há menos de 1 h) conta como erro: a venda fica para a
      // próxima rodada
      if ((await reconsultarAntesDeExpirar(venda)) && (await expirarVenda(venda.id))) canceladas++
    } catch (err) {
      erros++
      console.error(`[expiracao] venda ${venda.id}: ${descreverErro(err)}`)
    }
  }
  return { canceladas, erros }
}

// Devolução de pagamento indevido (#49, parte mínima): até 50 pagamentos aprovados com estorno pedido e menos de 5
// tentativas, os mais antigos primeiro. Cada um isolado: o erro num não para os outros. Com 5 tentativas o
// pagamentoService para e avisa no log que o admin precisa agir (a tela do admin entra no Lote 12).
// Exportada para os testes.
export async function executarEstornos(): Promise<{ estornados: number; falhas: number; erros: number }> {
  const ids = await pagamentoService.listarEstornosPendentes(estornosPorRodada)
  let estornados = 0
  let falhas = 0
  let erros = 0
  for (const id of ids) {
    try {
      const resultado = await pagamentoService.tentarEstornoPendente(id)
      if (resultado === 'estornado') estornados++
      if (resultado === 'falhou') falhas++
    } catch (err) {
      erros++
      console.error(`[estorno] pagamento ${id}: ${descreverErro(err)}`)
    }
  }
  return { estornados, falhas, erros }
}

// Pela seção 8 do api.md, a tarefa chama o service do auth, nunca os repositories dele
export async function executarLimpezas(): Promise<void> {
  await authService.limparSessoesVencidas()
  await authService.limparTokensVencidos()
}

// Os estornos rodam DEPOIS da rodada de expiração e limpezas, com a trava própria: uma chamada lenta ao gateway na
// devolução não segura a próxima expiração, e a expiração (que pode marcar devoluções) vem antes. Nunca rejeita
async function rodarEstornos(): Promise<void> {
  if (estornando) return
  estornando = true
  try {
    await executarEstornos()
  } catch (err) {
    console.error(`[estorno] rodada falhou: ${descreverErro(err)}`)
  } finally {
    estornando = false
  }
}

// Uma rodada nunca rejeita: cada parte tem o próprio catch, e um erro numa não impede a outra
async function rodarTarefas(): Promise<void> {
  if (rodando) return
  rodando = true
  try {
    try {
      await pagamentoService.reconciliar()
    } catch (err) {
      console.error(`[reconciliacao] rodada falhou: ${descreverErro(err)}`)
    }
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
  const rodada = (): void => void rodarTarefas().then(rodarEstornos)
  setTimeout(rodada, primeiraRodadaMs).unref()
  setInterval(rodada, intervaloMs).unref()
}
