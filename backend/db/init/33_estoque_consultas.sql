-- Consultas gerais/período: o índice por produto não entrega a ordem global.
-- Justificativa EXPLAIN com 120 mil movimentos: docs/estoque-consultas-2026-11-15.md.
-- Incremental e repetível; apenas índice, sem mudanças em linhas ou migrations aplicadas.
-- CREATE INDEX normal bloqueia escritas durante a construção: usar janela autorizada em base existente.
DO $indice$
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);
  CREATE INDEX IF NOT EXISTS idx_movimentacoes_estoque_data
    ON movimentacoes_estoque(criado_em DESC, id DESC);
END
$indice$;
