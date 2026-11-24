import { AppError } from '../../utils/AppError.js'
import { ENCONTROU, LIMITE_COMENTARIO_PRODUTO, LIMITE_COMENTARIO_SITE, LIMITE_NOME, LIMITE_PAGINA, MOTIVOS, ORIGENS, STATUS } from './avaliacao.config.js'
import type { NovaAvaliacaoProduto, NovaAvaliacaoSite, StatusAvaliacao } from './avaliacao.types.js'

const msgNota = 'Escolha uma nota de 1 a 5.'

// Texto livre de visitante: tira tags HTML e caracteres de controle, junta espaços e corta as pontas.
// O React já escapa tudo na tela; isto é para o banco e o painel guardarem só texto.
// multilinha: mantém as quebras de linha (no máximo uma linha em branco seguida)
export function limparTexto(valor: string, multilinha = false): string {
  let texto = valor.normalize('NFC')
    .replace(/<\/?[A-Za-z!?][^>]*>/g, ' ')  // tags inteiras (<b>, <script ...>, </a>, <!-- -->)
    .replace(/[<>]/g, '')              // o que sobrou de tag aberta
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '')
  texto = multilinha
    ? texto.split('\n').map((linha) => linha.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n')
    : texto.replace(/\s+/g, ' ')
  // A tag removida não deixa espaço antes da pontuação ("<i>comprar</i>." → "comprar.")
  return texto.replace(/ +([.,;:!?)])/g, '$1').trim()
}

function corpo(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }
  return body as Record<string, unknown>
}

function lerNota(valor: unknown, erros: Record<string, string>): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1 || valor > 5) erros.nota = msgNota
  return valor as number
}

// Ausente, null ou só espaços → null. Outro tipo que não texto é erro. Passou do limite (depois de limpo) é erro
function lerTextoOpcional(valor: unknown, campo: string, limite: number, multilinha: boolean, erros: Record<string, string>): string | null {
  if (valor === undefined || valor === null) return null
  if (typeof valor !== 'string') {
    erros[campo] = 'Formato inválido.'
    return null
  }
  const texto = limparTexto(valor, multilinha)
  if (texto.length > limite) erros[campo] = `Pode ter até ${limite} caracteres.`
  return texto || null
}

// Opção de lista: ausente/null → null; valor fora da lista é ignorado (como o formulário faz), não erro
function lerOpcao<T extends string>(valor: unknown, opcoes: readonly T[]): T | null {
  return typeof valor === 'string' && (opcoes as readonly string[]).includes(valor) ? (valor as T) : null
}

export function validarAvaliacaoProduto(body: unknown): NovaAvaliacaoProduto {
  const dados = corpo(body)
  const erros: Record<string, string> = {}
  const nota = lerNota(dados.nota, erros)
  const nome = lerTextoOpcional(dados.nome, 'nome', LIMITE_NOME, false, erros)
  const comentario = lerTextoOpcional(dados.comentario, 'comentario', LIMITE_COMENTARIO_PRODUTO, true, erros)
  if (Object.keys(erros).length) throw new AppError(erros.nota ?? 'Dados inválidos', 422, erros)
  return { nota, nome, comentario }
}

export function validarAvaliacaoSite(body: unknown): NovaAvaliacaoSite {
  const dados = corpo(body)
  const erros: Record<string, string> = {}
  const nota = lerNota(dados.nota, erros)
  const comentario = lerTextoOpcional(dados.comentario, 'comentario', LIMITE_COMENTARIO_SITE, true, erros)
  if (Object.keys(erros).length) throw new AppError(erros.nota ?? 'Dados inválidos', 422, erros)
  // Caminho da página: só um caminho do próprio site ("/loja/3"), sem query nem domínio; o resto vira null
  const pagina = typeof dados.pagina === 'string' && /^\/[A-Za-z0-9\-._~/%]*$/.test(dados.pagina) && dados.pagina.length <= LIMITE_PAGINA
    ? dados.pagina
    : null
  return {
    nota,
    comentario,
    motivo: lerOpcao(dados.motivo, MOTIVOS),
    encontrou: lerOpcao(dados.encontrou, ENCONTROU),
    origem: lerOpcao(dados.origem, ORIGENS) ?? 'aba',
    pagina,
  }
}

export function validarStatus(body: unknown): StatusAvaliacao {
  const status = corpo(body).status
  if (typeof status !== 'string' || !(STATUS as readonly string[]).includes(status)) {
    throw new AppError('Dados inválidos', 422, { status: 'Escolha um status válido: pendente, aprovada ou oculta.' })
  }
  return status as StatusAvaliacao
}

// Filtros do painel: status e nota opcionais
export function lerFiltros(query: Record<string, unknown>): { status?: StatusAvaliacao; nota?: number } {
  const erros: Record<string, string> = {}
  let status: StatusAvaliacao | undefined
  let nota: number | undefined
  if (query.status !== undefined && query.status !== '') {
    if (typeof query.status !== 'string' || !(STATUS as readonly string[]).includes(query.status)) erros.status = 'Escolha um status válido: pendente, aprovada ou oculta.'
    else status = query.status as StatusAvaliacao
  }
  if (query.nota !== undefined && query.nota !== '') {
    const n = Number(query.nota)
    if (!Number.isInteger(n) || n < 1 || n > 5) erros.nota = msgNota
    else nota = n
  }
  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { status, nota }
}
