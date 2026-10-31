// Somente a compatibilidade de apresentação do carrinho/histórico antigo usa reais.
// Os novos itens do catálogo mantêm o inteiro recebido da API, marcado com centavos:true.
export const precoEmCentavos = (item) => item.centavos ? item.preco : Math.round((item.preco ?? 0) * 100)
export const subtotalEmCentavos = (itens) => itens.reduce((soma, item) => soma + precoEmCentavos(item) * item.qtd, 0)
