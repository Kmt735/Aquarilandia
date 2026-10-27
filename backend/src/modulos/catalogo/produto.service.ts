import { AppError } from '../../utils/AppError.js'
import { comTransacao } from '../../utils/transacao.js'
import { ehTipoFicha } from './ficha.definicoes.js'
import { fichaRepository } from './ficha.repository.js'
import { produtoRepository } from './produto.repository.js'
import { lerAtualizacaoProduto, validarProdutoAtualizado } from './produto.atualizacao.js'
import { validarNovoProduto } from './produto.validacao.js'
import type { DetalheProduto, FiltrosProdutos, ListaProdutos } from './produto.types.js'

function tratarConflito(err: unknown): never {
  if (typeof err === 'object' && err !== null && 'code' in err && 'constraint' in err) {
    if (err.code === '23505' && err.constraint === 'peixes_nome_cientifico_key') {
      throw new AppError('Peixe já cadastrado', 409, { 'ficha.dados.nomeCientifico': 'Já existe um peixe com esse nome científico.' })
    }
    if (err.code === '23503' && err.constraint === 'produtos_categoria_id_fkey') {
      throw new AppError('Dados inválidos', 400, { categoriaId: 'Categoria não encontrada.' })
    }
  }
  throw err
}

export const produtoService = {
  async atualizar(id: number, body: unknown): Promise<DetalheProduto> {
    const edicao = lerAtualizacaoProduto(body)
    try {
      return await comTransacao(async (client) => {
        const bloqueado = await produtoRepository.bloquearParaEdicao(id, client)
        if (!bloqueado) throw new AppError('Produto não encontrado', 404)
        await produtoRepository.buscarCategoriaParaCadastro(bloqueado.categoriaId, client)
        // Nova leitura após adquirir o lock vê o commit da edição que estava concorrendo.
        const atual = await produtoRepository.buscarPorId(id, client)
        if (!atual) throw new AppError('Produto não encontrado', 404)
        const dados = validarProdutoAtualizado(atual, edicao)
        await produtoRepository.atualizar(id, dados, Object.keys(edicao), client)
        if (edicao.ficha && dados.ficha) {
          if (atual.ficha) await fichaRepository.atualizar(id, dados.ficha, Object.keys(edicao.ficha.dados), client)
          else await fichaRepository.inserir(id, dados.ficha, client)
        }
        const atualizado = await produtoRepository.buscarPorId(id, client)
        if (!atualizado) throw new Error('Produto editado não encontrado na própria transação.')
        return atualizado
      })
    } catch (err) {
      tratarConflito(err)
    }
  },

  async criar(body: unknown): Promise<DetalheProduto> {
    const dados = validarNovoProduto(body)
    try {
      return await comTransacao(async (client) => {
        const categoria = await produtoRepository.buscarCategoriaParaCadastro(dados.categoriaId, client)
        if (!categoria) throw new AppError('Dados inválidos', 400, { categoriaId: 'Categoria não encontrada.' })
        if (ehTipoFicha(categoria.slug)) {
          if (dados.ficha?.tipo !== categoria.slug) {
            throw new AppError('Dados inválidos', 400, { ficha: `Informe uma ficha do tipo ${categoria.slug}.` })
          }
        } else if (dados.ficha !== null) {
          throw new AppError('Dados inválidos', 400, { ficha: 'Esta categoria não possui ficha especializada.' })
        }
        const id = await produtoRepository.inserir(dados, client)
        if (dados.ficha) await fichaRepository.inserir(id, dados.ficha, client)
        const produto = await produtoRepository.buscarPorId(id, client)
        if (!produto) throw new Error('Produto criado não encontrado na própria transação.')
        return produto
      })
    } catch (err) {
      tratarConflito(err)
    }
  },

  async listar(filtros: FiltrosProdutos): Promise<ListaProdutos> {
    return produtoRepository.listar(filtros)
  },

  async buscarPorId(id: number): Promise<DetalheProduto> {
    const produto = await produtoRepository.buscarPorId(id)
    if (!produto) throw new AppError('Produto não encontrado', 404)
    return produto
  },
}
