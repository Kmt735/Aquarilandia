import type { Request, Response } from 'express'
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
}
