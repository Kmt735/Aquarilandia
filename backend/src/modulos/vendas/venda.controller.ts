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

  // POST /api/vendas/:id/cancelar (#35): do cliente ou do admin (o service decide pelo papel da sessão). no-store: a
  // resposta é o detalhe da compra, com endereço e pagamento
  async cancelar(req: Request<{ id: string }>, res: Response): Promise<void> {
    const venda = await vendaService.cancelar(req.usuario!, idParam(req.params.id), req.body)
    res.set('Cache-Control', 'no-store')
    res.status(200).json(venda)
  },

  // ---------- admin (a rota passa antes pela guarda autenticar + exigirAdmin do vendaRoutes) ----------
  // no-store em todas: endereço, e-mail, telefone e pagamentos são dados pessoais

  // GET /api/vendas (#39)
  async listarParaAdmin(req: Request, res: Response): Promise<void> {
    const pagina = await vendaService.listarParaAdmin(req.query as Record<string, unknown>)
    res.set('Cache-Control', 'no-store')
    res.json(pagina)
  },

  // GET /api/vendas/:id (#40)
  async buscarParaAdmin(req: Request<{ id: string }>, res: Response): Promise<void> {
    const venda = await vendaService.buscarParaAdmin(idParam(req.params.id))
    res.set('Cache-Control', 'no-store')
    res.json(venda)
  },

  // GET /api/vendas/:id/historico (#40)
  async listarHistoricoParaAdmin(req: Request<{ id: string }>, res: Response): Promise<void> {
    const historico = await vendaService.listarHistoricoParaAdmin(idParam(req.params.id))
    res.set('Cache-Control', 'no-store')
    res.json(historico)
  },

  // POST /api/vendas/:id/pagamentos (#44). Nenhum campo do body é lido: valor, vencimento e dono vêm do banco.
  // no-store: a resposta tem o código Pix, que não pode ficar em cache
  async gerarPix(req: Request<{ id: string }>, res: Response): Promise<void> {
    const pix = await pagamentoService.gerarPix(req.usuario!.id, idParam(req.params.id))
    res.set('Cache-Control', 'no-store')
    res.status(201).json(pix)
  },
}
