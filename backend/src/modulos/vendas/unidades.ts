import { AppError } from '../../utils/AppError.js'

export const unidadesRetirada = {
  centro: { id: 'centro', nome: 'Aquarilândia Centro', endereco: 'Rua Antônio Rocha, 27 – Centro – São João del-Rei/MG' },
  matosinhos: { id: 'matosinhos', nome: 'Aquarilândia Matosinhos', endereco: 'Avenida Josué de Queiroz, 115 – São João del-Rei/MG' },
} as const
export type UnidadeRetirada = (typeof unidadesRetirada)[keyof typeof unidadesRetirada]
export type UnidadeRetiradaId = keyof typeof unidadesRetirada
export function lerUnidade(valor: unknown): UnidadeRetiradaId {
  if (typeof valor !== 'string' || !Object.hasOwn(unidadesRetirada, valor)) {
    throw new AppError('Dados inválidos', 422, { unidadeRetirada: 'Escolha a unidade Centro ou Matosinhos para retirar.' })
  }
  return valor as UnidadeRetiradaId
}
