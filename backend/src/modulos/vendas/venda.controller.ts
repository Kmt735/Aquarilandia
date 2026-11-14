import type { Request, Response } from 'express'
import { idParam } from '../../utils/validacao.js'
import { pagamentoService } from '../pagamentos/pagamento.service.js'
import { vendaService } from './venda.service.js'
import { validarChaveIdempotencia } from './venda.validacao.js'

// O `!` em req.usuario é seguro só porque a rota passa antes pelo `autenticar`.
// O dono vem da sessão: nenhum clienteId do body é lido (api.md, seção 11)
export const vendaController = {
  async criar(req: Request, res: Response): Promise<void> {
    // Header obrigatório, conferido antes do body (mesmo padrão do POST /api/estoque/movimentacoes)
    const chave = validarChaveIdempotencia(req.get('Idempotency-Key'))
    const { venda, repetida } = await vendaService.criar(req.usuario!.id, req.body, chave)
    // A repetição responde igual à criação (201, mesmo corpo); o header avisa que nada novo foi criado
    if (repetida) res.set('Idempotent-Replayed', 'true')
    res.status(201).json(venda)
  },

  // POST /api/vendas/:id/pagamentos (#44). Nenhum campo do body é lido: valor, vencimento e dono vêm do banco.
  // no-store: a resposta tem o código Pix, que não pode ficar em cache
  async gerarPix(req: Request<{ id: string }>, res: Response): Promise<void> {
    const pix = await pagamentoService.gerarPix(req.usuario!.id, idParam(req.params.id))
    res.set('Cache-Control', 'no-store')
    res.status(201).json(pix)
  },
}
