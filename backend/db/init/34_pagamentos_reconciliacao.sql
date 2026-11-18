-- Reconciliação financeira independente do navegador e das retentativas do provedor.
DO $migracao$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS reconsultado_em TIMESTAMPTZ;
  ALTER TABLE eventos_webhook ADD COLUMN IF NOT EXISTS reprocessar_apos TIMESTAMPTZ;
  CREATE INDEX IF NOT EXISTS idx_pagamentos_reconciliacao ON pagamentos(reconsultado_em NULLS FIRST, id)
    WHERE gateway_cobranca_id IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_eventos_reprocessamento ON eventos_webhook(reprocessar_apos NULLS FIRST, id)
    WHERE processado_em IS NULL;
END
$migracao$;
