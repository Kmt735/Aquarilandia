import { servicos } from '../data/servicos.js'

// Por enquanto os dados ficam em memória; trocar por um banco depois
export const catalogoService = {
  listarServicos: () => servicos,
}
