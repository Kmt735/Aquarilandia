-- =====================================================================
-- Verificação das regras de clientes e vendas (10_clientes.sql e 20_vendas.sql)
--
-- Fica fora de db/init para NÃO rodar na subida do banco.
-- Tudo roda dentro de BEGIN ... ROLLBACK: nenhum dado fica no banco.
--
-- Como rodar (com o banco no ar):
--   docker compose exec -T db psql -X -U aquarilandia -d aquarilandia < db/testes/verificar_clientes_vendas.sql
--
-- Cada caso imprime "OK <descrição>" ou "FALHOU <descrição> (motivo)".
-- As mensagens "ERROR: ..." no stderr são esperadas: são as recusas do banco.
--
-- Os casos de recusa conferem o SQLSTATE e o nome da constraint, para um
-- erro qualquer (ex.: digitação no teste) não passar como "OK".
-- =====================================================================

\set QUIET on
\set VERBOSITY terse
\pset tuples_only on
\pset format unaligned

BEGIN;

-- Avalia um caso que o banco deve RECUSAR
CREATE FUNCTION pg_temp.recusa(descricao TEXT, houve_erro BOOLEAN, estado TEXT, mensagem TEXT,
                               estados_esperados TEXT[], trecho TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT CASE
    WHEN NOT houve_erro THEN 'FALHOU ' || descricao || ' (o banco aceitou)'
    WHEN estado = ANY (estados_esperados) AND (trecho IS NULL OR mensagem LIKE '%' || trecho || '%')
      THEN 'OK ' || descricao
    ELSE 'FALHOU ' || descricao || ' (erro inesperado ' || estado || ': ' || mensagem || ')'
  END
$$;

-- Avalia um caso que deve FUNCIONAR
CREATE FUNCTION pg_temp.funciona(descricao TEXT, houve_erro BOOLEAN, mensagem TEXT, resultado_certo BOOLEAN)
RETURNS TEXT LANGUAGE sql AS $$
  SELECT CASE
    WHEN houve_erro THEN 'FALHOU ' || descricao || ' (erro: ' || mensagem || ')'
    WHEN resultado_certo THEN 'OK ' || descricao
    ELSE 'FALHOU ' || descricao || ' (gravou, mas o resultado não é o esperado)'
  END
$$;


-- ---------------------------------------------------------------------
-- a) Dados válidos (se algo aqui falhar, o script para)
-- ---------------------------------------------------------------------

\set ON_ERROR_STOP on

INSERT INTO produtos (categoria_id, nome, preco, estoque)
VALUES ((SELECT id FROM categorias WHERE slug = 'acessorios'), 'Redinha média', 4990, 10)
RETURNING id AS produto1 \gset

INSERT INTO produtos (categoria_id, nome, preco, estoque)
VALUES ((SELECT id FROM categorias WHERE slug = 'acessorios'), 'Sifão 30 cm', 12990, 5)
RETURNING id AS produto2 \gset

INSERT INTO clientes (nome, email, senha_hash, telefone, aceitou_termos_em)
VALUES ('Ana Teste', 'ana@exemplo.com', '$argon2id$hash-falso', '11999998888', now())
RETURNING id AS cliente \gset

INSERT INTO clientes (nome, email, senha_hash, papel)
VALUES ('Admin Teste', 'admin@exemplo.com', '$argon2id$hash-falso', 'admin')
RETURNING id AS admin \gset

INSERT INTO enderecos_cliente (cliente_id, apelido, cep, logradouro, numero, bairro, cidade, uf, principal)
VALUES (:cliente, 'Casa', '01001000', 'Praça da Sé', '100', 'Sé', 'São Paulo', 'SP', TRUE)
RETURNING id AS endereco1 \gset

INSERT INTO sessoes (token_hash, cliente_id, expira_em, ip, user_agent)
VALUES (encode(sha256('token-de-teste'), 'hex'), :cliente, now() + interval '7 days', '127.0.0.1', 'psql');

INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
VALUES (:cliente, encode(sha256('recuperacao-de-teste'), 'hex'), now() + interval '30 minutes');

-- venda 1: correios, 2 itens (2 x 4990 + 1 x 12990 = 22970) + frete 2500
INSERT INTO vendas (cliente_id, subtotal, frete, total, tipo_entrega, entrega_destinatario, entrega_telefone,
                    entrega_cep, entrega_logradouro, entrega_numero, entrega_bairro, entrega_cidade, entrega_uf,
                    prazo_entrega_dias, expira_em)
VALUES (:cliente, 22970, 2500, 25470, 'correios', 'Ana Teste', '11999998888',
        '01001000', 'Praça da Sé', '100', 'Sé', 'São Paulo', 'SP', 5, now() + interval '30 minutes')
RETURNING id AS venda1 \gset

INSERT INTO itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal) VALUES
  (:venda1, :produto1, 'Redinha média', 4990, 2, 9980),
  (:venda1, :produto2, 'Sifão 30 cm', 12990, 1, 12990);

INSERT INTO historico_status_venda (venda_id, status_anterior, status_novo, origem)
VALUES (:venda1, NULL, 'aguardando_pagamento', 'sistema');

INSERT INTO pagamentos (venda_id, gateway, gateway_cobranca_id, valor)
VALUES (:venda1, 'teste', 'cobranca-teste-123', 25470);

INSERT INTO eventos_webhook (gateway_notificacao_id, tipo, payload)
VALUES ('notif-teste-1', 'payment', '{"data": {"id": "pg-teste-1"}}');

-- venda 2: retirada, SEM informar expira_em (deve usar o DEFAULT), com 1 item
INSERT INTO vendas (cliente_id, subtotal, frete, total, tipo_entrega, entrega_destinatario, entrega_telefone,
                    prazo_entrega_dias)
VALUES (:cliente, 4990, 0, 4990, 'retirada', 'Ana Teste', '11999998888', 1)
RETURNING id AS venda2 \gset

INSERT INTO itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal)
VALUES (:venda2, :produto1, 'Redinha média', 4990, 1, 4990);

\set ON_ERROR_STOP off

SELECT 'OK dados válidos inseridos (2 produtos, cliente, admin, endereço, sessão, token de recuperação, '
       || '2 vendas, 3 itens, histórico, pagamento, webhook)';


-- ---------------------------------------------------------------------
-- b) O banco deve RECUSAR
-- ---------------------------------------------------------------------

SAVEPOINT caso;
INSERT INTO clientes (nome, email, senha_hash) VALUES ('Outra Ana', 'ana@exemplo.com', 'x');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa e-mail duplicado', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23505}', 'clientes_email_key');

SAVEPOINT caso;
INSERT INTO clientes (nome, email, senha_hash) VALUES ('Bia', 'Bia@Exemplo.com', 'x');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa e-mail com maiúscula', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'ck_clientes_email_minusculo');

SAVEPOINT caso;
INSERT INTO clientes (nome, email, senha_hash) VALUES ('Caio', 'caio@exemplo.com', NULL);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa cliente ativo sem senha', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'ck_clientes_login');

SAVEPOINT caso;
INSERT INTO clientes (nome, email, senha_hash, papel) VALUES ('Davi', 'davi@exemplo.com', 'x', 'gerente');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa papel inválido', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'clientes_papel_check');

SAVEPOINT caso;
UPDATE clientes
   SET email = NULL, senha_hash = NULL, telefone = NULL, anonimizado_em = now()   -- ativo continua TRUE
 WHERE id = :cliente;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa cliente anonimizado e ativo', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'ck_clientes_anonimizado_inativo');

SAVEPOINT caso;
UPDATE clientes
   SET email = NULL, senha_hash = NULL, ativo = FALSE, anonimizado_em = now()   -- telefone mantido
 WHERE id = :cliente;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa anonimizar mantendo o telefone', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'ck_clientes_anonimizado_sem_dados');

SAVEPOINT caso;
UPDATE clientes SET telefone = '119999-8888' WHERE id = :cliente;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa telefone com máscara', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'clientes_telefone_check');

SAVEPOINT caso;
INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
VALUES (:cliente, encode(sha256('recuperacao-de-teste'), 'hex'), now() + interval '30 minutes');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa token de recuperação com hash duplicado', :erro, :'LAST_ERROR_SQLSTATE',
                      :'LAST_ERROR_MESSAGE', '{23505}', 'tokens_recuperacao_senha_token_hash_key');

SAVEPOINT caso;
INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
VALUES (999999999, encode(sha256('recuperacao-fantasma'), 'hex'), now() + interval '30 minutes');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa token de recuperação de cliente inexistente', :erro, :'LAST_ERROR_SQLSTATE',
                      :'LAST_ERROR_MESSAGE', '{23503}', 'tokens_recuperacao_senha_cliente_id_fkey');

SAVEPOINT caso;
INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
VALUES (:cliente, encode(sha256('recuperacao-vencida'), 'hex'), now() - interval '1 minute');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa token que expira antes de ser criado', :erro, :'LAST_ERROR_SQLSTATE',
                      :'LAST_ERROR_MESSAGE', '{23514}', 'ck_tokens_recuperacao_senha_expira_depois');

SAVEPOINT caso;
INSERT INTO enderecos_cliente (cliente_id, cep, logradouro, numero, bairro, cidade, uf, principal)
VALUES (:cliente, '20040002', 'Av. Rio Branco', '1', 'Centro', 'Rio de Janeiro', 'RJ', TRUE);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa dois endereços principais do mesmo cliente', :erro, :'LAST_ERROR_SQLSTATE',
                      :'LAST_ERROR_MESSAGE', '{23505}', 'idx_enderecos_cliente_principal');

-- '01001-000' tem 9 caracteres: CHAR(8) recusa por tamanho (22001) antes da CHECK
SAVEPOINT caso;
INSERT INTO enderecos_cliente (cliente_id, cep, logradouro, numero, bairro, cidade, uf)
VALUES (:cliente, '01001-000', 'Praça da Sé', '1', 'Sé', 'São Paulo', 'SP');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa CEP com traço', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{22001,23514}');

SAVEPOINT caso;
INSERT INTO enderecos_cliente (cliente_id, cep, logradouro, numero, bairro, cidade, uf)
VALUES (:cliente, '01001000', 'Praça da Sé', '1', 'Sé', 'São Paulo', 'sp');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa UF minúscula', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'enderecos_cliente_uf_check');

SAVEPOINT caso;
UPDATE vendas SET total = 99999 WHERE id = :venda1;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa total ≠ subtotal + frete', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'ck_vendas_total');

SAVEPOINT caso;
UPDATE vendas SET status = 'pago' WHERE id = :venda1;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa status ''pago'' (masculino)', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'status_venda_check');

SAVEPOINT caso;
UPDATE vendas SET status = 'enviada' WHERE id = :venda1;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa venda enviada sem código de rastreio', :erro, :'LAST_ERROR_SQLSTATE',
                      :'LAST_ERROR_MESSAGE', '{23514}', 'ck_vendas_rastreio_obrigatorio');

SAVEPOINT caso;
INSERT INTO itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal)
VALUES (:venda2, :produto2, 'Sifão 30 cm', 12990, 2, 12990);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa subtotal do item ≠ preço × quantidade', :erro, :'LAST_ERROR_SQLSTATE',
                      :'LAST_ERROR_MESSAGE', '{23514}', 'ck_itens_venda_subtotal');

SAVEPOINT caso;
INSERT INTO itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal)
VALUES (:venda2, :produto2, 'Sifão 30 cm', 12990, 0, 0);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa quantidade 0', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'itens_venda_quantidade_check');

SAVEPOINT caso;
INSERT INTO itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal)
VALUES (:venda1, :produto1, 'Redinha média', 4990, 1, 4990);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa mesmo produto duas vezes na venda', :erro, :'LAST_ERROR_SQLSTATE',
                      :'LAST_ERROR_MESSAGE', '{23505}', 'itens_venda_venda_id_produto_id_key');

SAVEPOINT caso;
INSERT INTO itens_venda (venda_id, produto_id, nome_produto, preco_unitario, quantidade, subtotal)
VALUES (:venda2, 999999999, 'Fantasma', 100, 1, 100);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa produto inexistente', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23503}', 'itens_venda_produto_id_fkey');

SAVEPOINT caso;
INSERT INTO historico_status_venda (venda_id, status_anterior, status_novo, origem, alterado_por_id)
VALUES (:venda1, 'aguardando_pagamento', 'paga', 'sistema', :admin);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa alterado_por fora do padrão (origem sistema com usuário)', :erro,
                      :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE', '{23514}',
                      'ck_historico_status_venda_alterado_por');

SAVEPOINT caso;
INSERT INTO historico_status_venda (venda_id, status_anterior, status_novo, origem, alterado_por_id)
VALUES (:venda1, 'aguardando_pagamento', 'paga', 'admin', NULL);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa alterado_por fora do padrão (origem admin sem usuário)', :erro,
                      :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE', '{23514}',
                      'ck_historico_status_venda_alterado_por');

SAVEPOINT caso;
UPDATE pagamentos SET status = 'approved' WHERE venda_id = :venda1;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa status de pagamento inválido', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'pagamentos_status_check');

SAVEPOINT caso;
INSERT INTO pagamentos (venda_id, gateway_cobranca_id, valor)
VALUES (:venda1, 'cobranca-teste-456', 25470);
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa pagamento sem gateway', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23502}', 'column "gateway"');

SAVEPOINT caso;
UPDATE pagamentos SET estorno_tentativas = 6 WHERE venda_id = :venda1;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa estorno_tentativas = 6', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23514}', 'pagamentos_estorno_tentativas_check');

SAVEPOINT caso;
INSERT INTO eventos_webhook (gateway_notificacao_id, tipo, payload)
VALUES ('notif-teste-1', 'payment', '{"data": {"id": "pg-teste-1"}}');
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa evento de webhook duplicado', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23505}', 'eventos_webhook_gateway_notificacao_id_key');

SAVEPOINT caso;
DELETE FROM produtos WHERE id = :produto2;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa apagar produto vendido', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23503}', 'itens_venda_produto_id_fkey');

SAVEPOINT caso;
DELETE FROM clientes WHERE id = :cliente;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa apagar cliente com venda', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23503}', 'vendas_cliente_id_fkey');

-- venda 2 só tem itens (sem histórico nem pagamento), então quem barra é a FK de itens_venda
SAVEPOINT caso;
DELETE FROM vendas WHERE id = :venda2;
\set erro :ERROR
ROLLBACK TO SAVEPOINT caso;
SELECT pg_temp.recusa('recusa apagar venda que tem itens', :erro, :'LAST_ERROR_SQLSTATE', :'LAST_ERROR_MESSAGE',
                      '{23503}', 'itens_venda_venda_id_fkey');


-- ---------------------------------------------------------------------
-- c) Deve FUNCIONAR
-- ---------------------------------------------------------------------

SELECT pg_temp.funciona('criar venda sem informar expira_em (DEFAULT criado_em + 30 min)', FALSE, '',
  (SELECT expira_em = criado_em + interval '30 minutes' FROM vendas WHERE id = :venda2));

SAVEPOINT caso;
INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
VALUES (:cliente, encode(sha256('recuperacao-nova'), 'hex'), now() + interval '30 minutes')
RETURNING id AS token_novo \gset
\set erro :ERROR
\if :erro
  ROLLBACK TO SAVEPOINT caso;
\endif
SELECT pg_temp.funciona('criar token de recuperação válido', :erro, :'LAST_ERROR_MESSAGE',
  (SELECT expira_em = criado_em + interval '30 minutes'
     FROM tokens_recuperacao_senha WHERE id = :token_novo));
ROLLBACK TO SAVEPOINT caso;

-- Cliente sem vendas: apagar a linha leva junto os tokens de recuperação (ON DELETE CASCADE)
SAVEPOINT caso;
INSERT INTO clientes (nome, email, senha_hash) VALUES ('Edu Teste', 'edu@exemplo.com', '$argon2id$hash-falso')
RETURNING id AS cliente_sem_venda \gset
INSERT INTO tokens_recuperacao_senha (cliente_id, token_hash, expira_em)
VALUES (:cliente_sem_venda, encode(sha256('recuperacao-edu'), 'hex'), now() + interval '30 minutes');
DELETE FROM clientes WHERE id = :cliente_sem_venda;
\set erro :ERROR
\if :erro
  ROLLBACK TO SAVEPOINT caso;
\endif
SELECT pg_temp.funciona('apagar o cliente apaga os tokens de recuperação dele', :erro, :'LAST_ERROR_MESSAGE',
  NOT EXISTS (SELECT 1 FROM tokens_recuperacao_senha WHERE cliente_id = :cliente_sem_venda));
ROLLBACK TO SAVEPOINT caso;

-- Anonimização LGPD: limpa dados pessoais, apaga endereços, sessões e tokens de recuperação, mantém as vendas
SAVEPOINT caso;
UPDATE clientes
   SET nome = 'Cliente removido', email = NULL, senha_hash = NULL, telefone = NULL,
       ativo = FALSE, anonimizado_em = now(), atualizado_em = now()
 WHERE id = :cliente;
DELETE FROM enderecos_cliente WHERE cliente_id = :cliente;
DELETE FROM sessoes WHERE cliente_id = :cliente;
DELETE FROM tokens_recuperacao_senha WHERE cliente_id = :cliente;
\set erro :ERROR
\if :erro
  ROLLBACK TO SAVEPOINT caso;
\endif
SELECT pg_temp.funciona('anonimizar o cliente mantendo as vendas', :erro, :'LAST_ERROR_MESSAGE',
  (SELECT count(*) = 2 FROM vendas WHERE cliente_id = :cliente)
  AND (SELECT entrega_cep IS NOT NULL FROM vendas WHERE id = :venda1)
  AND (SELECT email IS NULL AND NOT ativo FROM clientes WHERE id = :cliente)
  AND NOT EXISTS (SELECT 1 FROM enderecos_cliente WHERE cliente_id = :cliente)
  AND NOT EXISTS (SELECT 1 FROM sessoes WHERE cliente_id = :cliente)
  AND NOT EXISTS (SELECT 1 FROM tokens_recuperacao_senha WHERE cliente_id = :cliente));
ROLLBACK TO SAVEPOINT caso;

SAVEPOINT caso;
UPDATE vendas SET status = 'enviada', codigo_rastreio = 'AA123456789BR', atualizado_em = now()
 WHERE id = :venda1;
\set erro :ERROR
\if :erro
  ROLLBACK TO SAVEPOINT caso;
\endif
SELECT pg_temp.funciona('marcar venda enviada com rastreio', :erro, :'LAST_ERROR_MESSAGE',
  (SELECT status = 'enviada' AND codigo_rastreio = 'AA123456789BR' FROM vendas WHERE id = :venda1));
ROLLBACK TO SAVEPOINT caso;

-- Troca do principal: desmarcar o antigo e marcar o novo, na mesma transação
SAVEPOINT caso;
INSERT INTO enderecos_cliente (cliente_id, apelido, cep, logradouro, numero, bairro, cidade, uf)
VALUES (:cliente, 'Trabalho', '20040002', 'Av. Rio Branco', '1', 'Centro', 'Rio de Janeiro', 'RJ')
RETURNING id AS endereco2 \gset
UPDATE enderecos_cliente SET principal = FALSE, atualizado_em = now() WHERE id = :endereco1;
UPDATE enderecos_cliente SET principal = TRUE,  atualizado_em = now() WHERE id = :endereco2;
\set erro :ERROR
\if :erro
  ROLLBACK TO SAVEPOINT caso;
\endif
SELECT pg_temp.funciona('trocar o endereço principal', :erro, :'LAST_ERROR_MESSAGE',
  (SELECT array_agg(id) = ARRAY[:endereco2]
     FROM enderecos_cliente WHERE cliente_id = :cliente AND principal));
ROLLBACK TO SAVEPOINT caso;

ROLLBACK;

SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM clientes
                             WHERE email IN ('ana@exemplo.com', 'admin@exemplo.com', 'edu@exemplo.com'))
            THEN 'OK nenhum dado de teste ficou no banco'
            ELSE 'FALHOU sobraram dados de teste no banco' END;
