import { db } from '../../config/db.js'
import type { Queryable } from '../../utils/transacao.js'
import type { Categoria } from './categoria.types.js'
import { camposPublicosProduto, fichaPeixePublica } from './produto.projecoes.js'
import type { DetalheProduto, FiltrosProdutos, ListaProdutos, NovoProduto, OrdemProdutos } from './produto.types.js'

const ordenacoes: Record<OrdemProdutos, string> = {
  nome: 'nome ASC, id ASC',
  preco: 'preco ASC, id ASC',
  '-preco': 'preco DESC, id ASC',
}

export const produtoRepository = {
  async bloquearParaEdicao(id: number, executor: Queryable = db): Promise<{ categoriaId: number } | null> {
    const { rows } = await executor.query<{ categoriaId: number }>(
      // A edição não muda chaves: este lock serializa PATCHs e permite as leituras de FK.
      'SELECT categoria_id AS "categoriaId" FROM produtos WHERE id = $1 AND ativo FOR NO KEY UPDATE', [id],
    )
    return rows[0] ?? null
  },

  async atualizar(id: number, dados: NovoProduto, campos: string[], executor: Queryable = db): Promise<void> {
    const colunas = { nome: 'nome', descricao: 'descricao', marca: 'marca', preco: 'preco' } as const
    const selecionados = (Object.keys(colunas) as (keyof typeof colunas)[]).filter((campo) => campos.includes(campo))
    // Mesmo numa edição só da ficha o produto recebe atualizado_em, mantendo o lock até COMMIT.
    const { rows } = await executor.query<{ id: number }>(
      `UPDATE produtos SET ${selecionados.map((campo, i) => `${colunas[campo]} = $${i + 2}, `).join('')}atualizado_em = now()
        WHERE id = $1 AND ativo RETURNING id`,
      [id, ...selecionados.map((campo) => dados[campo])],
    )
    if (!rows.length) throw new Error('Produto deixou de estar disponível durante a edição.')
  },

  async buscarCategoriaParaCadastro(id: number, executor: Queryable = db): Promise<Categoria | null> {
    // FOR SHARE mantém categoria/slug estáveis até produto e ficha estarem confirmados.
    const { rows } = await executor.query<Categoria>('SELECT id, nome, slug FROM categorias WHERE id = $1 FOR SHARE', [id])
    return rows[0] ?? null
  },

  async inserir(dados: NovoProduto, executor: Queryable = db): Promise<number> {
    const { rows } = await executor.query<{ id: number }>(
      `INSERT INTO produtos (categoria_id, nome, descricao, marca, preco, estoque)
       VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
      [dados.categoriaId, dados.nome, dados.descricao, dados.marca, dados.preco],
    )
    return rows[0].id
  },

  async listar(filtros: FiltrosProdutos): Promise<ListaProdutos> {
    // Somente fragmentos fixos entram na ordenação; todos os valores usam parâmetros.
    const ordem = ordenacoes[filtros.ordem]
    const busca = filtros.busca === undefined ? null : `%${filtros.busca.replace(/[!%_]/g, '!$&')}%`
    const { rows } = await db.query<ListaProdutos>(
      `WITH filtrados AS (
         SELECT ${camposPublicosProduto}
           FROM produtos AS p
           JOIN categorias AS c ON c.id = p.categoria_id
          WHERE p.ativo
            AND ($1::text IS NULL OR c.slug = $1)
            AND ($2::text IS NULL OR p.nome ILIKE $2 ESCAPE '!'
                 OR p.descricao ILIKE $2 ESCAPE '!' OR p.marca ILIKE $2 ESCAPE '!')
            AND ($3::integer IS NULL OR p.preco >= $3)
            AND ($4::integer IS NULL OR p.preco <= $4)
            AND ($7::text IS NULL
                 OR (c.slug = 'peixes' AND EXISTS (
                   SELECT 1 FROM peixes AS f WHERE f.produto_id = p.id AND f.tipo_agua = $7
                 ))
                 OR (c.slug = 'aquarios' AND $7 IN ('doce', 'marinho') AND EXISTS (
                   SELECT 1 FROM aquarios AS a WHERE a.produto_id = p.id AND a.tipo_agua IN ($7, 'ambos')
                 ))
                 OR (c.slug = 'racoes' AND $7 IN ('doce', 'marinho') AND EXISTS (
                   SELECT 1 FROM racoes AS r WHERE r.produto_id = p.id AND r.tipo_agua IN ($7, 'ambos')
                 ))
                 OR (c.slug = 'condicionadores' AND $7 IN ('doce', 'marinho') AND EXISTS (
                   SELECT 1 FROM condicionadores AS cnd
                    WHERE cnd.produto_id = p.id AND cnd.tipo_agua IN ($7, 'ambos')
                 ))
                 OR (c.slug = 'decoracoes' AND EXISTS (
                   SELECT 1 FROM decoracoes AS d WHERE d.produto_id = p.id
                     AND ($7 = 'doce' OR ($7 = 'marinho' AND d.seguro_marinho))
                 )))
            AND (($8::integer IS NULL AND $9::integer IS NULL)
                 OR (c.slug = 'aquarios' AND EXISTS (
                   SELECT 1 FROM aquarios AS a WHERE a.produto_id = p.id
                     AND ($8::integer IS NULL OR a.volume_litros >= $8)
                     AND ($9::integer IS NULL OR a.volume_litros <= $9)
                 )))
            AND ($10::integer IS NULL
                 OR (c.slug = 'filtros' AND EXISTS (
                   SELECT 1 FROM filtros AS f WHERE f.produto_id = p.id AND f.vazao_lh >= $10
                 ))
                 OR (c.slug = 'bombas' AND EXISTS (
                   SELECT 1 FROM bombas AS b WHERE b.produto_id = p.id AND b.vazao_lh >= $10
                 )))
            AND ($11::boolean IS NULL OR (c.slug = 'substratos' AND EXISTS (
                  SELECT 1 FROM substratos AS s WHERE s.produto_id = p.id AND (s.tipo = 'fertil') = $11
                )))
            AND (($12::boolean IS NULL AND $13::text IS NULL)
                 OR (c.slug = 'plantas' AND EXISTS (
                   SELECT 1 FROM plantas AS pl WHERE pl.produto_id = p.id
                     AND ($12::boolean IS NULL OR pl.precisa_co2 = $12)
                     AND ($13::text IS NULL OR pl.iluminacao_exigida = $13)
                 )))
       )
       SELECT COALESCE(
                (SELECT json_agg(pagina ORDER BY ${ordem})
                   FROM (
                     SELECT id, "categoriaId", categoria, nome, descricao, marca, preco, "imagemUrl", "emEstoque"
                       FROM filtrados
                      ORDER BY ${ordem}
                      LIMIT $5 OFFSET $6
                   ) AS pagina),
                '[]'::json
              ) AS itens,
              (SELECT COUNT(*)::integer FROM filtrados) AS total`,
      [filtros.categoria ?? null, busca, filtros.precoMin ?? null, filtros.precoMax ?? null,
        filtros.limite, (filtros.pagina - 1) * filtros.limite, filtros.tipoAgua ?? null,
        filtros.volumeMin ?? null, filtros.volumeMax ?? null, filtros.vazaoMin ?? null,
        filtros.indicadoPlantado ?? null, filtros.precisaCo2 ?? null, filtros.iluminacao ?? null],
    )

    return rows[0]
  },

  async buscarPorId(id: number, executor: Queryable = db): Promise<DetalheProduto | null> {
    // A categoria escolhe uma única ficha. Produto sem linha de detalhe retorna ficha null.
    const { rows } = await executor.query<DetalheProduto>(
      `SELECT ${camposPublicosProduto},
              CASE c.slug
                WHEN 'peixes' THEN (
                  SELECT ${fichaPeixePublica} FROM peixes AS f WHERE f.produto_id = p.id
                )
                WHEN 'aquarios' THEN (
                  SELECT json_build_object('tipo', 'aquarios', 'dados', ficha)
                    FROM (SELECT volume_litros AS "volumeLitros", comprimento_cm AS "comprimentoCm",
                                 largura_cm AS "larguraCm", altura_cm AS "alturaCm", material,
                                 tipo_agua AS "tipoAgua"
                            FROM aquarios WHERE produto_id = p.id) AS ficha
                )
                WHEN 'filtros' THEN (
                  SELECT json_build_object('tipo', 'filtros', 'dados', ficha)
                    FROM (SELECT tipo, vazao_lh AS "vazaoLh", aquario_max_litros AS "aquarioMaxLitros",
                                 potencia_w AS "potenciaW", voltagem, midias_inclusas AS "midiasInclusas"
                            FROM filtros WHERE produto_id = p.id) AS ficha
                )
                WHEN 'bombas' THEN (
                  SELECT json_build_object('tipo', 'bombas', 'dados', ficha)
                    FROM (SELECT tipo, vazao_lh AS "vazaoLh", altura_max_m AS "alturaMaxM", saidas,
                                 potencia_w AS "potenciaW", voltagem
                            FROM bombas WHERE produto_id = p.id) AS ficha
                )
                WHEN 'iluminacao' THEN (
                  SELECT json_build_object('tipo', 'iluminacao', 'dados', ficha)
                    FROM (SELECT tecnologia, potencia_w AS "potenciaW", comprimento_cm AS "comprimentoCm",
                                 espectro, temperatura_cor_k AS "temperaturaCorK", voltagem
                            FROM iluminacao WHERE produto_id = p.id) AS ficha
                )
                WHEN 'termostatos' THEN (
                  SELECT json_build_object('tipo', 'termostatos', 'dados', ficha)
                    FROM (SELECT potencia_w AS "potenciaW", aquario_min_litros AS "aquarioMinLitros",
                                 aquario_max_litros AS "aquarioMaxLitros", temp_min_c AS "tempMinC",
                                 temp_max_c AS "tempMaxC", ajustavel, voltagem
                            FROM termostatos WHERE produto_id = p.id) AS ficha
                )
                WHEN 'racoes' THEN (
                  SELECT json_build_object('tipo', 'racoes', 'dados', ficha)
                    FROM (SELECT formato, peso_g AS "pesoG", tipo_agua AS "tipoAgua",
                                 indicada_para AS "indicadaPara"
                            FROM racoes WHERE produto_id = p.id) AS ficha
                )
                WHEN 'condicionadores' THEN (
                  SELECT json_build_object('tipo', 'condicionadores', 'dados', ficha)
                    FROM (SELECT tipo, volume_ml AS "volumeMl", dosagem, principio_ativo AS "principioAtivo",
                                 tipo_agua AS "tipoAgua"
                            FROM condicionadores WHERE produto_id = p.id) AS ficha
                )
                WHEN 'substratos' THEN (
                  SELECT json_build_object('tipo', 'substratos', 'dados', ficha)
                    FROM (SELECT tipo, peso_kg AS "pesoKg", granulometria_mm AS "granulometriaMm", cor,
                                 altera_ph AS "alteraPh"
                            FROM substratos WHERE produto_id = p.id) AS ficha
                )
                WHEN 'plantas' THEN (
                  SELECT json_build_object('tipo', 'plantas', 'dados', ficha)
                    FROM (SELECT nome, posicao, iluminacao_exigida AS "iluminacaoExigida",
                                 precisa_co2 AS "precisaCo2", crescimento, dificuldade,
                                 temp_min_c AS "tempMinC", temp_max_c AS "tempMaxC"
                            FROM plantas WHERE produto_id = p.id) AS ficha
                )
                WHEN 'decoracoes' THEN (
                  SELECT json_build_object('tipo', 'decoracoes', 'dados', ficha)
                    FROM (SELECT material, material_natural AS "materialNatural",
                                 comprimento_cm AS "comprimentoCm", largura_cm AS "larguraCm",
                                 altura_cm AS "alturaCm", seguro_marinho AS "seguroMarinho"
                            FROM decoracoes WHERE produto_id = p.id) AS ficha
                )
                ELSE NULL
              END AS ficha
         FROM produtos AS p
         JOIN categorias AS c ON c.id = p.categoria_id
        WHERE p.id = $1 AND p.ativo`,
      [id],
    )

    return rows[0] ?? null
  },
}
