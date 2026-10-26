import { AppError } from '../../utils/AppError.js'
import { categoriaRepository } from './categoria.repository.js'
import type { AtualizacaoCategoria, Categoria, ListaCategorias, PaginacaoCategorias } from './categoria.types.js'

function validarDados(body: unknown, parcial: boolean): AtualizacaoCategoria {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError('Dados inválidos', 400, { body: 'Envie um objeto com nome e slug.' })
  }
  const dados = body as Record<string, unknown>
  const erros: Record<string, string> = Object.create(null)
  const resultado: AtualizacaoCategoria = {}
  for (const campo of Object.keys(dados)) {
    if (campo !== 'nome' && campo !== 'slug') erros[campo] = 'Campo não permitido.'
  }
  if (!parcial || Object.hasOwn(dados, 'nome')) {
    if (typeof dados.nome !== 'string' || [...dados.nome.trim()].length < 2 || [...dados.nome.trim()].length > 80
      || /[\u0000-\u001f\u007f]/.test(dados.nome.trim())) {
      erros.nome = 'Informe um nome de 2 a 80 caracteres, sem caracteres de controle.'
    } else {
      resultado.nome = dados.nome.trim()
    }
  }
  if (!parcial || Object.hasOwn(dados, 'slug')) {
    if (typeof dados.slug !== 'string' || dados.slug.trim().length > 80
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dados.slug.trim())) {
      erros.slug = 'Informe um slug de 1 a 80 caracteres, em minúsculas e separado por hífens.'
    } else {
      resultado.slug = dados.slug.trim()
    }
  }
  if (parcial && !Object.hasOwn(dados, 'nome') && !Object.hasOwn(dados, 'slug')) {
    erros.body = 'Informe pelo menos nome ou slug para atualizar.'
  }
  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 400, erros)
  return resultado
}

function tratarConflito(err: unknown): never {
  if (typeof err === 'object' && err !== null && 'code' in err && 'constraint' in err) {
    if (err.code === '23505' && err.constraint === 'categorias_nome_key') {
      throw new AppError('Categoria já cadastrada', 409, { nome: 'Já existe uma categoria com esse nome.' })
    }
    if (err.code === '23505' && err.constraint === 'categorias_slug_key') {
      throw new AppError('Categoria já cadastrada', 409, { slug: 'Já existe uma categoria com esse slug.' })
    }
    if (err.code === '23503' && err.constraint === 'produtos_categoria_id_fkey') {
      throw new AppError('Categoria possui produtos vinculados e não pode ser excluída.', 409)
    }
  }
  throw err
}

export const categoriaService = {
  async listar(paginacao: PaginacaoCategorias): Promise<ListaCategorias> {
    return categoriaRepository.listar(paginacao)
  },

  async buscarPorId(id: number): Promise<Categoria> {
    const categoria = await categoriaRepository.buscarPorId(id)
    if (!categoria) throw new AppError('Categoria não encontrada', 404)
    return categoria
  },

  async criar(body: unknown): Promise<Categoria> {
    const dados = validarDados(body, false)
    // A validação completa acima exige ambos os campos no cadastro.
    if (dados.nome === undefined || dados.slug === undefined) throw new AppError('Dados inválidos', 400)
    try {
      return await categoriaRepository.inserir({ nome: dados.nome, slug: dados.slug })
    } catch (err) {
      tratarConflito(err)
    }
  },

  async atualizar(id: number, body: unknown): Promise<Categoria> {
    const dados = validarDados(body, true)
    try {
      const categoria = await categoriaRepository.atualizar(id, dados)
      if (!categoria) {
        if (!await categoriaRepository.buscarPorId(id)) throw new AppError('Categoria não encontrada', 404)
        throw new AppError('O slug desta categoria identifica uma ficha técnica e não pode ser alterado.', 409, {
          slug: 'Altere somente o nome; o slug estrutural deve ser preservado.',
        })
      }
      return categoria
    } catch (err) {
      tratarConflito(err)
    }
  },

  async remover(id: number): Promise<void> {
    try {
      if (!await categoriaRepository.excluir(id)) throw new AppError('Categoria não encontrada', 404)
    } catch (err) {
      tratarConflito(err)
    }
  },
}
