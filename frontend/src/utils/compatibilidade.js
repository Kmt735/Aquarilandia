import { filtroAtende } from '../lib/compatibilidade.js'

// H5 · Prevenção de erros: avisa se o filtro do carrinho não atende o aquário escolhido.
// A regra mora em lib/compatibilidade.js (a mesma do "Monte seu Aquário"); aqui só vira o texto do carrinho.
export function analisarCompatibilidade(linhas) {
  const filtro = linhas.find((l) => l.item.capacidadeMaxLitros)?.item
  if (!filtro) return null

  const aquario = linhas.find((l) => l.item.volumeLitros)?.item
  const max = filtro.capacidadeMaxLitros

  if (!aquario) {
    return { tipo: 'info', texto: `O ${filtro.nome} atende aquários de até ${max} L. Confira o tamanho do seu antes de finalizar.` }
  }
  if (filtroAtende({ aquarioMaxLitros: max }, aquario.volumeLitros)) {
    return { tipo: 'sucesso', texto: `O ${filtro.nome} (até ${max} L) é compatível com o ${aquario.nome}.` }
  }
  return {
    tipo: 'aviso',
    texto: `O ${filtro.nome} atende até ${max} L, mas o aquário escolhido tem ${aquario.volumeLitros} L. Fale com a gente antes de fechar o pedido.`,
  }
}
