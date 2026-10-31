// Ordenação local apenas para opções visuais que a API ainda não oferece.
const ORDENADORES = {
  'menor-preco': (a, b) => a.preco - b.preco,
  'maior-preco': (a, b) => b.preco - a.preco,
  'a-z': (a, b) => a.nome.localeCompare(b.nome, 'pt-BR'),
  'z-a': (a, b) => b.nome.localeCompare(a.nome, 'pt-BR'),
}

export const ordenarItens = (itens, ordem) => (ORDENADORES[ordem] ? [...itens].sort((a, b) => ORDENADORES[ordem](a, b) || a.id - b.id) : itens)

export function paginar(itens, paginaTexto, porPagina) {
  const totalPaginas = Math.max(1, Math.ceil(itens.length / porPagina))
  const pagina = Math.min(Math.max(1, Number(paginaTexto) || 1), totalPaginas)
  return { pagina, totalPaginas, itens: itens.slice((pagina - 1) * porPagina, pagina * porPagina) }
}

// Opções de filtro tiradas dos próprios dados (nada inventado)
export const opcoesDe = (itens, ler) => [...new Set(itens.map(ler).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
