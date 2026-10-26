import { AppError } from '../../utils/AppError.js'

export function lerIdCatalogo(valor: string): number {
  const id = Number(valor)
  if (!/^[1-9]\d*$/.test(valor) || !Number.isInteger(id) || id > 2147483647) {
    throw new AppError('Parâmetros inválidos', 400, { id: 'Informe um ID inteiro entre 1 e 2147483647.' })
  }
  return id
}
