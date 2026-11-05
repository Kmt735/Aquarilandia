-- =====================================================================
-- Aquarilândia — idempotência da criação de venda (PostgreSQL)
-- Dono: Celio
--
-- Por quê: dois cliques em "Finalizar compra", ou uma nova tentativa da rede depois de um timeout, mandariam o
-- mesmo POST /api/vendas duas vezes e criariam DUAS vendas (com o estoque baixado duas vezes). O frontend manda
-- um header Idempotency-Key (UUID) por tentativa de finalizar a compra; a venda guarda essa chave e o SHA-256
-- do pedido. A mesma chave do mesmo cliente devolve a venda já criada; com outro pedido, 409.
--
--   * chave_idempotencia: o UUID do header. UNIQUE por cliente: a chave de um cliente nunca acha a venda de outro.
--   * hash_requisicao: SHA-256 (hex) da forma canônica do pedido validado, para reconhecer "outro pedido".
--   * As duas juntas ou as duas NULL: as vendas criadas antes deste arquivo ficam com as duas NULL
--     (o UNIQUE não compara NULLs, então várias vendas antigas sem chave convivem).
--
-- Banco NOVO: o entrypoint do PostgreSQL roda db/init em ordem alfabética, então este arquivo roda logo depois
-- do 20_vendas.sql.
-- Banco EXISTENTE (sem db:reset; só acrescenta colunas e constraints, não apaga nada), de dentro de backend/:
--   docker compose exec -T db psql -U aquarilandia -d aquarilandia < db/init/21_vendas_idempotencia.sql
-- Pode rodar de novo: se as colunas já existem, não faz nada. Um bloco DO só é atômico: ou tudo, ou nada.
-- =====================================================================

DO $migracao$
BEGIN
  -- Não esperar para sempre por uma venda em andamento: falha em 5 s e pode ser rodado de novo
  PERFORM set_config('lock_timeout', '5s', true);

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'vendas' AND column_name = 'chave_idempotencia'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE vendas
    ADD COLUMN chave_idempotencia UUID,
    ADD COLUMN hash_requisicao    CHAR(64),
    ADD CONSTRAINT uq_vendas_cliente_chave UNIQUE (cliente_id, chave_idempotencia),
    -- O IS NOT NULL do hash é obrigatório: sem ele, hash NULL deixaria o regex NULL, o CHECK inteiro NULL, e um
    -- CHECK NULL passa (só FALSE recusa). Assim aceitaria a chave sem o hash
    ADD CONSTRAINT ck_vendas_idempotencia CHECK (
      (chave_idempotencia IS NULL AND hash_requisicao IS NULL)
      OR (chave_idempotencia IS NOT NULL AND hash_requisicao IS NOT NULL AND hash_requisicao ~ '^[0-9a-f]{64}$')
    );
END
$migracao$;
