import { AppError } from './AppError.js'


export function idParam(valor:unknown): number{
    const id = Number(valor)
    if (!Number.isInteger(id) || id < 1 ) throw new AppError('Id inválido.',400)
    return id    
}

export function paginacao(query: Record<string, unknown>): { pagina: number; limite: number } {
  const erros: Record<string, string> = {}

  let pagina: number
  if (query.pagina === undefined) {
    pagina = 1
  } else {
    pagina = Number(query.pagina)
  }

  let limite: number
  if (query.limite === undefined) {
    limite = 20
  } else {
    limite = Number(query.limite)
  }

  if (!Number.isInteger(pagina) || pagina < 1) {
    erros.pagina = 'A página precisa ser um número inteiro a partir de 1.'
  }
  if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
    erros.limite = 'O limite precisa ser um número inteiro de 1 a 100.'
  }

  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)

  return { pagina, limite }
}