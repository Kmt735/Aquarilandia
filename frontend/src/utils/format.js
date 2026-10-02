export const formatarPreco = (valor) => 'R$ ' + valor.toFixed(2).replace('.', ',')

// Remove acentos e caixa para comparar textos na busca
export const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
