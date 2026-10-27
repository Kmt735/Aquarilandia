import { AppError } from '../../utils/AppError.js'
import { ehTipoFicha } from './ficha.definicoes.js'
import type { AtualizacaoProduto, DetalheProduto, NovoProduto } from './produto.types.js'
import { validarNovoProduto } from './produto.validacao.js'

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function lerAtualizacaoProduto(body: unknown): AtualizacaoProduto {
  if (!ehObjeto(body)) throw new AppError('Dados inválidos', 400, { body: 'Envie um objeto de atualização.' })
  const erros: Record<string, string> = Object.create(null)
  const permitidos = ['nome', 'descricao', 'marca', 'preco', 'ficha']
  for (const campo of Object.keys(body)) {
    if (!permitidos.includes(campo)) erros[campo] = 'Campo não permitido nesta edição.'
  }
  if (!Object.keys(body).length) erros.body = 'Informe pelo menos um campo para editar.'
  if (Object.hasOwn(body, 'ficha')) {
    if (!ehObjeto(body.ficha)) {
      erros.ficha = 'Envie { dados: { ... } }; a ficha não pode ser removida.'
    } else {
      for (const campo of Object.keys(body.ficha)) {
        if (campo !== 'dados') erros[`ficha.${campo}`] = 'Campo não permitido; o tipo da ficha é fixo.'
      }
      if (!ehObjeto(body.ficha.dados) || !Object.keys(body.ficha.dados).length) {
        erros['ficha.dados'] = 'Informe pelo menos um campo da ficha para editar.'
      }
    }
  }
  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 400, erros)
  return body as AtualizacaoProduto
}

export function validarProdutoAtualizado(atual: DetalheProduto, edicao: AtualizacaoProduto): NovoProduto {
  let ficha: unknown = atual.ficha
  if (edicao.ficha) {
    if (!ehTipoFicha(atual.categoria)) {
      throw new AppError('Dados inválidos', 400, { ficha: 'Esta categoria não possui ficha especializada.' })
    }
    ficha = { tipo: atual.categoria, dados: { ...atual.ficha?.dados, ...edicao.ficha.dados } }
  }
  if (ehTipoFicha(atual.categoria) && ficha === null) {
    throw new AppError('Dados inválidos', 400, { ficha: 'Este produto está sem ficha. Informe todos os campos obrigatórios da categoria.' })
  }
  // O estado foi lido após o lock. Omitidos não recebem defaults de uma edição antiga.
  return validarNovoProduto({
    categoriaId: atual.categoriaId,
    nome: Object.hasOwn(edicao, 'nome') ? edicao.nome : atual.nome,
    descricao: Object.hasOwn(edicao, 'descricao') ? edicao.descricao : atual.descricao,
    marca: Object.hasOwn(edicao, 'marca') ? edicao.marca : atual.marca,
    preco: Object.hasOwn(edicao, 'preco') ? edicao.preco : atual.preco,
    ficha,
  })
}
