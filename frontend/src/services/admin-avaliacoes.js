import { requisitarApi } from './api'

// Moderação das avaliações (painel do admin). tipo: 'produtos' ou 'site'
export const EVENTO_AVALIACOES_MODERADAS = 'aquarilandia:avaliacoes-moderadas'
const avisarModeracao = () => typeof window !== 'undefined' && window.dispatchEvent(new Event(EVENTO_AVALIACOES_MODERADAS))

const query = (filtros) => new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString()

export const resumoAvaliacoesAdmin = () => requisitarApi('/avaliacoes/resumo')
export const listarAvaliacoesAdmin = (tipo, filtros) => requisitarApi(`/avaliacoes/${tipo}?${query(filtros)}`)

export async function mudarStatusAvaliacao(tipo, id, status) {
  const r = await requisitarApi(`/avaliacoes/${tipo}/${id}`, { metodo: 'PATCH', corpo: { status } })
  avisarModeracao()
  return r
}

export async function excluirAvaliacao(tipo, id) {
  await requisitarApi(`/avaliacoes/${tipo}/${id}`, { metodo: 'DELETE' })
  avisarModeracao()
}
