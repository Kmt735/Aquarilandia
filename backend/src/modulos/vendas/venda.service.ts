import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import type { Queryable } from '../../utils/transacao.js'
import { paginacao } from '../../utils/validacao.js'
import { produtoService } from '../catalogo/produto.service.js'
import { clienteRepository } from '../clientes/cliente.repository.js'
import type { Endereco } from '../clientes/cliente.types.js'
import { enderecoRepository } from '../clientes/endereco.repository.js'
import { estoqueService } from '../estoque/estoque.service.js'
import { calcularFrete } from './frete.service.js'
import type { ResultadoFrete } from './frete.service.js'
import { vendaRepository } from './venda.repository.js'
import { listaStatusVenda } from './venda.types.js'
import type {
  FiltroVendas,
  ItemPedido,
  NovoItemVenda,
  PaginaVendas,
  ResultadoCriacaoVenda,
  StatusVenda,
  VendaCriada,
} from './venda.types.js'
import {
  exigirDisponiveis,
  formatarReais,
  hashDoPedido,
  precificar,
  somarTotal,
  traduzirErroFrete,
  traduzirEstoqueInsuficiente,
  validarPedido,
} from './venda.validacao.js'

// Venda que ainda pode gerar entrega, cobrança ou estorno (só entregue e cancelada são finais)
const statusEmAndamento: readonly StatusVenda[] = [
  'aguardando_pagamento',
  'paga',
  'em_separacao',
  'enviada',
  'pronta_retirada',
  'cancelamento_solicitado',
]

// Vendas que contam no total gasto: pagamento confirmado e sem cancelamento. cancelamento_solicitado fica fora
// porque o estorno já está em andamento (o dinheiro vai voltar), e aguardando_pagamento ainda não foi pago.
const statusPagos: readonly StatusVenda[] = [
  'paga',
  'em_separacao',
  'enviada',
  'pronta_retirada',
  'entregue',
]

// #31: cada venda aberta segura estoque por 30 minutos; o limite impede uma conta de esvaziar a loja sem pagar
const maxVendasAguardando = 5

// calcularFrete com o endereço salvo. O erro de CEP fala em 'cep', mas o body da venda manda enderecoId:
// a chave vira enderecoId. O erro do peixe tem o índice traduzido para o do body.
function freteDaVenda(
  endereco: Endereco | null,
  itens: readonly ItemPedido[],
  linhas: readonly { categoria: string }[],
  subtotal: number,
): ResultadoFrete {
  try {
    return endereco
      ? calcularFrete({ retirada: false, cep: endereco.cep, itens: linhas, subtotal })
      : calcularFrete({ retirada: true, itens: linhas, subtotal })
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 422 && err.detalhes?.cep) {
      throw new AppError('Dados inválidos', 422, {
        enderecoId: 'Não entregamos no CEP deste endereço. Escolha outro endereço ou retire na loja.',
      })
    }
    traduzirErroFrete(err, itens)
  }
}

// 23505 = unique_violation; só a constraint da chave conta como repetição (qualquer outra continua sendo erro)
function violouChaveUnica(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const { code, constraint } = err as { code?: unknown; constraint?: unknown }
  return code === '23505' && constraint === 'uq_vendas_cliente_chave'
}

// 'Filtro X' (1 item), 'Filtro X e mais 1 item' (2) ou 'Filtro X e mais 2 itens' (3 ou mais).
// quantidade = linhas de itens_venda (produtos diferentes), não a soma das quantidades. Exportada para os testes
export function montarResumo(primeiroItem: string | null, quantidadeItens: number): string | null {
  if (primeiroItem === null || quantidadeItens < 1) return null
  const outros = quantidadeItens - 1
  if (outros === 0) return primeiroItem
  return `${primeiroItem} e mais ${outros} ${outros === 1 ? 'item' : 'itens'}`
}

// ?status= (opcional, um dos valores do DOMAIN status_venda) e a paginação da seção 4. Os erros dos dois saem juntos
function validarFiltroVendas(query: Record<string, unknown>): FiltroVendas {
  const erros: Record<string, string> = {}
  let status: StatusVenda | null = null
  if (query.status !== undefined) {
    // Repetido (?status=a&status=b) chega como array e também é inválido
    const valor = query.status
    if (typeof valor === 'string' && (listaStatusVenda as readonly string[]).includes(valor)) {
      status = valor as StatusVenda
    } else {
      erros.status = 'Status inválido.'
    }
  }

  let pagina: { pagina: number; limite: number } = { pagina: 1, limite: 20 }
  try {
    pagina = paginacao(query)
  } catch (err) {
    if (!(err instanceof AppError)) throw err
    Object.assign(erros, err.detalhes)
  }

  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { status, ...pagina }
}

async function listarVendas(clienteId: number, filtro: FiltroVendas): Promise<PaginaVendas> {
  const { linhas, total } = await vendaRepository.listarDoCliente(clienteId, filtro)
  const dados = linhas.map(({ primeiroItem, ...linha }) => ({
    ...linha,
    resumo: montarResumo(primeiroItem, linha.quantidadeItens),
  }))
  return { dados, total, pagina: filtro.pagina, limite: filtro.limite }
}

async function vendaCompleta(id: number, clienteId: number, executor?: Queryable): Promise<VendaCriada> {
  const venda = await vendaRepository.buscarCompleta(id, clienteId, executor)
  if (!venda) throw new Error('Venda do cliente não encontrada logo depois de gravada.')
  return venda
}

// A mesma chave voltou: com o mesmo pedido (mesmo hash), devolve a venda como ela está agora; com outro, 409
async function repetir(
  anterior: { id: number; hashRequisicao: string },
  hash: string,
  clienteId: number,
  executor?: Queryable,
): Promise<ResultadoCriacaoVenda> {
  if (anterior.hashRequisicao !== hash) throw new AppError('Esta chave já foi usada em outra compra.', 409)
  return { venda: await vendaCompleta(anterior.id, clienteId, executor), repetida: true }
}

export const vendaService = {
  // GET /api/clientes/me/vendas (#33): clienteId vem SEMPRE da sessão (req.usuario.id), nunca da URL (D-08)
  async listarDoCliente(clienteId: number, query: Record<string, unknown>): Promise<PaginaVendas> {
    return listarVendas(clienteId, validarFiltroVendas(query))
  },

  async temCompraEmAndamento(clienteId: number, executor: Queryable): Promise<boolean> {
    return (await vendaRepository.contarEmAndamentoDoCliente(clienteId, statusEmAndamento, executor)) > 0
  },

  // Quantidade de vendas de cada cliente da página, numa query só (evita o N+1: uma query por cliente)
  async contarPorClientes(ids: number[]): Promise<Map<number, number>> {
    if (!ids.length) return new Map()
    const linhas = await vendaRepository.contarPorClientes(ids)
    return new Map(linhas.map((linha) => [linha.clienteId, linha.quantidade]))
  },

  // totalVendas conta todas as vendas; totalGasto soma, em centavos, só as de statusPagos
  async resumoDoCliente(clienteId: number): Promise<{ totalVendas: number; totalGasto: number }> {
    return vendaRepository.resumirDoCliente(clienteId, statusPagos)
  },

  // POST /api/vendas (#30, #31). Ordem das travas, a mesma em toda venda:
  //   1. o cliente (FOR UPDATE): duas compras do mesmo cliente passam uma de cada vez (a Idempotency-Key e o
  //      limite de 5 abertas são conferidos depois desta trava) e a compra não cruza com o apagar conta;
  //   2. os produtos (FOR NO KEY UPDATE, em ordem de id, no buscarParaVenda com o client): preço e ativo ficam fixos
  //      até o COMMIT, e duas vendas com os mesmos produtos travam na mesma ordem, sem deadlock;
  //   3. a baixa do estoque (Dev 2) trava a venda, os itens e os MESMOS produtos, na mesma ordem de id: a transação
  //      já tem essas travas, então a baixa não espera de novo.
  // O preço vem SÓ do catálogo, lido sob a trava do passo 2: o do body é ignorado e o da cotação pode estar velho.
  // Qualquer erro dentro da transação desfaz tudo (venda, itens, histórico e baixa).
  async criar(clienteId: number, body: unknown, chave: string): Promise<ResultadoCriacaoVenda> {
    // Fora da transação: validação e leituras baratas, sem segurar conexão do pool nem trava
    const pedido = validarPedido(body, 'endereco')
    const { itens, entrega, totalEsperado } = pedido
    const hash = hashDoPedido(pedido)
    const cliente = await clienteRepository.buscarPorId(clienteId)
    if (!cliente) throw new AppError('Faça login para continuar.', 401)
    const { nome, telefone } = cliente
    if (!telefone) {
      throw new AppError('Dados inválidos', 422, { telefone: 'Cadastre um celular na sua conta antes de finalizar a compra.' })
    }

    try {
      return await comTransacao(async (client) => {
        // A trava do cliente vem PRIMEIRO; false = conta desativada ou anonimizada enquanto o pedido chegava
        if (!(await clienteRepository.travarParaAlteracao(clienteId, client))) {
          throw new AppError('Faça login para continuar.', 401)
        }

        // Idempotência: um pedido repetido (clique duplo, nova tentativa da rede) com a mesma chave ESPERA na trava
        // do cliente acima até o primeiro terminar; quando passa, já acha a venda pronta e só a devolve, sem criar
        // nada nem baixar estoque. Fica antes do limite de 5: repetir uma compra não é uma compra nova
        const anterior = await vendaRepository.buscarPorChave(clienteId, chave, client)
        if (anterior) return repetir(anterior, hash, clienteId, client)

        if ((await vendaRepository.contarAguardandoPagamento(clienteId, client)) >= maxVendasAguardando) {
          throw new AppError('Você já tem 5 compras aguardando pagamento.', 409)
        }

        // Endereço de outro cliente não é encontrado (filtro por id E cliente_id): 404, sem confirmar que existe
        let endereco: Endereco | null = null
        if (!entrega.retirada) {
          endereco = await enderecoRepository.buscarDoCliente(entrega.enderecoId, clienteId, client)
          if (!endereco) throw new AppError('Endereço não encontrado.', 404)
        }

        const produtos = await produtoService.buscarParaVenda(itens.map((item) => item.produtoId), client)
        const { linhas, subtotal } = precificar(itens, exigirDisponiveis(itens, produtos))
        const frete = freteDaVenda(endereco, itens, linhas, subtotal)
        const total = somarTotal(subtotal, frete.frete)

        // O totalEsperado só CONFERE: o preço continua vindo só do catálogo (travado acima). Diferente = o preço ou o
        // frete mudou desde a cotação; nada é gravado e o cliente vê o total novo antes de decidir
        if (total !== totalEsperado) {
          throw new AppError('O valor da compra mudou desde a cotação. Confira o carrinho antes de finalizar.', 409, {
            totalEsperado: `O total agora é ${formatarReais(total)}.`,
          })
        }

        // Cópia do endereço (D-12): a venda mostra para onde foi enviada mesmo se o endereço mudar ou for apagado
        const copia = endereco && {
          cep: endereco.cep,
          logradouro: endereco.logradouro,
          numero: endereco.numero,
          complemento: endereco.complemento,
          bairro: endereco.bairro,
          cidade: endereco.cidade,
          uf: endereco.uf,
        }
        const vendaId = await vendaRepository.inserir({
          clienteId,
          subtotal,
          frete: frete.frete,
          total,
          tipoEntrega: frete.tipoEntrega,
          prazoEntregaDias: frete.prazoDias,
          destinatario: nome,
          telefone,
          endereco: copia,
          chaveIdempotencia: chave,
          hashRequisicao: hash,
        }, client)

        const itensVenda: NovoItemVenda[] = linhas.map((linha) => ({
          produtoId: linha.produtoId,
          nomeProduto: linha.nomeProduto,
          precoUnitario: linha.precoUnitario,
          quantidade: linha.quantidade,
          subtotal: linha.subtotal,
        }))
        await vendaRepository.inserirItens(vendaId, itensVenda, client)
        await vendaRepository.registrarCriacao(vendaId, clienteId, client)

        // A baixa exige a venda e os itens_venda já gravados, com as quantidades somadas (D-51)
        try {
          const movimento = itens.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade }))
          await estoqueService.baixarParaVenda(vendaId, movimento, client)
        } catch (err) {
          traduzirEstoqueInsuficiente(err, itens)
        }

        // A resposta sai do banco, pela mesma função da repetição: as duas têm sempre o mesmo formato
        return { venda: await vendaCompleta(vendaId, clienteId, client), repetida: false }
      })
    } catch (err) {
      // Rede de segurança: com a trava do cliente, dois pedidos com a mesma chave não chegam juntos ao INSERT. Se
      // mesmo assim o UNIQUE (cliente_id, chave_idempotencia) estourar, a outra venda já foi gravada: a transação
      // desta já foi desfeita, então relê fora dela e trata como repetição
      if (!violouChaveUnica(err)) throw err
      const anterior = await vendaRepository.buscarPorChave(clienteId, chave)
      if (!anterior) throw err
      return repetir(anterior, hash, clienteId)
    }
  },
}
