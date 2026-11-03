// O armazenamento guarda intenção (IDs/quantidades), nunca autoridade de preço/estoque.
export const CHAVE_CARRINHO = 'aquarilandia-carrinho'
export const LIMITE_QUANTIDADE = 99 // mesmo limite visual do seletor existente, não saldo de estoque
const idValido = (id) => Number.isInteger(id) && id > 0 && id <= 2147483647

export function lerCarrinhoSalvo(bruto) {
  if (bruto == null || bruto === '') return { registros: [], avisos: [], bloqueado: false }
  let dados
  try { dados = JSON.parse(bruto) } catch {
    return { registros: [], avisos: ['O carrinho salvo estava malformado e foi limpo. Adicione os produtos novamente.'], bloqueado: false }
  }
  // Só uma versão futura conhecida é preservada; null, texto, número ou objeto sem itens viram carrinho vazio.
  if (typeof dados?.versao === 'number' && dados.versao > 2) {
    return { registros: [], avisos: ['Não reconhecemos o formato do carrinho salvo. Ele foi preservado; limpe o carrinho para começar novamente.'], bloqueado: true }
  }
  // Formatos antigos: lista pura ([{ id, qtd, item }]) ou objeto sem versão ({ itens } / { items }).
  const legado = Array.isArray(dados) || dados?.versao !== 2
  const itens = Array.isArray(dados) ? dados : (dados?.itens ?? dados?.items)
  if (!Array.isArray(itens)) return { registros: [], avisos: ['O carrinho salvo estava incompleto e foi limpo.'], bloqueado: false }
  const unicos = new Map()
  let descartados = 0, ajustados = 0
  for (const linha of itens) {
    if (!linha || !idValido(linha.id) || !Number.isSafeInteger(linha.qtd) || linha.qtd < 1
      || (linha.item?.id !== undefined && linha.item.id !== linha.id)) {
      descartados++; continue
    }
    const anterior = unicos.get(linha.id)?.qtd ?? 0
    const qtd = Math.min(LIMITE_QUANTIDADE, anterior + linha.qtd)
    if (anterior || qtd !== linha.qtd) ajustados++
    unicos.set(linha.id, { id: linha.id, qtd, item: null, erro: false })
  }
  return {
    registros: [...unicos.values()], bloqueado: false,
    avisos: [
      legado && 'Seu carrinho foi atualizado. Os itens identificáveis serão conferidos no catálogo atual.',
      descartados && 'Itens antigos sem identificação numérica confiável ou com dados inválidos foram removidos. Escolha-os novamente na loja.',
      ajustados && 'Itens duplicados foram agrupados e quantidades ajustadas ao limite de 99 por produto.',
    ].filter(Boolean),
  }
}

export const formatoParaSalvar = (registros) => ({ versao: 2, itens: registros.map(({ id, qtd }) => ({ id, qtd })) })

export async function conferirCarrinho(registros, obterProduto) {
  const resultados = new Array(registros.length)
  let proximo = 0
  async function executar() {
    while (proximo < registros.length) {
      const indice = proximo++
      const registro = registros[indice]
      try {
        const item = await obterProduto(registro.id)
        if (item.id !== registro.id || !Number.isInteger(item.preco) || item.preco < 0 || item.centavos !== true || typeof item.emEstoque !== 'boolean') throw new Error('Contrato inválido')
        resultados[indice] = { id: registro.id, estado: item.emEstoque ? 'valido' : 'removido', item,
          precoAlterado: Boolean(registro.item && registro.item.preco !== item.preco) }
      } catch (erro) {
        // Falha temporária mantém a intenção persistida, mas sem item comprável ou preço salvo.
        resultados[indice] = { id: registro.id, estado: erro?.status === 404 ? 'removido' : 'erro', item: null }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, registros.length) }, executar))
  return resultados
}

export function aplicarConferencia(registrosAtuais, resultados) {
  const porId = new Map(resultados.map((r) => [r.id, r]))
  return registrosAtuais.flatMap((registro) => {
    const resultado = porId.get(registro.id)
    if (!resultado) return [registro]
    if (resultado.estado === 'removido') return []
    // Quantidade/remoção feitas durante a consulta não são substituídas pelo snapshot da requisição.
    return [{ ...registro, item: resultado.item, erro: resultado.estado === 'erro' }]
  })
}

/**
 * Plano para adicionar vários itens de uma vez (ex.: "Monte seu Aquário"). Função pura.
 * Respeita o estoque informado (`item.estoque`, quando conhecido) e o teto de 99 por produto, já
 * descontando o que está no carrinho. Devolve os registros novos e o que foi limitado ou ignorado.
 *
 * @param {Array<{ id: number, qtd: number }>} registros  carrinho atual
 * @param {Array<{ item: object, qtd: number }>} pedidos
 */
export function planejarAdicao(registros, pedidos) {
  const novos = registros.map((r) => ({ ...r }))
  const adicionados = []
  const limitados = []
  const ignorados = []
  for (const { item, qtd } of pedidos) {
    if (!idValido(item?.id) || !Number.isSafeInteger(qtd) || qtd < 1) { ignorados.push({ item, motivo: 'invalido' }); continue }
    if (!item.emEstoque) { ignorados.push({ item, motivo: 'esgotado' }); continue }
    const estoqueConhecido = Number.isSafeInteger(item.estoque) && item.estoque < LIMITE_QUANTIDADE
    const teto = estoqueConhecido ? item.estoque : LIMITE_QUANTIDADE
    const registro = novos.find((r) => r.id === item.id)
    const livre = teto - (registro?.qtd ?? 0)
    if (livre <= 0) { ignorados.push({ item, motivo: estoqueConhecido ? 'estoque' : 'limite' }); continue }
    const quantidade = Math.min(qtd, livre)
    if (registro) registro.qtd += quantidade
    else novos.push({ id: item.id, qtd: quantidade, item: null, erro: false })
    adicionados.push({ item, qtd: quantidade })
    if (quantidade < qtd) limitados.push({ item, pedido: qtd, adicionado: quantidade, motivo: estoqueConhecido ? 'estoque' : 'limite' })
  }
  return { registros: novos, adicionados, limitados, ignorados }
}
