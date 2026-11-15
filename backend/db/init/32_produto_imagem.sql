-- Imagem principal: ID gerenciado separado da URL pública. Referências legadas são preservadas.
-- Incremental, sem reset; executar antes de habilitar as novas rotas. Não altera preço/saldo/ativo/histórico.
DO $migracao$
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  ALTER TABLE produtos ADD COLUMN IF NOT EXISTS imagem_arquivo_id UUID;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='produtos'::regclass AND conname='ck_produtos_imagem_gerenciada') THEN
    ALTER TABLE produtos ADD CONSTRAINT ck_produtos_imagem_gerenciada CHECK (
      imagem_arquivo_id IS NULL OR
      (imagem_url IS NOT NULL AND imagem_url='/api/midias/produtos/' || imagem_arquivo_id::text || '.webp')
    );
  END IF;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_imagem_arquivo ON produtos(imagem_arquivo_id) WHERE imagem_arquivo_id IS NOT NULL;
END
$migracao$;
