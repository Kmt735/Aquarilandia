import { AppError } from '../../utils/AppError.js'
import type { FiltrosHistoricoEstoque, NovoMovimentoAdmin, TipoMovimentoAdmin } from './estoque.types.js'

const tipos: readonly TipoMovimentoAdmin[] = ['entrada', 'ajuste_positivo', 'ajuste_negativo', 'saida']
const uuidCanonico = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function lerInteiroConsulta(valor: unknown, campo: string, maximo: number, erros: Record<string, string>): number {
  const numero = typeof valor === 'string' ? Number(valor) : NaN
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(numero) || numero > maximo) {
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

export function validarConsultaHistorico(query: Record<string, unknown>): FiltrosHistoricoEstoque {
  const erros: Record<string, string> = Object.create(null)
  for (const campo of Object.keys(query)) {
    if (!['produtoId', 'pagina', 'limite'].includes(campo)) erros[campo] = 'Parâmetro não permitido nesta consulta.'
  }
  const produtoId = lerInteiroConsulta(query.produtoId, 'produtoId', 2147483647, erros)
  const pagina = lerInteiroConsulta(query.pagina === undefined ? '1' : query.pagina, 'pagina', Number.MAX_SAFE_INTEGER, erros)
  const limite = lerInteiroConsulta(query.limite === undefined ? '20' : query.limite, 'limite', 100, erros)
  if (!Number.isSafeInteger((pagina - 1) * limite)) erros.pagina = 'Página fora do intervalo permitido.'
  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { produtoId, pagina, limite }
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
