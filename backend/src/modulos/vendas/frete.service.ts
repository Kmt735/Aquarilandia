import { calcularTransportes, transporteConfigurado, type ServicoFrete, type OpcaoTransporte, type ItemTransporte } from './frete.transporte.js'
import { buscarLogistica } from '../catalogo/produto.logistica.js'
import { env } from '../../config/env.js'
// Função PURA: o resultado depende só da entrada e da config (sem banco, sem rede, sem data atual).
// Por isso dá para testar cada regra sem servidor nem PostgreSQL, e a mesma regra serve à cotação
// (POST /api/frete/calcular, #28) e à criação da venda (#30), sem as duas calcularem o frete de jeitos diferentes.
import { AppError } from '../../utils/AppError.js'
import { produtoService } from '../catalogo/produto.service.js'
import { configFrete, configuracaoFrete } from './frete.config.js'
import { cepService } from './cep.service.js'
import type { ConfigFrete, FaixaCep } from './frete.config.js'
import type { CotacaoFrete } from './venda.types.js'
import { exigirDisponiveis, precificar, somarTotal, traduzirErroFrete, validarPedido } from './venda.validacao.js'

export interface EntradaFrete {
  cep?: string
  retirada: boolean
  itens: readonly { categoria: string }[]
  subtotal: number
  municipioIbge?: string
}

export interface ResultadoFrete {
  servicoFrete?: ServicoFrete
  opcoesFrete?: OpcaoTransporte[]
  frete: number
  prazoDias: number
  tipoEntrega: 'correios' | 'propria' | 'retirada'
}

const msgCepInvalido = 'Informe um CEP válido com 8 números ou escolha retirar na loja.'
const msgPeixeForaDaArea = 'Este peixe só pode ser entregue em São João del Rei.'

function erroCep(): AppError {
  return new AppError('Dados inválidos', 422, { cep: msgCepInvalido })
}

// Comparar como texto funciona porque todo CEP aqui tem exatamente 8 dígitos: com o mesmo tamanho,
// a ordem alfabética de '0'–'9' é a mesma ordem numérica ('36300000' < '36310000')
function estaNaFaixa(cep: string, faixa: Readonly<FaixaCep>): boolean {
  return cep >= faixa.cepInicio && cep <= faixa.cepFim
}

export function calcularFrete(entrada: EntradaFrete, config: Readonly<ConfigFrete> = configFrete): ResultadoFrete {
  // a) Retirada: o CEP, se vier, é ignorado; peixe é aceito porque o cliente busca na loja, em São João del Rei
  if (entrada.retirada === true) return { frete: 0, prazoDias: config.prazoRetiradaDias, tipoEntrega: 'retirada' }

  // b) Entrega precisa de CEP com 8 dígitos (a máscara já foi tirada por quem chama, mas a função confere)
  const cep = entrada.cep
  if (typeof cep !== 'string' || !/^[0-9]{8}$/.test(cep)) throw erroCep()

  let resultado: ResultadoFrete
  // c) São João del Rei ANTES das faixas do Brasil: a faixa de Minas contém a da cidade e ganharia dela
  if (entrada.municipioIbge !== undefined ? entrada.municipioIbge === '3162500' : estaNaFaixa(cep, config.saoJoaoDelRei)) {
    resultado = { frete: config.saoJoaoDelRei.valor, prazoDias: config.saoJoaoDelRei.prazoDias, tipoEntrega: 'propria' }
  } else {
    // d) Resto do Brasil. CEP fora de todas as faixas (ex.: 00000000–00999999) é tratado como CEP inválido
    const faixa = config.faixasBrasil.find((item) => estaNaFaixa(cep, item))
    if (!faixa) throw erroCep()

    // Um detalhe por item de peixe, no índice em que ele veio, para o frontend marcar o item certo
    const detalhes: Record<string, string> = {}
    entrada.itens.forEach((item, indice) => {
      if (item.categoria === config.categoriaPeixe) detalhes[`itens.${indice}.produtoId`] = msgPeixeForaDaArea
    })
    if (Object.keys(detalhes).length) {
      throw new AppError('Peixes vivos só são entregues em São João del Rei.', 422, detalhes)
    }

    resultado = { frete: faixa.valor, prazoDias: faixa.prazoDias, tipoEntrega: 'correios' }
  }

  // e) Frete grátis vale para entrega própria e Correios (a retirada já é 0); o prazo não muda
  if (config.freteGratisAcima !== null && entrada.subtotal >= config.freteGratisAcima) resultado.frete = 0
  return resultado
}

// Um único seletor para a estimativa e o recálculo final sob locks do catálogo.
export function resolverEntrega(entrada: EntradaFrete & { itens: readonly ItemTransporte[]; servicoFreteId?: string }): ResultadoFrete {
  if (entrada.retirada) return calcularFrete(entrada, configuracaoFrete(true))
  if (transporteConfigurado() || env.nodeEnv === 'production') {
    const opcoesFrete = calcularTransportes({ cep: entrada.cep!, municipioIbge: entrada.municipioIbge! }, entrada.itens)
    const escolhida = entrada.servicoFreteId ? opcoesFrete.find((o) => o.servicoFrete.id === entrada.servicoFreteId) : opcoesFrete[0]
    if (!escolhida) throw new AppError('Não há modalidade compatível com o endereço e as embalagens deste pedido. Escolha retirada ou fale com a loja.', entrada.servicoFreteId ? 409 : 422)
    return { ...escolhida, opcoesFrete }
  }
  if (entrada.servicoFreteId) throw new AppError('O serviço escolhido não está disponível. Confira a entrega.',409)
  return calcularFrete(entrada,configuracaoFrete(false)) // Somente development/test, explicitamente ilustrativo.
}

export const freteService = {
  // POST /api/frete/calcular (#28): mesma validação e mesmo calcularFrete da criação da venda (#30), só que sem
  // login, sem transação e sem trava (buscarParaVenda sem executor). O valor é uma estimativa: a venda recalcula
  // tudo com os preços travados no momento da compra.
  async cotar(body: unknown): Promise<CotacaoFrete> {
    const { itens, entrega } = validarPedido(body, 'cep')
    const produtos = await produtoService.buscarParaVenda(itens.map((item) => item.produtoId))
    const { linhas, subtotal } = precificar(itens, exigirDisponiveis(itens, produtos))

    let resultado: ResultadoFrete
    try {
      // linhas está na ordem dos itens somados: o índice do erro do peixe é traduzido com essa mesma lista
      const destino = entrega.retirada ? null : await cepService.consultar(entrega.cep)
      const logistica = entrega.retirada ? new Map() : await buscarLogistica(itens.map((i) => i.produtoId))
      resultado = resolverEntrega({ ...entrega, itens: linhas.map((l) => ({...l, logistica:logistica.get(l.produtoId)})), subtotal, municipioIbge: destino?.municipioIbge })
    } catch (err) {
      traduzirErroFrete(err, itens)
    }
    return { ...resultado, subtotal, total: somarTotal(subtotal, resultado.frete) }
  },
}
