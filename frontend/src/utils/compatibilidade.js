// H5 · Prevenção de erros: avisa se o filtro do carrinho não atende o aquário escolhido
export function analisarCompatibilidade(linhas) {
  const filtro = linhas.find((l) => l.produto.capacidadeMaxLitros)?.produto
  if (!filtro) return null

  const aquario = linhas.find((l) => l.produto.volumeLitros)?.produto
  const max = filtro.capacidadeMaxLitros

  if (!aquario) {
    return {
      tipo: 'info',
      texto: `ⓘ O ${filtro.nome} atende aquários de até ${max}L. Confira o tamanho do seu antes de finalizar.`,
    }
  }
  if (aquario.volumeLitros <= max) {
    return {
      tipo: 'ok',
      texto: `✓ O ${filtro.nome} (até ${max}L) é compatível com o ${aquario.nome}.`,
    }
  }
  return {
    tipo: 'alerta',
    texto: `⚠ O ${filtro.nome} atende até ${max}L, mas o aquário escolhido tem ${aquario.volumeLitros}L. Fale com a gente antes de fechar o pedido.`,
  }
}
