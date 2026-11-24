-- =====================================================================
-- Aquarilândia — avaliações de produtos/peixes e avaliações do site (PostgreSQL)
--
-- Qualquer visitante avalia, sem login (por isso o rate limit na rota). Nada
-- aparece no site antes da moderação: o status nasce 'pendente' e só as
-- 'aprovada' são públicas (a regra fica em avaliacao.config.ts; com
-- AVALIACOES_PUBLICAR_DIRETO=true nascem 'aprovada'). A loja modera pelo
-- painel (GET/PATCH/DELETE /api/avaliacoes/..., só admin).
--
-- Não guarda IP nem conta: nome é opcional e livre (aparece como "Visitante").
-- Os tamanhos são os mesmos limites do avaliacao.validacao.ts e do frontend.
--
-- Idempotente (IF NOT EXISTS): é o bootstrap de um banco novo e também a
-- migração de um banco que já existe (npm run db:migrar-avaliacoes).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Avaliações de produtos (peixes também são produtos: mesma tabela)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS avaliacoes_produto (
  id            SERIAL        PRIMARY KEY,
  produto_id    INTEGER       NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nota          SMALLINT      NOT NULL CHECK (nota BETWEEN 1 AND 5),
  nome          VARCHAR(40),                                  -- opcional
  comentario    VARCHAR(500),                                 -- opcional
  status        TEXT          NOT NULL DEFAULT 'pendente',
  criada_em     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  moderada_em   TIMESTAMPTZ,                                  -- última vez que a loja mudou o status

  CONSTRAINT ck_avaliacoes_produto_status CHECK (status IN ('pendente', 'aprovada', 'oculta'))
);

-- Página do produto: só as aprovadas daquele produto, mais recentes primeiro
CREATE INDEX IF NOT EXISTS idx_avaliacoes_produto_publicas
  ON avaliacoes_produto(produto_id, criada_em DESC) WHERE status = 'aprovada';
-- Painel: filtra por status e mostra as mais recentes primeiro
CREATE INDEX IF NOT EXISTS idx_avaliacoes_produto_status_criada_em
  ON avaliacoes_produto(status, criada_em DESC);


-- ---------------------------------------------------------------------
-- Avaliações do site (experiência de navegação, não de produto)
--
-- motivo, encontrou e origem: as mesmas opções do formulário
-- (frontend/src/data/avaliacao-site.js). pagina: o caminho onde a pessoa estava.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS avaliacoes_site (
  id            SERIAL        PRIMARY KEY,
  nota          SMALLINT      NOT NULL CHECK (nota BETWEEN 1 AND 5),
  motivo        TEXT          CHECK (motivo IN ('comprar', 'conhecer-peixes', 'aprender-aquario', 'orcamento', 'outro')),
  encontrou     TEXT          CHECK (encontrou IN ('sim', 'mais-ou-menos', 'nao')),
  comentario    VARCHAR(300),
  origem        TEXT          NOT NULL DEFAULT 'aba' CHECK (origem IN ('aba', 'rodape', 'pos-compra')),
  pagina        VARCHAR(200),
  status        TEXT          NOT NULL DEFAULT 'pendente',
  criada_em     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  moderada_em   TIMESTAMPTZ,

  CONSTRAINT ck_avaliacoes_site_status CHECK (status IN ('pendente', 'aprovada', 'oculta'))
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_site_status_criada_em
  ON avaliacoes_site(status, criada_em DESC);
