// Aliases p (produto), c (categoria) e f (ficha de peixe) são fixos nas consultas.
export const camposPublicosProduto = `p.id, p.categoria_id AS "categoriaId", c.slug AS categoria,
  p.nome, p.descricao, p.marca, p.preco,
  p.imagem_url AS "imagemUrl", (p.estoque > 0) AS "emEstoque"`

export const fichaPeixePublica = `json_build_object('tipo', 'peixes', 'dados', json_build_object(
  'nomeCientifico', f.nome_cientifico, 'origem', f.origem, 'tipoAgua', f.tipo_agua,
  'tamanhoAdultoCm', f.tamanho_adulto_cm, 'tempMinC', f.temp_min_c, 'tempMaxC', f.temp_max_c,
  'phMin', f.ph_min, 'phMax', f.ph_max, 'aquarioMinLitros', f.aquario_min_litros,
  'temperamento', f.temperamento, 'nivelNatacao', f.nivel_natacao, 'cardumeMinimo', f.cardume_minimo,
  'dieta', f.dieta, 'dificuldade', f.dificuldade
))`
