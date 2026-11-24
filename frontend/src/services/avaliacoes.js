// Avaliação do site (feedback de navegação, NÃO avaliação de produto).
//
// TODO INTEGRAÇÃO: hoje as respostas ficam só no localStorage DESTE navegador (protótipo).
// Para coletar de verdade, troque o corpo de `enviarAvaliacao` e `listarAvaliacoes` por uma destas opções:
//   a) backend: POST /api/avaliacoes-site e GET /api/avaliacoes-site (rota ainda não existe), via requisitarApi;
//   b) Google Forms: POST para https://docs.google.com/forms/d/e/<ID>/formResponse com os campos entry.<n>
//      (mode: 'no-cors'); a leitura passa a ser a planilha de respostas do formulário.
// Os componentes não precisam mudar: eles só chamam as funções abaixo.
import { CHAVE_AVALIACOES, LEMBRETE_EXEMPLO } from '../mocks/avaliacoes.js'
import { ErroApi, simularRede } from './http.js'
import { ENCONTROU, LIMITE_COMENTARIO, MOTIVOS_VISITA, NOTAS } from '../data/avaliacao-site.js'

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

// Normaliza e valida antes de salvar (a mesma regra valerá no backend)
export function montarAvaliacao({ nota, motivo, encontrou, comentario, origem, pagina }, agora = Date.now()) {
  if (!NOTAS.includes(nota)) throw new ErroApi('Escolha uma nota de 1 a 5.', { nota: 'Escolha uma nota de 1 a 5.' })
  return {
    id: `${agora.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    criadaEm: new Date(agora).toISOString(),
    nota,
    motivo: valido(MOTIVOS_VISITA, motivo) ? motivo : null,
    encontrou: valido(ENCONTROU, encontrou) ? encontrou : null,
    comentario: String(comentario ?? '').trim().slice(0, LIMITE_COMENTARIO) || null,
    origem: origem ?? 'aba',
    pagina: pagina ?? null,
  }
}

export async function enviarAvaliacao(dados) {
  const avaliacao = montarAvaliacao(dados)
  await simularRede(400)
  const lista = ler(CHAVE_AVALIACOES, [])
  gravar(CHAVE_AVALIACOES, [...(Array.isArray(lista) ? lista : []), avaliacao])
  registrarEnvio()
  return avaliacao
}

export async function listarAvaliacoes() {
  await simularRede(250)
  const lista = ler(CHAVE_AVALIACOES, [])
  return Array.isArray(lista) ? lista.filter((a) => NOTAS.includes(a?.nota)) : []
}

export function apagarAvaliacoesLocais() {
  try {
    localStorage.removeItem(CHAVE_AVALIACOES)
    localStorage.removeItem(CHAVE_LEMBRETE)
  } catch {
    // nada a apagar
  }
}

// Resumo para a página /avaliacoes: média, total, distribuição e contagem das outras perguntas
export function resumirAvaliacoes(lista) {
  const total = lista.length
  const contar = (campo, opcoes) => opcoes.map(([valor, rotulo]) => ({ valor, rotulo, qtd: lista.filter((a) => a[campo] === valor).length }))
  return {
    total,
    media: total ? lista.reduce((s, a) => s + a.nota, 0) / total : 0,
    distribuicao: [...NOTAS].reverse().map((nota) => ({ nota, qtd: lista.filter((a) => a.nota === nota).length })),
    motivos: contar('motivo', MOTIVOS_VISITA),
    encontrou: contar('encontrou', ENCONTROU),
    comentarios: lista.filter((a) => a.comentario).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)),
  }
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
export function podeConvidar(agora = Date.now(), { diasAposEnvio, diasAposDispensa } = LEMBRETE_EXEMPLO) {
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
