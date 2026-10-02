export const ROTAS = {
  inicio: '/',
  loja: '/loja',
  peixes: '/peixes',
  primeiroAquario: '/primeiro-aquario',
  servicos: '/servicos',
}

export function urlLoja({ categoria, disponibilidade } = {}) {
  const params = new URLSearchParams()
  if (categoria) params.set('categoria', categoria)
  if (disponibilidade) params.set('disponibilidade', disponibilidade)
  const query = params.toString()
  return query ? `${ROTAS.loja}?${query}` : ROTAS.loja
}
