import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError.js'
import { lerIdCatalogo } from './catalogo.parametros.js'
import { categoriaService } from './categoria.service.js'
import type { PaginacaoCategorias } from './categoria.types.js'

function lerPaginacao(query: Request['query']): PaginacaoCategorias {
  const erros: Record<string, string> = Object.create(null)

  function inteiro(campo: string, padrao: number): number {
    const valor = query[campo]
    if (valor === undefined) return padrao
    if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(Number(valor))) {
      erros[campo] = 'Informe um número inteiro positivo.'
      return padrao
    }
    return Number(valor)
  }

  for (const campo of Object.keys(query)) {
    if (campo !== 'pagina' && campo !== 'limite') erros[campo] = 'Parâmetro não permitido nesta consulta.'
  }

  const pagina = inteiro('pagina', 1)
  const limite = inteiro('limite', 20)
  if (limite > 100) erros.limite = 'Informe um limite de até 100 itens.'
  if (!Number.isSafeInteger((pagina - 1) * limite)) erros.pagina = 'Página fora do intervalo permitido.'

  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { pagina, limite }
}

export const categoriaController = {
  async listar(req: Request, res: Response): Promise<void> {
    res.json(await categoriaService.listar(lerPaginacao(req.query)))
  },

  async buscarPorId(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.json(await categoriaService.buscarPorId(lerIdCatalogo(req.params.id)))
  },

  async criar(req: Request, res: Response): Promise<void> {
    res.status(201).json(await categoriaService.criar(req.body))
  },

  async atualizar(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.json(await categoriaService.atualizar(lerIdCatalogo(req.params.id), req.body))
  },

  async remover(req: Request<{ id: string }>, res: Response): Promise<void> {
    await categoriaService.remover(lerIdCatalogo(req.params.id))
    res.status(204).end()
  },
}
