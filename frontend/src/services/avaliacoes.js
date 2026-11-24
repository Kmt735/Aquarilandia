// Avaliação do site (feedback de navegação, NÃO avaliação de produto).
//
// Vai para a API (POST /api/avaliacoes-site). A avaliação nasce "pendente" e só entra no resumo público
// (GET /api/avaliacoes-site, página /avaliacoes) depois que a loja aprovar no painel (Admin → Avaliações).
// O localStorage guarda só o lembrete de "não perguntar de novo" (abaixo), nunca as respostas.
import { requisitarApi } from './api.js'
import { ErroApi } from './http.js'
import { ENCONTROU, LEMBRETE_AVALIACAO, LIMITE_COMENTARIO, MOTIVOS_VISITA, NOTAS } from '../data/avaliacao-site.js'

const CHAVE_LEMBRETE = 'aquarilandia-avaliacao-lembrete'
const DIA = 86400000

function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(chave)
    return bruto ? JSON.parse(bruto) : padrao
  } catch {
    return padrao
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
    return true
  } catch {
    return false // armazenamento bloqueado (aba anônima, cota cheia): segue sem lembrar
  }
}

const valido = (lista, valor) => lista.some(([v]) => v === valor)

// O que vai para a API (o servidor valida de novo e tira HTML)
export function montarAvaliacao({ nota, motivo, encontrou, comentario, origem, pagina }) {
  if (!NOTAS.includes(nota)) throw new ErroApi('Escolha uma nota de 1 a 5.', { nota: 'Escolha uma nota de 1 a 5.' })
  return {
    nota,
    motivo: valido(MOTIVOS_VISITA, motivo) ? motivo : null,
    encontrou: valido(ENCONTROU, encontrou) ? encontrou : null,
    comentario: String(comentario ?? '').trim().slice(0, LIMITE_COMENTARIO) || null,
    origem: origem ?? 'aba',
    pagina: pagina ?? null,
  }
}

// Devolve { id, nota, criadaEm, status } (status: "pendente" ou "aprovada")
export async function enviarAvaliacao(dados) {
  const criada = await requisitarApi('/avaliacoes-site', { metodo: 'POST', corpo: montarAvaliacao(dados) })
  registrarEnvio()
  return criada
}

// Resumo público (só as aprovadas), com os rótulos das perguntas para a tela
export function mapearResumo(r) {
  const total = r?.total ?? 0
  const rotular = (opcoes, contagens) => opcoes.map(([valor, rotulo]) => ({
    valor, rotulo, qtd: contagens?.find((c) => c.valor === valor)?.qtd ?? 0,
  }))
  return {
    total,
    media: r?.media ?? 0,
    distribuicao: r?.distribuicao ?? [...NOTAS].reverse().map((nota) => ({ nota, qtd: 0 })),
    motivos: rotular(MOTIVOS_VISITA, r?.motivos),
    encontrou: rotular(ENCONTROU, r?.encontrou),
    comentarios: Array.isArray(r?.comentarios) ? r.comentarios : [],
  }
}

export async function buscarResumoAvaliacoes() {
  return mapearResumo(await requisitarApi('/avaliacoes-site'))
}

// ───── Não perguntar de novo ao mesmo visitante por um tempo ─────
const lembrete = () => {
  const l = ler(CHAVE_LEMBRETE, {})
  return l && typeof l === 'object' ? l : {}
}

export function registrarEnvio() {
  gravar(CHAVE_LEMBRETE, { ...lembrete(), enviadaEm: Date.now() })
}

export function registrarDispensa() {
  gravar(CHAVE_LEMBRETE, { ...lembrete(), dispensadaEm: Date.now() })
}

// A aba lateral some depois de avaliar (ou de "Agora não") pelo prazo do lembrete; o link do rodapé fica sempre.
export function podeConvidar(agora = Date.now(), { diasAposEnvio, diasAposDispensa } = LEMBRETE_AVALIACAO) {
  const { enviadaEm, dispensadaEm } = lembrete()
  if (enviadaEm && agora - enviadaEm < diasAposEnvio * DIA) return false
  if (dispensadaEm && agora - dispensadaEm < diasAposDispensa * DIA) return false
  return true
}

// Convite depois de uma compra concluída: aparece uma única vez por navegador
export function podeConvidarPosCompra() {
  const l = lembrete()
  return !l.convitePosCompraEm && podeConvidar()
}

export function registrarConvitePosCompra() {
  gravar(CHAVE_LEMBRETE, { ...lembrete(), convitePosCompraEm: Date.now() })
}
