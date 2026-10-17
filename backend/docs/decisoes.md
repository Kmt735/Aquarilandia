# Decisões do backend — Aquarilândia

Registro do que foi decidido no backend, por quê e quando, para ninguém precisar reabrir a discussão.
Mudou uma decisão? Edite o item **no mesmo PR da mudança** e registre a nova data.
Convenções de código, rotas e banco ficam no [`api.md`](../api.md); aqui fica só o porquê.

---

## Arquitetura

### D-01 — Banco PostgreSQL
- **Data:** 15/10/2026
- **Decisão:** o banco é PostgreSQL. MongoDB foi considerado e descartado.
- **Motivo:** os dados são muito relacionais (cliente → venda → itens → produto → estoque) e as garantias de
  integridade ficam no próprio banco: FKs, `CHECK`s e transações.
- **Impacto:** todos os módulos; `docker-compose.yml`.

### D-02 — SQL puro com `pg`, camada repository e scripts em `db/init/`
- **Data:** 15/10/2026
- **Decisão:** sem ORM. As queries são SQL puro com o pacote `pg`, só na camada `repository`. As tabelas são
  criadas pelos arquivos de `db/init/`, um por domínio, numerados pela ordem das FKs (`01_catalogo.sql`,
  `10_clientes.sql`, `20_vendas.sql`...).
- **Motivo:** o schema usa recursos do Postgres (`DOMAIN`, índices parciais, `CHECK`s compostos) que ficam
  mais claros em SQL; arquivo por domínio evita que os dois devs editem o mesmo arquivo.
- **Impacto:** todos os módulos. Mudou um `.sql`? Rodar `npm run db:reset` (ver `api.md`, seção 7).

### D-03 — Validação manual no service, erro 422 por campo
- **Data:** 15/10/2026
- **Decisão:** a validação do body é feita à mão no service (função `validar<Algo>`), juntando todos os erros e
  lançando um único `AppError(…, 422, detalhes)`, com uma mensagem por campo.
- **Motivo:** o frontend mostra o erro ao lado de cada campo; sem lib de validação, menos dependência para combinar.
- **Impacto:** todos os services (ver `api.md`, seções 5 e 6).

### D-04 — Dinheiro sempre `INTEGER` em centavos
- **Data:** 15/10/2026
- **Decisão:** todo valor em dinheiro é inteiro em centavos (`8990` = R$ 89,90) no banco, na API e nos tipos.
- **Motivo:** `float` gera erro de arredondamento; os `CHECK`s de soma (`total = subtotal + frete`,
  `subtotal = preco_unitario * quantidade`) só são confiáveis com inteiros.
- **Impacto:** catálogo, vendas, pagamentos; o frontend formata para "R$".

### D-05 — Orçamentos vão para o banco
- **Data:** 15/10/2026
- **Decisão:** os orçamentos deixam de ficar só em memória e passam para a tabela `orcamentos`.
- **Motivo:** hoje ficam num array em `orcamento.service.ts` e somem quando o servidor reinicia.
- **Impacto:** módulo `orcamentos`. **Implementação pendente** (ver Pendentes).

---

## Clientes e acesso

### D-06 — Login de clientes; clientes e admins na mesma tabela
- **Data:** 15/10/2026
- **Decisão:** o site terá login de clientes. Clientes e admins ficam na tabela `clientes`, separados pela coluna
  `papel` (`'cliente'` | `'admin'`). Admin só é criado por script (`npm run criar-admin`), nunca por rota.
- **Motivo:** um login só, uma tabela só de sessões e de autoria no histórico (`historico_status_venda.alterado_por_id`
  aponta para `clientes`). Sem rota de criar admin, não existe brecha para alguém se promover.
- **Impacto:** módulos `auth` e `clientes`. O script `criar-admin` ainda não existe no `package.json`.

### D-07 — Sessão no banco com cookie `sid`, em vez de JWT
- **Data:** 15/10/2026
- **Decisão:**
  - A sessão fica na tabela `sessoes`. O navegador recebe um token aleatório no cookie **`sid`**, com
    `httpOnly`, `secure` e `sameSite`.
  - O banco guarda só o hash SHA-256 do token (`sessoes.token_hash`), nunca o token.
  - Cada sessão vence em `sessoes.expira_em`; as vencidas são apagadas por limpeza periódica
    (`idx_sessoes_expira_em`).
- **Motivo:** permite encerrar sessões na hora (logout, troca de senha, cliente desativado, senha temporária), o que
  JWT não faz sem lista de bloqueio. `httpOnly` impede que um script injetado (XSS) leia o cookie. Se o banco
  vazar, os hashes não servem para entrar em nenhuma conta.
- **Impacto:** módulo `auth`. Toda requisição autenticada consulta `sessoes` pelo hash (coluna `UNIQUE`, indexada).
  O frontend não guarda token em `localStorage` e envia as requisições com `credentials: 'include'`; o CORS precisa
  de `credentials: true` e origem fixa (`CORS_ORIGIN`), não `*`. Depende do domínio do site (ver Pendentes).

### D-08 — Rotas do cliente usam `/me`
- **Data:** 15/10/2026
- **Decisão:** as rotas do próprio cliente usam `/me` e identificam o dono pela sessão de login, nunca por um id
  vindo da URL ou do body. Recurso de outro cliente responde **404** (não 403).
- **Motivo:** impede que um cliente acesse dados de outro trocando o id; 404 não revela que o recurso existe.
- **Impacto:** módulos `clientes`, `vendas`, `pagamentos`. Ver Divergências (o mapa de rotas do `api.md` ainda
  usa `/api/clientes/:id/...`).

### D-09 — Senha temporária no lugar de recuperação por e-mail
- **Data:** 15/10/2026
- **Decisão:** recuperação de senha por e-mail fica fora da entrega de 19/11. No lugar, o admin gera uma senha
  temporária (`POST /api/clientes/:id/senha-temporaria`); a coluna `clientes.trocar_senha` fica `TRUE` e o
  cliente é obrigado a trocar a senha no próximo login. Gerar a senha temporária encerra as sessões do cliente.
- **Motivo:** e-mail automático está fora do escopo (D-24), e o cliente não pode ficar sem acesso.
- **Impacto:** módulos `auth` e `clientes`.

---

## Vendas e estoque

### D-10 — Compra pelo site, com entrega
- **Data:** 15/10/2026
- **Decisão:** a compra é feita pelo próprio site, com entrega dos produtos. A retirada na loja já está prevista no
  banco (`tipo_entrega = 'retirada'` e status `pronta_retirada`), mas depende de confirmação da loja.
- **Motivo:** é o fluxo pedido pela loja; deixar a retirada pronta no schema evita migração depois.
- **Impacto:** módulo `vendas`; cálculo de frete depende das regras de entrega (ver Pendentes).

### D-11 — Status da venda
- **Data:** 15/10/2026
- **Decisão:** a lista de status é a do `DOMAIN status_venda` em `db/init/20_vendas.sql`, usada em `vendas.status`
  e no `historico_status_venda`:
  `aguardando_pagamento`, `paga`, `em_separacao`, `enviada`, `pronta_retirada`, `entregue`,
  `cancelamento_solicitado`, `cancelada`.
  ```
  aguardando_pagamento → paga → em_separacao → enviada → entregue          (correios / propria)
  aguardando_pagamento → paga → em_separacao → pronta_retirada → entregue  (retirada)
  aguardando_pagamento → cancelada
  paga / em_separacao / pronta_retirada → cancelamento_solicitado → cancelada (ou volta para em_separacao)
  ```
- **Motivo:** um `DOMAIN` só garante que a lista nunca fique diferente entre as tabelas.
- **Impacto:** vendas, pagamentos, frontend (telas de pedido e do admin).

### D-12 — A venda guarda cópias do momento da compra
- **Data:** 15/10/2026
- **Decisão:** a venda guarda cópia do nome e do preço de cada item (`itens_venda.nome_produto`,
  `itens_venda.preco_unitario`) e do endereço de entrega (`vendas.entrega_*`).
- **Motivo:** o histórico mostra o que o cliente realmente comprou, pelo preço que pagou, para onde foi enviado,
  mesmo se o produto ou o endereço mudar depois.
- **Impacto:** módulo `vendas`.

### D-13 — Produto nunca é apagado
- **Data:** 15/10/2026
- **Decisão:** remover produto = `ativo = FALSE`. A linha nunca sai do banco.
- **Motivo:** vendas antigas continuam apontando para ele (`itens_venda.produto_id`, sem `CASCADE`).
- **Impacto:** módulo `catalogo` (Dev 2).

### D-14 — Endereço do cliente é apagado de verdade
- **Data:** 15/10/2026
- **Decisão:** quando o cliente remove um endereço, a linha de `enderecos_cliente` é excluída (sem soft delete).
- **Motivo:** é dado pessoal e não precisa ser guardado; a venda já tem a própria cópia (D-12).
- **Impacto:** módulo `clientes`.

### D-15 — Fronteira com catálogo e estoque (CV-02)
- **Data:** 15/10/2026
- **Decisão:** resumo do contrato definido no `api.md`, **seção 8** (a fonte é ele; mudou lá, muda aqui):
  - Vendas nunca importa repository nem faz SQL em tabela do catálogo/estoque; usa só os services.
  - Só o módulo `estoque` escreve em `produtos.estoque`, e toda mudança gera uma linha em `movimentacoes_estoque`.
  - `produtoService.buscarParaVenda(ids)` → `ProdutoVenda[]` (`id`, `nome`, `preco`, `ativo`); retorna só os
    encontrados, quem chama decide o erro do id faltando.
  - `estoqueService.baixarParaVenda(vendaId, itens, client)` → lança `409 'Estoque insuficiente'` com detalhes
    por item (`itens.<indice>.quantidade`).
  - `estoqueService.estornarVenda(vendaId, client)`.
  - `ItemMovimento` = `produtoId` + `quantidade`. `ProdutoVenda` e `ItemMovimento` ficam em `types/index.ts`.
  - Fluxo do `POST /api/vendas`: valida o body → `buscarParaVenda` confere se todos existem e estão ativos →
    `comTransacao` insere `vendas` e `itens_venda` e chama `baixarParaVenda` → qualquer erro desfaz tudo.
- **Motivo:** cada dev mexe só nas próprias tabelas; a baixa de estoque fica na mesma transação da venda.
- **Impacto:** vendas (Celio), catálogo e estoque (Dev 2). Partes ainda em aberto estão em Pendentes.

### D-16 — Estoque baixado na criação; venda não paga expira em 30 minutos
- **Data:** 15/10/2026
- **Decisão:** o estoque é baixado quando a venda é criada. Venda em `aguardando_pagamento` vence em 30 minutos
  (`vendas.expira_em`, default `now() + interval '30 minutes'`): uma tarefa agendada do módulo `vendas` cancela a
  venda e chama `estoqueService.estornarVenda`.
- **Motivo:** o cliente não paga por um produto que acabou enquanto estava no checkout; o estoque preso volta sozinho.
- **Impacto:** vendas (tarefa agendada, usa `idx_vendas_expira_em`), estoque.

### D-17 — Cancelamento pelo cliente até antes do envio
- **Data:** 15/10/2026
- **Decisão:** o cliente pode cancelar a venda enquanto ela não foi enviada. Venda já paga tem estorno (D-22).
- **Motivo:** depois de enviada, o produto já saiu da loja.
- **Impacto:** vendas, pagamentos. Ver Divergências (o `api.md` e o `20_vendas.sql` tratam o cancelamento
  depois de paga como **pedido** que o admin aprova).

---

## Pagamento

### D-18 — Pagamento em página hospedada pelo gateway
- **Data:** 15/10/2026
- **Decisão:** cartão e PIX são pagos numa página hospedada pelo gateway. O backend nunca recebe dados de cartão.
- **Motivo:** dados de cartão fora do nosso servidor = sem exigência de PCI e sem risco de vazamento do nosso lado.
- **Impacto:** módulo `pagamentos`.

### D-19 — Gateway ainda não definido
- **Data:** 15/10/2026
- **Decisão:** o gateway ainda **não** foi escolhido. Prazo: **29/10/2026**. Requisitos: página de pagamento
  hospedada, API de estorno, webhooks com assinatura, sandbox e conta no nome da loja.
- **Motivo:** a escolha depende da loja (taxas e conta própria).
- **Impacto:** toda a parte de pagamento. Ver Divergências (o schema e o `api.md` já assumem Mercado Pago).

### D-20 — Código do gateway isolado em `gateway.ts`
- **Data:** 15/10/2026
- **Decisão:** toda chamada ao gateway fica num único arquivo, `gateway.ts`, dentro do módulo `pagamentos`.
- **Motivo:** trocar de gateway não pode afetar o resto do código.
- **Impacto:** módulo `pagamentos`.

### D-21 — Webhook só confirma o pagamento
- **Data:** 15/10/2026
- **Decisão:**
  - O webhook só confirma o pagamento (venda → `paga`); não mexe em estoque.
  - Sempre valida a assinatura e reconsulta o pagamento na API do gateway antes de agir.
  - Toda notificação é gravada em `eventos_webhook` antes de ser processada (idempotência).
  - Pagamento aprovado de venda já cancelada ou expirada → estorno.
- **Motivo:** o corpo do webhook pode ser forjado ou repetido; o estoque já foi resolvido na criação/cancelamento.
- **Impacto:** módulo `pagamentos`.

### D-22 — Estorno automático no cancelamento de venda paga
- **Data:** 15/10/2026
- **Decisão:** cancelar venda paga dispara estorno automático pela API do gateway, sempre do valor total, com chave
  de idempotência. Se o gateway falhar, a venda fica em `cancelamento_solicitado` e o estorno é tentado de novo.
- **Motivo:** o cliente não depende de ação manual para receber de volta; a chave de idempotência evita estorno em dobro
  na nova tentativa.
- **Impacto:** pagamentos, vendas. Hoje `pagamentos` não tem coluna para a chave de idempotência nem para as
  tentativas de estorno. Ver Divergências (sentido de `cancelamento_solicitado`).

---

## LGPD

### D-23 — "Apagar conta" anonimiza, as vendas ficam
- **Data:** 15/10/2026
- **Decisão:** apagar a conta anonimiza o cliente: `email`, `telefone`, `cpf` e `senha_hash` viram `NULL`, `nome`
  vira "Cliente removido", `anonimizado_em` é preenchido e `ativo = FALSE`. Endereços e sessões são excluídos.
  As vendas ficam, porque são registro da loja (incluindo os campos `entrega_*`, guardados por obrigação
  fiscal — LGPD art. 16, I). Cliente com venda em andamento não pode apagar a conta.
- **Motivo:** atende ao pedido de exclusão sem apagar registro fiscal. Os `CHECK`s de `clientes`
  (`ck_clientes_anonimizado_sem_dados`, `ck_clientes_anonimizado_inativo`) garantem isso no banco.
- **Impacto:** módulos `clientes` e `auth`.

---

## Escopo da entrega de 19/11/2026

### D-24 — Fora da entrega
- **Data:** 15/10/2026
- **Decisão:** ficam fora da entrega de 19/11/2026: e-mails automáticos, recuperação de senha por e-mail,
  integração com transportadora, exportação dos dados do cliente, CI no GitHub Actions e logger estruturado.
- **Motivo:** prazo.
- **Impacto:** D-09 (senha temporária substitui a recuperação por e-mail).

---

## Pendentes

| Pergunta | Com quem | Prazo | O que trava |
|---|---|---|---|
| CV-02: incluir `categoria` (slug) no `ProdutoVenda`? Hoje o contrato do `api.md` tem só `id`, `nome`, `preco`, `ativo`. | Dev 2 | a definir | Regra de entrega de peixe vivo na criação da venda |
| CV-02: `baixarParaVenda` fazer `UPDATE ... WHERE estoque >= quantidade` (baixa atômica)? | Dev 2 | a definir | Garantia de não vender além do estoque em compras simultâneas |
| CV-02: função pública do catálogo para a lista de serviços. Hoje `orcamento.service.ts` importa direto de `data/servicos.ts`. | Dev 2 | a definir | Orçamentos seguir a regra da seção 8 do `api.md` |
| CV-02: quem implementa o "Avise-me quando chegar"? | Celio + Dev 2 | a definir | Início da tarefa |
| Regras de entrega: cidades atendidas, frete por região, entrega de peixe vivo, prazo, se haverá retirada na loja. | Loja | 17/10/2026 | Cálculo de frete (`vendas.frete`, `prazo_entrega_dias`, `tipo_entrega`) |
| Qual gateway de pagamento? | Grupo + loja | 29/10/2026 | Toda a parte de pagamento |
| Conta do gateway no nome da loja para produção. | Loja | a definir | Pagamento em produção |
| CPF é necessário? (hoje `clientes.cpf` é opcional) | Loja | a definir | Validação do cadastro |
| Domínio do site: frontend e API no mesmo domínio ou proxy `/api` no frontend. | Grupo | antes do deploy | Cookie de login (`sid`) funcionar; valor do `sameSite` |
| Quem escreve termos de uso, política de privacidade e políticas de troca e entrega? | Grupo | a definir | Publicação do site; aceite no cadastro (`aceitou_termos_em`) |
| Implementar a tabela `orcamentos` (D-05). | Celio | a definir | Orçamentos sobreviverem ao reinício do servidor |
| Validade da sessão e se ela renova a cada uso. | Celio | a definir | Valor de `sessoes.expira_em` no login |

---

## Divergências encontradas

Pontos em que as decisões acima não batem com o `api.md` ou com os `.sql`. **Nada foi alterado** nesses arquivos;
cada item precisa ser decidido e corrigido no lugar certo.

1. **Gateway (D-19, D-20) × Mercado Pago no schema e no `api.md`.** A decisão diz que o gateway não está definido,
   mas o `api.md` já fala em "preferência do Checkout Pro" e "notificações do Mercado Pago", e o `20_vendas.sql` tem
   `pagamentos.mp_preferencia_id`, `pagamentos.mp_pagamento_id`, `eventos_webhook.mp_notificacao_id` e a tradução
   dos status do Mercado Pago. Decidir: manter os nomes `mp_*` até 29/10 ou trocar por nomes genéricos.
2. **Rotas `/me` (D-08) × mapa de rotas do `api.md`.** O `api.md` não tem nenhuma rota `/me`; as rotas do cliente
   estão como `/api/clientes/:id`, `/api/clientes/:id/vendas`, `/api/clientes/:id/enderecos...` e
   `DELETE /api/clientes/:id` (anonimiza). Decidir: quais viram `/me` e quais ficam só para o admin.
3. **`POST /api/clientes/:id/senha-temporaria` (D-09)** não está no mapa de rotas reservadas do `api.md`.
4. **Cancelamento (D-17, D-22) × `api.md` e `20_vendas.sql`.**
   - O `api.md` tem `POST /api/vendas/:id/solicitar-cancelamento` "(cliente, depois de paga)", e o fluxo do
     `20_vendas.sql` diz `cancelamento_solicitado → cancelada (ou volta para em_separacao)`: depois de paga, o
     cliente **pede** e o admin aprova ou recusa. A D-17 diz que o cliente **cancela** até antes do envio.
   - Na D-22, `cancelamento_solicitado` significa "estorno falhou, tentando de novo"; no `.sql`, significa
     "pedido do cliente aguardando decisão". O mesmo status com dois sentidos.
   - Decidir: o cliente cancela direto ou pede, e qual o sentido de `cancelamento_solicitado`.
5. **Exclusão de endereço (D-14) × `api.md`, seção 3.** A tabela de rotas diz que `DELETE` remove com soft delete;
   o endereço é excluído de verdade (o `10_clientes.sql` concorda com a D-14). Falta registrar a exceção no `api.md`.
