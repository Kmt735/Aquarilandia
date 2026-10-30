// INTEGRAÇÃO: POST /api/frete/calcular (D-29). Hoje usa a regra provisória de mocks/frete.js.
import { FRETE_EXEMPLO } from '../mocks/frete'
import { ErroApi, simularRede } from './http'
import { cepValido } from '../utils/cep'

export const AVISO_PEIXE =
  'Peixes vivos são entregues só em São João del Rei. Fora daqui, você pode retirar na loja.'

export async function calcularFrete(cep, linhas) {
  await simularRede(500)
  if (!cepValido(cep)) throw new ErroApi('CEP inválido.', { cep: 'Digite um CEP com 8 números. Exemplo: 36300-000.' })

  const numero = Number(cep.replace(/\D/g, ''))
  const [min, max] = FRETE_EXEMPLO.faixaCepLocal
  const local = numero >= min && numero <= max
  const temPeixe = linhas.some((l) => l.item.tipo === 'peixe')

  const entrega = local
    ? { id: 'endereco', rotulo: 'Entrega em São João del Rei', valor: FRETE_EXEMPLO.valorLocal, prazo: FRETE_EXEMPLO.prazoLocal, disponivel: true }
    : temPeixe
      ? {
          id: 'endereco',
          rotulo: 'Entrega no endereço',
          valor: null,
          prazo: null,
          disponivel: false,
          motivo: 'Seu carrinho tem peixes vivos, que só entregamos em São João del Rei. Retire na loja ou tire os peixes do carrinho para receber o resto em casa.',
        }
      : { id: 'endereco', rotulo: 'Entrega no endereço', valor: null, prazo: null, disponivel: true, pendente: 'Valor e prazo: a definir com a loja.' }

  return {
    cep,
    local,
    temPeixe,
    opcoes: [entrega, { id: 'retirada', rotulo: 'Retirar na loja', valor: 0, prazo: FRETE_EXEMPLO.prazoRetirada, disponivel: true }],
  }
}
