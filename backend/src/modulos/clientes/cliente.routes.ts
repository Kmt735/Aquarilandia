import { Router } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limiteTrocaSenha } from '../../middlewares/rateLimit.js'
import { clienteController } from './cliente.controller.js'
import { enderecoController } from './endereco.controller.js'

export const clienteRoutes = Router()

// Rotas /me ficam antes de qualquer /:id (api.md, seção 3).
// exigirOrigem vem antes do autenticar: recusa o pedido de outro site sem consultar a sessão no banco.
clienteRoutes.get('/me', autenticar, clienteController.buscarMeusDados)
clienteRoutes.patch('/me', exigirOrigem, autenticar, clienteController.atualizarMeusDados)
clienteRoutes.patch('/me/senha', exigirOrigem, autenticar, limiteTrocaSenha, clienteController.trocarMinhaSenha)
clienteRoutes.get('/me/enderecos', autenticar, enderecoController.listarMeus)
clienteRoutes.post('/me/enderecos', exigirOrigem, autenticar, enderecoController.criar)
clienteRoutes.patch('/me/enderecos/:enderecoId', exigirOrigem, autenticar, enderecoController.atualizar)
clienteRoutes.delete('/me/enderecos/:enderecoId', exigirOrigem, autenticar, enderecoController.excluir)
