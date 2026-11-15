# Decisões do backend — Aquarilândia

Registro do que foi decidido no backend, por quê e quando, para ninguém precisar reabrir a discussão.
Mudou uma decisão? Edite o item **no mesmo PR da mudança** e registre a nova data.
Convenções de código, rotas e banco ficam no [`api.md`](../api.md); aqui fica só o porquê.

---

## Arquitetura

### D-54 — E-mail em produção: Resend via HTTP, só texto, falha de e-mail nunca desfaz a operação
- **Data:** 14/11/2026 (Lote 14a, R-01 da revisão de base)
- **Decisão:**
  - **Provedor: Resend**, pela API HTTP (`POST https://api.resend.com/emails`, `Authorization: Bearer EMAIL_API_KEY`)
    com o `fetch` nativo: **nenhum pacote novo**. Corpo `{ from: EMAIL_REMETENTE, to: [destinatário], subject, text }`
    e timeout de 10 s.
  - **Só texto:** nenhum e-mail sai em HTML (o `enviarEmail` recusa `html`). O nome e o endereço de um cliente nunca
    viram marcação dentro de um e-mail.
  - **Variáveis:** `EMAIL_API_KEY` e `EMAIL_REMETENTE` são **obrigatórias em produção** (o servidor não sobe sem elas,
    D-52), e o remetente precisa ser `email@dominio` ou `Nome <email@dominio>`. Fora de produção são opcionais: sem a
    chave, o e-mail aparece no terminal (`[email:dev]`); com a chave, o remetente passa a ser obrigatório.
  - **Erros:** rede, timeout ou HTTP fora de 2xx viram um `Error` curto com o status (ex.: `Provedor de e-mail recusou o
    envio: HTTP 422.`), nunca com a chave, o destinatário, o texto nem o corpo da resposta.
  - **Falha de e-mail nunca desfaz a operação:** todo ponto que envia (esqueci-senha, troca de e-mail, mudança de status
    da venda) manda **depois do COMMIT e sem esperar** (`void enviarEmail(...).catch(...)`). A resposta da rota não muda
    (o esqueci-senha continua com o mesmo `202` exista a conta ou não), e o log não leva o e-mail do cliente.
  - **Remetente:** o domínio do `EMAIL_REMETENTE` precisa estar verificado no Resend (passo no `docs/deploy.md`).
- **Motivo:** sem provedor, a recuperação de senha (D-09) e os avisos de status (item 1 do PDF) não funcionavam em
  produção. O Resend tem plano gratuito, API HTTP simples (dispensa SDK) e aceita só texto.
- **Impacto:** `utils/email.ts` e `config/env.ts` (compartilhados), `.env.example`, `.env.producao.example`,
  `docs/deploy.md`. Fecha a pendência "Qual provedor de e-mail?".

### D-53 — Deploy: VPS + Docker + Caddy, mesmo endereço para site e API, simulação de Pix só em demonstração
- **Data:** 14/11/2026 (Lote 13)
- **Decisão:**
  - **Onde:** um VPS Linux (Ubuntu, Hostinger) com domínio próprio, tudo em Docker (`docker-compose.prod.yml`): o
    Caddy na frente (HTTPS automático, Let's Encrypt), a app (uma imagem só com o site e a API) e o Postgres.
  - **Mesmo endereço:** o backend serve o build do frontend (`FRONTEND_DIST`), e o site e a API ficam em
    `https://DOMINIO` e `https://DOMINIO/api`. Rota de API desconhecida continua 404 em JSON.
  - **Portas:** só o Caddy publica (80 e 443). A app e o Postgres não publicam nenhuma, e o Postgres fica numa rede
    `internal` com o gateway `isolated` (sem internet e sem endereço do host nela). O ufw libera só 22, 80 e 443.
  - **Imagem:** multi-stage (build do frontend, `tsc` do backend e dos scripts, só as dependências de produção),
    `NODE_ENV=production`, usuário `node` (não root), código só para leitura.
  - **Log de acesso do Caddy** sem a query string (o webhook traz o `webhookSecret` na URL), sem cookie e sem a
    assinatura do webhook.
  - **Cabeçalhos:** helmet com CSP restrita (só as origens do Google Fonts que o frontend usa, e o hash do script
    inline do tema em vez de `'unsafe-inline'`), HSTS só em produção (180 dias, sem preload).
  - **Simulação de Pix:** `POST /api/pagamentos/:id/simular` (admin) só existe com `PERMITIR_SIMULACAO_PIX=true` **e**
    a chave de teste da AbacatePay (prefixo `abc_dev_`); senão 404, como se não existisse. Com a variável ligada e uma
    chave de produção, o servidor avisa na subida e a rota continua desligada. O `simularPagamentoPix` do `gateway.ts`
    passou de "nunca em produção" para "em produção só com as duas travas".
  - **Segredos:** `.env.producao` fora do Git (modelo `.env.producao.example` só com placeholders), gerados no próprio
    servidor (`openssl rand -hex 32`).
- **Motivo:**
  - O cookie de sessão é `httpOnly`, `SameSite=Lax` e, em produção, `Secure` (D-07, D-52): com o site e a API em
    endereços diferentes, ele não iria nos pedidos do site.
  - A AbacatePay exige `https` no webhook, e o HTTPS automático do Caddy dispensa configurar e renovar certificado.
  - A loja ainda não tem conta na AbacatePay: a demonstração do dia 19 roda em produção com a chave de teste, e a
    simulação permite mostrar a compra paga sem um Pix de verdade. As duas travas impedem que ela exista com a chave
    da loja: simular numa conta real confirmaria uma venda sem dinheiro nenhum.
- **Impacto:** `app.ts` e `env.ts` (compartilhados), `gateway.ts`, `Dockerfile`, `docker-compose.prod.yml`,
  `Caddyfile`, `.env.producao.example`, `.gitignore`, `.dockerignore`, `scripts/dados-demo.ts` e `docs/deploy.md`.

### D-52 — Configuração: falhar cedo, sem padrões perigosos
- **Data:** 09/11/2026
- **Decisão:**
  - O `config/env.ts` valida o ambiente uma vez, quando é carregado. Faltou uma variável obrigatória → `Error`
    `Variável de ambiente obrigatória ausente: <NOME>. Veja o .env.example.` e o servidor não sobe. Ausente, vazia
    ou só com espaços contam igual. Nenhuma mensagem mostra o valor da variável.
  - `NODE_ENV` é obrigatória, sem padrão, e só aceita `development`, `test` ou `production`.
  - `DATABASE_URL` é obrigatória, sem padrão.
  - Só em produção também são obrigatórias `CORS_ORIGIN`, `FRONTEND_URL`, `API_URL`, `GATEWAY_ACCESS_TOKEN` e
    `GATEWAY_WEBHOOK_SECRET`; o segredo do webhook tem pelo menos 32 caracteres e `CORS_ORIGIN`, `FRONTEND_URL` e
    `API_URL` começam com `https://`.
  - Continuam com padrão: `PORT` (3333, em qualquer ambiente; se vier, precisa ser um número de 0 a 65535) e
    `CORS_ORIGIN` (`http://localhost:5173`, só fora de produção). `FRONTEND_URL`, `API_URL` e `GATEWAY_*` são
    opcionais fora de produção (sem token o gateway recusa a chamada; sem segredo o webhook recusa tudo).
    `EMAIL_API_KEY` e `EMAIL_REMETENTE` eram opcionais também em produção; desde o Lote 14a (D-54) são obrigatórias em
    produção.
  - Lote 13 (D-53): `FRONTEND_DIST` (opcional; definida, precisa ter o `index.html`) e `PERMITIR_SIMULACAO_PIX`
    (opcional; só `true` ou `false`, qualquer outro valor para o servidor na subida).
  - `npm test` e `npm run test:integration` definem `NODE_ENV=test` e uma `DATABASE_URL` que não aponta para
    banco nenhum (porta 1). A integração continua usando só o `TEST_DATABASE_URL` do PostgreSQL descartável.
  - `docker-compose.yml`: o Postgres é publicado só em `127.0.0.1`, e `DB_USER`, `DB_PASSWORD` e `DB_NAME` não
    têm padrão (o compose recusa rodar sem eles). `DB_PORT` mantém o padrão 5432.
  - `.env.example` lista todas as variáveis com placeholders; o `.gitignore` ignora `.env.*`, menos o `.env.example`.
- **Motivo:**
  - Sem `NODE_ENV`, o backend assumia `development`. Em produção isso imprimia no log o link de recuperação de
    senha (com o token), tirava o `Secure` do cookie `sid` e deixava o `trust proxy` desligado.
  - Sem `DATABASE_URL`, usava o banco local com a senha que está no GitHub; foi assim que o `test:integration`
    gravou no banco de dev.
  - Com a porta em `0.0.0.0`, qualquer máquina da mesma rede (Wi-Fi da faculdade, por exemplo) alcançava o banco,
    e com a senha padrão conhecida.
- **O que cada dev faz antes de puxar a main:**
  - Pôr no `backend/.env` `NODE_ENV=development` e, se ainda não tiver, `DB_USER`, `DB_PASSWORD` e `DB_NAME`
    **iguais aos que o banco usa hoje** (a senha fica gravada no volume na primeira criação; trocar o `.env` não
    troca a senha do banco). Quem nunca definiu usa os valores que eram o padrão antigo do compose.
  - Rodar `docker compose up -d db` uma vez: o container é recriado para pegar o `127.0.0.1`, o volume e os
    dados ficam. Nunca `db:reset` nem `down -v` para isso.
- **Impacto:** D-07 (cookie `Secure`), D-09 (recuperação de senha), D-21 (segredo do webhook), seção 9 do `api.md`.

### D-51 — `buscarParaVenda` trava só com executor, em ordem de id; 409 por `produtoId` vira contrato oficial
- **Data:** 05/11/2026 (ajustada em 05/11/2026 à criação de venda implementada no Lote 9, #30)
- **Decisão:**
  - `produtoService.buscarParaVenda(ids, executor?)` faz uma consulta só, com `ANY($1::integer[])`, sem filtrar
    `ativo` e em ordem de `id`.
  - **Sem executor** (cotação de frete, `POST /api/frete/calcular`, #28): consulta simples no pool, **sem trava**.
  - **Com executor** (client de `comTransacao`): acrescenta `FOR NO KEY UPDATE OF p`, na mesma ordem de `id` da
    `baixarParaVenda`; os produtos ficam travados até o COMMIT ou ROLLBACK. Só a tabela `produtos` é travada, não `categorias`.
  - A venda (`POST /api/vendas`, #30) lê o catálogo **uma vez só**: `buscarParaVenda(ids, client)`, dentro da
    transação, depois da trava do cliente, travando os produtos em ordem de id. O `preco_unitario` de `itens_venda`
    vem dessa leitura. A checagem rápida sem trava, antes da compra, é a cotação de frete (#28), que o carrinho chama
    antes; a venda não faz uma segunda leitura sem executor.
  - Repetidos são removidos antes da consulta. Lista vazia → `[]` sem ir ao banco. ID que não seja inteiro de 1 a
    2147483647, ou mais de 100 IDs depois de tirar os repetidos → `Error` comum (500), não `AppError`: o body é
    validado pela venda, que responde 422 antes de chamar.
  - A venda insere `vendas` e `itens_venda` (uma linha por produto, já somados) antes de chamar `baixarParaVenda`
    com os mesmos produtos e quantidades; a baixa confere isso e o status `aguardando_pagamento`.
  - O `409 'Estoque insuficiente'` da `baixarParaVenda` com `itens.<produtoId>.quantidade` e `itensIndisponiveis`
    (D-50) foi aceito pelo grupo como contrato oficial; a venda traduz para o índice do body quando precisar.
- **Motivo:**
  - Sem o lock, o admin pode mudar o preço ou desativar o produto entre a leitura e o COMMIT, e a venda gravaria um
    preço que já não vale ou venderia um inativo.
  - A mesma ordem e o mesmo modo de lock da `baixarParaVenda` evitam deadlock: com `FOR SHARE`, duas vendas do
    mesmo produto teriam o lock compartilhado e as duas esperariam uma pela outra ao subir para `NO KEY UPDATE` na baixa.
  - `NO KEY UPDATE` (e não `UPDATE`) não bloqueia as FKs que apontam para o produto, como `itens_venda`.
  - Sem transação a trava seria solta no fim do próprio SELECT, sem proteger nada; por isso a leitura sem executor
    não trava e não disputa lock com vendas e com o admin.
- **Impacto:** catálogo (implementado pelo Celio com o aval do Dev 2), vendas (#30), estoque (sem mudança).

### D-50 — Baixa e devolução de venda no mesmo PoolClient do Backend 2
- **Data:** 04/11/2026
- **Decisão desta tarefa:** aplicar D-16/D-21/D-26: baixa na criação, sem reserva separada; pagamento não
  debita novamente. B1 entrega baixarParaVenda(vendaId,itens,client) e estornarVenda(vendaId,client), Promise<void>.
  Só usa transação do chamador; B2 grava venda/itens/status/histórico e propaga erros até comTransacao.
- **Concorrência:** consolidar repetidos, validar contra itens persistidos, locks de produto por ID crescente,
  UPDATE condicional.409 identifica todos os IDs/quantidades solicitadas, sem saldo exato. Uma operação por
  venda/tipo, vários movimentos; retry igual no-op, diferente409. Compensação única vinculada à baixa original.
- **Devolução:** somente em cancelada, sem passagem por enviada/entregue. B2 muda estado e chama na mesma
  transação, após validar cancelamento não pago/expiração, ou aprovação do estorno financeiro para venda paga.
  cancelamento_solicitado não devolve; job de5min/TTL30min e corrida com webhook pertencem a B2.
  Quantidade vem da baixa imutável, nunca dos itens atuais. Produto inativo pode receber devolução sem reativar.
- **Schema:** nova migração002/SQL31, sem editar SQL30 aplicado. Unicidade no nível da operação e compensação,
  FKs e checks, integralidade diferida no COMMIT e proibição de anexar movimentos comerciais após confirmar.
  Cadastro zero, admin/abertura imutáveis e saldo reconciliável permanecem preservados.
- **Limite:** não implementa venda/checkout/pagamento/job nem aprova proposta de alocação separada do Ciclo3.
  Schema de B2 permanece intacto; apenas FKs/leitura de suas tabelas. Contrato e testes: [estoque por venda](estoque-vendas-2026-11-04.md).

### D-49 — Consultas administrativas distinguem saldo atual e histórico
- **Data:** 03/11/2026
- **Decisão:** implementar o caminho previsto `GET /api/estoque/:produtoId` e histórico em
  `GET /api/estoque/movimentacoes?produtoId=...&pagina=1&limite=20`, incluindo inativos e abertura legada.
  Sessão/admin atual, no-store e Vary Cookie também nos erros; GET segue política existente sem exigir Origin.
- **DTO:** saldo usa `saldoAtual`; movimento usa `saldoAnterior`/`saldoPosterior` históricos, operação, tipo,
  quantidade/delta, data, motivo e autorId técnico (null na abertura). Sem nome/e-mail, chave, hash ou sessão.
  Preserva o DTO histórico do POST, sem renomear seu saldoAtual.
- **Consulta:** produtoId obrigatório; paginação 1/20, teto 100, validação canônica e parâmetros fechados.
  Total e página compartilham snapshot SQL; ordem data/ID internos decrescentes. Inserções entre requisições
  podem deslocar páginas. A regra original de produto obrigatório foi ampliada em 15/11/2026, conforme abaixo.
- **Ampliação em 15/11/2026:** `produtoId` opcional, com consulta geral quando ausente; tipo fechado inclui os sete
  tipos reais (admin/abertura/venda), sem confundir tipo e origem. `de`/`ate` são timestamps com segundos e fuso
  explícito, normalizados UTC com até6 casas, intervalo `[de,ate)`, sem período oculto e com `de < ate`.
  Mesma paginação/DTO/404 para produto informado e inexistente. Snapshot em uma instrução parametrizada; JOIN
  de operação somente na página. Índice global data/ID via nova migração33, medido com EXPLAIN, sem editar30/31.
  Não cria movimentos nem modifica saldos/histórico/sessão. A lista geral de saldos foi entregue no incremento abaixo.
  Contrato, limitações e homologação: [ampliação das consultas](estoque-consultas-2026-11-15.md).
- **Listagem de saldos em 15/11/2026:** `GET /api/estoque` administrativo, sessão/papel atuais, no-store/Vary Cookie
  e HEAD. Envelope `{itens,total}` com o DTO individual de quatro campos. Filtros busca/categoria/ativo/em_estoque,
  quatro ordenações fechadas, padrão nome crescente com ID crescente como desempate, paginação1/20/teto100.
  Saldo lê diretamente produtos.estoque, disponível após baixa na criação da venda; inclui inativos por padrão.
  Busca nome com ILIKE e curingas literais; total e itens na mesma instrução/snapshot. Sem escrita/reconciliação,
  dados extras, novo índice ou migração (EXPLAIN medido). A antiga previsão abaixoDe não foi implementada.
  Evidências: [listagem de saldos](estoque-saldos-2026-11-15.md).
- **Limite:** nenhuma regra comercial do Ciclo 3 aprovada; não cria reserva, worker ou baixa por venda.
  Backend 2 combinado/testado somente em cópia isolada; sem merge definitivo.
- **Evidências:** [consultas e integração](estoque-leituras-integracao-2026-11-03.md).

### D-48 — Estoque administrativo com histórico e idempotência
- **Data:** 03/11/2026
- **Decisão:** `POST /api/estoque/movimentacoes` reutiliza sessão, admin atual e Origin; aceita somente entrada,
  ajuste_positivo, ajuste_negativo e saida, com quantidade positiva e motivo. Produto inativo pode receber
  movimento sem reativação. Cadastro zero, PATCH protegido e disponibilidade pública permanecem iguais.
- **Atomicidade:** comTransacao e executor obrigatório unem chave, saldo e movimento. UNIQUE por admin/UUID
  coordena replay; hash da intenção normalizada diferente resulta em 409. Lock de produto NO KEY UPDATE
  serializa com catálogo. Insuficiência/overflow não persistem efeitos. Replay retorna snapshot histórico, não saldo presente.
- **Migração:** SQL 30 é atômico e compartilhado por bootstrap/comando incremental; registra abertura sem
  alterar saldo preexistente. Reaplicação verifica reconciliação, sem duplicar abertura. Triggers impedem edição,
  exclusão e truncate do histórico/operações. Não usar reset em base com dados.
- **Limite:** não aprova nem implementa política de reserva/baixa de vendas do Ciclo 3. Sem alocações, worker,
  checkout ou pagamento. D-47 já pertence à troca de e-mail no remoto do Backend 2; não foi reutilizada.
- **Contrato e procedimento:** [estoque administrativo](estoque-admin-2026-11-03.md).

### D-46 — Vitrine de peixes independente do menu e paginada no servidor
- **Data:** 02/11/2026
- **Decisão:** lista/detalhe de peixes usam o próprio DTO, sem depender da consulta de metadados de categorias.
  A UI usa “Peixes” para o slug estrutural nesses atalhos; categorias do menu continuam vindo da API e
  falhas do menu permanecem visíveis. Não há fallback de produtos, fichas, preços ou disponibilidade.
- **Consulta:** adicionar `em_estoque=true|false` opcional à lista pública de peixes, como extensão ao PDF.
  Filtrar saldo antes de total/paginação, preservando ativo/categoria/ficha e ordem SQL nome/ID. Omitir o
  parâmetro mantém o contrato anterior. Home pede página 1/limite 3; não baixa todas as fichas para três cartões.
- **Motivo:** a revisão reproduziu categorias 500 bloqueando peixes 200 e 106 fichas transferidas para três
  destaques. API fora do ar é erro; catálogo sem peixe elegível é vazio legítimo. Estoque zero permanece zero.
- **Impacto:** Backend 1 e serviço público do frontend; sem alteração em autenticação, vendas ou schema.
  Preservar o redesign da home integrado no último pull. Testes HTTP/PG e E2E desktop/mobile cobrem vitrine,
  inelegíveis, paginação, indisponibilidade, retry e carregamento com respostas reais retidas.

### D-45 — Carrinho versionado guarda intenção e revalida pelo catálogo público
- **Data:** 31/10/2026
- **Decisão:** manter a chave `aquarilandia-carrinho`, migrar arrays legados para `{versao:2,itens:[{id,qtd}]}`.
  Não persistir preço, nome, imagem, estoque ou dados pessoais. Só IDs numéricos canônicos; não adivinhar ID
  de mock por nome/slug. Reconstruir cada item pelo detalhe público; ignorar totalmente os preços salvos.
- **Motivo:** o Ciclo 1 passou a usar centavos, mas snapshots antigos podiam ter IDs textuais, reais ou
  disponibilidade desatualizada. Total e compra não podem depender desse conteúdo arbitrário do navegador.
- **Impacto:** JSON malformado/dados inválidos têm aviso; duplicados são agrupados (limite visual 99, não saldo).
  Produto `404`/esgotado é removido com aviso. Falha de rede/5xx preserva IDs/quantidades para retry, sem preço
  fallback e com continuação bloqueada. Versão desconhecida é preservada até limpeza explícita. Leitura na
  abertura e retorno à aba reconsulta a API; desfazer também revalida. Sem checkout, venda, reserva ou movimento.
  O servidor de vendas deverá recalcular preço/estoque/permissões no futuro, independentemente do carrinho.

### D-44 — Inativos exigem leitura administrativa e reativação é uma operação explícita
- **Data:** 31/10/2026
- **Decisão:** `incluir_inativos=true` na lista/detalhe de produtos seleciona sessão/admin com papel atual,
  `401`/`403`, `no-store` e `Vary: Cookie`. Lista admite `ativo=false|true` apenas nesse modo, preservando
  filtros, paginação e total. DTO administrativo acrescenta somente `ativo`; público continua igual.
- **Motivo:** completar a consulta prevista no PDF sem ampliar as consultas públicas por um cookie ou
  misturar permissão com filtros. As indicações históricas de flag indisponível em D-34/35 foram superadas.
- **Reativação:** `POST /api/produtos/:id/reativar`, sem campos, sessão/admin/Origin. Extensão explícita deste
  ciclo, não uma rota já descrita pelo PDF. Retorna `200` tanto para inativo quanto já ativo; repetição não
  escreve. Inexistente `404`, ID/body/query inválido `400`; PATCH comum continua rejeitando `ativo` e inativos.
- **Concorrência:** transação compartilhada + lock por ID inclusive inativo. Reativa só `ativo` e timestamp,
  preservando preço/ficha/imagem/saldo/FKs/histórico. Serializa com DELETE/PATCH/reativar; última escrita
  serializada define estado. Peixe sem ficha continua fora dos atalhos. Sem migração de schema ou movimentação de estoque.
- **Frontend:** não há painel administrativo existente; não criar um novo. Ciclo 1 permanece integrado às
  consultas públicas. Detalhes e exemplos atuais em `api.md`, testes HTTP/PG reais e relatório do Ciclo 2.

### D-43 — Homologação conjunta isolada e logs mínimos de erros inesperados
- **Data:** 31/10/2026
- **Decisão:** homologar a árvore já combinada da main em branch/worktree de revisão, preservando a original.
  Não repetir a integração da branch-backend-2, já contida na main. Manter os contratos de catálogo e o POST
  público de orçamentos com Origin; público não exige sessão, mas não dispensa o controle CSRF.
- **Motivo:** a revisão confirmou que o HTTP ocultava detalhes de falhas que ainda eram copiados integralmente
  ao console. Handler, pool e falhas inesperadas do script criar-admin usam um helper de mensagem fixa,
  contexto fechado e código no formato SQLSTATE, sem mensagem, stack, SQL, parâmetros ou propriedades
  arbitrárias do erro. O script imprime só o ID criado. Sem biblioteca de logging ou nova infraestrutura.
- **Impacto:** testes HTTP/PG de sessão, revogação, limites, proxy, CORS e erros; exemplos só com dados fictícios.
  `trust proxy=1` permanece condicionado a um proxy confiável e acesso direto bloqueado; topologia real não
  foi presumida nem configurada nesta tarefa. Limitação do diagnóstico e riscos restantes no relatório do Ciclo 0.

### D-42 — DELETE de produto desativa com preservação e concorrência atômica
- **Data:** 30/10/2026
- **Decisão:** `DELETE /api/produtos/:id` exige sessão válida, papel atual de admin e Origin do catálogo.
  Segue D-13/PDF: uma escrita parametrizada muda somente `ativo=false` e `atualizado_em`, com sucesso `204`
  sem corpo. Inexistente ou já inativo retorna `404`; uma repetição não escreve de novo. ID inválido é `400`.
- **Motivo:** preservar fichas, saldo, preço, imagem e FKs/cópias de vendas, sem implementar estoque ou exclusão física.
  O `UPDATE ... WHERE ativo` reavalia o estado após esperar o lock do PATCH/DELETE concorrente. Se PATCH confirma
  primeiro, sua edição é preservada; se DELETE confirma primeiro, PATCH retorna `404`. Dois DELETEs: um `204`, outro `404`.
- **Impacto:** controller/service/repository e rota do catálogo; sem schema novo ou consultas administrativas de
  inativos/reativação. Corpo/query não alteram campos; ID do caminho é a fonte do alvo. Erros seguem o padrão local.
  Leitura pública e total deixam de incluir o inativo após commit, inclusive peixes. Frontend deve tratar 204 sem JSON.
  A escrita única é atômica no PostgreSQL e não requer transação de múltiplas instruções. Testes reais verificam
  11 fichas, histórico de venda, falhas e concorrência, usando banco descartável. A homologação prévia do parser
  executou 228 testes/9 suítes, sem ignorados; detalhes e riscos de integração remota no relatório de 30/10.

### D-41 — Leitura de orçamentos exige sessão e papel atual de admin
- **Data:** 26/10/2026
- **Decisão:** manter o POST de criação público e colocar uma guarda comum `autenticar, exigirAdmin` depois
  dele no router de orçamentos. GET/HEAD da lista e demais caminhos do módulo exigem sessão válida (`401`)
  e papel atual de admin (`403` para cliente), consultados a cada requisição pelo mecanismo existente.
- **Motivo:** corrigir a exposição confirmada de nome, telefone e mensagem, sem depender de CORS/frontend
  e sem reimplementar autenticação ou o restante do CRUD do outro responsável.
- **Impacto:** lista continua array em memória, mas projeta somente ID/data/nome/telefone/serviço/mensagem
  e envia `Cache-Control: no-store`. Erros não incluem a lista nem detalhes de sessão. Detalhe, PATCH de
  status/resposta e DELETE permanecem ausentes (`404` para admin), já atrás da guarda. Futuras escritas
  administrativas deverão adicionar `exigirOrigem`; este incremento não cria handlers de alteração.
  Formato paginado do PDF, persistência, filtros e rate limit continuam pendentes. Testes HTTP/PG verificam
  visitante, cliente, admin, troca de papel, sessão revogada/inativa/vencida e preservação da criação pública.
  A correção em orçamentos foi explicitamente autorizada pelo responsável nesta rodada, preservando o PATCH
  de produtos e as implementações de autenticação/catálogo. Detalhes em `api.md`; achado S-01 atualizado.

### D-40 — PATCH de produto e ficha com categoria fixa e estado final validado
- **Data:** 26/10/2026
- **Decisão:** o PATCH usa sessão/admin/Origin do POST e aceita somente nome, descrição, marca, preço e
  `ficha: { dados: { ... } }`. Categoria, `ficha.tipo`, ID, ativo, estoque e imagem são protegidos, mesmo se
  enviados com o mesmo valor. Omitidos permanecem; `null` só limpa campos anuláveis. Não há remoção de ficha.
- **Motivo:** editar produto e ficha juntos sem sobrescrever campos de outra edição. `FOR NO KEY UPDATE`
  serializa edições sem bloquear leituras de FK; categoria usa `FOR SHARE`. O estado é consultado após o lock,
  combinado com o corpo e validado pelas regras existentes das 11 categorias. SQL grava só os campos enviados.
- **Impacto:** transação inclui atualização de timestamp e DTO final; falhas e duplicidade científica desfazem
  tudo. Sucesso `200`, inativos/inexistentes `404`, inválidos `400`, duplicidade `409`, erro inesperado `500`.
  Legados especializados sem ficha exigem preenchimento completo para reparar o estado pelo PATCH; leituras
  antigas seguem permitindo `ficha: null`. Num mesmo campo vence a última edição serializada, sem `If-Match`.
  Contrato em `api.md`. Sem schema, DELETE, imagens, movimentações, frontend ou alterações em auth/orçamentos.
  Parser compartilhado passa a explicitar 100 KiB e responder `413` sem logar o corpo. Descompressão foi
  desabilitada (`415`) como mitigação oficial do alerta body-parser, mantendo dependências/lockfile.
  Falhas de outros módulos e riscos de configuração estão separados em
  [`seguranca-backend-2026-10-26.md`](seguranca-backend-2026-10-26.md), sem serem declarados resolvidos.

### D-39 — Cadastro transacional de produto e ficha, com estoque inicial zero
- **Data:** 25/10/2026
- **Decisão:** `POST /api/produtos` reutiliza sessão/admin/Origin de categorias. Recebe `categoriaId`, `nome`,
  preço inteiro em centavos, descrição/marca opcionais e `ficha: { tipo, dados }`. As 11 categorias com tabela
  exigem sua ficha completa obrigatória; categorias sem tabela aceitam ficha ausente/nula. A categoria vem do
  banco com `FOR SHARE`, para seu discriminador não mudar entre validação e gravação.
- **Motivo:** produto e ficha devem confirmar juntos, sem cadastro paralelo de peixes. O helper compartilhado
  `comTransacao`, até então somente documentado, foi implementado. INSERTs e leitura do mesmo DTO público
  usam o client transacional. Falha provoca rollback; falha de rollback descarta a conexão.
- **Impacto:** limites/defaults/enums/nulos seguem o schema; casas decimais excedentes não são arredondadas.
  `201` devolve o mesmo detalhe público existente. Categoria inexistente/incompatível e dados inválidos são `400`;
  duplicidade de nome científico é `409` e não deixa produto órfão. Erros seguem o formato local, diferente do PDF.
  Estoque inicial é sempre zero; `estoque` explícito aceita somente `0`. Entradas positivas dependerão de movimento
  rastreável pelo futuro módulo de estoque (motivo, responsável, movimento e saldo na mesma transação).
  Não altera baixa de estoque/vendas: PDF e D-16/D-21 ainda divergem nesse ponto, exigindo decisão conjunta.
  Não muda schema, frontend ou login, nem implementa PATCH/DELETE de produtos. DTO/regras em `api.md` e comparação
  do pull/trabalho local em [`revisao-pull-cadastro-produtos.md`](revisao-pull-cadastro-produtos.md).
  A configuração CORS compartilhada passa a emitir `credentials: true` com a mesma origem fixa, corrigindo
  a divergência de implementação com o contrato de sessão por cookie; preflight tem teste HTTP.

### D-38 — Categorias com leitura por ID e escritas administrativas persistentes
- **Data:** 25/10/2026
- **Decisão:** detalhe público por ID e POST/PATCH/DELETE somente com a sessão existente e papel atual `admin`.
  Os middlewares novos `exigirAdmin` e `exigirOrigem` complementam `autenticar`; exigem `Origin = CORS_ORIGIN`
  nas três escritas, conforme a convenção CSRF local. Sem sessão válida retorna `401`; sem permissão, `403`.
- **Motivo:** completar o contrato sem refazer autenticação. O DTO continua `{ id, nome, slug }`; validações de
  ID/corpo usam `400`, preservando o formato local de erros em vez de migrar globalmente para o do PDF.
  Nome e slug são validados com os limites do schema. As constraints únicas resolvem duplicidades com `409`.
- **Impacto:** exclusão física somente sem produtos; `produtos_categoria_id_fkey` protege inclusive contra
  vínculos inativos e concorrentes, traduzindo a violação para `409`. Não há consulta prévia como única proteção.
  Os 11 slugs usados como discriminadores de ficha não podem ser renomeados (`409`, condição no UPDATE), mas
  seus nomes podem mudar; outras categorias permitem editar ambos. Isso preserva detalhes/filtros/atalhos de
  peixes sem reorganizar seu modelo. O PDF não fixa essa regra; renomear slugs estruturais exige evoluir os
  mapeamentos em outra tarefa. DELETE continua permitido sem vínculos, inclusive nessas categorias.
  Contrato completo em `api.md`, com exceções ao soft delete/validação `422` genéricos. Sem mudança de schema,
  frontend, login ou CRUD de produtos. Sessões, permissões, concorrência e regressões têm testes no PostgreSQL.

### D-37 — Filtros técnicos de produtos por categoria e ficha existente
- **Data:** 25/10/2026
- **Decisão:** os filtros técnicos do PDF restringem as categorias aplicáveis, exigem ficha e combinam-se por
  interseção com os filtros gerais. Usam `EXISTS` parametrizados para não duplicar produtos; total, paginação,
  ordenação estável, DTO público e exclusão de inativos são preservados.
- **Motivo:** o PDF usa conceitos que nem sempre têm coluna direta. `tipo_agua` em aquários/rações/condicionadores
  inclui `ambos` em consultas doce/marinho; salobra fica restrita aos peixes. Decorações têm somente
  `seguro_marinho`: doce é o padrão da consulta, marinho exige a flag e salobra não é inferida.
  `indicado_plantado` é a classificação `tipo = 'fertil'`, sem usar `altera_ph`; `false` seleciona outros tipos.
- **Impacto:** ambiguidades e regras completas em `api.md`. Intervalos de volume/vazão são inclusivos;
  valores inválidos/faixas invertidas retornam `400`, enquanto interseções válidas vazias retornam `200` vazio.
  Sem mudança de schema, detalhes, atalhos de peixes, frontend ou liberação administrativa de inativos.

### D-36 — Peixes como atalhos persistentes de produto com ficha
- **Data:** 25/10/2026
- **Decisão:** `/api/peixes` e `/api/peixes/:id` exigem produto ativo, categoria `peixes` e ficha existente.
  Compartilham ID, projeções públicas e ficha com produtos. Lista `{ itens, total }`, paginação 1/20 (teto 100)
  e ordem nome/ID. Filtros seguem o PDF, com faixas inclusivas de temperatura/pH e limites de tamanho/volume.
- **Motivo:** cumprir os atalhos de leitura sem criar outro cadastro ou inventar ficha ausente. Produto sem
  ficha não aparece no catálogo de peixes e retorna `404` nesse detalhe; o produto genérico mantém `ficha: null`.
- **Impacto:** filtros parametrizados e DTO completo documentados em `api.md`; só os mocks de peixes do backend
  foram removidos, após conferir seus consumidores. O frontend mantém seus dados locais. Projeções SQL e ID
  são compartilhados com produtos; comportamentos de categorias/produtos são preservados por regressão.
  Sem migração de schema, cadastro ou filtros técnicos gerais de produtos. Erros mantêm o formato local.

### D-35 — Detalhe de produto com ID numérico e ficha da categoria
- **Data:** 25/10/2026
- **Decisão:** `GET /api/produtos/:id` usa o mesmo ID numérico e DTO básico da listagem, acrescentando
  `ficha: { tipo, dados } | null`. A consulta seleciona somente produto ativo e a ficha correspondente à
  categoria vinculada no banco, com campos explícitos em camelCase para as 11 tabelas especializadas.
- **Motivo:** cumprir o detalhe com ficha previsto no PDF sem criar restrições que o schema ainda não exige.
  Acessórios e produtos sem linha de detalhe retornam `200` com `ficha: null`; cadastro completo será tratado
  no futuro CRUD. Não há fallback para arrays nem seleção de outra ficha por parâmetros do cliente.
- **Impacto:** removidos o mock de produtos do backend e seu tipo antigo; o frontend mantém seus próprios dados.
  Inativos/inexistentes retornam `404`, IDs malformados retornam `400` e falhas de banco seguem o `500` genérico.
  O formato de erro local é preservado, divergência documentada em `api.md`. Listagem, schema e rotas de peixes
  não são migrados por este incremento; testes verificam todas as fichas e a coerência listagem/detalhe.

### D-34 — Listagem pública de produtos persistente e restrita a ativos
- **Data:** 25/10/2026
- **Decisão:** `GET /api/produtos` retorna `{ itens, total }` do PostgreSQL, com paginação 1/20 (teto 100),
  filtros gerais do PDF por slug, busca, faixa de preço em centavos e ordenação fechada por nome/preço.
  Toda ordenação desempata por `id`; total e página são calculados no mesmo snapshot e excluem inativos.
- **Motivo:** implementar o próximo corte do contrato, sem migrar a consulta individual nem fichas.
  Os textos de busca usam comparação parcial sem distinguir caixa e escapam os curingas como texto literal.
- **Impacto:** controller/service/repository/types de produto em `modulos/catalogo`, somente para listagem.
  O DTO público é documentado em `api.md`; a disponibilidade é apenas uma projeção de `estoque > 0`.
  `incluir_inativos=true` é recusado com `400`, até existir autorização administrativa compartilhada.
  Os erros permanecem no formato existente. O frontend não consome a rota e continua nos mocks; o detalhe
  legado também continua com ID textual e preço em reais, incompatibilidade explícita para o próximo incremento.

### D-33 — Categorias persistentes com paginação e envelope do PDF
- **Data:** 25/10/2026
- **Decisão:** `GET /api/categorias` consulta a tabela `categorias`, retorna `{ itens, total }` com
  itens `{ id, nome, slug }` e ordena por `id`. Query `pagina`/`limite` com padrões 1/20 e teto local de 100.
- **Motivo:** o incremento foi explicitamente solicitado com o contrato de listas do
  [`API_Aquarilandia_Rotas.pdf`](../../API_Aquarilandia_Rotas.pdf), páginas 1–2. Ele diverge da exceção anterior
  de array simples em `api.md`; a alteração vale somente para categorias. O formato de erros permanece o da
  API existente (`AppError`/`errorHandler`), sem a migração global para `erro`/`mensagem` proposta no PDF.
- **Impacto:** apenas categorias ganham controller/service/repository em `modulos/catalogo`; o restante do
  catálogo não é reorganizado. O frontend ainda usa seu array local e não consome a rota. A consulta calcula
  página e total no mesmo snapshot, inclusive para páginas vazias. Sem mudança no schema ou nos seeds.

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
- **Impacto:** módulos `auth` e `clientes`. O script `criar-admin` foi integrado pelo Backend 2 e consta no `package.json` da versão combinada; não é uma rota HTTP.

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
- **Data:** 19/10/2026 (atualizado em 03/11/2026: implementada na #19b e na #19c, com os detalhes abaixo)
- **Decisão:** a recuperação de senha por e-mail entra na entrega de 19/11. Contrato no `api.md` (seções 6 e 11):
  - `POST /api/auth/esqueci-senha` responde **sempre** `202` com a mesma mensagem, exista a conta ou não. Só fogem
    disso o `422` de formato do e-mail, o `403` de `Origin` e o `429`, e nenhum deles depende de a conta existir.
    Só conta ativa e não anonimizada recebe link;
  - o link é `<FRONTEND_URL>/redefinir-senha?token=<token>`, com um token aleatório de 32 bytes (`gerarToken`,
    43 caracteres base64url). O banco guarda **só o hash** SHA-256; o token inteiro existe apenas no e-mail. Vale
    **30 minutos**, contados pelo relógio do banco;
  - pedir um link novo apaga os anteriores do cliente. Redefinir a senha grava a senha nova e apaga **todos** os
    tokens e **todas** as sessões dele na mesma transação, e é isso que torna o link de **uso único**. Trocar a
    senha logado (`PATCH /me/senha`) e trocar o e-mail (D-47) também apagam os links pendentes;
  - qualquer problema no link (inventado, fora do formato, vencido, já usado, conta desativada ou anonimizada)
    responde `400` "Link inválido ou expirado.", sem dizer o motivo;
  - limites: no esqueci-senha, 3 pedidos por hora por IP **e** 3 por hora por e-mail; no redefinir-senha, 10 por
    hora por IP. Todos contam também os pedidos que deram certo;
  - o e-mail sai **depois do COMMIT e sem esperar** o provedor, para o tempo de resposta não revelar quem tem conta.
    Falha no envio vira só `[esqueci-senha] falha ao enviar e-mail` no log, sem o e-mail nem o token;
  - as travas seguem a ordem das outras operações da conta: primeiro o cliente, depois o token (sem deadlock);
  - sem `FRONTEND_URL`, nenhum token é criado (log `[esqueci-senha] FRONTEND_URL ausente`) e a resposta continua
    `202`;
  - **provedor (D-54, desde 14/11/2026): Resend.** Sem a chave, em desenvolvimento, o e-mail aparece no terminal
    (`[email:dev]`, com o link e o token, só para testes locais). Uma falha do provedor não muda a resposta: continua
    `202` (o token fica no banco até vencer ou até o próximo pedido);
  - sem limpeza periódica de tokens vencidos na entrega de 19/11: ficam até o cliente pedir outro link, redefinir
    a senha, trocar a senha ou o e-mail, ou ser anonimizado.

  A senha temporária gerada pelo admin foi descartada.
- **Motivo:** sem recuperação, um cliente que esquece a senha perde o acesso à conta; o fluxo por e-mail não depende
  de atendimento manual. A resposta sempre igual e o envio sem espera não deixam o formulário virar um teste de
  "quem tem conta"; o limite por e-mail impede encher a caixa de entrada de alguém trocando de IP.
- **Impacto:** tabela `tokens_recuperacao_senha`, coluna `trocar_senha` removida, `utils/email.ts` (compartilhado),
  `middlewares/rateLimit.ts` (compartilhado), duas telas novas no frontend ("esqueci minha senha" e "criar senha
  nova", na rota `/redefinir-senha`, que lê o `token` da URL).

### D-47 — Senha atual para trocar o e-mail
- **Data:** 03/11/2026 (decisão do grupo)
- **Decisão:**
  - `PATCH /api/clientes/me` passa a exigir `senhaAtual` (sem `trim`) quando o `email` enviado é **diferente** do
    atual, comparado já normalizado. Mandar o próprio e-mail (inclusive em maiúsculas), ou só nome e telefone,
    continua sem senha;
  - sem `senhaAtual` → `422` "Digite sua senha atual para trocar o e-mail."; errada (ou com mais de 128 caracteres)
    → `422` "Senha atual incorreta.". A senha é conferida **antes** do `409` de e-mail em uso;
  - a troca roda numa transação: trava o cliente, grava o e-mail e **apaga os links de recuperação pendentes**
    (o link mandado ao e-mail antigo deixa de valer);
  - depois do COMMIT, um aviso "Aquarilândia: seu e-mail foi alterado" vai para o e-mail **antigo**, sem mostrar
    o e-mail novo e sem link, sem esperar o provedor;
  - limite: só quando o body traz `email`, o PATCH passa pelo `limiteTrocaSenha` (5 erros em 15 minutos por IP),
    o mesmo contador da troca de senha e do apagar conta.
- **Motivo:** sessão roubada + recuperação de senha = conta roubada. Quem rouba o cookie troca o e-mail para um seu,
  pede "esqueci a senha" e fica com a conta de vez, sem nunca saber a senha. Pedir a senha atual fecha esse caminho;
  o aviso no e-mail antigo dá ao dono a chance de reagir; apagar os links impede que um link já enviado continue
  valendo para o endereço que não é mais da conta.
- **Impacto:** módulos `clientes` e `auth`; no frontend, a tela de dados da conta precisa do campo de senha atual
  quando o e-mail muda.

---

## Vendas e estoque

### D-10 — Compra pelo site, com entrega
- **Data:** 15/10/2026 (atualizado em 02/11/2026: retirada confirmada, conforme a D-29)
- **Decisão:** a compra é feita pelo próprio site, com entrega dos produtos. A retirada na loja está **confirmada**
  pela loja, com frete zero (`tipo_entrega = 'retirada'` e status `pronta_retirada`), conforme a D-29.
- **Motivo:** é o fluxo pedido pela loja; deixar a retirada pronta no schema evitou migração depois.
- **Impacto:** módulo `vendas`; regras de entrega na D-29.

### D-11 — Status da venda
- **Data:** 15/10/2026 (atualizado em 19/10/2026; alterada em 02/11/2026 no Lote 5, conforme a revisão de 24/10)
- **Decisão:** a lista de status é a do `DOMAIN status_venda` em `db/init/20_vendas.sql`, usada em `vendas.status`
  e no `historico_status_venda`:
  `aguardando_pagamento`, `paga`, `em_separacao`, `enviada`, `pronta_retirada`, `entregue`,
  `cancelamento_solicitado`, `cancelada`.
  ```
  aguardando_pagamento → paga → em_separacao → enviada → entregue          (correios / propria)
  aguardando_pagamento → paga → em_separacao → pronta_retirada → entregue  (retirada)
  aguardando_pagamento → cancelada                                          (venda não paga)
  paga / em_separacao / pronta_retirada → cancelamento_solicitado → cancelada   (estorno em andamento ou pendente)
  ```
  Não existe caminho direto de `paga`, `em_separacao` ou `pronta_retirada` para `cancelada`: toda venda paga passa
  por `cancelamento_solicitado`. Quem pode fazer cada transição está em `modulos/vendas/venda.transicoes.ts` (#29).
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
  - `produtoService.buscarParaVenda(ids, executor?)` → `ProdutoVenda[]` (`id`, `nome`, `preco`, `ativo`, `categoria`);
    retorna só os encontrados, inclusive inativos; quem chama decide o erro do id faltando (D-25). Com o client da
    transação, trava os produtos até o COMMIT (D-51).
  - `estoqueService.baixarParaVenda(vendaId, itens, client)` → baixa atômica (D-26); lança
    `409 'Estoque insuficiente'` com IDs/quantidades solicitadas em `itens.<produtoId>.quantidade` (D-50), sem saldo exato.
    Aceito pelo grupo como contrato oficial em 05/11/2026 (D-51).
  - `estoqueService.estornarVenda(vendaId, client)`.
  - `servicoService.listarOpcoes()` para os orçamentos (D-27).
  - `ItemMovimento` = `produtoId` + `quantidade`. `ProdutoVenda` e `ItemMovimento` ficam em `types/index.ts`.
  - Fluxo do `POST /api/vendas`: valida o body → `buscarParaVenda` (sem executor) confere se todos existem e estão
    ativos → calcula o frete → `comTransacao` chama `buscarParaVenda` de novo com o client (preço do snapshot vem
    daqui), insere `vendas` e `itens_venda` e chama `baixarParaVenda` → qualquer erro desfaz tudo (D-51).
- **Motivo:** cada dev mexe só nas próprias tabelas; a baixa de estoque fica na mesma transação da venda.
- **Impacto:** vendas (Celio), catálogo e estoque (Dev 2).

### D-16 — Estoque baixado na criação; venda não paga expira em 30 minutos
- **Data:** 15/10/2026 (aplicação do contrato interno em 04/11/2026, D-50; tarefa ligada em 09/11/2026, #32;
  reconsulta do Pix antes de cancelar em 14/11/2026, Lote 11)
- **Decisão:** o estoque é baixado quando a venda é criada. Venda em `aguardando_pagamento` vence em 30 minutos
  (`vendas.expira_em`, default `now() + interval '30 minutes'`): uma tarefa agendada do módulo `vendas` cancela a
  venda e chama `estoqueService.estornarVenda`.
- **Integração:** a tarefa **já está ligada** (`venda.tarefas.ts`, iniciada pelo `server.ts`): a cada 5 minutos,
  sem tolerância geral adicional depois do vencimento, cancela e devolve o estoque na mesma transação, venda por venda. Sem
  reserva separada. Desde o Lote 11, antes de cancelar uma venda com Pix pendente ela **reconsulta** a cobrança no
  gateway (o mesmo `processarCobranca` do webhook): pago → a venda vira `paga` em vez de cancelada. Gateway fora → não
  cancela nesta rodada, a não ser que a venda tenha vencido há mais de 1 hora (aí cancela, e um Pix pago depois vira
  devolução, D-21).
- **Motivo da reconsulta:** o Pix vence junto com a venda, mas o aviso da AbacatePay pode chegar atrasado
  ou se perder; sem ela, uma venda paga no último minuto seria cancelada. O limite de 1 hora impede que um gateway
  fora do ar segure o estoque para sempre.
- **Revisão de 14/11/2026:** cinco minutos é periodicidade, não tolerância além de expira_em. A seleção é só
  de candidatos: estado e prazo são revalidados depois de obter o lock, usando clock_timestamp no mesmo client.
  Nenhuma nova política de reserva; helpers, schema e unicidade por operação preservados. Histórico de homologação e patch
  adicional: [integração estoque/vendas](integracao-estoque-vendas-2026-11-14.md).
- **Após o pull de 14/11/2026:** criação, cancelamento e pagamento de B2 estão nesta branch. A exceção financeira
  de retenção sob falha de reconsulta/corte de uma hora foi preservada e permanece pendente de aprovação conjunta.
- **Consolidação B1:** correções de expiração/revalidação e testes em worktree baseada na main atual;
  nenhuma nova regra financeira ou correção de pagamentos foi incorporada. Ver
  [consolidação do Backend 1](consolidacao-backend1-2026-11-14.md). Os registros anteriores permanecem históricos.
- **Motivo:** o cliente não paga por um produto que acabou enquanto estava no checkout; o estoque preso volta sozinho.
- **Impacto:** vendas (tarefa agendada, usa `idx_vendas_expira_em`), estoque.

### D-17 — Cancelamento direto pelo cliente até antes do envio
- **Data:** 15/10/2026 (atualizado em 19/10/2026; alterada em 02/11/2026 no Lote 5, conforme a revisão de 24/10;
  implementada em 14/11/2026 no Lote 12, #35)
- **Decisão:** o cliente cancela a própria venda em `POST /api/vendas/:id/cancelar` enquanto ela não foi enviada,
  com estorno automático se já estiver paga (D-22). Não existe "solicitar cancelamento" para o admin aprovar.
  O status `cancelamento_solicitado` significa "estorno em andamento ou pendente" (não só "o gateway falhou"):
  toda venda paga cancelada passa por ele. Enquanto a venda está nele, nenhuma outra transição é permitida, só a
  conclusão para `cancelada`, que é sempre registrada como `sistema` (ou `admin`, só depois de 5 tentativas de
  estorno, D-22).
- **Implementação (14/11/2026, Lote 12):** a mesma rota serve o cliente (só a própria venda; outra → 404) e o admin
  (qualquer venda), com `{ motivo }` opcional para o histórico. `aguardando_pagamento` → `cancelada` na hora (o
  estoque volta e o Pix pendente vira cancelado); `paga`, `em_separacao` e `pronta_retirada` → os três passos da D-22;
  `enviada`, `entregue` e `cancelada` → 409. Em `cancelamento_solicitado`, o cliente recebe 409 e o admin só conclui
  depois das 5 tentativas, com o motivo. O status é lido com a venda travada, e toda mudança passa pelo
  `podeTransicionar`. Depois do COMMIT, o cliente recebe o e-mail de compra cancelada.
- **Motivo:** depois de enviada, o produto já saiu da loja; com o estorno automático, não há pedido para o admin
  aprovar.
- **Impacto:** rotas de vendas; tela de "minhas compras" no frontend; pagamentos.

### D-25 — Campo `categoria` no `ProdutoVenda`
- **Data:** 19/10/2026
- **Decisão:** `ProdutoVenda` passa a ter `categoria` (`categorias.slug`).
- **Motivo:** necessário para a regra de entrega de peixe vivo (D-29) na criação da venda.
- **Impacto:** catálogo (Dev 2).

### D-26 — Baixa de estoque atômica
- **Data:** 19/10/2026 (implementado em 04/11/2026, D-50)
- **Decisão:** `baixarParaVenda` faz `UPDATE produtos SET estoque = estoque - $1 WHERE id = $2 AND estoque >= $1`;
  se nenhuma linha for afetada, lança `409 'Estoque insuficiente'`.
- **Motivo:** evita vender o último item duas vezes em compras simultâneas e devolve 409 em vez de erro do banco
  (o `CHECK (estoque >= 0)` fica só como rede de segurança).
- **Implementação:** itens repetidos consolidados, locks por ID crescente, operação+movimentos ligados à venda,
  constraints de integralidade; erro propagado desfaz também venda/itens. Mais de um produto por operação permitido.
- **Impacto:** estoque (Dev 2).

### D-28 — "Avise-me quando chegar"
- **Data:** 19/10/2026
- **Decisão:** responsabilidade do Dev 2 (catálogo/estoque). Para 19/11 o pedido de aviso é salvo e a loja vê a
  lista no painel; o e-mail automático entra depois. O serviço de e-mail (`utils/email.ts`) entra na entrega (D-09),
  mas os e-mails de boas-vindas e o aviso de chegada ficam fora por decisão de escopo, não por falta de
  infraestrutura. **Atualizado em 14/11/2026:** os e-mails de mudança de status da venda entraram (Lote 12, D-24, D-54);
  o aviso de chegada continua com o Dev 2 (achado R-05 da revisão de base: ainda não existe no backend).
- **Motivo:** o aviso depende do estoque, e esses e-mails estão fora do escopo da entrega de 19/11 (D-24).
- **Impacto:** catálogo e estoque (Dev 2); painel do admin no frontend.

### D-29 — Regras de entrega
- **Data:** 19/10/2026 (atualizado em 02/11/2026, com as regras combinadas com a loja em 24/10/2026)
- **Decisão:** as regras abaixo estão confirmadas; só os **valores** continuam provisórios.
  - entrega para **todo o Brasil**: São João del Rei com entrega própria (`tipo_entrega = 'propria'`) e o resto
    pelos Correios (`'correios'`), por faixas de CEP;
  - **peixe vivo** (produto da categoria de slug `peixes`) só é entregue em São João del Rei; fora dela, `422` com
    um detalhe por item de peixe;
  - **retirada na loja** com frete zero (status `pronta_retirada`), inclusive com peixe;
  - os valores de `modulos/vendas/frete.config.ts` são **PROVISÓRIOS** até a loja responder. Falta: o preço e o
    prazo para o resto do Brasil, o valor e o prazo locais (São João del Rei) e se haverá frete grátis (e a partir
    de que valor). Hoje: R$ 10,00 e 1 dia em São João del Rei, de R$ 25,00 a R$ 55,00 no resto do Brasil, sem
    frete grátis;
  - a regra fica em `calcularFrete` (`modulos/vendas/frete.service.ts`, função pura, #27).
- **Motivo:** permite implementar e testar o frete sem esperar os valores; quando a loja responder, só o
  `frete.config.ts` muda.
- **Impacto:** módulo `vendas` (`POST /api/frete/calcular`, `vendas.frete`, `prazo_entrega_dias`, `tipo_entrega`).

---

## Pagamento

### D-18 — Pix transparente, sem página do gateway
- **Data:** 15/10/2026 (alterada em 02/11/2026, #43: Pix transparente no lugar da página hospedada)
- **Decisão:**
  - Começa só com **Pix transparente**: o backend cria a cobrança na AbacatePay com o valor em centavos e recebe o
    código Pix (copia e cola) e a imagem do QR code; o cliente paga no app do banco, sem sair do site.
  - A cobrança vai **sem `customer`** (D-31: não coletamos CPF).
  - Cartão fica para depois. Quando entrar, o número do cartão continua sem passar pelo nosso servidor: o
    navegador gera um token com o script da AbacatePay e o backend só cobra com esse token.
  - O requisito "página de pagamento hospedada" deixa de valer.
- **Motivo:** o checkout hospedado da AbacatePay exige produtos cadastrados nela e calcula o total por eles: não
  aceita o frete nem um valor livre. O Pix transparente cobra exatamente o total da venda.
- **Impacto:** módulo `pagamentos`; a #44 responde o código Pix e a imagem do QR code ao frontend (`api.md`,
  seção 8).

### D-19 — Gateway: AbacatePay (API v2)
- **Data:** 15/10/2026 (atualizado em 19/10/2026; gateway escolhido em 02/11/2026; Pix transparente em 02/11/2026)
- **Decisão:**
  - **AbacatePay, API v2**, escolhida pelo grupo em 02/11/2026.
  - Começa com **Pix**; cartão fica para depois.
  - Checkout **transparente**, só Pix por enquanto (D-18, definido na #43 em 02/11/2026); o hospedado foi descartado.
  - Desenvolvimento na conta de teste do dev, em **Dev mode**. Produção na conta da loja, com o CNPJ ou CPF e a
    conta bancária dela (**pendente**; necessária para o deploy, #66).
  - Credenciais só nas variáveis `GATEWAY_ACCESS_TOKEN` e `GATEWAY_WEBHOOK_SECRET`, nunca no Git.
- **Motivo:** fecha a pendência do gateway (o prazo anterior era 29/10/2026); a conta da loja continua necessária
  para receber os pagamentos em produção.
- **Impacto:** toda a parte de pagamento. O banco usa nomes genéricos (`gateway_*`) e a coluna `pagamentos.gateway`
  registra qual gateway foi usado; o código do gateway fica isolado em `modulos/pagamentos/gateway.ts` (D-20).

### D-20 — Código do gateway isolado em `gateway.ts`
- **Data:** 15/10/2026 (atualizado em 02/11/2026, #43)
- **Decisão:** toda chamada ao gateway fica num único arquivo, `gateway.ts`, dentro do módulo `pagamentos`.
  - **fetch nativo do Node, sem SDK** (nenhum pacote novo), com **timeout de 5 s** em toda chamada;
  - **tipos próprios** do projeto na interface (`cobrancaId`, `codigoPix`, `qrCodeImagem`, status do projeto):
    nenhum nome da AbacatePay sai do arquivo, exceto o id da cobrança, tratado como texto opaco;
  - mapa fixo dos status da AbacatePay para os do projeto; status desconhecido é erro (`502`), nunca "aprovado";
  - id de cobrança conferido (`pix_char_...`) antes de ir para a URL; toda resposta conferida antes de ser usada;
  - logs só com a operação e o status HTTP: nunca o token, o corpo das respostas nem o código Pix.
- **Motivo:** trocar de gateway não pode afetar o resto do código.
- **Impacto:** módulo `pagamentos`.

### D-21 — Webhook só confirma o pagamento
- **Data:** 15/10/2026 (atualizado em 02/11/2026, #45)
- **Decisão:**
  - O webhook só confirma o pagamento (venda → `paga`); não mexe em estoque.
  - Sempre valida a assinatura e reconsulta o pagamento na API do gateway antes de agir.
  - Toda notificação é gravada em `eventos_webhook` antes de ser processada (idempotência).
  - Pagamento aprovado de venda já cancelada ou expirada → estorno.
  - **Três camadas** (atualizado em 02/11/2026, #45): (1) o `webhookSecret` na URL, que só nós e a AbacatePay
    conhecemos e que prova a origem; (2) a assinatura `X-Webhook-Signature` (HMAC-SHA256 do corpo cru com a
    chave pública da AbacatePay), que só prova que o corpo não foi alterado, porque a chave é pública; (3) a
    reconsulta da cobrança na API (#47), que decide se o pagamento existe e quanto vale.
  - **Códigos de resposta:** `401` para segredo ou assinatura inválidos (a AbacatePay não reenvia 4xx, e o pedido
    não ficaria certo numa nova tentativa); `5xx` para falha nossa (ela reenvia até 7 vezes em cerca de 18 h);
    `200` para evento aceito ou ignorado. Nunca `410`, que desativa o webhook na AbacatePay.
  - **Processamento (14/11/2026, Lote 11, #46 e #47):**
    - Do corpo, só o id do aviso (`log_...`) e o id da cobrança (`data.transparent.id`, `pix_char_...`). Status, valor
      e dados do pagador são ignorados; o que vale é a reconsulta (`gatewayPix.consultarCobranca`).
    - **Idempotência:** `eventos_webhook` com `ON CONFLICT DO NOTHING` pelo id do aviso; o `payload` guarda **só**
      `{ cobrancaId }` (nunca o corpo, que traz nome, e-mail e CPF mascarado). Processado → `200` e para; gravado sem
      `processado_em` → reprocessa. Falha → `tentativas + 1`, `ultimo_erro` com um código curto e `500`.
    - O pagamento é achado no **nosso** banco pelo `gateway_cobranca_id`. Única exceção: o pagamento que ficou sem a
      cobrança gravada (a etapa 3 do #44 falhou), aceito só se o metadata da consulta apontar esse pagamento, sem
      cobrança, da mesma venda e com o mesmo valor. Cobrança desconhecida → log e o evento fica processado.
    - O valor da consulta é comparado com `pagamentos.valor` antes de confirmar; diferente → não confirma
      (`status_detalhe 'valor divergente'`).
    - **Ordem das travas:** a venda (`FOR UPDATE`) e depois o pagamento (`FOR UPDATE`). O #44 trava cliente → venda e a
      expiração trava a venda (e depois itens e produtos, no `estornarVenda`): ninguém trava o pagamento antes da
      venda, então não há deadlock. A chamada ao gateway fica sempre **fora** da transação.
    - **Pagamento indevido:** aprovado de venda cancelada, ou de venda já paga por outro pagamento (em dobro) → fica
      `aprovado` com `estorno_solicitado_em` e é devolvido (D-22). A venda nunca é reaberta e o estoque não muda.
    - **Rede de proteção:** a mesma função de processamento roda na expiração (D-16) e no detalhe da compra (no
      máximo 1 consulta a cada 20 s por pagamento), então um aviso perdido não deixa uma venda paga sem confirmação.
- **Motivo:** o corpo do webhook pode ser forjado ou repetido; o estoque já foi resolvido na criação/cancelamento.
  A reconsulta fora da transação não segura trava de venda nem conexão do pool durante a chamada de rede.
- **Impacto:** módulos `pagamentos` e `vendas` (tarefa de expiração e detalhe da compra); `db/init/22_pagamentos_estorno.sql`.

### D-22 — Estorno automático no cancelamento de venda paga
- **Data:** 15/10/2026 (atualizado em 19/10/2026; alterada em 02/11/2026 no Lote 5, conforme a revisão de 24/10;
  atualizada em 02/11/2026 no Lote 7, com a AbacatePay; devolução de pagamento indevido em 14/11/2026, Lote 11;
  cancelamento com estorno, conclusão automática e manual em 14/11/2026, Lote 12)
- **Decisão:**
  - Cancelar venda paga dispara estorno automático pela API do gateway, sempre do valor total.
  - A AbacatePay **não tem chave de idempotência** no estorno e só faz **estorno total**. Repetir é seguro: o
    segundo pedido é recusado com "Esta cobrança já foi reembolsada.", que conta como **sucesso** (já estornado).
  - O estorno da AbacatePay sai do **SALDO DISPONÍVEL** da conta. Se a loja tiver sacado tudo, ou se o dinheiro do
    Pix ainda não estiver disponível, o estorno falha com "Saldo insuficiente para realizar o reembolso.". O modelo
    da #35 cobre isso: a venda fica em `cancelamento_solicitado` e a #49 tenta de novo; depois de 5 tentativas, o
    admin conclui à mão. A loja precisa saber que estornos dependem de manter saldo na conta.
  - O estorno é controlado por pagamento, pela coluna `pagamentos.estorno_solicitado_em` (criada no Lote 11,
    `22_pagamentos_estorno.sql`), em três
    etapas: **travar** (numa transação, a venda vai para `cancelamento_solicitado` e o pagamento é marcado com
    `estorno_solicitado_em`), **estornar** (chamada ao gateway, fora da transação) e **concluir** (numa nova
    transação, a venda vai para `cancelada`, registrada como `sistema`).
  - Se o gateway falhar, a venda continua em `cancelamento_solicitado` (= estorno pendente) e a tarefa agendada tenta
    de novo, até 5 vezes. Contador em `pagamentos.estorno_tentativas` e último erro em
    `pagamentos.estorno_ultimo_erro`. Esgotadas as tentativas, a venda continua em `cancelamento_solicitado` e o
    admin resolve manualmente (só então o admin pode concluir para `cancelada`).
  - **Devolução de pagamento indevido (14/11/2026, Lote 11, parte mínima da #49):** um pagamento aprovado de venda já
    cancelada, ou o segundo pagamento de uma venda já paga, fica `aprovado` com `estorno_solicitado_em`. Logo depois
    do COMMIT do webhook, uma tentativa de `estornar` (fora da transação); aprovado ou "já reembolsada" → `estornado`;
    falhou → `estorno_tentativas + 1` e `estorno_ultimo_erro` com o código curto (ex.: `INSUFFICIENT_FUNDS`). A tarefa
    de 5 em 5 minutos tenta de novo até 50 por rodada, cada um isolado, até **5 tentativas** (o `CHECK` de
    `estorno_tentativas` vai até 5). Com 5, para e registra `[estorno] pagamento <id> precisa de ação do admin`; a
    tela do admin entra no Lote 12. Esse fluxo não muda a venda: ela continua cancelada (ou paga, pelo outro
    pagamento). O cancelamento de venda paga pelo cliente (#35, com `cancelamento_solicitado`) continua para depois.
  - **Implementado (14/11/2026, Lote 12):**
    1. **Travar** (`vendaService.cancelar`): numa transação, a venda (`FOR UPDATE`) e o pagamento que a confirmou
       (`aprovado` sem `estorno_solicitado_em`, `FOR UPDATE`), nesta ordem; a venda vai para `cancelamento_solicitado`
       (ator cliente ou admin) e o pagamento ganha `estorno_solicitado_em`.
    2. **Estornar**: fora da transação, `pagamentoService.tentarEstornoPendente` (uma tentativa já).
    3. **Concluir** (no próprio `tentarEstornoPendente`, quando o gateway aprova ou responde "já reembolsada"): numa
       nova transação, venda → pagamento; o pagamento vira `estornado` e, se a venda está em `cancelamento_solicitado`
       e este é o pagamento que a confirmou, ela vai para `cancelada` (ator `sistema`, `'Pagamento devolvido.'`) com o
       `estornarVenda`. Por isso a tarefa de 5 em 5 minutos, que já tentava os estornos pendentes, **conclui sozinha**
       os cancelamentos cujo estorno falhou da primeira vez.
    - **Qual é o pagamento da compra:** o banco não liga a venda ao pagamento que a confirmou. O webhook marca o
      pagamento indevido (em dobro, ou de venda já cancelada) com `status_detalhe 'pagamento indevido'` quando pede a
      devolução; o estorno dele nunca conclui o cancelamento da venda.
    - **Conclusão manual (admin):** só com as **5 tentativas** esgotadas e com um **motivo**. Venda em
      `cancelamento_solicitado`: o próprio `POST /api/vendas/:id/cancelar` (pagamento `estornado` com `status_detalhe
      'estorno manual'`, venda `cancelada` com ator admin e o motivo no histórico, estoque de volta). Pagamento
      indevido de venda não cancelada: `POST /api/pagamentos/:id/concluir-estorno` (só o pagamento muda; o motivo fica
      em `estorno_ultimo_erro`). O admin vê esses casos no `GET /api/vendas?problemaPagamento=true`.
- **Motivo:** o cliente não depende de ação manual para receber de volta; a recusa do segundo estorno pela AbacatePay
  evita estorno em dobro na nova tentativa; o limite de tentativas evita insistir num erro que não se resolve sozinho.
- **Impacto:** pagamentos, vendas.

**Correção pontual da D-22 — 15/11/2026:** confirmação autenticada de estorno por webhook/reconsulta e resposta direta
agora usam a mesma conclusão transacional (pagamento, cancelamento/histórico e devolução B1 no mesmo `PoolClient`).
Retry reconsulta antes de pedir outro estorno; o job inclui conclusão local pendente de pagamento já `estornado`,
mesmo com 5 tentativas. Cobrança indevida e `estorno manual` não cancelam automaticamente a compra, e suas marcas
não são apagadas por divergência de valor. Não altera baixa na criação, helper de estoque, expiração, política de
pagamento tardio nem contratos HTTP. Agrupamento de tentativas é por processo, sem lease distribuído; permanece a
limitação financeira entre instâncias. A classificação legada continua exigindo evidência individual.
Reprodução, testes, reconciliação proposta e localização revisável: [correção de estorno](estorno-confirmacao-2026-11-15.md).

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
- **Data:** 19/10/2026 (atualizado em 03/11/2026: o motivo "o gateway coleta o CPF na própria página de pagamento"
  deixou de valer com o Pix transparente, D-18)
- **Decisão:** o cadastro não pede CPF. O Pix transparente vai **sem `customer`** (D-18), então a cobrança não
  precisa de CPF. Quando o cartão entrar, a AbacatePay exige `customer` com `taxId`, e **esta decisão será revista**.
  Reavaliar também se a loja precisar do CPF para nota fiscal ou se uma transportadora exigir.
- **Motivo:** minimização de dados (LGPD); reduz o estrago em caso de vazamento; cadastro mais rápido.
- **Impacto:** a coluna `clientes.cpf` é removida (`10_clientes.sql`); módulos `clientes`, `auth` e `pagamentos`.

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
- **Decisão:** ficam fora da entrega de 19/11/2026: integração com transportadora, exportação dos dados do cliente,
  CI no GitHub Actions e logger estruturado. A recuperação de senha por e-mail entra na entrega (D-09).
  **Atualizado em 14/11/2026:** os e-mails automáticos de mudança de status da venda **entraram** (Lote 12, item 1 do
  PDF; envio pelo Resend, D-54). Continuam fora os e-mails de boas-vindas e o aviso de chegada por e-mail (D-28).
- **Motivo:** prazo.
- **Impacto:** D-28 (aviso de chegada sem e-mail).

---

## Pendentes

**Incremento de imagem principal — 14/11/2026:** uma imagem por produto, administrada por
`PUT /api/produtos/:id/imagem` e `DELETE` no mesmo caminho, com sessão/papel atual/Origin. É a exceção
de substituição integral ao uso geral de PATCH. Arquivos novos são WebP reencodados, ID privado separado
da URL; armazenamento local em volume externo configurável, sem excluir assets/referências legadas.
Migração incremental 32, limites, concorrência, limpeza e implantação estão no
[contrato/relatório](imagem-principal-2026-11-14.md). Não altera decisões de estoque, vendas ou estorno;
a pendência financeira B2 registrada na consolidação permanece fora deste incremento.
Registro datado sem reservar número D adicional para evitar colisão com trabalho paralelo.

| Pergunta | Com quem | Prazo | O que trava |
|---|---|---|---|
| Valores do frete | loja | a definir | valores definitivos do frete (#4). Falta: preço e prazo para o resto do Brasil, valor e prazo locais e frete grátis; só o `frete.config.ts` muda |

O provedor de e-mail foi escolhido em 14/11/2026: Resend (D-54).

As regras de entrega já estão confirmadas; só os valores do frete são provisórios (ver D-29).

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
