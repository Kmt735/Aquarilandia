import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError.js'
import { lerIdCatalogo } from './catalogo.parametros.js'
import { peixeService } from './peixe.service.js'
import type { FiltrosPeixes } from './peixe.types.js'

function lerFiltros(query: Request['query']): FiltrosPeixes {
  const erros: Record<string, string> = Object.create(null)
  const permitidos = new Set([
    'pagina', 'limite', 'temperatura', 'ph', 'tamanho_max', 'aquario_litros',
    'dificuldade', 'temperamento', 'tipo_agua', 'busca',
  ])
  for (const campo of Object.keys(query)) {
    if (!permitidos.has(campo)) erros[campo] = 'Parâmetro não permitido nesta consulta.'
  }

  function inteiro(campo: string, maximo: number): number | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    const numero = typeof valor === 'string' ? Number(valor) : NaN
    if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)
      || !Number.isSafeInteger(numero) || numero > maximo) {
      erros[campo] = `Informe um número inteiro entre 1 e ${maximo}.`
      return undefined
    }
    return numero
  }

  function decimal(campo: string, minimo: number, maximo: number, minimoInclusivo = true): number | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    const numero = typeof valor === 'string' ? Number(valor) : NaN
    if (typeof valor !== 'string' || !/^-?(0|[1-9]\d*)(\.\d+)?$/.test(valor) || !Number.isFinite(numero)
      || numero < minimo || numero > maximo || (!minimoInclusivo && numero === minimo)) {
      erros[campo] = `Informe um decimal ${minimoInclusivo ? 'a partir de' : 'maior que'} ${minimo} e até ${maximo}.`
      return undefined
    }
    return numero
  }

  function opcao<T extends string>(campo: string, valores: readonly T[]): T | undefined {
    const valor = query[campo]
    if (valor === undefined) return undefined
    const encontrada = valores.find((opcao) => opcao === valor)
    if (encontrada === undefined) erros[campo] = `Escolha ${valores.join(', ')}.`
    return encontrada
  }

  const pagina = inteiro('pagina', Number.MAX_SAFE_INTEGER) ?? 1
  const limite = inteiro('limite', 100) ?? 20
  if (!Number.isSafeInteger((pagina - 1) * limite)) erros.pagina = 'Página fora do intervalo permitido.'
  const temperatura = decimal('temperatura', -999.9, 999.9)
  const ph = decimal('ph', 0, 14)
  const tamanhoMax = decimal('tamanho_max', 0, 9999.9, false)
  const aquarioLitros = inteiro('aquario_litros', 2147483647)
  const dificuldade = opcao('dificuldade', ['iniciante', 'intermediario', 'avancado'] as const)
  const temperamento = opcao('temperamento', ['pacifico', 'semi_agressivo', 'agressivo'] as const)
  const tipoAgua = opcao('tipo_agua', ['doce', 'salobra', 'marinho'] as const)
  const valorBusca = query.busca
  let busca: string | undefined
  if (valorBusca !== undefined) {
    if (typeof valorBusca !== 'string' || !valorBusca.trim() || valorBusca.trim().length > 150) {
      erros.busca = 'Informe um texto de 1 a 150 caracteres.'
    } else {
      busca = valorBusca.trim()
    }
  }

  if (Object.keys(erros).length) throw new AppError('Parâmetros inválidos', 400, erros)
  return { pagina, limite, temperatura, ph, tamanhoMax, aquarioLitros, dificuldade, temperamento, tipoAgua, busca }
}

export const peixeController = {
  async listar(req: Request, res: Response): Promise<void> {
    res.json(await peixeService.listar(lerFiltros(req.query)))
  },

  async buscarPorId(req: Request<{ id: string }>, res: Response): Promise<void> {
    res.json(await peixeService.buscarPorId(lerIdCatalogo(req.params.id)))
  },
}
