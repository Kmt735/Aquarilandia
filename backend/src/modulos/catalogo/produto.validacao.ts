import { AppError } from '../../utils/AppError.js'
import { definicoesFicha, ehTipoFicha } from './ficha.definicoes.js'
import type { CampoFicha } from './ficha.definicoes.js'
import type { FichaTecnica } from './ficha.types.js'
import type { NovoProduto } from './produto.types.js'

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function validarNovoProduto(body: unknown): NovoProduto {
  const erros: Record<string, string> = Object.create(null)
  if (!ehObjeto(body)) throw new AppError('Dados inválidos', 400, { body: 'Envie um objeto de produto.' })
  function camposPermitidos(dados: Record<string, unknown>, campos: string[], prefixo = ''): void {
    for (const campo of Object.keys(dados)) {
      if (!campos.includes(campo)) erros[`${prefixo}${campo}`] = 'Campo não permitido.'
    }
  }
  function texto(valor: unknown, campo: string, maximo?: number, opcional = false): string | null {
    if (opcional && (valor === undefined || valor === null)) return null
    if (typeof valor !== 'string' || !valor.trim() || valor.includes('\u0000')
      || (maximo !== undefined && [...valor.trim()].length > maximo)) {
      erros[campo] = maximo ? `Informe um texto de 1 a ${maximo} caracteres.` : 'Informe um texto não vazio, sem caractere nulo.'
      return null
    }
    return valor.trim()
  }
  function numero(valor: unknown, campo: string, minimo: number, maximo: number, casas: number): number {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < minimo || valor > maximo
      || Number(valor.toFixed(casas)) !== valor) {
      erros[campo] = `Informe um número entre ${minimo} e ${maximo}, com até ${casas} casas decimais.`
      return minimo
    }
    return valor
  }
  function validarCampo(valor: unknown, campo: string, regra: CampoFicha): string | number | boolean | null {
    if (valor === undefined && 'padrao' in regra) return regra.padrao!
    if (regra.opcional && (valor === undefined || valor === null)) return null
    switch (regra.tipo) {
      case 'texto': return texto(valor, campo, regra.maximo)
      case 'numero': return numero(valor, campo, regra.minimo, regra.maximo, regra.casas)
      case 'booleano':
        if (typeof valor === 'boolean') return valor
        erros[campo] = 'Informe um booleano true ou false.'
        return false
      case 'enum':
        if (typeof valor === 'string' && regra.valores.includes(valor)) return valor
        erros[campo] = `Escolha ${regra.valores.join(', ')}.`
        return null
    }
  }

  camposPermitidos(body, ['categoriaId', 'nome', 'descricao', 'marca', 'preco', 'estoque', 'ficha'])
  const categoriaId = numero(body.categoriaId, 'categoriaId', 1, 2147483647, 0)
  const nome = texto(body.nome, 'nome', 150)
  const descricao = texto(body.descricao, 'descricao', undefined, true)
  const marca = texto(body.marca, 'marca', 80, true)
  const preco = numero(body.preco, 'preco', 0, 2147483647, 0)
  if (Object.hasOwn(body, 'estoque') && body.estoque !== 0) {
    erros.estoque = 'O estoque inicial deve ser zero. Entradas futuras exigem uma movimentação rastreável.'
  }

  let ficha: FichaTecnica | null = null
  if (body.ficha !== undefined && body.ficha !== null) {
    if (!ehObjeto(body.ficha)) {
      erros.ficha = 'Envie uma ficha no formato { tipo, dados }.'
    } else {
      camposPermitidos(body.ficha, ['tipo', 'dados'], 'ficha.')
      if (typeof body.ficha.tipo !== 'string' || !ehTipoFicha(body.ficha.tipo)) {
        erros['ficha.tipo'] = 'Informe um tipo de ficha especializado existente.'
      } else if (!ehObjeto(body.ficha.dados)) {
        erros['ficha.dados'] = 'Envie um objeto com os campos da ficha.'
      } else {
        const tipo = body.ficha.tipo
        const definicoes: Record<string, CampoFicha> = definicoesFicha[tipo]
        const dados: Record<string, string | number | boolean | null> = {}
        camposPermitidos(body.ficha.dados, Object.keys(definicoes), 'ficha.dados.')
        for (const [campo, regra] of Object.entries(definicoes)) {
          dados[campo] = validarCampo(body.ficha.dados[campo], `ficha.dados.${campo}`, regra)
        }
        for (const [minimo, maximo] of [['tempMinC', 'tempMaxC'], ['phMin', 'phMax'], ['aquarioMinLitros', 'aquarioMaxLitros']]) {
          if (typeof dados[minimo] === 'number' && typeof dados[maximo] === 'number' && dados[maximo] < dados[minimo]) {
            erros[`ficha.dados.${maximo}`] = 'O limite máximo deve ser maior ou igual ao mínimo.'
          }
        }
        // O discriminador e todos os campos foram validados pela definição fechada acima.
        ficha = { tipo, dados } as unknown as FichaTecnica
      }
    }
  }
  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 400, erros)
  return { categoriaId, nome: nome!, descricao, marca, preco, ficha }
}
