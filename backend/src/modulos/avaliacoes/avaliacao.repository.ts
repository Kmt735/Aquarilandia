import { db } from '../../config/db.js'
import type {
  AvaliacaoProduto, AvaliacaoProdutoAdmin, AvaliacaoSite, FiltrosAdmin, NovaAvaliacaoProduto, NovaAvaliacaoSite, StatusAvaliacao,
} from './avaliacao.types.js'

const colunasProduto = `a.id, a.produto_id AS "produtoId", a.nota, a.nome, a.comentario, a.status,
  a.criada_em AS "criadaEm", a.moderada_em AS "moderadaEm"`
const colunasSite = `id, nota, motivo, encontrou, comentario, origem, pagina, status,
  criada_em AS "criadaEm", moderada_em AS "moderadaEm"`

// Contagem por nota (1 a 5) e média, numa consulta só. A média vem com 2 casas (NUMERIC vira number no db.ts)
const sqlNotas = `count(*)::int AS total, COALESCE(round(avg(nota), 2), 0)::numeric AS media,
  count(*) FILTER (WHERE nota = 1)::int AS n1, count(*) FILTER (WHERE nota = 2)::int AS n2,
  count(*) FILTER (WHERE nota = 3)::int AS n3, count(*) FILTER (WHERE nota = 4)::int AS n4,
  count(*) FILTER (WHERE nota = 5)::int AS n5`

export interface LinhaNotas { total: number; media: number; n1: number; n2: number; n3: number; n4: number; n5: number }
export interface LinhaResumoAdmin { total: number; pendentes: number; aprovadas: number; ocultas: number; media: number }

// WHERE dos filtros do painel, sempre com parâmetros
function filtrar(filtro: FiltrosAdmin, prefixo = ''): { where: string; valores: unknown[] } {
  const valores: unknown[] = []
  const condicoes: string[] = []
  if (filtro.status) { valores.push(filtro.status); condicoes.push(`${prefixo}status = $${valores.length}`) }
  if (filtro.nota) { valores.push(filtro.nota); condicoes.push(`${prefixo}nota = $${valores.length}`) }
  return { where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '', valores }
}

// Resumo do painel de uma tabela: quantas em cada status e a média (sem as ocultas, que a loja descartou)
const sqlResumoAdmin = (tabela: 'avaliacoes_produto' | 'avaliacoes_site') => `SELECT count(*)::int AS total,
    count(*) FILTER (WHERE status = 'pendente')::int AS pendentes,
    count(*) FILTER (WHERE status = 'aprovada')::int AS aprovadas,
    count(*) FILTER (WHERE status = 'oculta')::int AS ocultas,
    COALESCE(round(avg(nota) FILTER (WHERE status <> 'oculta'), 2), 0)::numeric AS media
  FROM ${tabela}`

export const avaliacaoRepository = {
  // Só grava se o produto existe e está ativo (no catálogo). null: produto não encontrado
  async inserirProduto(produtoId: number, dados: NovaAvaliacaoProduto, status: StatusAvaliacao): Promise<AvaliacaoProduto | null> {
    const { rows } = await db.query<AvaliacaoProduto>(
      `WITH a AS (
         INSERT INTO avaliacoes_produto (produto_id, nota, nome, comentario, status)
         SELECT p.id, $2, $3, $4, $5 FROM produtos p WHERE p.id = $1 AND p.ativo
         RETURNING *
       ) SELECT ${colunasProduto} FROM a`,
      [produtoId, dados.nota, dados.nome, dados.comentario, status],
    )
    return rows[0] ?? null
  },

  async produtoAtivoExiste(produtoId: number): Promise<boolean> {
    const { rows } = await db.query('SELECT 1 FROM produtos WHERE id = $1 AND ativo', [produtoId])
    return rows.length > 0
  },

  async listarAprovadasDoProduto(produtoId: number, limite: number): Promise<AvaliacaoProduto[]> {
    const { rows } = await db.query<AvaliacaoProduto>(
      `SELECT ${colunasProduto} FROM avaliacoes_produto a
        WHERE a.produto_id = $1 AND a.status = 'aprovada'
        ORDER BY a.criada_em DESC, a.id DESC LIMIT $2`,
      [produtoId, limite],
    )
    return rows
  },

  async notasAprovadasDoProduto(produtoId: number): Promise<LinhaNotas> {
    const { rows } = await db.query<LinhaNotas>(
      `SELECT ${sqlNotas} FROM avaliacoes_produto WHERE produto_id = $1 AND status = 'aprovada'`, [produtoId])
    return rows[0]
  },

  async inserirSite(dados: NovaAvaliacaoSite, status: StatusAvaliacao): Promise<AvaliacaoSite> {
    const { rows } = await db.query<AvaliacaoSite>(
      `INSERT INTO avaliacoes_site (nota, motivo, encontrou, comentario, origem, pagina, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${colunasSite}`,
      [dados.nota, dados.motivo, dados.encontrou, dados.comentario, dados.origem, dados.pagina, status],
    )
    return rows[0]
  },

  // Página pública do site: notas e respostas das aprovadas
  async resumoSiteAprovadas(): Promise<LinhaNotas & { motivos: Record<string, number>; encontrou: Record<string, number> }> {
    const { rows } = await db.query<LinhaNotas & { motivos: Record<string, number> | null; encontrou: Record<string, number> | null }>(
      `SELECT ${sqlNotas},
         (SELECT jsonb_object_agg(motivo, qtd) FROM (SELECT motivo, count(*)::int AS qtd FROM avaliacoes_site
            WHERE status = 'aprovada' AND motivo IS NOT NULL GROUP BY motivo) m) AS motivos,
         (SELECT jsonb_object_agg(encontrou, qtd) FROM (SELECT encontrou, count(*)::int AS qtd FROM avaliacoes_site
            WHERE status = 'aprovada' AND encontrou IS NOT NULL GROUP BY encontrou) e) AS encontrou
       FROM avaliacoes_site WHERE status = 'aprovada'`,
    )
    const linha = rows[0]
    return { ...linha, motivos: linha.motivos ?? {}, encontrou: linha.encontrou ?? {} }
  },

  async comentariosSiteAprovados(limite: number): Promise<AvaliacaoSite[]> {
    const { rows } = await db.query<AvaliacaoSite>(
      `SELECT ${colunasSite} FROM avaliacoes_site WHERE status = 'aprovada' AND comentario IS NOT NULL
        ORDER BY criada_em DESC, id DESC LIMIT $1`, [limite])
    return rows
  },

  // ---------- painel ----------

  async listarProdutoAdmin(filtro: FiltrosAdmin): Promise<{ dados: AvaliacaoProdutoAdmin[]; total: number }> {
    const { where, valores } = filtrar(filtro, 'a.')
    const { rows: contagem } = await db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM avaliacoes_produto a ${where}`, valores)
    const { rows } = await db.query<AvaliacaoProdutoAdmin>(
      `SELECT ${colunasProduto}, p.nome AS "produtoNome", c.slug AS "produtoCategoria"
         FROM avaliacoes_produto a
         JOIN produtos p ON p.id = a.produto_id
         JOIN categorias c ON c.id = p.categoria_id
         ${where}
        ORDER BY a.criada_em DESC, a.id DESC
        LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, filtro.limite, filtro.offset],
    )
    return { dados: rows, total: contagem[0].total }
  },

  async listarSiteAdmin(filtro: FiltrosAdmin): Promise<{ dados: AvaliacaoSite[]; total: number }> {
    const { where, valores } = filtrar(filtro)
    const { rows: contagem } = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM avaliacoes_site ${where}`, valores)
    const { rows } = await db.query<AvaliacaoSite>(
      `SELECT ${colunasSite} FROM avaliacoes_site ${where}
        ORDER BY criada_em DESC, id DESC
        LIMIT $${valores.length + 1} OFFSET $${valores.length + 2}`,
      [...valores, filtro.limite, filtro.offset],
    )
    return { dados: rows, total: contagem[0].total }
  },

  async mudarStatusProduto(id: number, status: StatusAvaliacao): Promise<AvaliacaoProduto | null> {
    const { rows } = await db.query<AvaliacaoProduto>(
      `WITH a AS (UPDATE avaliacoes_produto SET status = $2, moderada_em = now() WHERE id = $1 RETURNING *)
       SELECT ${colunasProduto} FROM a`, [id, status])
    return rows[0] ?? null
  },

  async mudarStatusSite(id: number, status: StatusAvaliacao): Promise<AvaliacaoSite | null> {
    const { rows } = await db.query<AvaliacaoSite>(
      `UPDATE avaliacoes_site SET status = $2, moderada_em = now() WHERE id = $1 RETURNING ${colunasSite}`, [id, status])
    return rows[0] ?? null
  },

  async apagarProduto(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM avaliacoes_produto WHERE id = $1', [id])
    return (rowCount ?? 0) > 0
  },

  async apagarSite(id: number): Promise<boolean> {
    const { rowCount } = await db.query('DELETE FROM avaliacoes_site WHERE id = $1', [id])
    return (rowCount ?? 0) > 0
  },

  async resumoAdmin(): Promise<{ produtos: LinhaResumoAdmin; site: LinhaResumoAdmin }> {
    const [produtos, site] = await Promise.all([
      db.query<LinhaResumoAdmin>(sqlResumoAdmin('avaliacoes_produto')),
      db.query<LinhaResumoAdmin>(sqlResumoAdmin('avaliacoes_site')),
    ])
    return { produtos: produtos.rows[0], site: site.rows[0] }
  },
}
