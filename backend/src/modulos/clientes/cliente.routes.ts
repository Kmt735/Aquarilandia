import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { autenticar } from '../../middlewares/autenticar.js'
import { exigirAdmin } from '../../middlewares/exigirAdmin.js'
import { exigirOrigem } from '../../middlewares/exigirOrigem.js'
import { limiteTrocaSenha } from '../../middlewares/rateLimit.js'
import { clienteController } from './cliente.controller.js'
import { enderecoController } from './endereco.controller.js'

export const clienteRoutes = Router()

// D-47: o PATCH /me só pede a senha atual quando o body traz email, e só nesse caso passa pelo limiteTrocaSenha.
// As tentativas de senha atual somam com a troca de senha e com o apagar conta, no mesmo contador.
// PATCH só com nome ou telefone segue direto, sem gastar nem ser barrado pelo limite
async function limiteSeTrocarEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.body?.email === undefined) {
    next()
    return
  }
  await limiteTrocaSenha(req, res, next)
}

// Rotas /me ficam antes de qualquer /:id (api.md, seção 3).
// exigirOrigem vem antes do autenticar: recusa o pedido de outro site sem consultar a sessão no banco.
clienteRoutes.get('/me', autenticar, clienteController.buscarMeusDados)
clienteRoutes.patch('/me', exigirOrigem, autenticar, limiteSeTrocarEmail, clienteController.atualizarMeusDados)
clienteRoutes.patch('/me/senha', exigirOrigem, autenticar, limiteTrocaSenha, clienteController.trocarMinhaSenha)
// limiteTrocaSenha reaproveitado: as duas rotas pedem a senha atual, então o contador é compartilhado
// (5 tentativas erradas em 15 min, somando as duas), que é o comportamento desejado
clienteRoutes.delete('/me', exigirOrigem, autenticar, limiteTrocaSenha, clienteController.apagarMinhaConta)
clienteRoutes.get('/me/enderecos', autenticar, enderecoController.listarMeus)
clienteRoutes.post('/me/enderecos', exigirOrigem, autenticar, enderecoController.criar)
clienteRoutes.patch('/me/enderecos/:enderecoId', exigirOrigem, autenticar, enderecoController.atualizar)
clienteRoutes.delete('/me/enderecos/:enderecoId', exigirOrigem, autenticar, enderecoController.excluir)
// Compras do próprio cliente (#33): leitura, sem exigirOrigem (como o GET /me)
clienteRoutes.get('/me/vendas', autenticar, clienteController.listarMinhasVendas)

// Daqui para baixo, só admin; rota nova já nasce protegida (D-41).
// Por isso qualquer rota /me nova (ex.: /me/vendas) precisa ser registrada ACIMA desta linha.
clienteRoutes.use(autenticar, exigirAdmin)
clienteRoutes.get('/', clienteController.listarParaAdmin)
clienteRoutes.get('/:id', clienteController.buscarParaAdmin)
// Escritas de admin: exigirOrigem (CSRF) depois da guarda, como em orçamentos
clienteRoutes.patch('/:id', exigirOrigem, clienteController.definirAtivoPeloAdmin)
clienteRoutes.delete('/:id', exigirOrigem, clienteController.removerPeloAdmin)
// GET /:id/vendas (#37) fica para depois: depende da listagem de vendas (#33)
