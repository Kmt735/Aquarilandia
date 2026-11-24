// Avaliações de produtos e peixes (nota + comentário), mostradas na página de cada item.
//
// TODO INTEGRAÇÃO: hoje tudo fica no localStorage DESTE navegador (protótipo; mocks/avaliacoes-produto.js).
// No backend, troque o corpo das funções por:
//   GET  /api/produtos/:id/avaliacoes   (lista pública, mais recentes primeiro)
//   POST /api/produtos/:id/avaliacoes   (exigir login e, de preferência, compra entregue: selo "Compra verificada")
// e modere os comentários antes de publicar. Os componentes não precisam mudar.
import { CHAVE_AVALIACOES_PRODUTO, CHAVE_JA_AVALIADOS } from '../mocks/avaliacoes-produto.js'
import { ErroApi, simularRede } from './http.js'
import { NOTAS } from '../data/avaliacao-site.js'

export const LIMITE_COMENTARIO_PRODUTO = 500
export const LIMITE_NOME = 40

// Peixe e produto podem ter o mesmo id numérico: a chave junta o tipo
export const chaveItem = (item) => `${item?.tipo === 'peixe' ? 'peixe' : 'produto'}:${item?.id}`

function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave)
    const dados = bruto ? JSON.parse(bruto) : padrao
    return dados && typeof dados === 'object' ? dados : padrao
  } catch {
    return padrao
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
  } catch {
    // armazenamento bloqueado: a avaliação aparece só enquanto a página estiver aberta
  }
}

export function montarAvaliacaoProduto({ nota, nome, comentario }, agora = Date.now()) {
  if (!NOTAS.includes(nota)) throw new ErroApi('Escolha uma nota de 1 a 5.', { nota: 'Escolha uma nota de 1 a 5.' })
  return {
    id: `${agora.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    criadaEm: new Date(agora).toISOString(),
    nota,
    nome: String(nome ?? '').trim().replace(/\s+/g, ' ').slice(0, LIMITE_NOME) || null,
    comentario: String(comentario ?? '').trim().slice(0, LIMITE_COMENTARIO_PRODUTO) || null,
  }
}

const valida = (a) => a && NOTAS.includes(a.nota) && typeof a.criadaEm === 'string'

export async function listarAvaliacoesProduto(item) {
  await simularRede(250)
  const lista = ler(CHAVE_AVALIACOES_PRODUTO, {})[chaveItem(item)]
  return Array.isArray(lista) ? lista.filter(valida).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)) : []
}

export async function enviarAvaliacaoProduto(item, dados) {
  const avaliacao = montarAvaliacaoProduto(dados)
  await simularRede(400)
  const chave = chaveItem(item)
  const todas = ler(CHAVE_AVALIACOES_PRODUTO, {})
  gravar(CHAVE_AVALIACOES_PRODUTO, { ...todas, [chave]: [...(Array.isArray(todas[chave]) ? todas[chave] : []), avaliacao] })
  gravar(CHAVE_JA_AVALIADOS, { ...ler(CHAVE_JA_AVALIADOS, {}), [chave]: avaliacao.criadaEm })
  return avaliacao
}

export const jaAvaliou = (item) => Boolean(ler(CHAVE_JA_AVALIADOS, {})[chaveItem(item)])

export function resumirNotas(lista) {
  const total = lista.length
  return {
    total,
    media: total ? lista.reduce((s, a) => s + a.nota, 0) / total : 0,
    distribuicao: [...NOTAS].reverse().map((nota) => ({ nota, qtd: lista.filter((a) => a.nota === nota).length })),
  }
}
