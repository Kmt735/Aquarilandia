-- Evolução 002. Não modifica a migração 001 nem saldos/histórico já gravados.
DO $migracao$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  IF NOT EXISTS (SELECT 1 FROM migracoes_estoque WHERE versao = '001_movimentos_admin') THEN
    RAISE EXCEPTION 'A migração administrativa de estoque é obrigatória.' USING ERRCODE = '55000';
  END IF;
  -- Ordem compatível com as escritas: operação antes de produto e movimento.
  LOCK TABLE operacoes_estoque IN ACCESS EXCLUSIVE MODE;
  LOCK TABLE produtos IN SHARE ROW EXCLUSIVE MODE;
  LOCK TABLE movimentacoes_estoque IN ACCESS EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM migracoes_estoque WHERE versao = '002_movimentos_venda') THEN
    IF EXISTS (
      SELECT 1 FROM produtos p LEFT JOIN
        (SELECT produto_id, sum(delta) AS saldo FROM movimentacoes_estoque GROUP BY produto_id) m ON m.produto_id = p.id
      WHERE p.estoque::bigint <> COALESCE(m.saldo, 0)
    ) THEN
      RAISE EXCEPTION 'Estoque divergente do histórico; exige reconciliação.' USING ERRCODE = '55000';
    END IF;
    RETURN;
  END IF;

  ALTER TABLE operacoes_estoque
    ADD COLUMN venda_id INTEGER REFERENCES vendas(id),
    ADD COLUMN tipo_venda TEXT,
    ADD COLUMN operacao_original_id UUID,
    ADD COLUMN transacao_venda XID8,
    ADD CONSTRAINT uq_operacoes_estoque_venda_tipo UNIQUE (venda_id, tipo_venda),
    ADD CONSTRAINT uq_operacoes_estoque_original UNIQUE (operacao_original_id),
    ADD CONSTRAINT uq_operacoes_estoque_id_venda UNIQUE (id, venda_id),
    ADD CONSTRAINT fk_operacoes_estoque_original_venda FOREIGN KEY (operacao_original_id, venda_id)
      REFERENCES operacoes_estoque(id, venda_id),
    DROP CONSTRAINT operacoes_estoque_origem_check,
    DROP CONSTRAINT ck_operacoes_estoque_autoria;

  ALTER TABLE operacoes_estoque
    ADD CONSTRAINT operacoes_estoque_origem_check CHECK (origem IN ('admin', 'abertura', 'venda')),
    ADD CONSTRAINT ck_operacoes_estoque_autoria CHECK (
      (origem = 'admin' AND autor_id IS NOT NULL AND chave_idempotencia IS NOT NULL
        AND hash_requisicao IS NOT NULL AND hash_requisicao ~ '^[0-9a-f]{64}$'
        AND venda_id IS NULL AND tipo_venda IS NULL AND operacao_original_id IS NULL AND transacao_venda IS NULL)
      OR (origem = 'abertura' AND autor_id IS NULL AND chave_idempotencia IS NULL AND hash_requisicao IS NULL
        AND venda_id IS NULL AND tipo_venda IS NULL AND operacao_original_id IS NULL AND transacao_venda IS NULL)
      OR (origem = 'venda' AND autor_id IS NULL AND chave_idempotencia IS NULL AND hash_requisicao IS NULL
        AND venda_id IS NOT NULL AND tipo_venda IS NOT NULL AND transacao_venda IS NOT NULL
        AND ((tipo_venda = 'baixa_venda' AND operacao_original_id IS NULL)
          OR (tipo_venda = 'estorno_venda' AND operacao_original_id IS NOT NULL AND operacao_original_id <> id)))
    );

  ALTER TABLE movimentacoes_estoque
    ADD COLUMN movimento_original_id BIGINT REFERENCES movimentacoes_estoque(id),
    ADD CONSTRAINT uq_movimentacoes_estoque_original UNIQUE (movimento_original_id),
    ADD CONSTRAINT ck_movimentacoes_estoque_original CHECK ((tipo = 'estorno_venda') = (movimento_original_id IS NOT NULL)),
    DROP CONSTRAINT movimentacoes_estoque_tipo_check,
    DROP CONSTRAINT ck_movimentacoes_estoque_sinal;
  ALTER TABLE movimentacoes_estoque
    ADD CONSTRAINT movimentacoes_estoque_tipo_check CHECK (tipo IN
      ('entrada', 'ajuste_positivo', 'ajuste_negativo', 'saida', 'abertura', 'baixa_venda', 'estorno_venda')),
    ADD CONSTRAINT ck_movimentacoes_estoque_sinal CHECK (
      (tipo = 'abertura' AND saldo_anterior = 0 AND quantidade = saldo_atual AND delta = quantidade)
      OR (tipo IN ('entrada', 'ajuste_positivo', 'estorno_venda') AND quantidade > 0 AND delta = quantidade)
      OR (tipo IN ('saida', 'ajuste_negativo', 'baixa_venda') AND quantidade > 0 AND delta = -quantidade)
    );

  CREATE FUNCTION validar_operacao_venda_estoque() RETURNS trigger LANGUAGE plpgsql AS $funcao$
  DECLARE estado TEXT;
  BEGIN
    IF NEW.origem <> 'venda' THEN RETURN NEW; END IF;
    NEW.transacao_venda := pg_current_xact_id();
    SELECT status INTO estado FROM vendas WHERE id = NEW.venda_id FOR NO KEY UPDATE;
    IF (NEW.tipo_venda = 'baixa_venda' AND estado IS DISTINCT FROM 'aguardando_pagamento')
      OR (NEW.tipo_venda = 'estorno_venda' AND (estado IS DISTINCT FROM 'cancelada' OR EXISTS (
        SELECT 1 FROM historico_status_venda WHERE venda_id = NEW.venda_id AND status_novo IN ('enviada', 'entregue')
      ))) THEN
      RAISE EXCEPTION 'Estado de venda incompatível com operação de estoque.' USING ERRCODE = '23514';
    END IF;
    IF NEW.tipo_venda = 'estorno_venda' AND NOT EXISTS (
      SELECT 1 FROM operacoes_estoque WHERE id = NEW.operacao_original_id
        AND venda_id = NEW.venda_id AND tipo_venda = 'baixa_venda' AND origem = 'venda'
    ) THEN
      RAISE EXCEPTION 'Devolução exige baixa original da mesma venda.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END;
  $funcao$;
  CREATE TRIGGER validar_operacao_venda BEFORE INSERT ON operacoes_estoque
    FOR EACH ROW EXECUTE FUNCTION validar_operacao_venda_estoque();

  CREATE FUNCTION validar_movimento_venda_estoque() RETURNS trigger LANGUAGE plpgsql AS $funcao$
  DECLARE operacao operacoes_estoque%ROWTYPE;
  BEGIN
    SELECT * INTO operacao FROM operacoes_estoque WHERE id = NEW.operacao_id;
    IF operacao.origem = 'venda' THEN
      IF operacao.transacao_venda IS DISTINCT FROM pg_current_xact_id() THEN
        RAISE EXCEPTION 'Operação de venda já confirmada não aceita novos movimentos.' USING ERRCODE = '23514';
      END IF;
      IF NEW.tipo IS DISTINCT FROM operacao.tipo_venda THEN
        RAISE EXCEPTION 'Tipo de movimento incompatível com operação.' USING ERRCODE = '23514';
      END IF;
      IF NEW.tipo = 'baixa_venda' AND NOT EXISTS (
        SELECT 1 FROM itens_venda WHERE venda_id = operacao.venda_id
          AND produto_id = NEW.produto_id AND quantidade = NEW.quantidade
      ) THEN
        RAISE EXCEPTION 'Baixa incompatível com item da venda.' USING ERRCODE = '23514';
      END IF;
      IF NEW.tipo = 'estorno_venda' AND NOT EXISTS (
        SELECT 1 FROM movimentacoes_estoque WHERE id = NEW.movimento_original_id
          AND operacao_id = operacao.operacao_original_id AND tipo = 'baixa_venda'
          AND produto_id = NEW.produto_id AND quantidade = NEW.quantidade
      ) THEN
        RAISE EXCEPTION 'Devolução incompatível com movimento original.' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.tipo IN ('baixa_venda', 'estorno_venda') THEN
      RAISE EXCEPTION 'Movimento de venda exige operação vinculada.' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END;
  $funcao$;
  CREATE TRIGGER validar_movimento_venda BEFORE INSERT ON movimentacoes_estoque
    FOR EACH ROW EXECUTE FUNCTION validar_movimento_venda_estoque();

  -- Uma operação incompleta não pode ser confirmada, mesmo se o chamador capturar um erro e tentar COMMIT.
  CREATE FUNCTION conferir_operacao_venda_completa() RETURNS trigger LANGUAGE plpgsql AS $funcao$
  BEGIN
    IF NEW.origem <> 'venda' THEN RETURN NULL; END IF;
    IF NOT EXISTS (SELECT 1 FROM movimentacoes_estoque WHERE operacao_id = NEW.id) THEN
      RAISE EXCEPTION 'Operação de venda sem movimentos.' USING ERRCODE = '23514';
    END IF;
    IF NEW.tipo_venda = 'baixa_venda' AND EXISTS (
      SELECT 1 FROM (SELECT produto_id, quantidade FROM itens_venda WHERE venda_id = NEW.venda_id) i
      FULL JOIN (SELECT produto_id, quantidade FROM movimentacoes_estoque WHERE operacao_id = NEW.id) m USING (produto_id)
      WHERE i.quantidade IS DISTINCT FROM m.quantidade
    ) THEN
      RAISE EXCEPTION 'Baixa deve incluir todos os itens da venda.' USING ERRCODE = '23514';
    END IF;
    IF NEW.tipo_venda = 'estorno_venda' AND EXISTS (
      SELECT 1 FROM (SELECT id, produto_id, quantidade FROM movimentacoes_estoque WHERE operacao_id = NEW.operacao_original_id) b
      FULL JOIN (SELECT movimento_original_id, produto_id, quantidade FROM movimentacoes_estoque WHERE operacao_id = NEW.id) e USING (produto_id)
      WHERE b.quantidade IS DISTINCT FROM e.quantidade OR b.id IS DISTINCT FROM e.movimento_original_id
    ) THEN
      RAISE EXCEPTION 'Devolução deve compensar a baixa integral.' USING ERRCODE = '23514';
    END IF;
    RETURN NULL;
  END;
  $funcao$;
  CREATE CONSTRAINT TRIGGER conferir_operacao_venda_completa AFTER INSERT ON operacoes_estoque
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION conferir_operacao_venda_completa();

  INSERT INTO migracoes_estoque (versao) VALUES ('002_movimentos_venda');
END;
$migracao$;
