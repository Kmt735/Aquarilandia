-- =====================================================================
-- Aquarilândia — vendas, itens, histórico e pagamentos (PostgreSQL)
-- Dono: Celio
--
-- Regras importantes:
--   * Dinheiro sempre INTEGER em centavos (R$ 89,90 = 8990), igual a produtos.preco.
--   * A venda guarda CÓPIAS do que pode mudar depois: o nome e o preço de cada
--     produto e os dados de entrega. Assim o histórico do cliente mostra o
--     que ele realmente comprou, pelo preço que pagou, para onde foi enviado.
--   * O estoque é baixado na criação da venda (módulo estoque). Venda não paga
--     até expira_em é cancelada por uma tarefa agendada, que devolve o estoque.
--   * Venda nunca é apagada (registro fiscal), só cancelada. Por isso nenhuma
--     FK para vendas tem ON DELETE CASCADE.
--   * LGPD: os campos entrega_* NÃO são apagados quando o cliente anonimiza a
--     conta. Ficam guardados por obrigação legal/fiscal (LGPD art. 16, I)
--     pelo prazo de guarda dos documentos fiscais (5 anos).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Status da venda (um DOMAIN só, usado em vendas e no histórico, para a
-- lista nunca ficar diferente entre as tabelas)
--
-- Fluxo:
--   aguardando_pagamento → paga → em_separacao → enviada → entregue        (correios / propria)
--   aguardando_pagamento → paga → em_separacao → pronta_retirada → entregue (retirada na loja)
--   aguardando_pagamento → cancelada
--   paga / em_separacao / pronta_retirada → cancelada                        (estorno aprovado na hora)
--   paga / em_separacao / pronta_retirada → cancelamento_solicitado → cancelada
--     cancelamento_solicitado = estorno pendente (o gateway falhou); só segue para cancelada
-- ---------------------------------------------------------------------

CREATE DOMAIN status_venda AS TEXT
  CHECK (VALUE IN ('aguardando_pagamento', 'paga', 'em_separacao', 'enviada', 'pronta_retirada',
                   'entregue', 'cancelamento_solicitado', 'cancelada'));


-- ---------------------------------------------------------------------
-- Vendas
--
-- tipo_entrega:
--   correios → endereço obrigatório; enviada/entregue exige codigo_rastreio
--   propria  → endereço obrigatório; a loja entrega, sem rastreio
--   retirada → cliente busca na loja; sem endereço, frete = 0
-- entrega_destinatario/telefone: quem recebe (ou quem vai retirar).
-- ---------------------------------------------------------------------

CREATE TABLE vendas (
  id                   SERIAL       PRIMARY KEY,
  cliente_id           INTEGER      NOT NULL REFERENCES clientes(id),
  status               status_venda NOT NULL DEFAULT 'aguardando_pagamento',
  subtotal             INTEGER      NOT NULL CHECK (subtotal >= 0),
  frete                INTEGER      NOT NULL CHECK (frete >= 0),
  total                INTEGER      NOT NULL CHECK (total >= 0),

  tipo_entrega         TEXT         NOT NULL CHECK (tipo_entrega IN ('correios', 'propria', 'retirada')),
  entrega_destinatario VARCHAR(120) NOT NULL,
  entrega_telefone     VARCHAR(11)  NOT NULL CHECK (entrega_telefone ~ '^[0-9]{10,11}$'),

  -- cópia do endereço de entrega no momento da compra (NULL na retirada)
  entrega_cep          CHAR(8)      CHECK (entrega_cep ~ '^[0-9]{8}$'),
  entrega_logradouro   VARCHAR(150),
  entrega_numero       VARCHAR(10),
  entrega_complemento  VARCHAR(80),
  entrega_bairro       VARCHAR(80),
  entrega_cidade       VARCHAR(80),
  entrega_uf           CHAR(2)      CHECK (entrega_uf ~ '^[A-Z]{2}$'),
  prazo_entrega_dias   INTEGER      NOT NULL CHECK (prazo_entrega_dias >= 0),   -- na retirada: dias até ficar pronta

  codigo_rastreio      VARCHAR(60),
  expira_em            TIMESTAMPTZ  NOT NULL DEFAULT now() + interval '30 minutes',
  criado_em            TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em        TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT ck_vendas_total CHECK (total = subtotal + frete),

  -- retirada: sem endereço e sem frete; correios/propria: endereço completo
  CONSTRAINT ck_vendas_endereco_entrega CHECK (
    (tipo_entrega = 'retirada'
      AND frete = 0
      AND entrega_cep IS NULL AND entrega_logradouro IS NULL AND entrega_numero IS NULL
      AND entrega_complemento IS NULL AND entrega_bairro IS NULL
      AND entrega_cidade IS NULL AND entrega_uf IS NULL)
    OR
    (tipo_entrega <> 'retirada'
      AND entrega_cep IS NOT NULL AND entrega_logradouro IS NOT NULL AND entrega_numero IS NOT NULL
      AND entrega_bairro IS NOT NULL AND entrega_cidade IS NOT NULL AND entrega_uf IS NOT NULL)
  ),

  -- status de envio só para entrega; "pronta_retirada" só para retirada
  CONSTRAINT ck_vendas_enviada_sem_retirada CHECK (status <> 'enviada' OR tipo_entrega <> 'retirada'),
  CONSTRAINT ck_vendas_pronta_retirada_so_retirada CHECK (status <> 'pronta_retirada' OR tipo_entrega = 'retirada'),

  -- rastreio só existe nos correios, e é obrigatório depois de enviada
  CONSTRAINT ck_vendas_rastreio_so_correios CHECK (codigo_rastreio IS NULL OR tipo_entrega = 'correios'),
  CONSTRAINT ck_vendas_rastreio_obrigatorio CHECK (
    tipo_entrega <> 'correios' OR status NOT IN ('enviada', 'entregue') OR codigo_rastreio IS NOT NULL
  )
);

CREATE INDEX idx_vendas_cliente_criado_em ON vendas(cliente_id, criado_em DESC);   -- "minhas compras"
CREATE INDEX idx_vendas_status            ON vendas(status);
CREATE INDEX idx_vendas_criado_em         ON vendas(criado_em);
-- usado pela tarefa que cancela vendas vencidas
CREATE INDEX idx_vendas_expira_em ON vendas(expira_em) WHERE status = 'aguardando_pagamento';


-- ---------------------------------------------------------------------
-- Itens da venda
-- ---------------------------------------------------------------------

CREATE TABLE itens_venda (
  id                  SERIAL       PRIMARY KEY,
  venda_id            INTEGER      NOT NULL REFERENCES vendas(id),
  produto_id          INTEGER      NOT NULL REFERENCES produtos(id),   -- sem CASCADE: produto nunca é apagado (ativo = FALSE)
  nome_produto        VARCHAR(150) NOT NULL,                  -- cópia de produtos.nome
  preco_unitario      INTEGER      NOT NULL CHECK (preco_unitario >= 0),   -- cópia de produtos.preco
  quantidade          INTEGER      NOT NULL CHECK (quantidade > 0),
  subtotal            INTEGER      NOT NULL CHECK (subtotal >= 0),

  CONSTRAINT ck_itens_venda_subtotal CHECK (subtotal = preco_unitario * quantidade),
  -- o mesmo produto aparece uma vez por venda (quantidades repetidas são somadas no service)
  UNIQUE (venda_id, produto_id)
);

CREATE INDEX idx_itens_venda_produto ON itens_venda(produto_id);


-- ---------------------------------------------------------------------
-- Histórico de status (auditoria: quem mudou o quê e quando)
--
-- origem cliente/admin → alterado_por_id aponta para clientes(id)
--   (admins também ficam em clientes, ver 10_clientes.sql)
-- origem sistema/gateway → alterado_por_id é NULL
-- ---------------------------------------------------------------------

CREATE TABLE historico_status_venda (
  id                  SERIAL       PRIMARY KEY,
  venda_id            INTEGER      NOT NULL REFERENCES vendas(id),
  status_anterior     status_venda,                           -- NULL no primeiro registro
  status_novo         status_venda NOT NULL,
  origem              TEXT         NOT NULL CHECK (origem IN ('cliente', 'admin', 'sistema', 'gateway')),
  alterado_por_id     INTEGER      REFERENCES clientes(id),
  observacao          VARCHAR(300),                           -- motivo do cancelamento etc.
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT ck_historico_status_venda_alterado_por CHECK ((origem IN ('cliente', 'admin')) = (alterado_por_id IS NOT NULL)),
  CONSTRAINT ck_historico_status_venda_mudou CHECK (status_anterior IS DISTINCT FROM status_novo)
);

CREATE INDEX idx_historico_status_venda_venda ON historico_status_venda(venda_id);


-- ---------------------------------------------------------------------
-- Pagamentos (gateway de pagamento)
--
-- Uma venda pode ter mais de um pagamento (ex.: cartão recusado e depois PIX).
-- status é a nossa tradução do status do gateway de pagamento:
--   approved → aprovado · pending/in_process/authorized → pendente
--   rejected → recusado · cancelled → cancelado
--   refunded/charged_back → estornado · in_mediation → em_disputa
-- ---------------------------------------------------------------------

CREATE TABLE pagamentos (
  id                  SERIAL       PRIMARY KEY,
  venda_id            INTEGER      NOT NULL REFERENCES vendas(id),
  gateway             TEXT         NOT NULL,                  -- qual gateway foi usado (o código informa; sem DEFAULT)
  gateway_cobranca_id VARCHAR(100) NOT NULL,                  -- id da cobrança criada no gateway
  gateway_pagamento_id VARCHAR(50) UNIQUE,                    -- id do pagamento no gateway de pagamento (chega pelo webhook)
  metodo              VARCHAR(30),                            -- "credit_card", "pix"...
  status              TEXT         NOT NULL DEFAULT 'pendente'
                                   CHECK (status IN ('pendente', 'aprovado', 'recusado', 'estornado', 'cancelado', 'em_disputa')),
  status_detalhe      VARCHAR(80),                            -- "cc_rejected_insufficient_amount"...
  valor               INTEGER      NOT NULL CHECK (valor >= 0),
  -- estorno: a tarefa agendada tenta até 5 vezes; depois o admin resolve manualmente
  estorno_tentativas  INTEGER      NOT NULL DEFAULT 0 CHECK (estorno_tentativas BETWEEN 0 AND 5),
  estorno_ultimo_erro TEXT,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagamentos_venda ON pagamentos(venda_id);


-- ---------------------------------------------------------------------
-- Eventos do webhook (idempotência)
--
-- Toda notificação recebida é gravada aqui ANTES de ser processada:
--   INSERT ... ON CONFLICT (gateway_notificacao_id) DO NOTHING
--   * inseriu agora                        → processar
--   * já existia com processado_em IS NULL → reprocessar (falhou antes)
--   * já existia com processado_em preenchido → ignorar (notificação repetida)
-- Em cada falha: tentativas = tentativas + 1 e ultimo_erro = mensagem.
-- ---------------------------------------------------------------------

CREATE TABLE eventos_webhook (
  id                  SERIAL       PRIMARY KEY,
  gateway_notificacao_id VARCHAR(100) NOT NULL UNIQUE,
  tipo                VARCHAR(50)  NOT NULL,                  -- "payment"
  payload             JSONB        NOT NULL,
  processado_em       TIMESTAMPTZ,
  tentativas          INTEGER      NOT NULL DEFAULT 0,
  ultimo_erro         TEXT,
  criado_em           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- usado para reprocessar eventos que falharam
CREATE INDEX idx_eventos_webhook_criado_em ON eventos_webhook(criado_em) WHERE processado_em IS NULL;
