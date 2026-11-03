import { listarPeixes, listarProdutos, obterProduto } from './catalogo.js'

// Catálogo do "Monte seu Aquário". A listagem de /api/produtos não traz a ficha técnica (volume, limites
// do filtro, tipo de substrato...), só o detalhe. Por isso cada produto é completado pelo detalhe, com
// no máximo 6 consultas ao mesmo tempo. Peixes já vêm com ficha na listagem.
// TODO(API): uma listagem com `ficha` (ou ?incluir_ficha=true) evitaria uma consulta por produto.
const CATEGORIAS = { aquarios: 'aquarios', filtros: 'filtros', termostatos: 'termostatos', iluminacao: 'iluminacao', substratos: 'substratos', decoracoes: 'decoracoes', plantas: 'plantas' }

async function comFicha(itens) {
  const resultado = [...itens]
  let proximo = 0
  async function trabalhar() {
    while (proximo < itens.length) {
      const i = proximo++
      // Se o detalhe falhar, o item continua (sem ficha) em vez de sumir da montagem.
      try { resultado[i] = await obterProduto(itens[i].id) } catch { /* mantém o item da listagem */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, itens.length) }, trabalhar))
  return resultado
}

export async function carregarCatalogoMontagem() {
  const [peixes, ...grupos] = await Promise.all([
    listarPeixes({ limite: 100 }).then((r) => r.itens),
    ...Object.values(CATEGORIAS).map((categoria) => listarProdutos({ categoria, limite: 100 }).then((r) => comFicha(r.itens))),
  ])
  return { peixes, ...Object.fromEntries(Object.keys(CATEGORIAS).map((chave, i) => [chave, grupos[i]])) }
}
