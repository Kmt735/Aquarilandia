// Helper ÚNICO de preço. Hoje src/data guarda reais (ex.: 249.9); a API manda centavos (24990).
// Quando ligar a API, os services passam { centavos: true } e nenhum componente muda.
const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatarPreco = (valor, { centavos = false } = {}) =>
  valor == null ? '—' : moeda.format(centavos ? valor / 100 : valor)

// Remove acentos e caixa para comparar textos na busca
export const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const plural = (n, singular, pluralTexto = `${singular}s`) => `${n} ${n === 1 ? singular : pluralTexto}`

export const formatarData = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

export const formatarDataHora = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
