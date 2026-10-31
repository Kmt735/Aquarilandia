import useConsulta from './useConsulta'
import { listarCategorias } from '../services/catalogo'

export default function useCategorias() {
  return useConsulta(listarCategorias)
}
