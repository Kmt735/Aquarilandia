import type { UsuarioLogado } from '../../types/index.js'
import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import type { Queryable } from '../../utils/transacao.js'
import { paginacao } from '../../utils/validacao.js'
import { produtoService } from '../catalogo/produto.service.js'
import { clienteRepository } from '../clientes/cliente.repository.js'
import type { Endereco } from '../clientes/cliente.types.js'
import { enderecoRepository } from '../clientes/endereco.repository.js'
import { estoqueService } from '../estoque/estoque.service.js'
import { pagamentoService } from '../pagamentos/pagamento.service.js'
import { calcularFrete } from './frete.service.js'
import type { ResultadoFrete } from './frete.service.js'
import { vendaRepository } from './venda.repository.js'
import { podeTransicionar } from './venda.transicoes.js'
import { notificarMudancaStatus } from './vendaNotificacoes.js'
import type { AutoriaVenda } from './venda.transicoes.js'
import { listaStatusVenda, listaTiposEntrega } from './venda.types.js'
import type {
  DetalheVenda,
  DetalheVendaAdmin,
  EtapaHistoricoAdmin,
  FiltroVendas,
  FiltrosVendaAdmin,
  ItemPedido,
  LinhaPagamento,
  NovoItemVenda,
  PagamentoDaVenda,
  PagamentoEscolhido,
  PaginaVendas,
  PaginaVendasAdmin,
  ResultadoCriacaoVenda,
  StatusVenda,
  TipoEntrega,
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

// #35: a venda paga que o cliente (ou o admin) ainda pode cancelar: antes de sair da loja (D-17)
const statusCancelaComEstorno: readonly StatusVenda[] = ['paga', 'em_separacao', 'pronta_retirada']

// #41: os status que o admin escolhe pela rota. paga vem do gateway; cancelamento_solicitado e cancelada, do #35
const statusDoAdmin: readonly StatusVenda[] = ['em_separacao', 'enviada', 'pronta_retirada', 'entregue']
// Código dos Correios (2 letras, 9 números, 2 letras), depois do trim e das maiúsculas
const padraoRastreio = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/

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

// O pagamento que a compra mostra (#34, #48): o 'aprovado' mais recente SEM estorno pedido (estorno_solicitado_em);
// sem um aprovado assim, o mais recente de qualquer status; sem pagamentos, null. "Mais recente" = maior criadoEm, e
// o maior id no empate. Não depende da ordem recebida. Um pagamento em dobro (aprovado e devolvido, ou com a
// devolução pedida) nunca aparece como o pagamento da compra enquanto houver o aprovado de verdade.
// Devolve só status, método e data (o id e o estorno servem só para a escolha). Exportada para os testes.
export function escolherPagamento(pagamentos: readonly LinhaPagamento[]): PagamentoEscolhido | null {
  const maisRecente = (a: LinhaPagamento, b: LinhaPagamento): LinhaPagamento => {
    const diferenca = a.criadoEm.getTime() - b.criadoEm.getTime()
    if (diferenca !== 0) return diferenca > 0 ? a : b
    return a.id > b.id ? a : b
  }
  const aprovados = pagamentos.filter((pagamento) => pagamento.status === 'aprovado' && !pagamento.estornoSolicitadoEm)
  const candidatos = aprovados.length ? aprovados : pagamentos
  if (!candidatos.length) return null
  const { status, metodo, criadoEm } = candidatos.reduce(maisRecente)
  return { status, metodo, criadoEm }
}

// #48 (item 9 do PDF): a mensagem do pagamento no detalhe da compra. Depende também do status da venda: o Pix
// cancelado (expirado) de uma compra que ainda espera o pagamento convida a gerar outro; o aprovado de uma compra
// cancelada é dinheiro que está sendo devolvido. Exportada para os testes
export function mensagemDoPagamento(pagamento: PagamentoEscolhido, statusVenda: StatusVenda): string {
  switch (pagamento.status) {
    case 'pendente':
      return 'Aguardando o pagamento do Pix.'
    case 'aprovado':
      // Só chega aqui um aprovado com devolução pedida quando não há outro aprovado: a compra está sendo cancelada
      // (pedido do cliente ou do admin, #35) ou foi cancelada antes de o Pix ser pago
      if (statusVenda === 'cancelamento_solicitado') {
        return 'Cancelamento registrado. A devolução do pagamento está em andamento.'
      }
      if (statusVenda === 'cancelada') return 'Pagamento recebido. A devolução está em andamento.'
      return 'Pagamento confirmado.'
    case 'cancelado':
      return statusVenda === 'aguardando_pagamento'
        ? 'O código Pix expirou. Gere um novo código para pagar.'
        : 'Pagamento não concluído.'
    case 'recusado':
      return 'O pagamento não foi aprovado. Gere um novo código Pix.'
    case 'estornado':
      return 'Pagamento devolvido.'
    case 'em_disputa':
      return 'Pagamento em análise.'
  }
}

function pagamentoDaVenda(pagamentos: readonly LinhaPagamento[], statusVenda: StatusVenda): PagamentoDaVenda | null {
  const escolhido = escolherPagamento(pagamentos)
  return escolhido && { ...escolhido, mensagem: mensagemDoPagamento(escolhido, statusVenda) }
}

// #35: { motivo } opcional, até 300 caracteres depois do trim (vai para a observação do histórico). As outras
// chaves do body são ignoradas. Vazio ou só espaços = sem motivo
function validarMotivo(body: unknown): string | null {
  const motivo = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).motivo : undefined
  if (motivo === undefined || motivo === null) return null
  if (typeof motivo !== 'string') throw new AppError('Dados inválidos', 422, { motivo: 'Informe o motivo em texto.' })
  const texto = motivo.trim()
  if (texto.length > 300) {
    throw new AppError('Dados inválidos', 422, { motivo: 'O motivo pode ter até 300 caracteres.' })
  }
  return texto === '' ? null : texto
}

function autoria(usuario: UsuarioLogado, observacao: string | null): AutoriaVenda {
  return { ator: usuario.papel, clienteId: usuario.id, observacao }
}

// 409 do estornarVenda (Dev 2) para venda sem baixa (dado inconsistente, ex.: inserida à mão): não havia estoque
// baixado para devolver, então o cancelamento fica (o mesmo tratamento da expiração)
function semBaixaDeEstoque(err: unknown): boolean {
  return err instanceof AppError && err.statusCode === 409 && err.message === 'Venda sem baixa original de estoque'
}

// Sempre a tabela de transições antes de mudar: a regra não depende só de quem escreveu o fluxo
function exigirTransicao(de: StatusVenda, para: StatusVenda, ator: AutoriaVenda['ator']): void {
  if (!podeTransicionar(de, para, ator)) throw new Error(`Transição ${de} → ${para} proibida para ${ator}.`)
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

// #41: { status, observacao?, codigoRastreio? }. Os erros de formato saem juntos num 422; os que dependem da venda
// (transição, tipo de entrega, rastreio obrigatório) vêm depois, com a venda travada
function validarMudancaStatus(body: unknown): {
  status: StatusVenda
  observacao: string | null
  codigoRastreio: string | null
} {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 422, { body: 'Formato de dados inválido.' })
  }
  const dados = body as Record<string, unknown>
  const erros: Record<string, string> = {}

  const status = typeof dados.status === 'string' && statusDoAdmin.includes(dados.status as StatusVenda)
    ? dados.status as StatusVenda
    : null
  if (!status) erros.status = 'Escolha em_separacao, enviada, pronta_retirada ou entregue.'

  let observacao: string | null = null
  if (dados.observacao !== undefined && dados.observacao !== null) {
    if (typeof dados.observacao !== 'string') erros.observacao = 'Informe a observação em texto.'
    else if (dados.observacao.trim().length > 300) erros.observacao = 'A observação pode ter até 300 caracteres.'
    else observacao = dados.observacao.trim() || null
  }

  let codigoRastreio: string | null = null
  if (dados.codigoRastreio !== undefined && dados.codigoRastreio !== null) {
    const codigo = typeof dados.codigoRastreio === 'string' ? dados.codigoRastreio.trim().toUpperCase() : ''
    if (padraoRastreio.test(codigo)) codigoRastreio = codigo
    else erros.codigoRastreio = 'Informe o código de rastreio dos Correios no formato AA123456789BR.'
  }

  if (Object.keys(erros).length || !status) throw new AppError('Dados inválidos', 422, erros)
  return { status, observacao, codigoRastreio }
}

// AAAA-MM-DD de um dia que existe (2026-02-30 não passa: o Date.UTC rola para março e a volta não bate)
function ehData(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const [ano, mes, dia] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
}

// #39: ?clienteId, ?status, ?tipoEntrega, ?de, ?ate, ?problemaPagamento e a paginação. Os erros saem todos juntos
// num 400. Repetido (?status=a&status=b) chega como array e é inválido. Outros parâmetros são ignorados, como na
// /me/vendas
function validarFiltrosVendaAdmin(query: Record<string, unknown>): FiltrosVendaAdmin {
  const erros: Record<string, string> = {}
  const texto = (nome: string): string | null | undefined => {
    const valor = query[nome]
    if (valor === undefined) return null
    return typeof valor === 'string' ? valor : undefined
  }

  let clienteId: number | null = null
  const id = texto('clienteId')
  if (id !== null) {
    if (id !== undefined && /^[1-9][0-9]{0,9}$/.test(id) && Number(id) <= 2147483647) clienteId = Number(id)
    else erros.clienteId = 'Cliente inválido.'
  }

  let status: StatusVenda | null = null
  const valorStatus = texto('status')
  if (valorStatus !== null) {
    if (valorStatus !== undefined && (listaStatusVenda as readonly string[]).includes(valorStatus)) {
      status = valorStatus as StatusVenda
    } else {
      erros.status = 'Status inválido.'
    }
  }

  let tipoEntrega: TipoEntrega | null = null
  const valorTipo = texto('tipoEntrega')
  if (valorTipo !== null) {
    if (valorTipo !== undefined && (listaTiposEntrega as readonly string[]).includes(valorTipo)) {
      tipoEntrega = valorTipo as TipoEntrega
    } else {
      erros.tipoEntrega = 'Tipo de entrega inválido.'
    }
  }

  const datas: { de: string | null; ate: string | null } = { de: null, ate: null }
  for (const nome of ['de', 'ate'] as const) {
    const valor = texto(nome)
    if (valor === null) continue
    if (valor !== undefined && ehData(valor)) datas[nome] = valor
    else erros[nome] = 'Informe a data no formato AAAA-MM-DD.'
  }
  // Texto AAAA-MM-DD compara na ordem das datas
  if (datas.de !== null && datas.ate !== null && datas.de > datas.ate) {
    erros.ate = 'A data final precisa ser igual ou depois da inicial.'
  }

  let problemaPagamento = false
  const problema = texto('problemaPagamento')
  if (problema !== null) {
    if (problema === 'true' || problema === 'false') problemaPagamento = problema === 'true'
    else erros.problemaPagamento = 'Use true ou false.'
  }

  let pagina: { pagina: number; limite: number } = { pagina: 1, limite: 20 }
  try {
    pagina = paginacao(query)
  } catch (err) {
    if (!(err instanceof AppError)) throw err
    Object.assign(erros, err.detalhes)
  }

  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { clienteId, status, tipoEntrega, ...datas, problemaPagamento, ...pagina }
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

  // GET /api/clientes/:id/vendas (#37, admin): o mesmo formato, paginação e filtro. A query é conferida antes do banco.
  // buscarParaAdmin acha também contas desativadas e anonimizadas: o admin vê as vendas de uma conta anonimizada
  async listarDoClienteParaAdmin(clienteId: number, query: Record<string, unknown>): Promise<PaginaVendas> {
    const filtro = validarFiltroVendas(query)
    if (!(await clienteRepository.buscarParaAdmin(clienteId))) throw new AppError('Cliente não encontrado.', 404)
    return listarVendas(clienteId, filtro)
  },

  // GET /api/clientes/me/vendas/:id (#34). O buscarCompleta filtra por id E cliente_id: venda de outro cliente cai no
  // mesmo 404 da inexistente, sem confirmar que ela existe (D-08). Só depois disso as outras leituras, pela venda
  async buscarDoCliente(id: number, clienteId: number): Promise<DetalheVenda> {
    let venda = await vendaRepository.buscarCompleta(id, clienteId)
    if (!venda) throw new AppError('Compra não encontrada.', 404)

    // Rede de proteção (Lote 11): a compra ainda espera o Pix e tem uma cobrança pendente → reconsulta no gateway
    // ANTES de responder (no máximo 1 vez a cada 20 s por pagamento). Assim, mesmo se um aviso da AbacatePay se
    // perder, a página de "aguardando pagamento" do cliente confirma a venda sozinha. Gateway fora → mostra o banco
    if (venda.status === 'aguardando_pagamento' && (await pagamentoService.reconsultarPendente(id))) {
      venda = (await vendaRepository.buscarCompleta(id, clienteId)) ?? venda
    }

    const [codigoRastreio, historico, pagamentos] = await Promise.all([
      vendaRepository.buscarCodigoRastreio(id),
      vendaRepository.listarHistorico(id),
      pagamentoService.listarDaVenda(id),
    ])
    return { ...venda, codigoRastreio, historico, pagamento: pagamentoDaVenda(pagamentos, venda.status) }
  },

  // POST /api/vendas/:id/cancelar (#35), do cliente (só a própria venda) ou do admin (qualquer uma). O status é lido
  // com a venda TRAVADA, e o que acontece depende dele:
  //   aguardando_pagamento → cancelada, o estoque volta e o Pix pendente vira cancelado, tudo na mesma transação.
  //   paga, em_separacao, pronta_retirada → o estorno em três passos (D-22):
  //     1) numa transação: venda → cancelamento_solicitado e estorno pedido no pagamento que a confirmou;
  //     2) FORA da transação: uma tentativa de estorno no gateway (pagamentoService.tentarEstornoPendente);
  //     3) a resposta mostra o estado final: estorno aprovado → a venda já está cancelada (o tentarEstornoPendente
  //        conclui); falhou → continua cancelamento_solicitado, e a tarefa de 5 em 5 minutos tenta de novo.
  //   cancelamento_solicitado → cliente: 409 (já está em andamento). Admin: só depois das 5 tentativas automáticas
  //     de estorno, com o motivo obrigatório: ele confirma que devolveu pelo painel da AbacatePay; o pagamento vira
  //     estornado ('estorno manual'), a venda cancelada (ator admin) e o estoque volta, numa transação só.
  //   enviada, entregue, cancelada → 409.
  async cancelar(usuario: UsuarioLogado, vendaId: number, body: unknown): Promise<DetalheVenda | DetalheVendaAdmin> {
    const motivo = validarMotivo(body)
    const ehAdmin = usuario.papel === 'admin'

    type Resultado = { estornar: number | null; cancelou: boolean }
    const { estornar, cancelou } = await comTransacao(async (client): Promise<Resultado> => {
      // A venda do cliente é procurada por id E cliente_id: a de outro cai no mesmo 404 da inexistente
      const status = await vendaRepository.travarParaCancelar(vendaId, ehAdmin ? null : usuario.id, client)
      if (!status) throw new AppError(ehAdmin ? 'Venda não encontrada.' : 'Compra não encontrada.', 404)

      if (status === 'aguardando_pagamento') {
        exigirTransicao(status, 'cancelada', usuario.papel)
        // A venda está travada: o mudarStatus sempre casa
        await vendaRepository.mudarStatus(vendaId, status, 'cancelada', autoria(usuario, motivo), client)
        await estoqueService.estornarVenda(vendaId, client)
        // Ordem venda → pagamento, a mesma do webhook
        await pagamentoService.cancelarPendentes(vendaId, client)
        return { estornar: null, cancelou: true }
      }

      if (statusCancelaComEstorno.includes(status)) {
        exigirTransicao(status, 'cancelamento_solicitado', usuario.papel)
        // Passo 1. Sem pagamento aprovado (ex.: estornado pelo painel da AbacatePay) não há o que devolver
        // automaticamente: a loja precisa olhar
        const pagamentoId = await pagamentoService.pedirEstornoDoCancelamento(vendaId, client)
        if (pagamentoId === null) {
          console.error(`[cancelamento] venda ${vendaId} em ${status} sem pagamento aprovado`)
          throw new AppError('Não foi possível cancelar agora. Fale com a loja.', 409)
        }
        await vendaRepository.mudarStatus(vendaId, status, 'cancelamento_solicitado', autoria(usuario, motivo), client)
        return { estornar: pagamentoId, cancelou: false }
      }

      if (status === 'cancelamento_solicitado') {
        if (!ehAdmin) throw new AppError('O cancelamento desta compra já está em andamento.', 409)
        const pagamento = await pagamentoService.travarConfirmadorEmEstorno(vendaId, client)
        if (!pagamento || pagamento.tentativas < pagamentoService.maxTentativasEstorno) {
          throw new AppError('O estorno ainda está sendo tentado automaticamente.', 409)
        }
        if (!motivo) throw new AppError('Dados inválidos', 422, { motivo: 'Descreva como o estorno foi feito.' })
        exigirTransicao(status, 'cancelada', usuario.papel)
        await pagamentoService.marcarEstornoManual(pagamento.id, client)
        await vendaRepository.mudarStatus(vendaId, status, 'cancelada', autoria(usuario, motivo), client)
        try {
          await estoqueService.estornarVenda(vendaId, client)
        } catch (err) {
          if (!semBaixaDeEstoque(err)) throw err
          console.error(`[cancelamento] venda ${vendaId} sem baixa de estoque`)
        }
        console.error(`[estorno] pagamento ${pagamento.id} concluído manualmente pelo admin ${usuario.id}`)
        return { estornar: null, cancelou: true }
      }
      throw new AppError('Esta compra não pode mais ser cancelada.', 409)
    })

    // Depois do COMMIT: o e-mail de compra cancelada (no passo 2 abaixo, quem avisa é a conclusão do estorno)
    if (cancelou) notificarMudancaStatus(vendaId, 'cancelada')

    // Passo 2, fora da transação: nenhuma chamada de rede segura a trava da venda. Um erro aqui não desfaz o pedido
    // de cancelamento (já gravado): a tarefa de 5 em 5 minutos tenta de novo
    if (estornar !== null) {
      try {
        await pagamentoService.tentarEstornoPendente(estornar)
      } catch (err) {
        console.error(`[cancelamento] venda ${vendaId}: estorno não tentado (${pagamentoService.codigoDoErro(err)})`)
      }
    }

    return ehAdmin ? vendaService.buscarParaAdmin(vendaId) : vendaService.buscarDoCliente(vendaId, usuario.id)
  },

  // GET /api/vendas (#39, admin): paginada, com os filtros conferidos antes do banco
  async listarParaAdmin(query: Record<string, unknown>): Promise<PaginaVendasAdmin> {
    const filtro = validarFiltrosVendaAdmin(query)
    const { linhas, total } = await vendaRepository.listarParaAdmin(filtro, pagamentoService.maxTentativasEstorno)
    return { dados: linhas, total, pagina: filtro.pagina, limite: filtro.limite }
  },

  // GET /api/vendas/:id (#40, admin; também a resposta do #35 e do #41 para o admin): o detalhe do cliente (a venda,
  // o rastreio, o histórico simples e o pagamento escolhido com a mensagem) mais a conta e TODOS os pagamentos, com o
  // id da cobrança cortado. Sem reconsulta no gateway: a leitura do admin não muda nada
  async buscarParaAdmin(vendaId: number): Promise<DetalheVendaAdmin> {
    const venda = await vendaRepository.buscarCompletaParaAdmin(vendaId)
    if (!venda) throw new AppError('Venda não encontrada.', 404)
    const { clienteId, ...semDono } = venda
    const [codigoRastreio, historico, pagamentos, todos, conta] = await Promise.all([
      vendaRepository.buscarCodigoRastreio(vendaId),
      vendaRepository.listarHistorico(vendaId),
      pagamentoService.listarDaVenda(vendaId),
      pagamentoService.listarParaAdmin(vendaId),
      clienteRepository.buscarParaAdmin(clienteId),
    ])
    // A venda tem FK para clientes e a conta nunca é apagada (D-23, anonimizada): não tem como faltar
    if (!conta) throw new Error('Cliente da venda não encontrado.')
    return {
      ...semDono,
      codigoRastreio,
      historico,
      pagamento: pagamentoDaVenda(pagamentos, venda.status),
      cliente: { id: conta.id, nome: conta.nome, email: conta.email, telefone: conta.telefone },
      pagamentos: todos,
    }
  },

  // POST /api/vendas/:id/status (#41, admin): avança a venda pela tabela de transições, com a venda travada. Segue os
  // CHECKs do 20_vendas.sql: enviada só para correios/propria, pronta_retirada só para retirada, e o rastreio só
  // existe nos correios, obrigatório ao enviar (gravado junto, na mesma transação)
  async mudarStatusPeloAdmin(admin: UsuarioLogado, vendaId: number, body: unknown): Promise<DetalheVendaAdmin> {
    const pedido = validarMudancaStatus(body)
    const novo = pedido.status

    await comTransacao(async (client) => {
      const venda = await vendaRepository.travarParaStatus(vendaId, client)
      if (!venda) throw new AppError('Venda não encontrada.', 404)
      const { status: atual, tipoEntrega } = venda
      if (!podeTransicionar(atual, novo, 'admin')) {
        throw new AppError(`Não é possível mudar de ${atual} para ${novo}.`, 409)
      }
      if (novo === 'enviada' && tipoEntrega === 'retirada') {
        throw new AppError('Uma compra para retirada na loja não é enviada.', 409)
      }
      if (novo === 'pronta_retirada' && tipoEntrega !== 'retirada') {
        throw new AppError('Só compras para retirada na loja ficam prontas para retirada.', 409)
      }

      const enviaPelosCorreios = novo === 'enviada' && tipoEntrega === 'correios'
      if (pedido.codigoRastreio !== null && !enviaPelosCorreios) {
        throw new AppError('Dados inválidos', 422, {
          codigoRastreio: tipoEntrega === 'correios'
            ? 'O código de rastreio é informado quando a compra é enviada.'
            : 'Só compras enviadas pelos Correios têm código de rastreio.',
        })
      }
      if (enviaPelosCorreios && pedido.codigoRastreio === null) {
        throw new AppError('Dados inválidos', 422, { codigoRastreio: 'Informe o código de rastreio dos Correios.' })
      }

      if (pedido.codigoRastreio !== null) await vendaRepository.definirRastreio(vendaId, pedido.codigoRastreio, client)
      // A venda está travada desde a leitura do status: o mudarStatus sempre casa
      await vendaRepository.mudarStatus(vendaId, atual, novo, autoria(admin, pedido.observacao), client)
    })

    // Depois do COMMIT: o e-mail ao cliente (em_separacao não avisa)
    if (novo === 'enviada' || novo === 'pronta_retirada' || novo === 'entregue') notificarMudancaStatus(vendaId, novo)

    return vendaService.buscarParaAdmin(vendaId)
  },

  // GET /api/vendas/:id/historico (#40, admin): com origem, quem mudou e a observação
  async listarHistoricoParaAdmin(vendaId: number): Promise<EtapaHistoricoAdmin[]> {
    if (!(await vendaRepository.existe(vendaId))) throw new AppError('Venda não encontrada.', 404)
    return vendaRepository.listarHistoricoParaAdmin(vendaId)
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
