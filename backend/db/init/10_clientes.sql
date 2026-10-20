-- =====================================================================
-- Aquarilândia — clientes, endereços, sessões e recuperação de senha (PostgreSQL)
-- Dono: Celio
--
-- Clientes e admins ficam na mesma tabela, separados pela coluna "papel".
-- O login usa sessão em banco: o navegador guarda um token no cookie
-- "sid" e aqui fica só o HASH desse token (se o banco vazar, os tokens
-- salvos não servem para entrar em nenhuma conta).
--
-- LGPD: "apagar a conta" não remove a linha (as vendas precisam continuar
-- existindo). Os dados pessoais DESTA tabela são apagados, os endereços e
-- as sessões são excluídos e anonimizado_em é preenchido.
-- Os dados de entrega copiados em vendas (entrega_*) NÃO são apagados:
-- ficam guardados por obrigação legal/fiscal (LGPD art. 16, I), pelo prazo
-- de guarda dos documentos fiscais (5 anos). Ver 20_vendas.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Clientes (e admins)
-- ---------------------------------------------------------------------

CREATE TABLE clientes (
  id                  SERIAL       PRIMARY KEY,
  nome                VARCHAR(120) NOT NULL,
  email               VARCHAR(160) UNIQUE,                    -- NULL só depois de anonimizado
  senha_hash          TEXT,                                   -- argon2; NULL só depois de anonimizado
  telefone            VARCHAR(11)  CHECK (telefone ~ '^[0-9]{10,11}$'),   -- só dígitos, com DDD
  papel               TEXT         NOT NULL DEFAULT 'cliente' CHECK (papel IN ('cliente', 'admin')),
  aceitou_termos_em   TIMESTAMPTZ,
  anonimizado_em      TIMESTAMPTZ,
  ativo               BOOLEAN      NOT NULL DEFAULT TRUE,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- e-mail sempre salvo em minúsculas (o service normaliza; o banco garante)
  CONSTRAINT ck_clientes_email_minusculo CHECK (email = lower(email)),
  -- conta não anonimizada precisa de e-mail e senha para conseguir logar
  CONSTRAINT ck_clientes_login CHECK (anonimizado_em IS NOT NULL OR (email IS NOT NULL AND senha_hash IS NOT NULL)),
  -- conta anonimizada nunca volta a ficar ativa
  CONSTRAINT ck_clientes_anonimizado_inativo CHECK (anonimizado_em IS NULL OR ativo = FALSE),
  -- conta anonimizada não guarda dados pessoais (nome vira "Cliente removido" no service)
  CONSTRAINT ck_clientes_anonimizado_sem_dados CHECK (anonimizado_em IS NULL OR
    (email IS NULL AND senha_hash IS NULL AND telefone IS NULL))
);


-- ---------------------------------------------------------------------
-- Endereços do cliente
--
-- Sem soft delete: quando o cliente apaga um endereço, a linha sai mesmo
-- (dado pessoal). As vendas não perdem nada, porque guardam uma CÓPIA do
-- endereço de entrega (ver 20_vendas.sql).
-- ---------------------------------------------------------------------

CREATE TABLE enderecos_cliente (
  id                  SERIAL       PRIMARY KEY,
  cliente_id          INTEGER      NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  apelido             VARCHAR(40),                            -- "Casa", "Trabalho"
  cep                 CHAR(8)      NOT NULL CHECK (cep ~ '^[0-9]{8}$'),
  logradouro          VARCHAR(150) NOT NULL,
  numero              VARCHAR(10)  NOT NULL,
  complemento         VARCHAR(80),
  bairro              VARCHAR(80)  NOT NULL,
  cidade              VARCHAR(80)  NOT NULL,
  uf                  CHAR(2)      NOT NULL CHECK (uf ~ '^[A-Z]{2}$'),
  principal           BOOLEAN      NOT NULL DEFAULT FALSE,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_enderecos_cliente_cliente ON enderecos_cliente(cliente_id);

-- No máximo UM endereço principal por cliente.
-- Para trocar o principal: desmarcar o antigo e marcar o novo na mesma transação.
CREATE UNIQUE INDEX idx_enderecos_cliente_principal ON enderecos_cliente(cliente_id) WHERE principal;


-- ---------------------------------------------------------------------
-- Sessões de login
-- ---------------------------------------------------------------------

CREATE TABLE sessoes (
  id                  SERIAL       PRIMARY KEY,
  token_hash          CHAR(64)     NOT NULL UNIQUE,           -- SHA-256 (hex) do token do cookie
  cliente_id          INTEGER      NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  expira_em           TIMESTAMPTZ  NOT NULL,
  ip                  VARCHAR(45),                            -- cabe IPv6
  user_agent          VARCHAR(300),
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessoes_cliente   ON sessoes(cliente_id);
CREATE INDEX idx_sessoes_expira_em ON sessoes(expira_em);     -- limpeza de sessões vencidas


-- ---------------------------------------------------------------------
-- Tokens de recuperação de senha
--
-- Mesmo esquema das sessões: o token vai só no link do e-mail e aqui fica
-- só o HASH dele. O token vale 30 minutos (expira_em, definido pelo
-- service) e é de uso único: é válido se existe e não venceu. Pedir um link
-- novo apaga os tokens anteriores do cliente; redefinir a senha apaga todos.
-- Sem limpeza periódica na entrega de 19/11: os vencidos ficam até o cliente
-- pedir outro link, redefinir a senha ou ser anonimizado.
-- ---------------------------------------------------------------------

CREATE TABLE tokens_recuperacao_senha (
  id                  SERIAL       PRIMARY KEY,
  cliente_id          INTEGER      NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  token_hash          CHAR(64)     NOT NULL UNIQUE,           -- SHA-256 (hex) do token do link
  expira_em           TIMESTAMPTZ  NOT NULL,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT ck_tokens_recuperacao_senha_expira_depois CHECK (expira_em > criado_em)
);

CREATE INDEX idx_tokens_recuperacao_senha_cliente_id ON tokens_recuperacao_senha(cliente_id);
