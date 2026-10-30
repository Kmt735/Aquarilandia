export const ROTAS = {
  inicio: '/',
  loja: '/loja',
  peixes: '/peixes',
  compararPeixes: '/peixes/comparar',
  primeiroAquario: '/primeiro-aquario',
  servicos: '/servicos',
  perguntas: '/perguntas-frequentes',
  politicas: '/politicas',
  entrar: '/entrar',
  criarConta: '/criar-conta',
  esqueciSenha: '/esqueci-a-senha',
  redefinirSenha: '/redefinir-senha',
  minhaConta: '/minha-conta',
  checkout: '/checkout',
  pagamento: '/pagamento',
}

export function urlLoja({ categoria, disponibilidade } = {}) {
  const params = new URLSearchParams()
  if (categoria) params.set('categoria', categoria)
  if (disponibilidade) params.set('disponibilidade', disponibilidade)
  const query = params.toString()
  return query ? `${ROTAS.loja}?${query}` : ROTAS.loja
}

export const urlPeixe = (id) => `${ROTAS.peixes}/${id}`
export const urlProduto = (id) => `${ROTAS.loja}/${id}`
export const urlItem = (item) => (item.tipo === 'peixe' ? urlPeixe(item.id) : urlProduto(item.id))
export const urlPolitica = (tipo) => `${ROTAS.politicas}/${tipo}`
export const urlCompra = (id) => `${ROTAS.minhaConta}/compras/${id}`
export const urlEtapaCheckout = (etapa) => `${ROTAS.checkout}/${etapa}`
