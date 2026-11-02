export const ROTAS = {
  inicio: '/',
  loja: '/loja',
  peixes: '/peixes',
<<<<<<< Updated upstream
  primeiroAquario: '/primeiro-aquario',
=======
  compararPeixes: '/peixes/comparar',
  primeiroAquario: '/meu-primeiro-aquario',
  primeiroAquarioAntigo: '/primeiro-aquario',
>>>>>>> Stashed changes
  servicos: '/servicos',
}

export function urlLoja({ categoria, disponibilidade } = {}) {
  const params = new URLSearchParams()
  if (categoria) params.set('categoria', categoria)
  if (disponibilidade) params.set('disponibilidade', disponibilidade)
  const query = params.toString()
  return query ? `${ROTAS.loja}?${query}` : ROTAS.loja
}
<<<<<<< Updated upstream
=======

export function urlPeixes({ dificuldade } = {}) {
  const params = new URLSearchParams()
  if (dificuldade) params.set('dificuldade', dificuldade)
  const query = params.toString()
  return query ? `${ROTAS.peixes}?${query}` : ROTAS.peixes
}

export const urlCategoria = (nome) => (nome === 'Peixes' ? ROTAS.peixes : urlLoja({ categoria: nome }))
export const urlPeixe = (id) => `${ROTAS.peixes}/${id}`
export const urlProduto = (id) => `${ROTAS.loja}/${id}`
export const urlItem = (item) => (item.tipo === 'peixe' ? urlPeixe(item.id) : urlProduto(item.id))
export const urlPolitica = (tipo) => `${ROTAS.politicas}/${tipo}`
export const urlCompra = (id) => `${ROTAS.minhaConta}/compras/${id}`
export const urlEtapaCheckout = (etapa) => `${ROTAS.checkout}/${etapa}`
>>>>>>> Stashed changes
