import { Router } from 'express'
import { db } from '../config/db.js'
import { catalogoRoutes } from './catalogo.routes.js'
import { orcamentoRoutes } from '../modulos/orcamentos/orcamento.routes.js'
import { authRoutes } from '../modulos/auth/auth.routes.js'
import { clienteRoutes } from '../modulos/clientes/cliente.routes.js'
import { freteRoutes } from '../modulos/vendas/frete.routes.js'
import { vendaRoutes } from '../modulos/vendas/venda.routes.js'
import { pagamentoRoutes } from '../modulos/pagamentos/pagamento.routes.js'
import { estoqueRoutes } from '../modulos/estoque/estoque.routes.js'
import { imagemPublicaRoutes } from '../modulos/catalogo/imagem/imagem.controller.js'
import { avaliacaoRoutes } from '../modulos/avaliacoes/avaliacao.routes.js'

export const routes = Router()

// Contas, pedidos e pagamentos podem conter dados pessoais mesmo nas respostas de erro.
routes.use((req, res, next) => {
  if (/^\/(auth|clientes|vendas|pagamentos|orcamentos|estoque|avaliacoes)(\/|$)/.test(req.path)) {
    res.set('Cache-Control', 'no-store')
    res.vary('Cookie')
  }
  next()
})

routes.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1')
    res.json({ status: 'ok', banco: 'ok' })
  } catch {
    res.status(503).json({ status: 'erro', banco: 'indisponível' })
  }
})
// Antes do catálogo: /produtos/:id/avaliacoes é das avaliações
routes.use('/', avaliacaoRoutes)
routes.use('/', catalogoRoutes)
routes.use('/orcamentos', orcamentoRoutes)
routes.use('/auth', authRoutes)
routes.use('/clientes', clienteRoutes)
routes.use('/frete', freteRoutes)
routes.use('/vendas', vendaRoutes)
routes.use('/pagamentos', pagamentoRoutes)
routes.use('/estoque', estoqueRoutes)
routes.use('/midias/produtos', imagemPublicaRoutes)
