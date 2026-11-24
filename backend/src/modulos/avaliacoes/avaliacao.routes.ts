import { Router } from 'express'
import type { RequestHandler } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limiteAvaliacao } from '../../middlewares/rateLimit.js'
import { avaliacaoController } from './avaliacao.controller.js'

// Montado em /api (routes/index.ts), antes do catálogo.
//
// Público (sem login): enviar avaliação de produto/peixe ou do site, e ler as APROVADAS.
//   GET  /produtos/:id/avaliacoes    aprovadas do produto + resumo (média e distribuição)
//   POST /produtos/:id/avaliacoes    nova avaliação (nasce com o STATUS_INICIAL)
//   GET  /avaliacoes-site            resumo das avaliações do site aprovadas
//   POST /avaliacoes-site            nova avaliação do site
// Painel (autenticar + exigirAdmin), tudo em /avaliacoes:
//   GET    /avaliacoes/resumo                   contagens por status e médias
//   GET    /avaliacoes/produtos | /site         lista com filtros (status, nota, pagina, limite)
//   PATCH  /avaliacoes/produtos/:id | /site/:id { status: 'pendente' | 'aprovada' | 'oculta' }
//   DELETE /avaliacoes/produtos/:id | /site/:id
export const avaliacaoRoutes = Router()

// Escritas públicas: Origin conferido ANTES do limite, como no orçamento (pedido de outro site não gasta o limite)
avaliacaoRoutes.get('/produtos/:id/avaliacoes', avaliacaoController.listarDoProduto)
avaliacaoRoutes.post('/produtos/:id/avaliacoes', exigirOrigem, limiteAvaliacao, avaliacaoController.criarDoProduto)
avaliacaoRoutes.get('/avaliacoes-site', avaliacaoController.resumoDoSite)
avaliacaoRoutes.post('/avaliacoes-site', exigirOrigem, limiteAvaliacao, avaliacaoController.criarDoSite)

// R-06: nas escritas de admin o exigirOrigem vem antes da guarda; as leituras de admin seguem sem Origin
const origemNasEscritas: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }
  exigirOrigem(req, res, next)
}

// /avaliacoes e /avaliacoes/... (não pega /avaliacoes-site: o Express compara o caminho por segmento)
const painel = Router()
painel.use(origemNasEscritas, autenticar, exigirAdmin)
painel.get('/resumo', avaliacaoController.resumoAdmin)
painel.get('/produtos', avaliacaoController.listarProdutosAdmin)
painel.patch('/produtos/:id', avaliacaoController.mudarStatusProduto)
painel.delete('/produtos/:id', avaliacaoController.apagarProduto)
painel.get('/site', avaliacaoController.listarSiteAdmin)
painel.patch('/site/:id', avaliacaoController.mudarStatusSite)
painel.delete('/site/:id', avaliacaoController.apagarSite)
avaliacaoRoutes.use('/avaliacoes', painel)
