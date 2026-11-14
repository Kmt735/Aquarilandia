import { enviarEmail } from '../../utils/email.js'
import { clienteRepository } from '../clientes/cliente.repository.js'
import { enderecoLoja } from './frete.config.js'
import { vendaRepository } from './venda.repository.js'

// E-mail ao cliente quando a venda muda de status (item 1 do PDF). Uma função só, chamada DEPOIS do COMMIT por quem
// mudou o status: o webhook e a reconsulta (paga), o #41 (enviada, pronta_retirada, entregue), o #35 e a conclusão do
// estorno (cancelada). A expiração NÃO avisa: o cliente não pediu nada e a venda nem chegou a ser paga.
// Nunca dentro da transação e nunca esperado: o pedido HTTP não fica preso no provedor de e-mail, e uma falha no envio
// só vai para o log (curta, sem dados). Conta anonimizada (sem e-mail) não recebe nada.
// Texto simples: sem link de pagamento, sem código Pix e sem nenhum dado do gateway.

export type StatusAvisado = 'paga' | 'enviada' | 'pronta_retirada' | 'entregue' | 'cancelada'

// O "seam" dos testes, como o gatewayPix: o envio passa SEMPRE por este objeto, que os testes trocam por um falso
export const canalEmail = { enviar: enviarEmail }

// O endereço vem do frete.config.ts (enderecoLoja), o mesmo lugar das outras regras de entrega e retirada
const textoRetirada =
  `Retire na loja Aquarilândia (${enderecoLoja}), no horário de funcionamento. Leve um documento com foto.`

export interface DadosAviso {
  vendaId: number
  nome: string
  codigoRastreio: string | null
  pagamentoDevolvido: boolean
}

// Exportada para os testes
export function montarAviso(status: StatusAvisado, dados: DadosAviso): { assunto: string; texto: string } {
  const pedido = `pedido #${dados.vendaId}`
  const ola = `Olá, ${dados.nome}.`
  switch (status) {
    case 'paga':
      return {
        assunto: `Pagamento confirmado — ${pedido}`,
        texto: `${ola} Recebemos o pagamento do seu ${pedido}. Agora vamos separar os produtos.`,
      }
    case 'enviada':
      return {
        assunto: `Seu ${pedido} foi enviado`,
        texto: dados.codigoRastreio
          ? `${ola} Seu ${pedido} foi enviado. Código de rastreio dos Correios: ${dados.codigoRastreio}.`
          : `${ola} Seu ${pedido} saiu para entrega.`,
      }
    case 'pronta_retirada':
      return {
        assunto: `Seu pedido está pronto para retirada — ${pedido}`,
        texto: `${ola} Seu ${pedido} está pronto para retirada. ${textoRetirada}`,
      }
    case 'entregue':
      return { assunto: `Pedido entregue — ${pedido}`, texto: `${ola} Seu ${pedido} foi entregue. Obrigado pela compra!` }
    case 'cancelada': {
      const devolvido = dados.pagamentoDevolvido ? ' O valor foi devolvido.' : ''
      return { assunto: `Compra cancelada — ${pedido}`, texto: `${ola} Sua compra (${pedido}) foi cancelada.${devolvido}` }
    }
  }
}

function codigoCurto(err: unknown): string {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined
  return typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) ? code : 'erro inesperado'
}

async function enviarAviso(vendaId: number, status: StatusAvisado): Promise<void> {
  const venda = await vendaRepository.buscarParaNotificacao(vendaId)
  if (!venda) return
  const conta = await clienteRepository.buscarParaAdmin(venda.clienteId)
  if (!conta?.email) return
  const { assunto, texto } = montarAviso(status, {
    vendaId,
    nome: conta.nome,
    codigoRastreio: venda.codigoRastreio,
    pagamentoDevolvido: venda.pagamentoDevolvido,
  })
  await canalEmail.enviar({ para: conta.email, assunto, texto })
}

// Dispara e não espera. Chame só DEPOIS do COMMIT da mudança de status
export function notificarMudancaStatus(vendaId: number, status: StatusAvisado): void {
  void enviarAviso(vendaId, status).catch((err: unknown) => {
    console.error(`[email] venda ${vendaId}: aviso de ${status} não enviado (${codigoCurto(err)})`)
  })
}
