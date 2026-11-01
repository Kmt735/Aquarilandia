-- =====================================================================
-- Aquarilândia — pedidos de orçamento (PostgreSQL)
-- Dono: Celio
--
-- Dados pessoais: nome e telefone de quem pediu o orçamento (não precisa ter
-- conta). Só o admin lê (GET/PATCH /api/orcamentos atrás de autenticar +
-- exigirAdmin); a criação é pública e devolve só o próprio pedido.
--
-- Os tamanhos são os mesmos limites da validação do orcamento.service.ts.
-- O telefone é salvo só com dígitos (DDD + número), como em clientes.
-- O serviço é validado contra a lista de serviços no service; os 80
-- caracteres são só um teto de segurança.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Orçamentos
--
-- status: novo → em_atendimento → concluido (a loja marca o que já respondeu)
-- ---------------------------------------------------------------------

CREATE TABLE orcamentos (
  id                  SERIAL        PRIMARY KEY,
  nome                VARCHAR(120)  NOT NULL,
  telefone            VARCHAR(11)   NOT NULL CHECK (telefone ~ '^[0-9]{10,11}$'),   -- só dígitos, com DDD
  servico             VARCHAR(80)   NOT NULL,
  mensagem            VARCHAR(1000),                            -- opcional
  status              TEXT          NOT NULL DEFAULT 'novo',
  criado_em           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT ck_orcamentos_status CHECK (status IN ('novo', 'em_atendimento', 'concluido'))
);

-- Listagem do admin: filtra por status e mostra os mais recentes primeiro
CREATE INDEX idx_orcamentos_status_criado_em ON orcamentos(status, criado_em DESC);
