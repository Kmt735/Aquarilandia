import { db } from '../../config/db.js'
import { camposPublicosProduto, fichaPeixePublica } from './produto.projecoes.js'
import type { FiltrosPeixes, ListaPeixes, PeixePublico } from './peixe.types.js'

export const peixeRepository = {
  async listar(filtros: FiltrosPeixes): Promise<ListaPeixes> {
    const busca = filtros.busca === undefined ? null : `%${filtros.busca.replace(/[!%_]/g, '!$&')}%`
    const { rows } = await db.query<ListaPeixes>(
      `WITH filtrados AS (
         SELECT ${camposPublicosProduto}, ${fichaPeixePublica} AS ficha
           FROM produtos AS p
           JOIN categorias AS c ON c.id = p.categoria_id
           JOIN peixes AS f ON f.produto_id = p.id
          WHERE p.ativo AND c.slug = 'peixes'
            AND ($1::numeric IS NULL OR (f.temp_min_c <= $1 AND f.temp_max_c >= $1))
            AND ($2::numeric IS NULL OR (f.ph_min <= $2 AND f.ph_max >= $2))
            AND ($3::numeric IS NULL OR f.tamanho_adulto_cm <= $3)
            AND ($4::integer IS NULL OR f.aquario_min_litros <= $4)
            AND ($5::text IS NULL OR f.dificuldade = $5)
            AND ($6::text IS NULL OR f.temperamento = $6)
            AND ($7::text IS NULL OR f.tipo_agua = $7)
            AND ($8::text IS NULL OR p.nome ILIKE $8 ESCAPE '!' OR f.nome_cientifico ILIKE $8 ESCAPE '!')
       )
       SELECT COALESCE(
                (SELECT json_agg(pagina ORDER BY pagina.nome, pagina.id)
                   FROM (
                     SELECT id, "categoriaId", categoria, nome, descricao, marca, preco, "imagemUrl", "emEstoque", ficha
                       FROM filtrados ORDER BY nome, id LIMIT $9 OFFSET $10
                   ) AS pagina), '[]'::json
              ) AS itens,
              (SELECT COUNT(*)::integer FROM filtrados) AS total`,
      [filtros.temperatura ?? null, filtros.ph ?? null, filtros.tamanhoMax ?? null, filtros.aquarioLitros ?? null,
        filtros.dificuldade ?? null, filtros.temperamento ?? null, filtros.tipoAgua ?? null, busca,
        filtros.limite, (filtros.pagina - 1) * filtros.limite],
    )
    return rows[0]
  },

  async buscarPorId(id: number): Promise<PeixePublico | null> {
    const { rows } = await db.query<PeixePublico>(
      `SELECT ${camposPublicosProduto}, ${fichaPeixePublica} AS ficha
         FROM produtos AS p
         JOIN categorias AS c ON c.id = p.categoria_id
         JOIN peixes AS f ON f.produto_id = p.id
        WHERE p.id = $1 AND p.ativo AND c.slug = 'peixes'`,
      [id],
    )
    return rows[0] ?? null
  },
}
