import { AppError } from '../../utils/AppError.js'
import { peixeRepository } from './peixe.repository.js'
import type { FiltrosPeixes, ListaPeixes, PeixePublico } from './peixe.types.js'

export const peixeService = {
  async listar(filtros: FiltrosPeixes): Promise<ListaPeixes> {
    return peixeRepository.listar(filtros)
  },

  async buscarPorId(id: number): Promise<PeixePublico> {
    const peixe = await peixeRepository.buscarPorId(id)
    if (!peixe) throw new AppError('Peixe não encontrado', 404)
    return peixe
  },
}
