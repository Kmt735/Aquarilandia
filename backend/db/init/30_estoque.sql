-- PostgreSQL 17. O mesmo arquivo é bootstrap e migração incremental (npm run db:migrar-estoque).
-- Um único DO é atômico inclusive no psql do entrypoint, sem BEGIN aninhado no helper da aplicação.
-- Não edite uma versão aplicada: mudanças futuras exigem nova migração.
DO $migracao$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  -- Bloqueia escritas antigas durante o snapshot, mas permite consultas públicas.
  LOCK TABLE produtos IN SHARE ROW EXCLUSIVE MODE;

  CREATE TABLE IF NOT EXISTS migracoes_estoque (
    versao TEXT PRIMARY KEY,
    aplicado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );

  IF EXISTS (SELECT 1 FROM migracoes_estoque WHERE versao = '001_movimentos_admin') THEN
    IF to_regclass('operacoes_estoque') IS NULL OR to_regclass('movimentacoes_estoque') IS NULL THEN
      RAISE EXCEPTION 'Migração de estoque inconsistente.' USING ERRCODE = '55000';
    END IF;
    IF EXISTS (
      SELECT 1 FROM produtos p
      LEFT JOIN (SELECT produto_id, sum(delta) AS saldo FROM movimentacoes_estoque GROUP BY produto_id) m
        ON m.produto_id = p.id
      WHERE p.estoque::bigint <> COALESCE(m.saldo, 0)
    ) THEN
      RAISE EXCEPTION 'Estoque divergente do histórico; exige reconciliação.' USING ERRCODE = '55000';
    END IF;
    RETURN;
  END IF;

  CREATE TABLE operacoes_estoque (
    id UUID PRIMARY KEY,
    origem TEXT NOT NULL DEFAULT 'admin' CHECK (origem IN ('admin', 'abertura')),
    autor_id INTEGER REFERENCES clientes(id),
    chave_idempotencia UUID,
    hash_requisicao CHAR(64),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_operacoes_estoque_autor_chave UNIQUE (autor_id, chave_idempotencia),
    CONSTRAINT ck_operacoes_estoque_autoria CHECK (
      (origem = 'admin' AND autor_id IS NOT NULL AND chave_idempotencia IS NOT NULL
        AND hash_requisicao IS NOT NULL AND hash_requisicao ~ '^[0-9a-f]{64}$')
      OR (origem = 'abertura' AND autor_id IS NULL AND chave_idempotencia IS NULL AND hash_requisicao IS NULL)
    )
  );

  CREATE TABLE movimentacoes_estoque (
    id BIGSERIAL PRIMARY KEY,
    operacao_id UUID NOT NULL REFERENCES operacoes_estoque(id),
    produto_id INTEGER NOT NULL REFERENCES produtos(id),
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'ajuste_positivo', 'ajuste_negativo', 'saida', 'abertura')),
    quantidade INTEGER NOT NULL CHECK (quantidade >= 0),
    delta INTEGER NOT NULL,
    saldo_anterior INTEGER NOT NULL CHECK (saldo_anterior >= 0),
    saldo_atual INTEGER NOT NULL CHECK (saldo_atual >= 0),
    motivo VARCHAR(300) NOT NULL CHECK (length(btrim(motivo)) > 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_movimentacoes_estoque_operacao_produto UNIQUE (operacao_id, produto_id),
    CONSTRAINT ck_movimentacoes_estoque_saldo CHECK (saldo_atual::bigint = saldo_anterior::bigint + delta::bigint),
    CONSTRAINT ck_movimentacoes_estoque_sinal CHECK (
      (tipo = 'abertura' AND saldo_anterior = 0 AND quantidade = saldo_atual AND delta = quantidade)
      OR (tipo IN ('entrada', 'ajuste_positivo') AND quantidade > 0 AND delta = quantidade)
      OR (tipo IN ('saida', 'ajuste_negativo') AND quantidade > 0 AND delta = -quantidade)
    )
  );
  CREATE UNIQUE INDEX uq_movimentacoes_estoque_abertura ON movimentacoes_estoque(produto_id) WHERE tipo = 'abertura';
  CREATE INDEX idx_movimentacoes_estoque_produto_data ON movimentacoes_estoque(produto_id, criado_em, id);

  CREATE FUNCTION impedir_mutacao_historico_estoque() RETURNS trigger LANGUAGE plpgsql AS $historico$
  BEGIN
    RAISE EXCEPTION 'Histórico de estoque é imutável.' USING ERRCODE = '55000';
  END;
  $historico$;
  CREATE TRIGGER operacoes_estoque_imutaveis BEFORE UPDATE OR DELETE ON operacoes_estoque
    FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_historico_estoque();
  CREATE TRIGGER operacoes_estoque_sem_truncate BEFORE TRUNCATE ON operacoes_estoque
    FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacao_historico_estoque();
  CREATE TRIGGER movimentacoes_estoque_imutaveis BEFORE UPDATE OR DELETE ON movimentacoes_estoque
    FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_historico_estoque();
  CREATE TRIGGER movimentacoes_estoque_sem_truncate BEFORE TRUNCATE ON movimentacoes_estoque
    FOR EACH STATEMENT EXECUTE FUNCTION impedir_mutacao_historico_estoque();

  -- Fotografa TODO produto já existente, inclusive zero/inativo. Não atualiza produtos nem presume reservas.
  WITH base AS MATERIALIZED (
    SELECT id, estoque, gen_random_uuid() AS operacao_id FROM produtos
  ), operacoes AS (
    INSERT INTO operacoes_estoque (id, origem) SELECT operacao_id, 'abertura' FROM base RETURNING id
  )
  INSERT INTO movimentacoes_estoque
    (operacao_id, produto_id, tipo, quantidade, delta, saldo_anterior, saldo_atual, motivo)
  SELECT o.id, b.id, 'abertura', b.estoque, b.estoque, 0, b.estoque, 'Saldo preexistente na implantação do histórico.'
    FROM base b JOIN operacoes o ON o.id = b.operacao_id;

  INSERT INTO migracoes_estoque (versao) VALUES ('001_movimentos_admin');
END;
$migracao$;
