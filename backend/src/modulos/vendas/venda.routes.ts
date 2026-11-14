import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limitePagamento } from '../../middlewares/rateLimit.js'
import { vendaController } from './venda.controller.js'

export const vendaRoutes = Router()

// exigirOrigem antes do autenticar: recusa o pedido de outro site sem consultar a sessão no banco
vendaRoutes.post('/', exigirOrigem, autenticar, vendaController.criar)
// #44: gera o Pix da compra (o controller chama o pagamentoService). O limite vem depois do login, então pedido sem
// Origin ou sem sessão não gasta a cota
vendaRoutes.post('/:id/pagamentos', exigirOrigem, autenticar, limitePagamento, vendaController.gerarPix)
// #35: cliente (só a própria venda) e admin (qualquer uma). Fica ACIMA de qualquer guarda de admin
vendaRoutes.post('/:id/cancelar', exigirOrigem, autenticar, vendaController.cancelar)

// Daqui para baixo, só admin; rota nova já nasce protegida (D-41, o mesmo padrão do clienteRoutes).
// Por isso qualquer rota nova de CLIENTE em /api/vendas precisa ser registrada ACIMA desta linha.
vendaRoutes.use(autenticar, exigirAdmin)
vendaRoutes.get('/', vendaController.listarParaAdmin)
vendaRoutes.get('/:id', vendaController.buscarParaAdmin)
vendaRoutes.get('/:id/historico', vendaController.listarHistoricoParaAdmin)
