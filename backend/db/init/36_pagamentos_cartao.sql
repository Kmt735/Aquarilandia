-- Cartão pelo checkout hospedado. Migração aditiva; não altera pedidos nem saldos.
DO $migracao$
BEGIN
PERFORM set_config('lock_timeout', '5s', true);
CREATE TABLE IF NOT EXISTS pagamentos_checkout (
  pagamento_id INTEGER PRIMARY KEY REFERENCES pagamentos(id),
  referencia UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  envio_iniciado_em TIMESTAMPTZ
);
-- Uma tentativa pendente por modalidade. Pagamento duplicado é devolvido pelo fluxo financeiro existente.
DROP INDEX IF EXISTS uq_pagamentos_venda_pendente;
CREATE UNIQUE INDEX IF NOT EXISTS uq_pagamentos_venda_metodo_pendente
  ON pagamentos (venda_id, COALESCE(metodo, 'pix')) WHERE status = 'pendente';
END
$migracao$;
