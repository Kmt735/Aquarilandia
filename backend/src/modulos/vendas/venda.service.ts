import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import type { Queryable } from '../../utils/transacao.js'
import { produtoService } from '../catalogo/produto.service.js'
import { clienteRepository } from '../clientes/cliente.repository.js'
import type { Endereco } from '../clientes/cliente.types.js'
import { enderecoRepository } from '../clientes/endereco.repository.js'
import { estoqueService } from '../estoque/estoque.service.js'
import { calcularFrete } from './frete.service.js'
import type { ResultadoFrete } from './frete.service.js'
import { vendaRepository } from './venda.repository.js'
import type { ItemPedido, NovoItemVenda, StatusVenda, VendaCriada } from './venda.types.js'
import {
  exigirDisponiveis,
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

export const vendaService = {
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
  //   1. o cliente (FOR UPDATE): duas compras do mesmo cliente passam uma de cada vez (o limite de 5 abertas é
  //      contado depois desta trava) e a compra não cruza com o apagar conta, que trava a mesma linha;
  //   2. os produtos (FOR NO KEY UPDATE, em ordem de id, no buscarParaVenda com o client): preço e ativo ficam fixos
  //      até o COMMIT, e duas vendas com os mesmos produtos travam na mesma ordem, sem deadlock;
  //   3. a baixa do estoque (Dev 2) trava a venda, os itens e os MESMOS produtos, na mesma ordem de id: a transação
  //      já tem essas travas, então a baixa não espera de novo.
  // O preço vem SÓ do catálogo, lido sob a trava do passo 2: o do body é ignorado e o da cotação pode estar velho.
  // Qualquer erro dentro da transação desfaz tudo (venda, itens, histórico e baixa).
  async criar(clienteId: number, body: unknown): Promise<VendaCriada> {
    // Fora da transação: validação e leituras baratas, sem segurar conexão do pool nem trava
    const { itens, entrega } = validarPedido(body, 'endereco')
    const cliente = await clienteRepository.buscarPorId(clienteId)
    if (!cliente) throw new AppError('Faça login para continuar.', 401)
    const { nome, telefone } = cliente
    if (!telefone) {
      throw new AppError('Dados inválidos', 422, { telefone: 'Cadastre um celular na sua conta antes de finalizar a compra.' })
    }

    return comTransacao(async (client) => {
      // A trava do cliente vem PRIMEIRO; false = conta desativada ou anonimizada enquanto o pedido chegava
      if (!(await clienteRepository.travarParaAlteracao(clienteId, client))) {
        throw new AppError('Faça login para continuar.', 401)
      }
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
      const venda = await vendaRepository.inserir({
        clienteId,
        subtotal,
        frete: frete.frete,
        total,
        tipoEntrega: frete.tipoEntrega,
        prazoEntregaDias: frete.prazoDias,
        destinatario: nome,
        telefone,
        endereco: copia,
      }, client)

      const itensVenda: NovoItemVenda[] = linhas.map((linha) => ({
        produtoId: linha.produtoId,
        nomeProduto: linha.nomeProduto,
        precoUnitario: linha.precoUnitario,
        quantidade: linha.quantidade,
        subtotal: linha.subtotal,
      }))
      await vendaRepository.inserirItens(venda.id, itensVenda, client)
      await vendaRepository.registrarCriacao(venda.id, clienteId, client)

      // A baixa exige a venda e os itens_venda já gravados, com as quantidades somadas (D-51)
      try {
        const movimento = itens.map((item) => ({ produtoId: item.produtoId, quantidade: item.quantidade }))
        await estoqueService.baixarParaVenda(venda.id, movimento, client)
      } catch (err) {
        traduzirEstoqueInsuficiente(err, itens)
      }

      return {
        id: venda.id,
        status: venda.status,
        tipoEntrega: frete.tipoEntrega,
        subtotal,
        frete: frete.frete,
        total,
        prazoEntregaDias: frete.prazoDias,
        expiraEm: venda.expiraEm,
        criadoEm: venda.criadoEm,
        itens: itensVenda,
        entrega: copia && { ...copia, destinatario: nome, telefone },
      }
    })
  },
}
