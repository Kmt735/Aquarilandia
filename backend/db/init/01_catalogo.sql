-- =====================================================================
-- Aquarilândia — esquema do catálogo (PostgreSQL)
--
-- Padrão usado: uma tabela "produtos" com o que TODO produto tem
-- (nome, preço, estoque...) e uma tabela de detalhes para cada categoria
-- com as especificações dela. Cada tabela de detalhes tem relação 1:1
-- com produtos: a chave primária dela É o id do produto.
--
-- Assim a parte de vendas trata qualquer item (filtro, ração, peixe)
-- do mesmo jeito: tudo é um produto com preço e estoque.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Base
-- ---------------------------------------------------------------------

CREATE TABLE categorias (
  id    SERIAL       PRIMARY KEY,
  nome  VARCHAR(80)  NOT NULL UNIQUE,
  slug  VARCHAR(80)  NOT NULL UNIQUE          -- "filtros", usado na URL
);

CREATE TABLE produtos (
  id              SERIAL       PRIMARY KEY,
  categoria_id    INTEGER      NOT NULL REFERENCES categorias(id),
  nome            VARCHAR(150) NOT NULL,
  descricao       TEXT,
  marca           VARCHAR(80),
  preco  INTEGER      NOT NULL CHECK (preco >= 0),   -- R$ 89,90 = 8990
  estoque         INTEGER      NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  imagem_url      TEXT,
  ativo           BOOLEAN      NOT NULL DEFAULT TRUE,  -- "apagar" = ativo FALSE
  criado_em       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_ativos    ON produtos(ativo) WHERE ativo;


-- ---------------------------------------------------------------------
-- Peixes (ficha técnica completa — é a categoria com mais filtros)
-- ---------------------------------------------------------------------

CREATE TABLE peixes (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  nome_cientifico     VARCHAR(120) NOT NULL UNIQUE,     -- "Betta splendens"
  origem              VARCHAR(120),                     -- "Sudeste Asiático"
  tipo_agua           TEXT         NOT NULL CHECK (tipo_agua IN ('doce', 'salobra', 'marinho')),
  tamanho_adulto_cm   NUMERIC(5,1) NOT NULL CHECK (tamanho_adulto_cm > 0),
  temp_min_c          NUMERIC(4,1) NOT NULL,
  temp_max_c          NUMERIC(4,1) NOT NULL,
  ph_min              NUMERIC(3,1) NOT NULL CHECK (ph_min BETWEEN 0 AND 14),
  ph_max              NUMERIC(3,1) NOT NULL CHECK (ph_max BETWEEN 0 AND 14),
  aquario_min_litros  INTEGER      NOT NULL CHECK (aquario_min_litros > 0),
  temperamento        TEXT         NOT NULL CHECK (temperamento IN ('pacifico', 'semi_agressivo', 'agressivo')),
  nivel_natacao       TEXT         CHECK (nivel_natacao IN ('fundo', 'meio', 'superficie', 'todos')),
  cardume_minimo      INTEGER      NOT NULL DEFAULT 1 CHECK (cardume_minimo >= 1),
  dieta               TEXT         CHECK (dieta IN ('onivoro', 'carnivoro', 'herbivoro')),
  dificuldade         TEXT         NOT NULL CHECK (dificuldade IN ('iniciante', 'intermediario', 'avancado')),

  CHECK (temp_max_c >= temp_min_c),
  CHECK (ph_max >= ph_min)
);

-- Índices pensados nos filtros do site (?temperatura=26, ?dificuldade=iniciante...)
CREATE INDEX idx_peixes_temp        ON peixes(temp_min_c, temp_max_c);
CREATE INDEX idx_peixes_ph          ON peixes(ph_min, ph_max);
CREATE INDEX idx_peixes_dificuldade ON peixes(dificuldade);


-- ---------------------------------------------------------------------
-- Aquários
-- ---------------------------------------------------------------------

CREATE TABLE aquarios (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  volume_litros       INTEGER      NOT NULL CHECK (volume_litros > 0),
  comprimento_cm      NUMERIC(6,1) NOT NULL CHECK (comprimento_cm > 0),
  largura_cm          NUMERIC(6,1) NOT NULL CHECK (largura_cm > 0),
  altura_cm           NUMERIC(6,1) NOT NULL CHECK (altura_cm > 0),
  material            TEXT         NOT NULL CHECK (material IN ('vidro', 'acrilico')),
  tipo_agua           TEXT         NOT NULL CHECK (tipo_agua IN ('doce', 'marinho', 'ambos'))
);


-- ---------------------------------------------------------------------
-- Filtros
-- ---------------------------------------------------------------------

CREATE TABLE filtros (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  tipo                TEXT         NOT NULL CHECK (tipo IN ('hang_on', 'canister', 'interno', 'esponja', 'sump')),
  vazao_lh            INTEGER      NOT NULL CHECK (vazao_lh > 0),        -- litros por hora
  aquario_max_litros  INTEGER      CHECK (aquario_max_litros > 0),
  potencia_w          NUMERIC(6,1) CHECK (potencia_w >= 0),
  voltagem            TEXT         CHECK (voltagem IN ('110', '220', 'bivolt')),
  midias_inclusas     TEXT                                               -- "cerâmica, carvão, perlon"
);


-- ---------------------------------------------------------------------
-- Bombas (submersas, de circulação e compressores de ar)
-- ---------------------------------------------------------------------

CREATE TABLE bombas (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  tipo                TEXT         NOT NULL CHECK (tipo IN ('submersa', 'circulacao', 'ar')),
  vazao_lh            INTEGER      NOT NULL CHECK (vazao_lh > 0),
  altura_max_m        NUMERIC(4,2) CHECK (altura_max_m > 0),             -- altura manométrica
  saidas              INTEGER      CHECK (saidas > 0),                   -- nº de saídas (compressores)
  potencia_w          NUMERIC(6,1) CHECK (potencia_w >= 0),
  voltagem            TEXT         CHECK (voltagem IN ('110', '220', 'bivolt'))
);


-- ---------------------------------------------------------------------
-- Iluminação
-- ---------------------------------------------------------------------

CREATE TABLE iluminacao (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  tecnologia          TEXT         NOT NULL CHECK (tecnologia IN ('led', 'fluorescente')),
  potencia_w          NUMERIC(6,1) NOT NULL CHECK (potencia_w > 0),
  comprimento_cm      NUMERIC(6,1) CHECK (comprimento_cm > 0),
  espectro            TEXT         CHECK (espectro IN ('branco', 'rgb', 'plantado', 'marinho')),
  temperatura_cor_k   INTEGER      CHECK (temperatura_cor_k > 0),        -- 6500 K etc.
  voltagem            TEXT         CHECK (voltagem IN ('110', '220', 'bivolt'))
);


-- ---------------------------------------------------------------------
-- Termostatos / aquecedores
-- ---------------------------------------------------------------------

CREATE TABLE termostatos (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  potencia_w          NUMERIC(6,1) NOT NULL CHECK (potencia_w > 0),
  aquario_min_litros  INTEGER      CHECK (aquario_min_litros > 0),
  aquario_max_litros  INTEGER      CHECK (aquario_max_litros > 0),
  temp_min_c          NUMERIC(4,1),
  temp_max_c          NUMERIC(4,1),
  ajustavel           BOOLEAN      NOT NULL DEFAULT TRUE,
  voltagem            TEXT         CHECK (voltagem IN ('110', '220', 'bivolt')),

  CHECK (aquario_max_litros >= aquario_min_litros),
  CHECK (temp_max_c >= temp_min_c)
);


-- ---------------------------------------------------------------------
-- Rações
-- ---------------------------------------------------------------------

CREATE TABLE racoes (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  formato             TEXT         NOT NULL CHECK (formato IN ('flocos', 'granulos', 'pastilhas', 'palitos', 'liofilizada', 'congelada')),
  peso_g              INTEGER      NOT NULL CHECK (peso_g > 0),
  tipo_agua           TEXT         NOT NULL CHECK (tipo_agua IN ('doce', 'marinho', 'ambos')),
  indicada_para       TEXT                                               -- "bettas", "peixes de fundo"
);


-- ---------------------------------------------------------------------
-- Condicionadores e medicamentos
-- ---------------------------------------------------------------------

CREATE TABLE condicionadores (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  tipo                TEXT         NOT NULL CHECK (tipo IN ('condicionador', 'medicamento', 'bacterias', 'suplemento', 'teste_agua')),
  volume_ml           INTEGER      CHECK (volume_ml > 0),
  dosagem             TEXT,                                              -- "5 ml para cada 20 L"
  principio_ativo     TEXT,
  tipo_agua           TEXT         NOT NULL CHECK (tipo_agua IN ('doce', 'marinho', 'ambos'))
);


-- ---------------------------------------------------------------------
-- Substratos
-- ---------------------------------------------------------------------

CREATE TABLE substratos (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  tipo                TEXT         NOT NULL CHECK (tipo IN ('areia', 'cascalho', 'fertil', 'argila', 'coral')),
  peso_kg             NUMERIC(5,2) NOT NULL CHECK (peso_kg > 0),
  granulometria_mm    VARCHAR(20),                                       -- "1-3 mm"
  cor                 VARCHAR(40),
  altera_ph           BOOLEAN      NOT NULL DEFAULT FALSE
);


-- ---------------------------------------------------------------------
-- Plantas
-- ---------------------------------------------------------------------

CREATE TABLE plantas (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  nome     VARCHAR(120) NOT NULL,
  posicao             TEXT         NOT NULL CHECK (posicao IN ('frente', 'meio', 'fundo', 'flutuante', 'epifita')),
  iluminacao_exigida  TEXT         NOT NULL CHECK (iluminacao_exigida IN ('baixa', 'media', 'alta')),
  precisa_co2         BOOLEAN      NOT NULL DEFAULT FALSE,
  crescimento         TEXT         CHECK (crescimento IN ('lento', 'medio', 'rapido')),
  dificuldade         TEXT         NOT NULL CHECK (dificuldade IN ('iniciante', 'intermediario', 'avancado')),
  temp_min_c          NUMERIC(4,1),
  temp_max_c          NUMERIC(4,1),

  CHECK (temp_max_c >= temp_min_c)
);


-- ---------------------------------------------------------------------
-- Decorações
-- ---------------------------------------------------------------------

CREATE TABLE decoracoes (
  produto_id          INTEGER      PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  material            TEXT         NOT NULL CHECK (material IN ('resina', 'pedra', 'tronco', 'ceramica', 'plastico')),
  material_natural    BOOLEAN      NOT NULL DEFAULT FALSE,
  comprimento_cm      NUMERIC(6,1) CHECK (comprimento_cm > 0),
  largura_cm          NUMERIC(6,1) CHECK (largura_cm > 0),
  altura_cm           NUMERIC(6,1) CHECK (altura_cm > 0),
  seguro_marinho      BOOLEAN      NOT NULL DEFAULT FALSE
);


-- ---------------------------------------------------------------------
-- Acessórios: sem tabela própria.
-- Redinhas, sifões, pinças, ventosas... são variados demais para ter
-- colunas em comum. Ficam só com nome, descrição e preço em "produtos".
-- ---------------------------------------------------------------------


-- ---------------------------------------------------------------------
-- Categorias iniciais
-- ---------------------------------------------------------------------

INSERT INTO categorias (nome, slug) VALUES
  ('Peixes',                       'peixes'),
  ('Aquários',                     'aquarios'),
  ('Filtros',                      'filtros'),
  ('Bombas',                       'bombas'),
  ('Iluminação',                   'iluminacao'),
  ('Termostatos',                  'termostatos'),
  ('Rações',                       'racoes'),
  ('Condicionadores e medicamentos', 'condicionadores'),
  ('Substratos',                   'substratos'),
  ('Plantas',                      'plantas'),
  ('Decorações',                   'decoracoes'),
  ('Acessórios',                   'acessorios');
