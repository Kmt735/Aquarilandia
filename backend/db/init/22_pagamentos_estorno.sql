-- =====================================================================
-- Aquarilândia — pagamento Pix: cobrança gravada depois e devolução de pagamento indevido (PostgreSQL)
-- Dono: Celio
--
-- Por quê (Lote 11: #44, #46, #47 e a parte mínima da #49):
--   * O POST /api/vendas/:id/pagamentos grava o pagamento ANTES de chamar a AbacatePay (a rede nunca fica dentro
--     da transação) e só depois grava o id da cobrança. Por isso gateway_cobranca_id passa a aceitar NULL
--     ("pagamento criado, cobrança ainda não gravada"). Cada cobrança pertence a um pagamento só (UNIQUE).
--   * Um pagamento por vez fica 'pendente' em cada venda: o #44 reaproveita o pendente em vez de criar outro.
--   * estorno_solicitado_em: um pagamento APROVADO que precisa ser devolvido (a venda já estava cancelada, ou
--     já tinha sido paga por outro pagamento). A tarefa de 5 em 5 minutos tenta o estorno até 5 vezes
--     (estorno_tentativas, que o CHECK do 20_vendas.sql já limita a 0..5).
--   * gateway_pagamento_id passa de VARCHAR(50) para VARCHAR(100), o mesmo tamanho de gateway_cobranca_id: no
--     Pix ele recebe o próprio id da cobrança quando o pagamento é aprovado.
--
-- Banco NOVO: o entrypoint do PostgreSQL roda db/init em ordem alfabética, então este arquivo roda depois do 21.
-- Banco EXISTENTE (sem db:reset; só ALTER e índices, nada é apagado), de dentro de backend/:
--   docker compose exec -T db psql -U aquarilandia -d aquarilandia < db/init/22_pagamentos_estorno.sql
-- Pode rodar de novo: cada passo confere se já foi feito. Um bloco DO só é atômico: ou tudo, ou nada.
-- =====================================================================

DO $migracao$
BEGIN
  -- Não esperar para sempre por um pagamento em andamento: falha em 5 s e pode ser rodado de novo
  PERFORM set_config('lock_timeout', '5s', true);

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'pagamentos' AND column_name = 'estorno_solicitado_em'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN estorno_solicitado_em TIMESTAMPTZ;
  END IF;

  -- DROP NOT NULL e aumentar o tamanho de um VARCHAR não reescrevem a tabela nem mudam nenhum valor
  ALTER TABLE pagamentos ALTER COLUMN gateway_cobranca_id DROP NOT NULL;
  ALTER TABLE pagamentos ALTER COLUMN gateway_pagamento_id TYPE VARCHAR(100);
END
$migracao$;

COMMENT ON COLUMN pagamentos.estorno_solicitado_em IS
  'Preenchido quando um pagamento APROVADO precisa ser devolvido (venda já cancelada, ou pagamento em dobro).';
COMMENT ON COLUMN pagamentos.gateway_cobranca_id IS
  'Id da cobrança no gateway. NULL = pagamento criado, cobrança ainda não gravada (POST /api/vendas/:id/pagamentos).';

-- A tarefa de estornos acha os pendentes por aqui (status aprovado + estorno pedido)
CREATE INDEX IF NOT EXISTS idx_pagamentos_estorno_pendente ON pagamentos (estorno_solicitado_em)
  WHERE status = 'aprovado' AND estorno_solicitado_em IS NOT NULL;

-- O webhook acha o pagamento pela cobrança; uma cobrança nunca pertence a dois pagamentos (vários NULL convivem)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_gateway_cobranca ON pagamentos (gateway_cobranca_id);

-- No máximo um pagamento pendente por venda. A trava da venda no #44 já garante isso; o índice é a rede de segurança
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_venda_pendente ON pagamentos (venda_id) WHERE status = 'pendente';
