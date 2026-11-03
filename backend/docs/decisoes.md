# Decisões do backend — Aquarilândia

Registro do que foi decidido no backend, por quê e quando, para ninguém precisar reabrir a discussão.
Mudou uma decisão? Edite o item **no mesmo PR da mudança** e registre a nova data.
Convenções de código, rotas e banco ficam no [`api.md`](../api.md); aqui fica só o porquê.

---

## Arquitetura

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
- **Data:** 15/10/2026 (atualizado em 19/10/2026; alterada em 02/11/2026 no Lote 5, conforme a revisão de 24/10)
- **Decisão:** o cliente cancela a própria venda em `POST /api/vendas/:id/cancelar` enquanto ela não foi enviada,
  com estorno automático se já estiver paga (D-22). Não existe "solicitar cancelamento" para o admin aprovar.
  O status `cancelamento_solicitado` significa "estorno em andamento ou pendente" (não só "o gateway falhou"):
  toda venda paga cancelada passa por ele. Enquanto a venda está nele, nenhuma outra transição é permitida, só a
  conclusão para `cancelada`, que é sempre registrada como `sistema` (ou `admin`, só depois de 5 tentativas de
  estorno, D-22).
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
- **Motivo:** o corpo do webhook pode ser forjado ou repetido; o estoque já foi resolvido na criação/cancelamento.
- **Impacto:** módulo `pagamentos`.

### D-22 — Estorno automático no cancelamento de venda paga
- **Data:** 15/10/2026 (atualizado em 19/10/2026; alterada em 02/11/2026 no Lote 5, conforme a revisão de 24/10;
  atualizada em 02/11/2026 no Lote 7, com a AbacatePay)
- **Decisão:**
  - Cancelar venda paga dispara estorno automático pela API do gateway, sempre do valor total.
  - A AbacatePay **não tem chave de idempotência** no estorno e só faz **estorno total**. Repetir é seguro: o
    segundo pedido é recusado com "Esta cobrança já foi reembolsada.", que conta como **sucesso** (já estornado).
  - O estorno da AbacatePay sai do **SALDO DISPONÍVEL** da conta. Se a loja tiver sacado tudo, ou se o dinheiro do
    Pix ainda não estiver disponível, o estorno falha com "Saldo insuficiente para realizar o reembolso.". O modelo
    da #35 cobre isso: a venda fica em `cancelamento_solicitado` e a #49 tenta de novo; depois de 5 tentativas, o
    admin conclui à mão. A loja precisa saber que estornos dependem de manter saldo na conta.
  - O estorno é controlado por pagamento, pela coluna `pagamentos.estorno_solicitado_em` (entra na #35), em três
    etapas: **travar** (numa transação, a venda vai para `cancelamento_solicitado` e o pagamento é marcado com
    `estorno_solicitado_em`), **estornar** (chamada ao gateway, fora da transação) e **concluir** (numa nova
    transação, a venda vai para `cancelada`, registrada como `sistema`).
  - Se o gateway falhar, a venda continua em `cancelamento_solicitado` (= estorno pendente) e a tarefa agendada tenta
    de novo, até 5 vezes. Contador em `pagamentos.estorno_tentativas` e último erro em
    `pagamentos.estorno_ultimo_erro`. Esgotadas as tentativas, a venda continua em `cancelamento_solicitado` e o
    admin resolve manualmente (só então o admin pode concluir para `cancelada`).
- **Motivo:** o cliente não depende de ação manual para receber de volta; a recusa do segundo estorno pela AbacatePay
  evita estorno em dobro na nova tentativa; o limite de tentativas evita insistir num erro que não se resolve sozinho.
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
| Qual provedor de e-mail? | grupo | 22/10/2026 (vencido) | envio real da recuperação de senha (#19a, passo 3, e #19b). Falta: escolher o provedor, combinar o SDK no `package.json`, a chave `EMAIL_API_KEY` e o remetente verificado `EMAIL_REMETENTE` |
| Valores do frete | loja | a definir | valores definitivos do frete (#4). Falta: preço e prazo para o resto do Brasil, valor e prazo locais e frete grátis; só o `frete.config.ts` muda |

Requisitos do provedor de e-mail: plano gratuito suficiente para testes, envio a partir de um remetente verificado
sem exigir domínio próprio, SDK para Node.js.

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
