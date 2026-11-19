import { CATALOGO_MOCK } from '../config/ambiente.js'
import { consultarApi } from './api-publica.js'
import { lerCategoria, lerEnvelope, normalizarProduto } from './catalogo-mapeamento.js'
import { ErroApi, simularRede } from './http.js'
import { faixasPreco } from '../data/categorias.js'
import { ordenarItens } from '../utils/catalogo.js'

const ORDENS = { padrao: 'nome', 'a-z': 'nome', 'menor-preco': 'preco', 'maior-preco': '-preco', 'z-a': 'nome' }
const inteiro = (valor, padrao, maximo) => {
  const texto = String(valor === undefined || valor === null || valor === '' ? padrao : valor)
  if (!/^[1-9]\d*$/.test(texto) || !Number.isSafeInteger(Number(texto)) || Number(texto) > maximo) throw new ErroApi('Paginação inválida.')
  return Number(texto)
}
const escolher = (valor, opcoes) => {
  if (valor && !opcoes.includes(valor)) throw new ErroApi('Filtro inválido.')
  return valor || undefined
}
const idValido = (id) => inteiro(id, '', 2147483647)
// Tipo de água da URL (doce, salgada ou salobra) → valor da API (doce, marinho, salobra)
const AGUA_API = { doce: 'doce', salgada: 'marinho', marinho: 'marinho', salobra: 'salobra' }
// Preço digitado em reais ("49,90" ou "50") → centavos; vazio = sem limite
const reaisParaCentavos = (valor) => {
  if (valor === undefined || valor === null || valor === '') return undefined
  const texto = String(valor).trim().replace(',', '.')
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(texto)) throw new ErroApi('Faixa de preço inválida.')
  return Math.round(Number(texto) * 100)
}
// Faixa de preço em centavos: os campos mínimo/máximo valem mais que a faixa pronta (links antigos com ?preco=)
export function limitesPreco({ min, max, preco } = {}) {
  const faixa = faixasPreco.find((x) => x.valor === preco)
  if (preco && !faixa) throw new ErroApi('Faixa de preço inválida.')
  let minimo = reaisParaCentavos(min)
  let maximo = reaisParaCentavos(max)
  if (minimo === undefined && maximo === undefined && faixa) {
    minimo = faixa.min || undefined
    maximo = Number.isFinite(faixa.max) ? faixa.max : undefined
  }
  if (minimo !== undefined && maximo !== undefined && minimo > maximo) throw new ErroApi('O preço mínimo é maior que o máximo.')
  return { minimo, maximo }
}

// Injeção apenas da consulta permite testar o contrato sem mocks de catálogo em produção.
export function criarCatalogo(consultar = consultarApi) {
  async function todasPaginas(caminho, parametros) {
    const itens = []
    for (let pagina = 1; ; pagina++) {
      const resposta = lerEnvelope(await consultar(caminho, { ...parametros, pagina, limite: 100 }))
      itens.push(...resposta.itens)
      if (itens.length >= resposta.total || !resposta.itens.length) return itens
    }
  }
  async function listarCategorias() {
    return (await todasPaginas('/categorias', {})).map(lerCategoria)
  }
  async function listar(filtros = {}, peixes = false) {
    const pagina = inteiro(filtros.pagina, 1, 2147483647)
    const limite = inteiro(filtros.limite, 9, 100)
    const ordem = escolher(filtros.ordem, Object.keys(ORDENS))
    const disponibilidade = escolher(filtros.disponibilidade, ['in', 'out', 'disponivel', 'esgotado'])
    const { minimo, maximo } = limitesPreco(filtros)
    const faixa = minimo !== undefined || maximo !== undefined
    if (filtros.agua && !AGUA_API[filtros.agua]) throw new ErroApi('Filtro inválido.')
    // Peixes já trazem categoria e ficha no próprio DTO; metadados do menu são independentes.
    const categorias = peixes ? [] : await listarCategorias()
    const parametros = { busca: filtros.busca?.trim() || undefined }
    if (filtros.agua) parametros.tipo_agua = AGUA_API[filtros.agua]
    if (peixes) {
      parametros.tipo_agua = AGUA_API[filtros.agua]
      parametros.temperamento = escolher(filtros.temperamento, ['pacifico', 'semi_agressivo', 'agressivo'])
      parametros.dificuldade = escolher(filtros.dificuldade, ['iniciante', 'intermediario', 'avancado'])
      if (disponibilidade) parametros.em_estoque = String(['in', 'disponivel'].includes(disponibilidade))
    } else {
      const categoria = categorias.find((c) => c.slug === filtros.categoria || c.nome === filtros.categoria)
      if (filtros.categoria && !categoria) throw new ErroApi('Categoria não encontrada.', {}, 404)
      parametros.categoria = categoria?.slug
      parametros.preco_min = minimo
      parametros.preco_max = maximo
      parametros.ordem = ORDENS[ordem ?? 'padrao']
    }
    const caminho = peixes ? '/peixes' : '/produtos'
    // A API de peixes não ordena por preço; disponibilidade de produtos e Z–A são opções só da UI.
    // Nesses casos, filtra o conjunto completo, nunca somente uma página do servidor.
    const local = Boolean((!peixes && disponibilidade) || ordem === 'z-a' || (peixes && (faixa || (ordem && !['padrao', 'a-z'].includes(ordem)))))
    if (local) {
      let itens = (await todasPaginas(caminho, parametros)).map((p) => normalizarProduto(p, categorias))
      if (disponibilidade) itens = itens.filter((p) => p.emEstoque === ['in', 'disponivel'].includes(disponibilidade))
      if (peixes && faixa) itens = itens.filter((p) => p.preco >= (minimo ?? 0) && p.preco <= (maximo ?? Infinity))
      itens = ordenarItens(itens, ordem ?? 'a-z')
      return { itens: itens.slice((pagina - 1) * limite, pagina * limite), total: itens.length, pagina, totalPaginas: Math.max(1, Math.ceil(itens.length / limite)) }
    }
    const resposta = lerEnvelope(await consultar(caminho, { ...parametros, pagina, limite }))
    return { itens: resposta.itens.map((p) => normalizarProduto(p, categorias)), total: resposta.total, pagina, totalPaginas: Math.max(1, Math.ceil(resposta.total / limite)) }
  }
  async function obter(id, caminho) {
    const numero = idValido(id)
    const [produto, categorias] = await Promise.all([consultar(`${caminho}/${numero}`), caminho === '/peixes' ? [] : listarCategorias()])
    return normalizarProduto(produto, categorias)
  }
  return {
    listarCategorias,
    listarProdutos: (filtros) => listar(filtros), listarPeixes: (filtros) => listar(filtros, true),
    obterProduto: (id) => obter(id, '/produtos'), obterPeixe: (id) => obter(id, '/peixes'),
  }
}

// VITE_CATALOGO_MOCK=true (só no .env.local) usa os dados de demonstração. O import é dinâmico: o mock
// fica num arquivo separado, que só é baixado com a chave ligada.
const consultaPadrao = CATALOGO_MOCK
  ? async (...args) => (await import('../mocks/catalogo-api.js')).consultarMock(...args)
  : consultarApi

export const { listarCategorias, listarProdutos, listarPeixes, obterProduto, obterPeixe } = criarCatalogo(consultaPadrao)

// Protótipo independente do catálogo público; ainda não existe POST /api/avise-me.
export async function aviseMe({ itemId, email }) {
  await simularRede(500)
  return { itemId, email }
}
