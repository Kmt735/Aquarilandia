// Lógica pura do "Monte seu Aquário": escolhas → linhas, totais, dados das regras e mensagem do WhatsApp.
// Sem React e sem API (testes/montagem.test.mjs). As regras de compatibilidade ficam em ./compatibilidade.js.
import { analisarMontagem, filtroAtende, luminariaAtende, medidasAquario, sugerirSubstrato, termostatoAtende } from './compatibilidade.js'

export const ETAPAS = ['aquario', 'equipamentos', 'substrato', 'decoracao', 'plantas', 'peixes']
export const VERSAO_MONTAGEM = 1
export const CHAVE_MONTAGEM = `aquarilandia-monte-aquario-v${VERSAO_MONTAGEM}`
export const LIMITE_QTD_MONTAGEM = 99

export const montagemVazia = () => ({
  versao: VERSAO_MONTAGEM, etapa: 0, concluidas: [], aquarioProprio: null,
  escolhas: Object.fromEntries(ETAPAS.map((e) => [e, []])),
})

const inteiroPositivo = (v) => Number.isSafeInteger(v) && v > 0
const listaDe = (v) => (Array.isArray(v) ? v : [])

/** Lê o progresso salvo. Qualquer formato inesperado ou versão diferente vira uma montagem nova. */
export function lerMontagemSalva(bruto) {
  if (!bruto) return montagemVazia()
  let d
  try { d = JSON.parse(bruto) } catch { return montagemVazia() }
  if (d?.versao !== VERSAO_MONTAGEM || typeof d.escolhas !== 'object' || !d.escolhas) return montagemVazia()
  const escolhas = Object.fromEntries(ETAPAS.map((e) => [e, listaDe(d.escolhas[e])
    .filter((x) => inteiroPositivo(x?.id) && inteiroPositivo(x?.qtd))
    .map(({ id, qtd }) => ({ id, qtd: Math.min(qtd, LIMITE_QTD_MONTAGEM) }))]))
  escolhas.aquario = escolhas.aquario.slice(0, 1).map((x) => ({ ...x, qtd: 1 }))
  const p = d.aquarioProprio
  const aquarioProprio = p && Number.isFinite(p.litros) && p.litros > 0 && ['doce', 'marinho'].includes(p.tipoAgua)
    ? { litros: p.litros, tipoAgua: p.tipoAgua } : null
  return {
    versao: VERSAO_MONTAGEM, aquarioProprio, escolhas,
    etapa: Number.isInteger(d.etapa) && d.etapa >= 0 && d.etapa < ETAPAS.length ? d.etapa : 0,
    concluidas: listaDe(d.concluidas).filter((e) => ETAPAS.includes(e)),
  }
}

export const fichaDe = (item) => item?.fichaTecnica?.dados ?? {}

/** O aquário da montagem: o escolhido no catálogo ou o que o cliente já tem. */
export function aquarioDaMontagem(montagem, porId) {
  if (montagem.aquarioProprio) {
    const { litros, tipoAgua } = montagem.aquarioProprio
    return { proprio: true, nome: 'Seu aquário', litros, tipoAgua, medidas: medidasAquario({ litros }) }
  }
  const item = porId.get(montagem.escolhas.aquario[0]?.id)
  if (!item) return null
  const f = fichaDe(item)
  return { proprio: false, item, nome: item.nome, litros: f.volumeLitros ?? item.volumeLitros ?? null, tipoAgua: f.tipoAgua ?? null, medidas: medidasAquario({ litros: f.volumeLitros, ...f }) }
}

/** Linhas escolhidas por etapa (ignora IDs que saíram do catálogo). */
export function linhasDaMontagem(montagem, porId) {
  return Object.fromEntries(ETAPAS.map((etapa) => [etapa, montagem.escolhas[etapa]
    .map(({ id, qtd }) => ({ etapa, id, qtd, item: porId.get(id) }))
    .filter((l) => l.item)]))
}

const centavos = (item) => (item.centavos ? item.preco : Math.round((item.preco ?? 0) * 100))

/** Subtotais por etapa e total estimado, em centavos. */
export function totaisDaMontagem(linhas) {
  const porEtapa = Object.fromEntries(ETAPAS.map((e) => [e, linhas[e].reduce((s, l) => s + centavos(l.item) * l.qtd, 0)]))
  return { porEtapa, total: Object.values(porEtapa).reduce((a, b) => a + b, 0) }
}

/** Monta a entrada de analisarMontagem a partir das linhas. */
export function entradaDasRegras(aquario, linhas) {
  const doTipo = (etapa, slug) => linhas[etapa].filter((l) => !slug || l.item.categoriaSlug === slug)
  // A ficha vem primeiro: a de plantas tem um campo `nome` (científico) que não pode trocar o nome do produto
  const comFicha = (l) => ({ ...fichaDe(l.item), id: l.id, nome: l.item.nome, qtd: l.qtd })
  return {
    aquario: aquario ? { nome: aquario.nome, litros: aquario.litros, tipoAgua: aquario.tipoAgua } : null,
    peixes: doTipo('peixes').map((l) => ({ ...comFicha(l), incompativelCom: fichaDe(l.item).incompativelCom ?? [] })),
    filtros: doTipo('equipamentos', 'filtros').map(comFicha),
    termostatos: doTipo('equipamentos', 'termostatos').map(comFicha),
    plantas: doTipo('plantas').map(comFicha),
    decoracoes: doTipo('decoracao').map(comFicha),
  }
}

export const avisosDaMontagem = (aquario, linhas) => analisarMontagem(entradaDasRegras(aquario, linhas))

/** "Recomendado para o seu aquário": equipamento que atende o volume/medida escolhidos. */
export function recomendado(item, aquario) {
  if (!aquario) return false
  const f = fichaDe(item)
  if (item.categoriaSlug === 'filtros') return filtroAtende(f, aquario.litros) === true
  if (item.categoriaSlug === 'termostatos') return termostatoAtende(f, aquario.litros) === true
  if (item.categoriaSlug === 'iluminacao') return luminariaAtende(f, aquario.medidas?.comprimentoCm) === true
  if (item.categoriaSlug === 'substratos') return aquario.tipoAgua === 'marinho' ? f.tipo === 'coral' : f.tipo !== 'coral'
  return false
}

/** Recomendados primeiro, depois disponíveis, depois por preço. */
export const ordenarPorRecomendacao = (itens, aquario) =>
  [...itens].sort((a, b) => (recomendado(b, aquario) - recomendado(a, aquario)) || (b.emEstoque - a.emEstoque) || (a.preco - b.preco))

export const sugestaoSubstrato = (aquario, item) => sugerirSubstrato(aquario?.medidas ?? null, fichaDe(item).pesoKg)

const reais = (c) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100)
const AGUA = { doce: 'água doce', marinho: 'água salgada', ambos: 'água doce ou salgada' }

/** Texto do WhatsApp com o resumo da montagem (o link é codificado por linkWhatsApp). */
export function mensagemWhatsApp({ aquario, linhas, totais, avisos, rotulos }) {
  const itens = ETAPAS.flatMap((e) => linhas[e])
  if (!aquario && !itens.length) {
    return 'Olá! Quero montar meu primeiro aquário, mas ainda não sei o que escolher. Vocês podem me ajudar?'
  }
  const partes = ['Olá! Montei um aquário no site da Aquarilândia e queria a orientação de vocês.']
  if (aquario) {
    const tipo = aquario.tipoAgua ? `, ${AGUA[aquario.tipoAgua]}` : ''
    partes.push(`*Aquário:* ${aquario.proprio ? 'já tenho um' : aquario.nome} (${aquario.litros} L${tipo})`)
  } else {
    partes.push('*Aquário:* ainda não escolhi')
  }
  const grupos = ETAPAS.filter((e) => e !== 'aquario' && linhas[e].length)
    .map((e) => `*${rotulos[e]}:*\n${linhas[e].map((l) => `- ${l.qtd}x ${l.item.nome} (${reais(centavos(l.item) * l.qtd)})`).join('\n')}`)
  if (grupos.length) partes.push(grupos.join('\n\n'))
  if (itens.length) partes.push(`*Total estimado:* ${reais(totais.total)} (sem frete)`)
  if (avisos.length) {
    partes.push(`*Avisos do site:*\n${avisos.map((a) => `- ${a.nivel === 'incompativel' ? 'Incompatível' : 'Atenção'}: ${a.titulo}`).join('\n')}`)
  }
  partes.push('Ainda estou decidindo. Vocês me ajudam a conferir?')
  return partes.join('\n\n')
}
