import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError.js'
import { lerIdCatalogo } from './catalogo.parametros.js'
import { produtoService } from './produto.service.js'
import type { FiltrosProdutos, OrdemProdutos } from './produto.types.js'

function lerFiltros(query: Request['query']): FiltrosProdutos {
  const erros: Record<string, string> = Object.create(null)
  const permitidos = new Set([
    'pagina', 'limite', 'categoria', 'busca', 'preco_min', 'preco_max', 'ordem', 'incluir_inativos',
    'tipo_agua', 'volume_min', 'volume_max', 'vazao_min', 'indicado_plantado', 'precisa_co2', 'iluminacao',
  ])

  for (const campo of Object.keys(query)) {
    if (!permitidos.has(campo)) erros[campo] = 'Parâmetro não permitido nesta consulta.'
  }

  function inteiro(campo: string, minimo: number, maximo: number): number | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    const numero = typeof valor === 'string' ? Number(valor) : NaN
    if (typeof valor !== 'string' || !/^(0|[1-9]\d*)$/.test(valor)
      || !Number.isSafeInteger(numero) || numero < minimo || numero > maximo) {
      erros[campo] = `Informe um número inteiro entre ${minimo} e ${maximo}.`
      return undefined
    }
    return numero
  }

  function texto(campo: string, maximo: number): string | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) {
      erros[campo] = `Informe um texto de 1 a ${maximo} caracteres.`
      return undefined
    }
    return valor.trim()
  }

  function booleano(campo: string): boolean | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    if (valor === 'true') return true
    if (valor === 'false') return false
    erros[campo] = 'Informe true ou false.'
    return undefined
  }

  function opcao<T extends string>(campo: string, valores: readonly T[]): T | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    const encontrada = valores.find((opcao) => opcao === valor)
    if (encontrada === undefined) erros[campo] = `Escolha ${valores.join(', ')}.`
    return encontrada
  }

  const pagina = inteiro('pagina', 1, Number.MAX_SAFE_INTEGER) ?? 1
  const limite = inteiro('limite', 1, 100) ?? 20
  if (!Number.isSafeInteger((pagina - 1) * limite)) erros.pagina = 'Página fora do intervalo permitido.'

  const categoria = texto('categoria', 80)
  if (categoria !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(categoria)) {
    erros.categoria = 'Informe o slug da categoria, em minúsculas e separado por hífens.'
  }
  const busca = texto('busca', 150)
  const precoMin = inteiro('preco_min', 0, 2147483647)
  const precoMax = inteiro('preco_max', 0, 2147483647)
  if (precoMin !== undefined && precoMax !== undefined && precoMin > precoMax) {
    erros.preco_max = 'O preço máximo deve ser maior ou igual ao preço mínimo.'
  }

  const tipoAgua = opcao('tipo_agua', ['doce', 'salobra', 'marinho'] as const)
  const volumeMin = inteiro('volume_min', 1, 2147483647)
  const volumeMax = inteiro('volume_max', 1, 2147483647)
  if (volumeMin !== undefined && volumeMax !== undefined && volumeMin > volumeMax) {
    erros.volume_max = 'O volume máximo deve ser maior ou igual ao volume mínimo.'
  }
  const vazaoMin = inteiro('vazao_min', 1, 2147483647)
  const indicadoPlantado = booleano('indicado_plantado')
  const precisaCo2 = booleano('precisa_co2')
  const iluminacao = opcao('iluminacao', ['baixa', 'media', 'alta'] as const)

  let ordem: OrdemProdutos = 'nome'
  if (query.ordem === 'preco' || query.ordem === '-preco' || query.ordem === 'nome') {
    ordem = query.ordem
  } else if (query.ordem !== undefined) {
    erros.ordem = 'Escolha nome, preco ou -preco.'
  }

  if (query.incluir_inativos === 'true') {
    erros.incluir_inativos = 'A consulta de produtos inativos não está disponível nesta rota pública.'
  } else if (query.incluir_inativos !== undefined && query.incluir_inativos !== 'false') {
    erros.incluir_inativos = 'Informe false; a consulta administrativa de inativos ainda não está disponível.'
  }

  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return {
    pagina, limite, ordem, categoria, busca, precoMin, precoMax,
    tipoAgua, volumeMin, volumeMax, vazaoMin, indicadoPlantado, precisaCo2, iluminacao,
  }
}

export const produtoController = {
  async remover(req: Request<{ id: string }>, res: Response): Promise<void> {
    await produtoService.remover(lerIdCatalogo(req.params.id))
    res.status(204).end()
  },

  async atualizar(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.json(await produtoService.atualizar(lerIdCatalogo(req.params.id), req.body))
  },

  async criar(req: Request, res: Response): Promise<void> {
    res.status(201).json(await produtoService.criar(req.body))
  },

  async listar(req: Request, res: Response): Promise<void> {
    res.json(await produtoService.listar(lerFiltros(req.query)))
  },

  async buscarPorId(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.json(await produtoService.buscarPorId(lerIdCatalogo(req.params.id)))
  },
}
