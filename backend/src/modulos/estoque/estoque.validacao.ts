import { AppError } from '../../utils/AppError.js'
import type { FiltrosHistoricoEstoque, FiltrosSaldosEstoque, NovoMovimentoAdmin, OrdemSaldosEstoque, TipoMovimentoAdmin } from './estoque.types.js'
import { tiposMovimentoHistorico, type TipoMovimentoHistorico } from './estoque.types.js'

const tipos: readonly TipoMovimentoAdmin[] = ['entrada', 'ajuste_positivo', 'ajuste_negativo', 'saida']
const uuidCanonico = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function lerInteiroConsulta(valor: unknown, campo: string, maximo: number, erros: Record<string, string>): number {
  const numero = typeof valor === 'string' ? Number(valor) : NaN
  if (typeof valor !== 'string' || valor.trim() !== valor || !/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(numero) || numero > maximo) {
    erros[campo] = `Informe um inteiro entre 1 e ${maximo}, sem zeros à esquerda.`
    return 0
  }
  return numero
}

export function validarConsultaSaldo(id: unknown, query: object): number {
  const erros: Record<string, string> = Object.create(null)
  const produtoId = lerInteiroConsulta(id, 'produtoId', 2147483647, erros)
  if (Object.keys(query).length) erros.query = 'Não envie parâmetros na consulta de saldo por ID.'
  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return produtoId
}

export function validarConsultaSaldos(query: Record<string, unknown>): FiltrosSaldosEstoque {
  const erros: Record<string, string> = Object.create(null)
  for (const campo of Object.keys(query)) {
    if (!['busca', 'categoria', 'ativo', 'em_estoque', 'ordem', 'pagina', 'limite'].includes(campo)) {
      erros[campo] = 'Parâmetro não permitido nesta consulta.'
    }
  }
  function texto(campo: string, maximo: number): string | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo || /[\u0000-\u001f\u007f]/.test(valor.trim())) {
      erros[campo] = `Informe um texto de 1 a ${maximo} caracteres, sem controles.`
      return undefined
    }
    return valor.trim()
  }
  function booleano(campo: string): boolean | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    if (valor === 'true') return true
    if (valor === 'false') return false
    erros[campo] = 'Informe true ou false.'
    return undefined
  }
  const busca = texto('busca', 150), categoria = texto('categoria', 80)
  if (categoria !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categoria)) {
    erros.categoria = 'Informe o slug da categoria, em minúsculas e separado por hífens.'
  }
  const ativo = booleano('ativo'), emEstoque = booleano('em_estoque')
  const ordens: readonly OrdemSaldosEstoque[] = ['nome', '-nome', 'saldo', '-saldo']
  const ordem = query.ordem === undefined ? 'nome' : query.ordem
  if (typeof ordem !== 'string' || !ordens.includes(ordem as OrdemSaldosEstoque)) erros.ordem = 'Escolha nome, -nome, saldo ou -saldo.'
  const pagina = lerInteiroConsulta(query.pagina === undefined ? '1' : query.pagina, 'pagina', Number.MAX_SAFE_INTEGER, erros)
  const limite = lerInteiroConsulta(query.limite === undefined ? '20' : query.limite, 'limite', 100, erros)
  if (!Number.isSafeInteger((pagina - 1) * limite)) erros.pagina = 'Página fora do intervalo permitido.'
  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { busca, categoria, ativo, emEstoque, ordem: ordem as OrdemSaldosEstoque, pagina, limite }
}

// Validar componentes antes de construir Date: Date.parse normaliza datas inexistentes.
// Preservar até microssegundos, a precisão do TIMESTAMPTZ; Date sozinho perderia os últimos três dígitos.
function lerInstante(valor: unknown, campo: string, erros: Record<string, string>): { iso: string; micros: bigint } | undefined {
  if (valor === undefined) return undefined
  const invalido = () => {
    erros[campo] = 'Informe data existente no formato AAAA-MM-DDTHH:mm:ss[.ffffff]Z ou com fuso ±HH:mm (até 6 casas decimais).'
    return undefined
  }
  const partes = typeof valor === 'string'
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(valor)
    : null
  // Em JavaScript, $ também pode casar antes de uma quebra de linha final. Exigir consumo integral.
  if (!partes || partes[0] !== valor) return invalido()
  const [, a, m, d, h, min, s, fracao = '', , sinal, fh = '0', fm = '0'] = partes
  const ano = Number(a), mes = Number(m), dia = Number(d), hora = Number(h), minuto = Number(min), segundo = Number(s)
  const horaFuso = Number(fh), minutoFuso = Number(fm)
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0)
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (ano < 1 || mes < 1 || mes > 12 || dia < 1 || dia > dias[mes - 1]
    || hora > 23 || minuto > 59 || segundo > 59 || horaFuso > 23 || minutoFuso > 59) return invalido()
  const data = new Date(0)
  data.setUTCFullYear(ano, mes - 1, dia); data.setUTCHours(hora, minuto, segundo, 0)
  data.setTime(data.getTime() - (sinal === '-' ? -1 : 1) * (horaFuso * 60 + minutoFuso) * 60000)
  if (data.getUTCFullYear() < 1 || data.getUTCFullYear() > 9999) return invalido()
  const micros = fracao.padEnd(6, '0')
  return { iso: `${data.toISOString().slice(0, 19)}.${micros}Z`, micros: BigInt(data.getTime()) * 1000n + BigInt(micros) }
}

export function validarConsultaHistorico(query: Record<string, unknown>): FiltrosHistoricoEstoque {
  const erros: Record<string, string> = Object.create(null)
  for (const campo of Object.keys(query)) {
    if (!['produtoId', 'tipo', 'de', 'ate', 'pagina', 'limite'].includes(campo)) erros[campo] = 'Parâmetro não permitido nesta consulta.'
  }
  const produtoId = query.produtoId === undefined ? undefined : lerInteiroConsulta(query.produtoId, 'produtoId', 2147483647, erros)
  if (query.tipo !== undefined && (typeof query.tipo !== 'string' || !tiposMovimentoHistorico.includes(query.tipo as TipoMovimentoHistorico))) {
    erros.tipo = `Escolha ${tiposMovimentoHistorico.join(', ')}.`
  }
  const de = lerInstante(query.de, 'de', erros), ate = lerInstante(query.ate, 'ate', erros)
  if (de && ate && de.micros >= ate.micros) erros.ate = 'O limite ate deve ser posterior a de (intervalo [de, ate)).'
  const pagina = lerInteiroConsulta(query.pagina === undefined ? '1' : query.pagina, 'pagina', Number.MAX_SAFE_INTEGER, erros)
  const limite = lerInteiroConsulta(query.limite === undefined ? '20' : query.limite, 'limite', 100, erros)
  if (!Number.isSafeInteger((pagina - 1) * limite)) erros.pagina = 'Página fora do intervalo permitido.'
  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { produtoId, tipo: query.tipo as TipoMovimentoHistorico | undefined, de: de?.iso, ate: ate?.iso, pagina, limite }
}

export function validarMovimento(body: unknown, chave: unknown, query: object): { dados: NovoMovimentoAdmin; chave: string } {
  const erros: Record<string, string> = Object.create(null)
  if (typeof chave !== 'string' || !uuidCanonico.test(chave)) {
    erros['Idempotency-Key'] = 'Informe um UUID canônico em minúsculas (versão 1 a 8 e variante RFC).'
  }
  if (Object.keys(query).length) erros.query = 'Não envie parâmetros de consulta nesta operação.'
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    erros.body = 'Envie um objeto com produtoId, tipo, quantidade e motivo.'
    throw new AppError('Dados inválidos', 400, erros)
  }
  const entrada = body as Record<string, unknown>
  for (const campo of Object.keys(entrada)) {
    if (!['produtoId', 'tipo', 'quantidade', 'motivo'].includes(campo)) erros[campo] = 'Campo não permitido nesta operação.'
  }
  for (const campo of ['produtoId', 'quantidade'] as const) {
    const valor = entrada[campo]
    if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 1 || valor > 2147483647) {
      erros[campo] = 'Informe um inteiro entre 1 e 2147483647.'
    }
  }
  if (!tipos.includes(entrada.tipo as TipoMovimentoAdmin)) erros.tipo = 'Escolha entrada, ajuste_positivo, ajuste_negativo ou saida.'
  const motivo = typeof entrada.motivo === 'string' ? entrada.motivo.trim().normalize('NFC') : ''
  if (!motivo || [...motivo].length > 300 || /\p{C}/u.test(motivo) || !/[\p{L}\p{N}]/u.test(motivo)) {
    erros.motivo = 'Informe de 1 a 300 caracteres, com letra ou número e sem caracteres de controle.'
  }
  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 400, erros)
  return { dados: { produtoId: entrada.produtoId as number, tipo: entrada.tipo as TipoMovimentoAdmin,
    quantidade: entrada.quantidade as number, motivo }, chave: chave as string }
}
