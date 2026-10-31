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
    const faixa = faixasPreco.find((x) => x.valor === filtros.preco)
    if (filtros.preco && !faixa) throw new ErroApi('Faixa de preço inválida.')
    const categorias = await listarCategorias()
    const parametros = { busca: filtros.busca?.trim() || undefined }
    if (peixes) {
      parametros.tipo_agua = escolher(filtros.agua === 'salgada' ? 'marinho' : filtros.agua, ['doce', 'marinho', 'salobra'])
      parametros.temperamento = escolher(filtros.temperamento, ['pacifico', 'semi_agressivo', 'agressivo'])
      parametros.dificuldade = escolher(filtros.dificuldade, ['iniciante', 'intermediario', 'avancado'])
    } else {
      const categoria = categorias.find((c) => c.slug === filtros.categoria || c.nome === filtros.categoria)
      if (filtros.categoria && !categoria) throw new ErroApi('Categoria não encontrada.', {}, 404)
      parametros.categoria = categoria?.slug
      parametros.preco_min = faixa?.min
      parametros.preco_max = Number.isFinite(faixa?.max) ? faixa.max : undefined
      parametros.ordem = ORDENS[ordem ?? 'padrao']
    }
    const caminho = peixes ? '/peixes' : '/produtos'
    // A API de peixes não ordena por preço; disponibilidade e Z–A também são opções só da UI.
    // Nesses casos, filtra o conjunto completo, nunca somente uma página do servidor.
    const local = Boolean(disponibilidade || ordem === 'z-a' || (peixes && (faixa || (ordem && !['padrao', 'a-z'].includes(ordem)))))
    if (local) {
      let itens = (await todasPaginas(caminho, parametros)).map((p) => normalizarProduto(p, categorias))
      if (disponibilidade) itens = itens.filter((p) => p.emEstoque === ['in', 'disponivel'].includes(disponibilidade))
      if (peixes && faixa) itens = itens.filter((p) => p.preco >= faixa.min && p.preco <= faixa.max)
      itens = ordenarItens(itens, ordem ?? 'a-z')
      return { itens: itens.slice((pagina - 1) * limite, pagina * limite), total: itens.length, pagina, totalPaginas: Math.max(1, Math.ceil(itens.length / limite)) }
    }
    const resposta = lerEnvelope(await consultar(caminho, { ...parametros, pagina, limite }))
    return { itens: resposta.itens.map((p) => normalizarProduto(p, categorias)), total: resposta.total, pagina, totalPaginas: Math.max(1, Math.ceil(resposta.total / limite)) }
  }
  async function obter(id, caminho) {
    const numero = idValido(id)
    const [produto, categorias] = await Promise.all([consultar(`${caminho}/${numero}`), listarCategorias()])
    return normalizarProduto(produto, categorias)
  }
  return {
    listarCategorias,
    listarProdutos: (filtros) => listar(filtros), listarPeixes: (filtros) => listar(filtros, true),
    obterProduto: (id) => obter(id, '/produtos'), obterPeixe: (id) => obter(id, '/peixes'),
  }
}

export const { listarCategorias, listarProdutos, listarPeixes, obterProduto, obterPeixe } = criarCatalogo()

// Protótipo independente do catálogo público; ainda não existe POST /api/avise-me.
export async function aviseMe({ itemId, email }) {
  await simularRede(500)
  return { itemId, email }
}
