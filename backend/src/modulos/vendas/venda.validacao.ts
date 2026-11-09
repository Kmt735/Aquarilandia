// Validação compartilhada pela cotação de frete (#28) e pela criação da venda (#30): as duas leem o body do mesmo
// jeito, então um carrinho que passou na cotação passa (ou falha igual) na compra.
// Só as chaves esperadas são lidas: precoUnitario, total, status, clienteId e qualquer outra são ignoradas
// (api.md, seção 11). Preço, total e dono nunca vêm do body.
import { createHash } from 'node:crypto'
import type { ProdutoVenda } from '../../types/index.js'
import { AppError } from '../../utils/AppError.js'
import type { EntregaCotacao, EntregaVenda, ItemPedido, NovoItemVenda, PedidoVenda } from './venda.types.js'

export const maxItensPorPedido = 30
export const maxQuantidadePorProduto = 50
// Maior valor de uma coluna INTEGER do PostgreSQL (subtotal, frete e total em centavos)
const maxCentavos = 2147483647
const maxId = 2147483647

const msgDadosInvalidos = 'Dados inválidos'
const msgItens = 'Adicione de 1 a 30 produtos.'
const msgProdutoInvalido = 'Produto inválido.'
const msgQuantidade = 'A quantidade precisa ser de 1 a 50.'
const msgEntrega = 'Escolha um endereço de entrega ou retirar na loja.'
const msgCep = 'Informe um CEP válido com 8 números ou escolha retirar na loja.'
const msgProdutoIndisponivel = 'Produto indisponível.'
const msgSemEstoque = 'Não temos essa quantidade em estoque.'
const msgTotalEsperado = 'Atualize o carrinho antes de finalizar a compra.'

type Erros = Record<string, string>

// Mesmo formato, status e mensagem do POST /api/estoque/movimentacoes (Dev 2): UUID canônico em minúsculas
const uuidCanonico = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function ehIdValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor > 0 && valor <= maxId
}

function ehQuantidadeValida(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 1 && valor <= maxQuantidadePorProduto
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

// Valor ausente: a chave não veio, ou veio null. Os dois contam como "não escolheu"
function ausente(valor: unknown): boolean {
  return valor === undefined || valor === null
}

export function exigirObjeto(body: unknown): Record<string, unknown> {
  if (!ehObjeto(body)) throw new AppError(msgDadosInvalidos, 422, { body: 'Formato de dados inválido.' })
  return body
}

export function validarItens(valor: unknown): { itens: ItemPedido[] } {
  if (!Array.isArray(valor) || valor.length < 1 || valor.length > maxItensPorPedido) {
    throw new AppError(msgDadosInvalidos, 422, { itens: msgItens })
  }

  // Todos os erros juntos, um por campo de cada item, para o carrinho marcar tudo de uma vez
  const erros: Erros = {}
  const itens: ItemPedido[] = []
  valor.forEach((item: unknown, indice) => {
    const dados = ehObjeto(item) ? item : {}
    const { produtoId, quantidade } = dados
    if (!ehIdValido(produtoId)) erros[`itens.${indice}.produtoId`] = msgProdutoInvalido
    if (!ehQuantidadeValida(quantidade)) erros[`itens.${indice}.quantidade`] = msgQuantidade
    if (ehIdValido(produtoId) && ehQuantidadeValida(quantidade)) itens.push({ produtoId, quantidade, indice })
  })
  if (Object.keys(erros).length) throw new AppError(msgDadosInvalidos, 422, erros)
  return { itens }
}

// Um item por produto: itens_venda tem UNIQUE (venda_id, produto_id) e a baixa do estoque exige as quantidades já
// somadas. Fica o PRIMEIRO índice em que o produto apareceu, que é para onde os erros desse produto apontam.
// A ordem do resultado é a da primeira aparição de cada produto.
export function somarPorProduto(itens: readonly ItemPedido[]): ItemPedido[] {
  const porProduto = new Map<number, ItemPedido>()
  for (const item of itens) {
    const atual = porProduto.get(item.produtoId)
    if (atual) atual.quantidade += item.quantidade
    else porProduto.set(item.produtoId, { ...item })
  }

  const somados = [...porProduto.values()]
  const erros: Erros = {}
  for (const item of somados) {
    if (item.quantidade > maxQuantidadePorProduto) erros[`itens.${item.indice}.quantidade`] = msgQuantidade
  }
  if (Object.keys(erros).length) throw new AppError(msgDadosInvalidos, 422, erros)
  return somados
}

// retirada precisa ser exatamente true/false: "true", 1 ou "sim" não contam como escolha de retirada.
// Na cotação o destino é o cep; na venda, o enderecoId (um endereço salvo do próprio cliente).
export function lerEntrega(dados: Record<string, unknown>, modo: 'cep'): EntregaCotacao
export function lerEntrega(dados: Record<string, unknown>, modo: 'endereco'): EntregaVenda
export function lerEntrega(dados: Record<string, unknown>, modo: 'cep' | 'endereco'): EntregaCotacao | EntregaVenda {
  const { retirada } = dados
  if (!ausente(retirada) && typeof retirada !== 'boolean') {
    throw new AppError(msgDadosInvalidos, 422, { retirada: 'Informe true para retirar na loja ou false para entrega.' })
  }

  const chaveDestino = modo === 'cep' ? 'cep' : 'enderecoId'
  const destino = dados[chaveDestino]
  const temDestino = !ausente(destino) && destino !== ''

  if (retirada === true) {
    if (temDestino) throw new AppError(msgDadosInvalidos, 422, { entrega: msgEntrega })
    return { retirada: true }
  }
  if (!temDestino) throw new AppError(msgDadosInvalidos, 422, { entrega: msgEntrega })

  if (modo === 'cep') {
    // Mesmo tratamento do cadastro de endereço: a máscara (36300-000) é tirada; sobra só número
    const cep = typeof destino === 'string' ? destino.replace(/\D/g, '') : ''
    if (!/^[0-9]{8}$/.test(cep)) throw new AppError(msgDadosInvalidos, 422, { cep: msgCep })
    return { retirada: false, cep }
  }
  if (!ehIdValido(destino)) throw new AppError(msgDadosInvalidos, 422, { enderecoId: 'Endereço inválido.' })
  return { retirada: false, enderecoId: destino }
}

// totalEsperado (só na venda): o total, em centavos, que a cotação mostrou ao cliente. Só serve para CONFERIR o
// total recalculado; nunca define preço
export function lerTotalEsperado(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 0 || valor > maxCentavos) {
    throw new AppError(msgDadosInvalidos, 422, { totalEsperado: msgTotalEsperado })
  }
  return valor
}

// O body inteiro: os erros de itens, de entrega e do totalEsperado saem juntos num 422 só (api.md, seção 6).
// A soma dos repetidos vem depois, porque só faz sentido com todos os itens válidos.
// A cotação (#28) não lê totalEsperado: só a venda confere o total.
export function validarPedido(body: unknown, modo: 'cep'): { itens: ItemPedido[]; entrega: EntregaCotacao }
export function validarPedido(body: unknown, modo: 'endereco'): PedidoVenda
export function validarPedido(
  body: unknown,
  modo: 'cep' | 'endereco',
): { itens: ItemPedido[]; entrega: EntregaCotacao } | PedidoVenda {
  const dados = exigirObjeto(body)
  const erros: Erros = {}
  const coletar = <T>(ler: () => T): T | null => {
    try {
      return ler()
    } catch (err) {
      if (!(err instanceof AppError) || err.statusCode !== 422 || !err.detalhes) throw err
      Object.assign(erros, err.detalhes)
      return null
    }
  }

  const lidos = coletar(() => validarItens(dados.itens))
  if (modo === 'cep') {
    const entrega = coletar(() => lerEntrega(dados, 'cep'))
    if (!lidos || !entrega) throw new AppError(msgDadosInvalidos, 422, erros)
    return { itens: somarPorProduto(lidos.itens), entrega }
  }
  const entrega = coletar(() => lerEntrega(dados, 'endereco'))
  const totalEsperado = coletar(() => lerTotalEsperado(dados.totalEsperado))
  if (!lidos || !entrega || totalEsperado === null) throw new AppError(msgDadosInvalidos, 422, erros)
  return { itens: somarPorProduto(lidos.itens), entrega, totalEsperado }
}

// Produto que não voltou do catálogo ou está inativo: 422 no índice original (nunca o 409 do estoque, que é só
// para falta de quantidade). Devolve os produtos por id para quem chama montar os itens.
export function exigirDisponiveis(
  itens: readonly ItemPedido[],
  produtos: readonly ProdutoVenda[],
): Map<number, ProdutoVenda> {
  const porId = new Map(produtos.map((produto) => [produto.id, produto]))
  const erros: Erros = {}
  for (const item of itens) {
    if (!porId.get(item.produtoId)?.ativo) erros[`itens.${item.indice}.produtoId`] = msgProdutoIndisponivel
  }
  if (Object.keys(erros).length) throw new AppError(msgDadosInvalidos, 422, erros)
  return porId
}

// Preço SEMPRE do catálogo (produtos.preco), nunca do body. Os itens saem na ordem dos itens somados,
// que é a mesma ordem da lista entregue à calcularFrete (para traduzir o índice do erro do peixe).
export function precificar(
  itens: readonly ItemPedido[],
  porId: ReadonlyMap<number, ProdutoVenda>,
): { linhas: (NovoItemVenda & { categoria: string })[]; subtotal: number } {
  const linhas = itens.map((item) => {
    const produto = porId.get(item.produtoId)
    if (!produto) throw new Error('precificar recebeu um item sem produto; chame exigirDisponiveis antes.')
    return {
      produtoId: produto.id,
      nomeProduto: produto.nome,
      precoUnitario: produto.preco,
      quantidade: item.quantidade,
      subtotal: produto.preco * item.quantidade,
      categoria: produto.categoria,
    }
  })
  const subtotal = linhas.reduce((soma, linha) => soma + linha.subtotal, 0)
  return { linhas, subtotal }
}

// subtotal + frete precisa caber no INTEGER do banco; senão o INSERT falharia com um 500
export function somarTotal(subtotal: number, frete: number): number {
  const total = subtotal + frete
  if (total > maxCentavos) {
    throw new AppError(msgDadosInvalidos, 422, { itens: 'O valor da compra passou do limite. Divida em compras menores.' })
  }
  return total
}

// A calcularFrete aponta o peixe pelo índice da lista que ela recebeu (a dos itens somados); aqui esse índice
// vira o índice original do body. As outras chaves (ex.: cep) passam como vieram.
export function traduzirErroFrete(err: unknown, itensSomados: readonly ItemPedido[]): never {
  if (!(err instanceof AppError) || err.statusCode !== 422 || !err.detalhes) throw err
  const detalhes: Erros = {}
  for (const [chave, mensagem] of Object.entries(err.detalhes)) {
    const achado = /^itens\.(\d+)\.(.+)$/.exec(chave)
    const item = achado ? itensSomados[Number(achado[1])] : undefined
    if (achado && !item) throw err
    detalhes[item && achado ? `itens.${item.indice}.${achado[2]}` : chave] = mensagem
  }
  throw new AppError(err.message, 422, detalhes)
}

// O 409 do estoque vem por produtoId (err.itensIndisponiveis, D-50/D-51); o body fala em índices. Converte para
// 'itens.<indiceOriginal>.quantidade'. Qualquer erro de outra forma (inclusive 'Itens incompatíveis com a venda
// persistida' e falhas do banco) é relançado sem mudança.
export function traduzirEstoqueInsuficiente(err: unknown, itensSomados: readonly ItemPedido[]): never {
  if (!(err instanceof AppError) || err.statusCode !== 409 || err.message !== 'Estoque insuficiente') throw err
  const indisponiveis: unknown = (err as AppError & { itensIndisponiveis?: unknown }).itensIndisponiveis
  if (!Array.isArray(indisponiveis) || !indisponiveis.length) throw err

  const indicePorProduto = new Map(itensSomados.map((item) => [item.produtoId, item.indice]))
  const detalhes: Erros = {}
  for (const item of indisponiveis as unknown[]) {
    const produtoId = ehObjeto(item) ? item.produtoId : undefined
    const indice = typeof produtoId === 'number' ? indicePorProduto.get(produtoId) : undefined
    if (indice === undefined) throw err
    detalhes[`itens.${indice}.quantidade`] = msgSemEstoque
  }
  throw new AppError('Estoque insuficiente', 409, detalhes)
}

// Header Idempotency-Key do POST /api/vendas: obrigatório. Falta ou formato inválido → 400, como no estoque
export function validarChaveIdempotencia(valor: unknown): string {
  if (typeof valor !== 'string' || !uuidCanonico.test(valor)) {
    throw new AppError(msgDadosInvalidos, 400, {
      'Idempotency-Key': 'Informe um UUID canônico em minúsculas (versão 1 a 8 e variante RFC).',
    })
  }
  return valor
}

// SHA-256 da forma CANÔNICA do pedido já validado: um array de posições fixas, com os itens somados e ordenados por
// produtoId, a entrega e o totalEsperado. A mesma compra em outra ordem (ou com o mesmo produto dividido em dois
// itens) dá o mesmo hash; os índices do body e chaves extras não entram. É ele que diz se a mesma chave voltou com
// "outra compra".
export function hashDoPedido(pedido: PedidoVenda): string {
  const itens = [...pedido.itens]
    .sort((a, b) => a.produtoId - b.produtoId)
    .map((item) => [item.produtoId, item.quantidade])
  const entrega = pedido.entrega.retirada ? ['retirada'] : ['endereco', pedido.entrega.enderecoId]
  return createHash('sha256').update(JSON.stringify([itens, entrega, pedido.totalEsperado])).digest('hex')
}

// Centavos → 'R$ 1.234,56' (ponto de milhar e vírgula decimal), sem biblioteca. Só para valores >= 0 (totais)
export function formatarReais(centavos: number): string {
  const reais = Math.floor(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const resto = String(centavos % 100).padStart(2, '0')
  return `R$ ${reais},${resto}`
}
