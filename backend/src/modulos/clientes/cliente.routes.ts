import { Router } from 'express'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
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
// Compras do próprio cliente (#33, #34): leitura, sem exigirOrigem (como o GET /me)
clienteRoutes.get('/me/vendas', autenticar, clienteController.listarMinhasVendas)
clienteRoutes.get('/me/vendas/:id', autenticar, clienteController.buscarMinhaVenda)

// R-06 (Lote 14a): nas escritas de admin o exigirOrigem vem ANTES da guarda, como em toda escrita da API: um pedido de
// outro site é recusado sem nem consultar a sessão no banco. As leituras de admin continuam sem Origin
const origemNasEscritas: RequestHandler = (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next()
    return
  }
  exigirOrigem(req, res, next)
}

// Daqui para baixo, só admin; rota nova já nasce protegida (D-41), e escrita nova já nasce com o exigirOrigem.
// Por isso qualquer rota /me nova (ex.: /me/vendas) precisa ser registrada ACIMA desta linha.
clienteRoutes.use(origemNasEscritas, autenticar, exigirAdmin)
clienteRoutes.get('/', clienteController.listarParaAdmin)
clienteRoutes.get('/:id', clienteController.buscarParaAdmin)
clienteRoutes.get('/:id/vendas', clienteController.listarVendasDoCliente)
// Escritas de admin: o exigirOrigem (CSRF) já rodou na guarda acima (origemNasEscritas)
clienteRoutes.patch('/:id', clienteController.definirAtivoPeloAdmin)
clienteRoutes.delete('/:id', clienteController.removerPeloAdmin)
