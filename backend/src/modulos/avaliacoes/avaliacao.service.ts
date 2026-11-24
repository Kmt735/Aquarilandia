import { AppError } from '../../utils/AppError.js'
import { paginacao } from '../../utils/validacao.js'
import { ENCONTROU, LIMITE_COMENTARIOS_SITE, LIMITE_LISTA_PUBLICA, MOTIVOS, STATUS_INICIAL } from './avaliacao.config.js'
import { avaliacaoRepository, type LinhaNotas } from './avaliacao.repository.js'
import type { AvaliacaoProduto, AvaliacaoProdutoAdmin, AvaliacaoSite, Resumo, StatusAvaliacao } from './avaliacao.types.js'
import { lerFiltros, validarAvaliacaoProduto, validarAvaliacaoSite, validarStatus } from './avaliacao.validacao.js'

const msgProdutoNaoEncontrado = 'Produto não encontrado.'
const msgAvaliacaoNaoEncontrada = 'Avaliação não encontrada.'

function resumo(l: LinhaNotas): Resumo {
  return {
    total: l.total,
    media: l.media,
    distribuicao: [5, 4, 3, 2, 1].map((nota) => ({ nota, qtd: l[`n${nota}` as keyof LinhaNotas] })),
  }
}

// O que o site mostra de uma avaliação de produto: sem status nem datas de moderação
function publicaProduto({ id, nota, nome, comentario, criadaEm }: AvaliacaoProduto) {
  return { id, nota, nome, comentario, criadaEm }
}

// Resposta de quem acabou de enviar: inclui o status, para a tela dizer se já foi publicada ou espera a loja
function enviadaProduto(a: AvaliacaoProduto) {
  return { ...publicaProduto(a), status: a.status }
}

function enviadaSite({ id, nota, criadaEm, status }: AvaliacaoSite) {
  return { id, nota, criadaEm, status }
}

function adminProduto(a: AvaliacaoProdutoAdmin) {
  const { id, produtoId, produtoNome, produtoCategoria, nota, nome, comentario, status, criadaEm, moderadaEm } = a
  return { id, produtoId, produtoNome, produtoCategoria, nota, nome, comentario, status, criadaEm, moderadaEm }
}

function adminSite(a: AvaliacaoSite) {
  const { id, nota, motivo, encontrou, comentario, origem, pagina, status, criadaEm, moderadaEm } = a
  return { id, nota, motivo, encontrou, comentario, origem, pagina, status, criadaEm, moderadaEm }
}

function consulta(query: unknown): Record<string, unknown> {
  return (typeof query === 'object' && query !== null ? query : {}) as Record<string, unknown>
}

export const avaliacaoService = {
  // ---------- público ----------

  async criarDoProduto(produtoId: number, body: unknown) {
    const dados = validarAvaliacaoProduto(body)
    const criada = await avaliacaoRepository.inserirProduto(produtoId, dados, STATUS_INICIAL)
    if (!criada) throw new AppError(msgProdutoNaoEncontrado, 404)
    return enviadaProduto(criada)
  },

  async listarDoProduto(produtoId: number) {
    if (!(await avaliacaoRepository.produtoAtivoExiste(produtoId))) throw new AppError(msgProdutoNaoEncontrado, 404)
    const [itens, notas] = await Promise.all([
      avaliacaoRepository.listarAprovadasDoProduto(produtoId, LIMITE_LISTA_PUBLICA),
      avaliacaoRepository.notasAprovadasDoProduto(produtoId),
    ])
    return { itens: itens.map(publicaProduto), resumo: resumo(notas) }
  },

  async criarDoSite(body: unknown) {
    return enviadaSite(await avaliacaoRepository.inserirSite(validarAvaliacaoSite(body), STATUS_INICIAL))
  },

  // Só as aprovadas: média, distribuição, as outras perguntas e os comentários mais recentes
  async resumoDoSite() {
    const [linha, comentarios] = await Promise.all([
      avaliacaoRepository.resumoSiteAprovadas(),
      avaliacaoRepository.comentariosSiteAprovados(LIMITE_COMENTARIOS_SITE),
    ])
    return {
      ...resumo(linha),
      motivos: MOTIVOS.map((valor) => ({ valor, qtd: linha.motivos[valor] ?? 0 })),
      encontrou: ENCONTROU.map((valor) => ({ valor, qtd: linha.encontrou[valor] ?? 0 })),
      comentarios: comentarios.map(({ id, nota, motivo, encontrou, comentario, origem, criadaEm }) => (
        { id, nota, motivo, encontrou, comentario, origem, criadaEm })),
    }
  },

  // ---------- painel (admin) ----------

  async resumoAdmin() {
    const { produtos, site } = await avaliacaoRepository.resumoAdmin()
    return { produtos, site, pendentes: produtos.pendentes + site.pendentes }
  },

  async listarProdutosAdmin(query: unknown) {
    const parametros = consulta(query)
    const { pagina, limite } = paginacao(parametros)
    const filtros = lerFiltros(parametros)
    const { dados, total } = await avaliacaoRepository.listarProdutoAdmin({ ...filtros, limite, offset: (pagina - 1) * limite })
    return { dados: dados.map(adminProduto), total, pagina, limite }
  },

  async listarSiteAdmin(query: unknown) {
    const parametros = consulta(query)
    const { pagina, limite } = paginacao(parametros)
    const filtros = lerFiltros(parametros)
    const { dados, total } = await avaliacaoRepository.listarSiteAdmin({ ...filtros, limite, offset: (pagina - 1) * limite })
    return { dados: dados.map(adminSite), total, pagina, limite }
  },

  async mudarStatusProduto(id: number, body: unknown) {
    const status: StatusAvaliacao = validarStatus(body)
    const a = await avaliacaoRepository.mudarStatusProduto(id, status)
    if (!a) throw new AppError(msgAvaliacaoNaoEncontrada, 404)
    return { id: a.id, status: a.status, moderadaEm: a.moderadaEm }
  },

  async mudarStatusSite(id: number, body: unknown) {
    const status: StatusAvaliacao = validarStatus(body)
    const a = await avaliacaoRepository.mudarStatusSite(id, status)
    if (!a) throw new AppError(msgAvaliacaoNaoEncontrada, 404)
    return { id: a.id, status: a.status, moderadaEm: a.moderadaEm }
  },

  async apagarProduto(id: number): Promise<void> {
    if (!(await avaliacaoRepository.apagarProduto(id))) throw new AppError(msgAvaliacaoNaoEncontrada, 404)
  },

  async apagarSite(id: number): Promise<void> {
    if (!(await avaliacaoRepository.apagarSite(id))) throw new AppError(msgAvaliacaoNaoEncontrada, 404)
  },
}
