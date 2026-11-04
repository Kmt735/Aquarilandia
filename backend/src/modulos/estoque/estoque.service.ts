import { createHash, randomUUID } from 'node:crypto'
import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { estoqueRepository } from './estoque.repository.js'
import { validarConsultaHistorico, validarConsultaSaldo, validarMovimento } from './estoque.validacao.js'
import type { ResultadoMovimento } from './estoque.types.js'
import { estoqueVendaService } from './estoque-venda.service.js'

export const estoqueService = {
  ...estoqueVendaService,
  async consultarSaldo(id: unknown, query: object) {
    const produto = await estoqueRepository.buscarSaldo(validarConsultaSaldo(id, query))
    if (!produto) throw new AppError('Produto não encontrado', 404)
    return produto
  },

  async consultarHistorico(query: Record<string, unknown>) {
    const historico = await estoqueRepository.listarHistorico(validarConsultaHistorico(query))
    if (!historico) throw new AppError('Produto não encontrado', 404)
    return historico
  },

  async registrarMovimentacao(autorId: number, body: unknown, chaveRecebida: unknown, query: object): Promise<ResultadoMovimento> {
    const { dados, chave } = validarMovimento(body, chaveRecebida, query)
    // Array fechado: ordem das chaves do JSON não muda a intenção; texto é normalizado antes do hash.
    const hash = createHash('sha256').update(JSON.stringify([dados.produtoId, dados.tipo, dados.quantidade, dados.motivo])).digest('hex')
    return comTransacao(async (tx) => {
      const operacaoId = randomUUID()
      // A constraint única espera o COMMIT/ROLLBACK da requisição concorrente com a mesma chave.
      if (!await estoqueRepository.criarOperacao(operacaoId, autorId, chave, hash, tx)) {
        const { hashRequisicao, ...resultado } = await estoqueRepository.buscarOperacao(autorId, chave, tx)
        if (hashRequisicao !== hash) throw new AppError('Chave de idempotência já utilizada com dados diferentes', 409)
        return resultado
      }
      const produto = await estoqueRepository.bloquearProduto(dados.produtoId, tx)
      if (!produto) throw new AppError('Produto não encontrado', 404)
      const positivo = dados.tipo === 'entrada' || dados.tipo === 'ajuste_positivo'
      const atual = produto.estoque + (positivo ? dados.quantidade : -dados.quantidade)
      if (atual < 0) throw new AppError('Estoque insuficiente', 409, { quantidade: 'A quantidade solicitada supera o saldo disponível.' })
      if (atual > 2147483647) throw new AppError('Limite de estoque excedido', 409, { quantidade: 'O saldo resultante excederia 2147483647 unidades.' })
      await estoqueRepository.atualizarSaldo(dados.produtoId, produto.estoque, atual, tx)
      return estoqueRepository.inserirMovimento(operacaoId, dados, produto.estoque, atual, tx)
    })
  },
}
