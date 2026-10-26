import { db } from '../../config/db.js'
import type { AtualizacaoCategoria, Categoria, ListaCategorias, NovaCategoria, PaginacaoCategorias } from './categoria.types.js'
import type { FichaTecnica } from './ficha.types.js'

const slugsComFicha: FichaTecnica['tipo'][] = [
  'peixes', 'aquarios', 'filtros', 'bombas', 'iluminacao', 'termostatos',
  'racoes', 'condicionadores', 'substratos', 'plantas', 'decoracoes',
]

export const categoriaRepository = {
  async listar({ pagina, limite }: PaginacaoCategorias): Promise<ListaCategorias> {
    // A página e o total usam o mesmo snapshot, inclusive quando a página está vazia.
    const { rows } = await db.query<ListaCategorias>(
      `SELECT
         COALESCE(
           (SELECT json_agg(pagina ORDER BY pagina.id)
              FROM (
                SELECT id, nome, slug
                  FROM categorias
                 ORDER BY id
                 LIMIT $1 OFFSET $2
              ) AS pagina),
           '[]'::json
         ) AS itens,
         (SELECT COUNT(*)::integer FROM categorias) AS total`,
      [limite, (pagina - 1) * limite],
    )

    return rows[0]
  },

  async buscarPorId(id: number): Promise<Categoria | null> {
    const { rows } = await db.query<Categoria>('SELECT id, nome, slug FROM categorias WHERE id = $1', [id])
    return rows[0] ?? null
  },

  async inserir({ nome, slug }: NovaCategoria): Promise<Categoria> {
    const { rows } = await db.query<Categoria>(
      'INSERT INTO categorias (nome, slug) VALUES ($1, $2) RETURNING id, nome, slug',
      [nome, slug],
    )
    return rows[0]
  },

  async atualizar(id: number, dados: AtualizacaoCategoria): Promise<Categoria | null> {
    // Os slugs estruturais são discriminadores de ficha; a proteção é atômica com a edição.
    const { rows } = await db.query<Categoria>(
      `UPDATE categorias SET nome = COALESCE($2::text, nome), slug = COALESCE($3::text, slug)
        WHERE id = $1 AND ($3::text IS NULL OR slug = $3 OR slug <> ALL($4::text[]))
        RETURNING id, nome, slug`,
      [id, dados.nome ?? null, dados.slug ?? null, slugsComFicha],
    )
    return rows[0] ?? null
  },

  async excluir(id: number): Promise<boolean> {
    // A FK inclui produtos inativos e resolve a corrida com inserções concorrentes.
    const { rows } = await db.query<{ id: number }>('DELETE FROM categorias WHERE id = $1 RETURNING id', [id])
    return rows.length > 0
  },
}
