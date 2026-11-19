import { env } from '../../config/env.js'
import { AppError } from '../../utils/AppError.js'
import type { LogisticaProduto } from '../catalogo/produto.logistica.js'

export interface ServicoFrete { id: string; nome: string; transportadora: string; rastreioCorreios: boolean }
export interface OpcaoTransporte {
  frete: number; prazoDias: number; tipoEntrega: 'correios' | 'propria'; servicoFrete: ServicoFrete
}
interface Base { id: string; nome: string; transportadora: string; prazoTransporteDias: number }
interface Local extends Base { tipoEntrega: 'propria'; valorCentavos: number }
interface Nacional extends Base {
  tipoEntrega: 'correios'; cepInicio: string; cepFim: string; rastreioCorreios: boolean
  fatorCubagemCm3PorKg: number; maxPesoG: number; maxComprimentoCm: number; maxLarguraCm: number; maxAlturaCm: number
  maxSomaDimensoesCm: number; faixasPeso: { ateGramas: number; valorCentavos: number }[]
}
export interface TabelaTransporte { servicos: (Local | Nacional)[] }
const inteiro = (v: unknown, min: number, max: number) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max
export function lerTabelaTransporte(json: string): TabelaTransporte {
  try {
    const t = JSON.parse(json) as TabelaTransporte
    if (!t || !Array.isArray(t.servicos) || !t.servicos.length || t.servicos.length > 30) throw new Error()
    const ids = new Set<string>()
    for (const s of t.servicos) {
      if (!s || typeof s.id !== 'string' || !/^[a-z0-9_-]{1,60}$/.test(s.id) || ids.has(s.id)
        || ![s.nome,s.transportadora].every((v) => typeof v === 'string' && v.trim().length > 0 && v.length <= 120 && !/[\x00-\x1f]/.test(v))
        || !inteiro(s.prazoTransporteDias,0,120)) throw new Error()
      ids.add(s.id)
      if (s.tipoEntrega === 'propria') { if (!inteiro(s.valorCentavos,0,2147483647)) throw new Error(); continue }
      if (s.tipoEntrega !== 'correios' || !/^\d{8}$/.test(s.cepInicio) || !/^\d{8}$/.test(s.cepFim) || s.cepInicio > s.cepFim
        || typeof s.rastreioCorreios !== 'boolean' || !inteiro(s.fatorCubagemCm3PorKg,1,1000000)
        || !inteiro(s.maxPesoG,1,1000000) || !inteiro(s.maxSomaDimensoesCm,1,900)
        || ![s.maxComprimentoCm,s.maxLarguraCm,s.maxAlturaCm].every((v) => inteiro(v,1,300))
        || !Array.isArray(s.faixasPeso) || !s.faixasPeso.length || s.faixasPeso.length > 100) throw new Error()
      let anterior = 0
      for (const f of s.faixasPeso) {
        if (!f || !inteiro(f.ateGramas,anterior+1,s.maxPesoG) || !inteiro(f.valorCentavos,0,2147483647)) throw new Error()
        anterior = f.ateGramas
      }
      if (anterior !== s.maxPesoG) throw new Error()
    }
    return t
  } catch { throw new Error('FRETE_TRANSPORTE_JSON inválida. Confira os serviços e as tarifas aprovadas; valores não são exibidos no erro.') }
}
// Carrega uma vez. Somente tarifas aprovadas por quem opera a loja, sem números ilustrativos de fallback.
const tabela = env.freteTransporteJson ? lerTabelaTransporte(env.freteTransporteJson) : undefined
export function transporteConfigurado(): boolean { return tabela !== undefined }
export interface ItemTransporte { produtoId: number; categoria: string; quantidade: number; logistica?: LogisticaProduto }
export function calcularTransportes(
  destino: { cep: string; municipioIbge: string }, itens: readonly ItemTransporte[], config = tabela,
): OpcaoTransporte[] {
  if (!config) throw new AppError('As entregas aguardam configuração de tarifas e prazos. Escolha retirada na loja.', 503)
  const local = destino.municipioIbge === '3162500'
  if (!local && itens.some((i) => i.categoria === 'peixes')) throw new AppError('Peixes vivos só são entregues em São João del Rei. Escolha retirada na loja.', 422)
  const opcoes: OpcaoTransporte[] = []
  for (const s of config.servicos) {
    if (local !== (s.tipoEntrega === 'propria')) continue
    let frete = 0, preparacao = 0, compativel = true
    if (s.tipoEntrega === 'propria') {
      frete = s.valorCentavos
      // O prazo de preparação precisa ser cadastrado mesmo em entrega própria.
      if (itens.some((i) => !i.logistica)) continue
      preparacao = Math.max(...itens.map((i) => i.logistica!.prazoPreparacaoDias))
    } else {
      if (destino.cep < s.cepInicio || destino.cep > s.cepFim) continue
      for (const i of itens) {
        const l = i.logistica
        if (!l || !l.envioConvencional || l.comprimentoCm > s.maxComprimentoCm || l.larguraCm > s.maxLarguraCm
          || l.alturaCm > s.maxAlturaCm || l.comprimentoCm+l.larguraCm+l.alturaCm > s.maxSomaDimensoesCm) { compativel=false; break }
        // Cada unidade é um volume individual com embalagem cadastrada. Nunca supõe encaixe/consolidação.
        const peso = Math.max(l.pesoG, Math.ceil(l.comprimentoCm*l.larguraCm*l.alturaCm*1000/s.fatorCubagemCm3PorKg))
        const faixa = s.faixasPeso.find((f) => peso <= f.ateGramas)
        if (peso > s.maxPesoG || !faixa) { compativel=false; break }
        frete += faixa.valorCentavos*i.quantidade
        preparacao = Math.max(preparacao,l.prazoPreparacaoDias)
      }
    }
    if (compativel && Number.isSafeInteger(frete) && frete <= 2147483647) opcoes.push({ frete, prazoDias: preparacao+s.prazoTransporteDias,
      tipoEntrega: s.tipoEntrega, servicoFrete: { id:s.id,nome:s.nome,transportadora:s.transportadora,rastreioCorreios:s.tipoEntrega==='correios' && s.rastreioCorreios } })
  }
  return opcoes.sort((a,b) => a.frete-b.frete || a.prazoDias-b.prazoDias || a.servicoFrete.id.localeCompare(b.servicoFrete.id))
}
