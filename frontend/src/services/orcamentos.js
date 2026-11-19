import { requisitarApi } from './api.js'
export const enviarOrcamento = (dados) => requisitarApi('/orcamentos', { metodo: 'POST', corpo: dados })
