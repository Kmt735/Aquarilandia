import { cepValido } from '../utils/cep.js'
import { MENSAGENS } from '../utils/validacao.js'
import { ErroApi } from './http.js'
import { requisitarApi } from './api.js'
import { itensDaCompra } from './pedidos.js'

export const AVISO_PEIXE =
  'Peixes vivos são entregues só em São João del Rei. Fora daqui, você pode retirar na loja.'

export const cotarCompra = (linhas, entrega) => requisitarApi('/frete/calcular', {
  metodo: 'POST', corpo: { itens: itensDaCompra(linhas), ...(entrega.tipo === 'retirada' ? { retirada: true } : { cep: entrega.cep, ...(entrega.servicoFreteId ? {servicoFreteId:entrega.servicoFreteId} : {}) }) },
})
export async function calcularFrete(cep, linhas) {
  if (!cepValido(cep)) throw new ErroApi('CEP inválido.', { cep: MENSAGENS.cep })
  try {
    const cotacao = await cotarCompra(linhas, { cep })
    return { cotacao, opcoes: (cotacao.opcoesFrete ?? [cotacao]).map((o) => ({ id:'endereco', servicoFreteId:o.servicoFrete?.id, nome:o.servicoFrete ? `${o.servicoFrete.transportadora} · ${o.servicoFrete.nome}` : 'Entrega', valor:o.frete/100, prazo:`${o.prazoDias} dia(s)`, disponivel:true })) }
  } catch (erro) {
    return { opcoes: [{ id: 'endereco', disponivel: false, motivo: erro.erro ?? 'Não foi possível calcular a entrega. Tente novamente.' }] }
  }
}
