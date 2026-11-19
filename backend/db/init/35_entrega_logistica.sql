-- Escolha da unidade e serviço preservados como snapshots; pedidos antigos permanecem sem atribuição inventada.
DO $migracao$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  ALTER TABLE vendas ADD COLUMN IF NOT EXISTS unidade_retirada JSONB;
  ALTER TABLE vendas ADD COLUMN IF NOT EXISTS servico_frete JSONB;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='vendas'::regclass AND conname='ck_vendas_unidade_retirada') THEN
    ALTER TABLE vendas ADD CONSTRAINT ck_vendas_unidade_retirada CHECK (
      unidade_retirada IS NULL OR (tipo_entrega='retirada' AND jsonb_typeof(unidade_retirada)='object'
        AND COALESCE(unidade_retirada->>'id','') IN ('centro','matosinhos')
        AND COALESCE(length(unidade_retirada->>'nome'),0)>0 AND COALESCE(length(unidade_retirada->>'endereco'),0)>0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='vendas'::regclass AND conname='ck_vendas_servico_frete') THEN
    ALTER TABLE vendas ADD CONSTRAINT ck_vendas_servico_frete CHECK (
      servico_frete IS NULL OR (tipo_entrega<>'retirada' AND jsonb_typeof(servico_frete)='object'
        AND COALESCE(length(servico_frete->>'id'),0)>0));
  END IF;
  CREATE TABLE IF NOT EXISTS produto_logistica (
    produto_id INTEGER PRIMARY KEY REFERENCES produtos(id),
    peso_g INTEGER NOT NULL CHECK (peso_g BETWEEN 1 AND 1000000),
    comprimento_cm INTEGER NOT NULL CHECK (comprimento_cm BETWEEN 1 AND 300),
    largura_cm INTEGER NOT NULL CHECK (largura_cm BETWEEN 1 AND 300),
    altura_cm INTEGER NOT NULL CHECK (altura_cm BETWEEN 1 AND 300),
    prazo_preparacao_dias INTEGER NOT NULL CHECK (prazo_preparacao_dias BETWEEN 0 AND 60),
    envio_convencional BOOLEAN NOT NULL,
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
  );
END
$migracao$;
