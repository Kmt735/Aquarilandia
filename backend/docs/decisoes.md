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
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** os orçamentos deixam de ficar só em memória e passam para a tabela `orcamentos`, criada em
  `db/init/15_orcamentos.sql`, que substitui a lista em memória.
- **Motivo:** hoje ficam num array em `orcamento.service.ts` e somem quando o servidor reinicia.
- **Impacto:** módulo `orcamentos` (Celio).

### D-27 — Lista de serviços pelo `servicoService.listarOpcoes()`
- **Data:** 19/10/2026
- **Decisão:** o catálogo expõe `servicoService.listarOpcoes(): Promise<string[]>` com os valores aceitos no campo
  `servico` do orçamento. Os orçamentos deixam de importar `data/servicos.ts`.
- **Motivo:** um módulo só usa as funções públicas do service do outro (`api.md`, seção 8).
- **Impacto:** catálogo (Dev 2) e orçamentos (Celio).

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
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:**
  - A sessão fica na tabela `sessoes`. O navegador recebe um token aleatório no cookie **`sid`**, com
    `httpOnly`, `secure` em produção e `sameSite=lax`.
  - O banco guarda só o hash SHA-256 do token (`sessoes.token_hash`), nunca o token.
  - Cada sessão vence em `sessoes.expira_em`; as vencidas são apagadas por limpeza periódica
    (`idx_sessoes_expira_em`).
  - O frontend faz proxy de `/api` para o backend: o navegador enxerga uma única origem. Com domínio próprio no
    futuro, frontend e API ficam em subdomínios do mesmo domínio.
- **Motivo:** permite encerrar sessões na hora (logout, troca de senha, cliente desativado, redefinição de senha), o que
  JWT não faz sem lista de bloqueio. `httpOnly` impede que um script injetado (XSS) leia o cookie. Se o banco
  vazar, os hashes não servem para entrar em nenhuma conta. Com uma única origem, `sameSite=lax` funciona sem
  domínio próprio.
- **Impacto:** módulo `auth`. Toda requisição autenticada consulta `sessoes` pelo hash (coluna `UNIQUE`, indexada).
  O frontend não guarda token em `localStorage` e envia as requisições com `credentials: 'include'`; o CORS usa
  `credentials: true` e origem fixa pela variável `CORS_ORIGIN`, nunca `*`. `CORS_ORIGIN` serve só para CORS e
  para a checagem do header `Origin` (CSRF); os links em e-mails usam `FRONTEND_URL` (endereço público do frontend).

### D-08 — Rotas do cliente usam `/me`
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** o cliente acessa os próprios dados por `/api/clientes/me/...`; o dono vem sempre do login
  (`req.usuario.id`), nunca de um id vindo da URL ou do body. As rotas `/api/clientes/:id/...` ficam só para o
  admin. Recurso de outro cliente responde **404** (não 403).
- **Motivo:** sem id na URL não existe número para trocar; elimina a falha de um cliente acessar dados de
  outro (IDOR), em vez de depender de cada rota lembrar de checar. 404 não revela que o recurso existe.
- **Impacto:** módulos `clientes`, `vendas`, `pagamentos` (rotas de conta, endereços e vendas do cliente); o
  frontend usa `/me` nessas telas.

### D-09 — Recuperação de senha por e-mail
- **Data:** 19/10/2026
- **Decisão:** a recuperação de senha por e-mail entra na entrega de 19/11. Fluxo e regras conforme a seção 11 do
  `api.md`:
  - token aleatório guardado só como hash, válido por 30 minutos; resposta `202` sempre;
  - o token é válido se existe e não venceu, e a conta precisa estar ativa e não anonimizada; senão `400`
    "Link inválido ou expirado.";
  - pedir um link novo apaga todos os tokens anteriores do cliente; redefinir a senha apaga todos os tokens e
    todas as sessões dele, na mesma transação que grava a senha (por isso o token é de uso único);
  - o link usa `FRONTEND_URL`;
  - sem limpeza periódica de tokens vencidos na entrega de 19/11: ficam até o cliente pedir outro link, redefinir
    a senha ou ser anonimizado.

  A senha temporária gerada pelo admin foi descartada.
- **Motivo:** sem recuperação, um cliente que esquece a senha perde o acesso à conta; o fluxo por e-mail não depende
  de atendimento manual.
- **Impacto:** tabela `tokens_recuperacao_senha`, coluna `trocar_senha` removida, `utils/email.ts` (compartilhado),
  duas telas novas no frontend ("esqueci minha senha" e "criar senha nova").

---

## Vendas e estoque

### D-10 — Compra pelo site, com entrega
- **Data:** 15/10/2026
- **Decisão:** a compra é feita pelo próprio site, com entrega dos produtos. A retirada na loja já está prevista no
  banco (`tipo_entrega = 'retirada'` e status `pronta_retirada`), mas depende de confirmação da loja.
- **Motivo:** é o fluxo pedido pela loja; deixar a retirada pronta no schema evita migração depois.
- **Impacto:** módulo `vendas`; regras de entrega provisórias na D-29.

### D-11 — Status da venda
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** a lista de status é a do `DOMAIN status_venda` em `db/init/20_vendas.sql`, usada em `vendas.status`
  e no `historico_status_venda`:
  `aguardando_pagamento`, `paga`, `em_separacao`, `enviada`, `pronta_retirada`, `entregue`,
  `cancelamento_solicitado`, `cancelada`.
  ```
  aguardando_pagamento → paga → em_separacao → enviada → entregue          (correios / propria)
  aguardando_pagamento → paga → em_separacao → pronta_retirada → entregue  (retirada)
  aguardando_pagamento → cancelada
  paga / em_separacao / pronta_retirada → cancelada                         (estorno aprovado na hora)
  paga / em_separacao / pronta_retirada → cancelamento_solicitado → cancelada   (estorno pendente: o gateway falhou)
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
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** resumo do contrato definido no `api.md`, **seção 8** (a fonte é ele; mudou lá, muda aqui):
  - Vendas nunca importa repository nem faz SQL em tabela do catálogo/estoque; usa só os services.
  - Só o módulo `estoque` escreve em `produtos.estoque`, e toda mudança gera uma linha em `movimentacoes_estoque`.
  - `produtoService.buscarParaVenda(ids)` → `ProdutoVenda[]` (`id`, `nome`, `preco`, `ativo`, `categoria`); retorna
    só os encontrados, quem chama decide o erro do id faltando (D-25).
  - `estoqueService.baixarParaVenda(vendaId, itens, client)` → baixa atômica (D-26); lança
    `409 'Estoque insuficiente'` com detalhes por item (`itens.<indice>.quantidade`).
  - `estoqueService.estornarVenda(vendaId, client)`.
  - `servicoService.listarOpcoes()` para os orçamentos (D-27).
  - `ItemMovimento` = `produtoId` + `quantidade`. `ProdutoVenda` e `ItemMovimento` ficam em `types/index.ts`.
  - Fluxo do `POST /api/vendas`: valida o body → `buscarParaVenda` confere se todos existem e estão ativos →
    calcula o frete → `comTransacao` insere `vendas` e `itens_venda` e chama `baixarParaVenda` → qualquer erro
    desfaz tudo.
- **Motivo:** cada dev mexe só nas próprias tabelas; a baixa de estoque fica na mesma transação da venda.
- **Impacto:** vendas (Celio), catálogo e estoque (Dev 2).

### D-16 — Estoque baixado na criação; venda não paga expira em 30 minutos
- **Data:** 15/10/2026
- **Decisão:** o estoque é baixado quando a venda é criada. Venda em `aguardando_pagamento` vence em 30 minutos
  (`vendas.expira_em`, default `now() + interval '30 minutes'`): uma tarefa agendada do módulo `vendas` cancela a
  venda e chama `estoqueService.estornarVenda`.
- **Motivo:** o cliente não paga por um produto que acabou enquanto estava no checkout; o estoque preso volta sozinho.
- **Impacto:** vendas (tarefa agendada, usa `idx_vendas_expira_em`), estoque.

### D-17 — Cancelamento direto pelo cliente até antes do envio
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** o cliente cancela a própria venda em `POST /api/vendas/:id/cancelar` enquanto ela não foi enviada,
  com estorno automático se já estiver paga (D-22). Não existe "solicitar cancelamento". O status
  `cancelamento_solicitado` indica apenas estorno pendente após falha no gateway.
- **Motivo:** depois de enviada, o produto já saiu da loja; com o estorno automático, não há pedido para o admin
  aprovar.
- **Impacto:** rotas de vendas; tela de "minhas compras" no frontend; pagamentos.

### D-25 — Campo `categoria` no `ProdutoVenda`
- **Data:** 19/10/2026
- **Decisão:** `ProdutoVenda` passa a ter `categoria` (`categorias.slug`).
- **Motivo:** necessário para a regra de entrega de peixe vivo (D-29) na criação da venda.
- **Impacto:** catálogo (Dev 2).

### D-26 — Baixa de estoque atômica
- **Data:** 19/10/2026
- **Decisão:** `baixarParaVenda` faz `UPDATE produtos SET estoque = estoque - $1 WHERE id = $2 AND estoque >= $1`;
  se nenhuma linha for afetada, lança `409 'Estoque insuficiente'`.
- **Motivo:** evita vender o último item duas vezes em compras simultâneas e devolve 409 em vez de erro do banco
  (o `CHECK (estoque >= 0)` fica só como rede de segurança).
- **Impacto:** estoque (Dev 2).

### D-28 — "Avise-me quando chegar"
- **Data:** 19/10/2026
- **Decisão:** responsabilidade do Dev 2 (catálogo/estoque). Para 19/11 o pedido de aviso é salvo e a loja vê a
  lista no painel; o e-mail automático entra depois. O serviço de e-mail (`utils/email.ts`) entra na entrega (D-09),
  mas os e-mails de venda, de boas-vindas e o aviso de chegada ficam fora por decisão de escopo, não por falta de
  infraestrutura.
- **Motivo:** o aviso depende do estoque, e esses e-mails estão fora do escopo da entrega de 19/11 (D-24).
- **Impacto:** catálogo e estoque (Dev 2); painel do admin no frontend.

### D-29 — Regras de entrega (provisórias)
- **Data:** 19/10/2026
- **Decisão:** **provisório até a loja confirmar**; os valores ficam em `frete.config.ts`:
  - entrega só em São João del Rei, frete fixo de R$ 10,00 (`1000` centavos), prazo de 1 dia útil;
  - peixe vivo só nessa área;
  - retirada na loja disponível, com frete zero (status `pronta_retirada`);
  - sem frete grátis.
- **Motivo:** permite implementar e testar o frete sem esperar a resposta da loja.
- **Impacto:** módulo `vendas` (`POST /api/frete/calcular`, `vendas.frete`, `prazo_entrega_dias`, `tipo_entrega`).

---

## Pagamento

### D-18 — Pagamento em página hospedada pelo gateway
- **Data:** 15/10/2026
- **Decisão:** cartão e PIX são pagos numa página hospedada pelo gateway. O backend nunca recebe dados de cartão.
- **Motivo:** dados de cartão fora do nosso servidor = sem exigência de PCI e sem risco de vazamento do nosso lado.
- **Impacto:** módulo `pagamentos`.

### D-19 — Gateway ainda não definido
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** o gateway ainda **não** foi escolhido. Prazo: **29/10/2026**. Requisitos: página de pagamento
  hospedada, API de estorno, webhooks com assinatura, ambiente de testes e conta no nome da loja.
- **Motivo:** a escolha depende da loja (taxas e conta própria).
- **Impacto:** toda a parte de pagamento. O banco usa nomes genéricos (`gateway_*`) e a coluna `pagamentos.gateway`
  registra qual gateway foi usado.

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
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:**
  - Cancelar venda paga dispara estorno automático pela API do gateway, sempre do valor total, com chave de
    idempotência derivada do id da venda (`estorno-venda-<id>`).
  - Se o gateway falhar, a venda fica em `cancelamento_solicitado` (= estorno pendente) e a tarefa agendada tenta
    de novo, até 5 vezes. Contador em `pagamentos.estorno_tentativas` e último erro em
    `pagamentos.estorno_ultimo_erro`. Esgotadas as tentativas, a venda continua em `cancelamento_solicitado` e o
    admin resolve manualmente.
- **Motivo:** o cliente não depende de ação manual para receber de volta; a chave de idempotência evita estorno em dobro
  na nova tentativa; o limite de tentativas evita insistir num erro que não se resolve sozinho.
- **Impacto:** pagamentos, vendas.

### D-30 — Conta do gateway
- **Data:** 19/10/2026
- **Decisão:** a loja abre a própria conta no gateway escolhido (é ela quem recebe o dinheiro); até lá o time usa a
  conta de testes. Se a conta da loja não estiver pronta em 19/11, a demonstração é feita no ambiente de testes.
- **Motivo:** o dinheiro das vendas precisa cair na conta da loja, e a entrega não pode depender disso.
- **Impacto:** módulo `pagamentos`; variáveis `GATEWAY_ACCESS_TOKEN` e `GATEWAY_WEBHOOK_SECRET` por ambiente.

---

## LGPD

### D-23 — "Apagar conta" anonimiza, as vendas ficam
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** apagar a conta anonimiza o cliente: `email`, `telefone` e `senha_hash` viram `NULL`, `nome`
  vira "Cliente removido", `anonimizado_em` é preenchido e `ativo = FALSE`. Endereços, sessões e tokens de
  recuperação de senha são excluídos.
  As vendas ficam, porque são registro da loja (incluindo os campos `entrega_*`, guardados por obrigação
  fiscal — LGPD art. 16, I). Cliente com venda em andamento não pode apagar a conta.
- **Motivo:** atende ao pedido de exclusão sem apagar registro fiscal. Os `CHECK`s de `clientes`
  (`ck_clientes_anonimizado_sem_dados`, `ck_clientes_anonimizado_inativo`) garantem isso no banco.
- **Impacto:** módulos `clientes` e `auth`.

### D-31 — CPF não é coletado
- **Data:** 19/10/2026
- **Decisão:** o cadastro não pede CPF. Reavaliar se a loja precisar do CPF para nota fiscal ou se uma
  transportadora exigir.
- **Motivo:** minimização de dados (LGPD); reduz o estrago em caso de vazamento; o gateway coleta o CPF na própria
  página de pagamento quando precisa; cadastro mais rápido.
- **Impacto:** a coluna `clientes.cpf` é removida (`10_clientes.sql`); módulos `clientes` e `auth`.

### D-32 — Termos de uso e políticas
- **Data:** 19/10/2026
- **Decisão:** Celio escreve a política de privacidade; o frontend escreve os termos de uso e as políticas de troca e
  entrega, com base nas respostas da loja.
- **Motivo:** dados pessoais são da área do Celio (clientes, auth, LGPD); troca e entrega dependem das regras da loja.
- **Impacto:** publicação do site; aceite no cadastro (`aceitou_termos_em`).

---

## Escopo da entrega de 19/11/2026

### D-24 — Fora da entrega
- **Data:** 15/10/2026 (atualizado em 19/10/2026)
- **Decisão:** ficam fora da entrega de 19/11/2026: e-mails automáticos de venda, integração com transportadora,
  exportação dos dados do cliente, CI no GitHub Actions e logger estruturado. A recuperação de senha por e-mail
  entra na entrega (D-09).
- **Motivo:** prazo.
- **Impacto:** D-28 (aviso de chegada sem e-mail).

---

## Pendentes

| Pergunta | Com quem | Prazo | O que trava |
|---|---|---|---|
| Qual gateway de pagamento? | grupo + loja | 29/10/2026 | toda a parte de pagamento (semana 4) |
| Qual provedor de e-mail? | grupo | 22/10/2026 | recuperação de senha (semana 2) |

Requisitos do provedor de e-mail: plano gratuito suficiente para testes, envio a partir de um remetente verificado
sem exigir domínio próprio, SDK para Node.js.

Requisitos do gateway: ver `api.md` (seção de pagamento). As regras de entrega são provisórias até a confirmação
da loja (ver decisão de entrega, D-29).

---

## Divergências encontradas

Pontos em que as decisões acima não batiam com o `api.md` ou com os `.sql`. Todos foram resolvidos; ficam aqui
como registro.

1. **Gateway (D-19, D-20) × Mercado Pago no schema e no `api.md`.** — **Resolvido em 19/10/2026 (PR do `api.md`):**
   o `api.md` usa termos genéricos e o `20_vendas.sql` passou a usar `gateway_cobranca_id`,
   `gateway_pagamento_id` e `gateway_notificacao_id`.
2. **Rotas `/me` (D-08) × mapa de rotas do `api.md`.** — **Resolvido em 19/10/2026 (PR do `api.md`):** as rotas do
   cliente passaram para `/api/clientes/me/...`; `/api/clientes/:id/...` ficou só para o admin.
3. **Rota da D-09 fora do mapa de rotas.** — **Obsoleto em 19/10/2026:** a D-09 foi substituída pela recuperação
   de senha por e-mail, cujas rotas (`/api/auth/esqueci-senha` e `/api/auth/redefinir-senha`) estão no mapa.
4. **Cancelamento (D-17, D-22) × `api.md` e `20_vendas.sql`.** — **Resolvido em 19/10/2026 (PR do `api.md`):** o
   cliente cancela direto até antes do envio; `solicitar-cancelamento` foi removida; `cancelamento_solicitado`
   significa só estorno pendente (D-17, D-22), também no comentário do `20_vendas.sql`.
5. **Exclusão de endereço (D-14) × `api.md`, seção 3.** — **Resolvido em 19/10/2026:** a exceção de endereços
   (excluídos de verdade) foi registrada na seção 3 do `api.md`.
