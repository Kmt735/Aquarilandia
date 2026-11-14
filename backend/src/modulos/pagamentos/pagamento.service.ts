import type { LinhaPagamento } from '../vendas/venda.types.js'
import { pagamentoRepository } from './pagamento.repository.js'

// Pagamentos (Lote 11). O venda.service chama por aqui, não pelo repository (seção 8 do api.md)
export const pagamentoService = {
  // Detalhe da compra (#34)
  async listarDaVenda(vendaId: number): Promise<LinhaPagamento[]> {
    return pagamentoRepository.listarPorVenda(vendaId)
  },
}
