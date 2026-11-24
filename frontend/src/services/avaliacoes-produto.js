// Avaliações de produtos e peixes (nota + comentário), mostradas na página de cada item.
//
// Vêm da API (backend/src/modulos/avaliacoes): o site mostra só as APROVADAS pela loja; a avaliação nova nasce
// "pendente" (ou "aprovada", se a loja ligar AVALIACOES_PUBLICAR_DIRETO) e a resposta do envio diz qual.
// Peixe também é produto na API: os dois usam /produtos/:id/avaliacoes.
//
// O localStorage guarda só a MARCA "este navegador já avaliou este item" (para não mostrar o formulário de novo),
// nunca a avaliação em si.
import { requisitarApi } from './api.js'
import { ErroApi } from './http.js'
import { NOTAS } from '../data/avaliacao-site.js'

export const LIMITE_COMENTARIO_PRODUTO = 500
export const LIMITE_NOME = 40
const CHAVE_JA_AVALIADOS = 'aquarilandia-avaliacoes-produto-feitas'

// A marca de "já avaliado" separa peixe de produto (a página de cada um tem a sua)
export const chaveItem = (item) => `${item?.tipo === 'peixe' ? 'peixe' : 'produto'}:${item?.id}`

function lerMarcas() {
  try {
    const dados = JSON.parse(localStorage.getItem(CHAVE_JA_AVALIADOS) ?? '{}')
    return dados && typeof dados === 'object' ? dados : {}
  } catch {
    return {}
  }
}

function marcarAvaliado(item) {
  try {
    localStorage.setItem(CHAVE_JA_AVALIADOS, JSON.stringify({ ...lerMarcas(), [chaveItem(item)]: Date.now() }))
  } catch {
    // armazenamento bloqueado: o formulário pode aparecer de novo, sem problema
  }
}

export const jaAvaliou = (item) => Boolean(lerMarcas()[chaveItem(item)])

// O que vai para a API (o servidor valida de novo e tira HTML)
export function montarAvaliacaoProduto({ nota, nome, comentario }) {
  if (!NOTAS.includes(nota)) throw new ErroApi('Escolha uma nota de 1 a 5.', { nota: 'Escolha uma nota de 1 a 5.' })
  return {
    nota,
    nome: String(nome ?? '').trim().replace(/\s+/g, ' ').slice(0, LIMITE_NOME) || null,
    comentario: String(comentario ?? '').trim().slice(0, LIMITE_COMENTARIO_PRODUTO) || null,
  }
}

export const RESUMO_VAZIO = { total: 0, media: 0, distribuicao: [...NOTAS].reverse().map((nota) => ({ nota, qtd: 0 })) }

// { itens: [{ id, nota, nome, comentario, criadaEm }], resumo: { total, media, distribuicao } }
export async function listarAvaliacoesProduto(item) {
  const r = await requisitarApi(`/produtos/${encodeURIComponent(item.id)}/avaliacoes`)
  return { itens: Array.isArray(r?.itens) ? r.itens : [], resumo: r?.resumo ?? RESUMO_VAZIO }
}

// Devolve a avaliação criada, com o status ("pendente" ou "aprovada")
export async function enviarAvaliacaoProduto(item, dados) {
  const corpo = montarAvaliacaoProduto(dados)
  const criada = await requisitarApi(`/produtos/${encodeURIComponent(item.id)}/avaliacoes`, { metodo: 'POST', corpo })
  marcarAvaliado(item)
  return criada
}

// Soma avaliações recém-publicadas a um resumo vindo da API (sem recarregar a lista)
export function somarAoResumo(resumo, novas) {
  if (!novas.length) return resumo
  const total = resumo.total + novas.length
  const soma = resumo.media * resumo.total + novas.reduce((s, a) => s + a.nota, 0)
  return {
    total,
    media: soma / total,
    distribuicao: resumo.distribuicao.map((d) => ({ ...d, qtd: d.qtd + novas.filter((a) => a.nota === d.nota).length })),
  }
}
