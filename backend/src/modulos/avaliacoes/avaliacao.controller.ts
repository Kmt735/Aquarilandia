import type { Request, Response } from 'express'
import { idParam } from '../../utils/validacao.js'
import { avaliacaoService } from './avaliacao.service.js'

export const avaliacaoController = {
  async criarDoProduto(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.status(201).json(await avaliacaoService.criarDoProduto(idParam(req.params.id), req.body))
  },

  // Público, mas muda a cada moderação: cache curto no navegador, sem cache compartilhado
  async listarDoProduto(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-cache').json(await avaliacaoService.listarDoProduto(idParam(req.params.id)))
  },

  async criarDoSite(req: Request, res: Response): Promise<void> {
    res.status(201).json(await avaliacaoService.criarDoSite(req.body))
  },

  async resumoDoSite(_req: Request, res: Response): Promise<void> {
    res.set('Cache-Control', 'no-cache').json(await avaliacaoService.resumoDoSite())
  },

  async resumoAdmin(_req: Request, res: Response): Promise<void> {
    res.json(await avaliacaoService.resumoAdmin())
  },

  async listarProdutosAdmin(req: Request, res: Response): Promise<void> {
    res.json(await avaliacaoService.listarProdutosAdmin(req.query))
  },

  async listarSiteAdmin(req: Request, res: Response): Promise<void> {
    res.json(await avaliacaoService.listarSiteAdmin(req.query))
  },

  async mudarStatusProduto(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.json(await avaliacaoService.mudarStatusProduto(idParam(req.params.id), req.body))
  },

  async mudarStatusSite(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.json(await avaliacaoService.mudarStatusSite(idParam(req.params.id), req.body))
  },

  async apagarProduto(req: Request<{ id: string }>, res: Response): Promise<void> {
    await avaliacaoService.apagarProduto(idParam(req.params.id))
    res.status(204).end()
  },

  async apagarSite(req: Request<{ id: string }>, res: Response): Promise<void> {
    await avaliacaoService.apagarSite(idParam(req.params.id))
    res.status(204).end()
  },
}
