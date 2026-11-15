# Listagem administrativa de saldos atuais — implementação e homologação

**15/11/2026. Incremento funcional concluído em área isolada, sem commit, push ou deploy.**
`GET /api/estoque` lista os saldos atuais com filtros e paginação, usando diretamente `produtos.estoque`.
Mantém o DTO individual, inclui ativos/inativos por padrão e exige sessão/papel atual de admin.
**Verificações desta rodada:**1.411 testes HTTP/unitários e644 integrações PostgreSQL aprovados, zero ignorados.

## 1. Base utilizada e trabalho anterior preservado

| Área/referência | Estado confirmado antes de editar e após fetch final |
|---|---|
| Repositório real | `/home/mateus/Projetos/Aquarilandia`; o caminho duplicado configurado no ambiente não existe; nenhum AGENTS.md aplicável encontrado |
| Local e remoto B1 | `branch-backend` / `origin/branch-backend`: `ff5bacca81f879c4eba32ded432dc20667dd4a95`, árvore limpa |
| Base desta entrega / main remota | `8c6f1b06d9109672d1e55cca06bb91545fb806f3`, merge PR45 do histórico; árvore idêntica a ff5bacc |
| Remoto B2 | `7e9b6fd22556bd194588dc50b221079bfab15bfa`, ancestral da base |
| Histórico ampliado | Já publicado em ff5bacc e incorporado à main pelo PR45, inclusive migração33; a informação anterior de entrega sem commit está desatualizada |
| Imagens | Commit b872486 já incorporado à base; não foi refeito |
| Worktrees antigas em /tmp | Registros continuam no Git, marcados prunable; as pastas antigas não estão disponíveis neste ambiente, inclusive estoque-consultas/imagem-principal/consolidada |

A ausência das pastas antigas impede conferir agora seus arquivos não commitados ou logs temporários; não é
evidência de que trabalho privado de B2 tenha sido integrado. Não removi registros, não apliquei patches antigos
nem tentei recompor decisões financeiras. Os incrementos publicados estão preservados no HEAD desta nova área.
Foram lidos contrato, decisões, schemas/migrations, estoque, validação/consulta do catálogo, sessão/admin,
transação e testes/consumidores. Fetch inicial detectou apenas o PR45 na main, sem diferença de arquivos em B1.

Snapshot inicial do original:479 arquivos com SHA-256, conjunto de fontes, status e HEAD, na pasta da seção10.
Conferência final aprovada: todos os479 arquivos, conjunto de fontes, HEAD/status e registros antigos de worktrees
preservados; somente a nova área foi acrescentada. Evidência: `preservacao-final.log`.
As dependências existentes foram copiadas para a worktree; não houve instalação, mudança de versões ou lockfile.
Nenhum arquivo de produção ou configuração local do repositório original foi editado. O `.env` não foi copiado
ou alterado; os testes usam variáveis explícitas e banco descartável.

## 2. Matriz do que existia e do que foi implementado

Estado anterior refere-se ao HEAD8c6f1b0. Os links apontam para a entrega atual; funções antigas foram preservadas.

| Requisito | Estado anterior | Evidência | Ação necessária/realizada |
|---|---|---|---|
| Catálogo, imagem principal, estoque administrativo/vendas | Implementados/publicados | b872486/ff5bacc, módulos catálogo/estoque e schemas30–33 | Preservar; sem reimplementação |
| Listagem `GET /api/estoque` | Ausente; mapa previa abaixoDe sem handler | `estoque.routes.ts` anterior:14–16; api.md anterior:222 | Adicionar GET raiz sem colisão com caminhos existentes |
| Saldo individual | Implementado com quatro campos, inclusive inativos | `buscarSaldo`, `SaldoProdutoAdmin`, D-49 | Reutilizar exatamente o DTO em cada item |
| Histórico geral e filtros | Implementados na rodada anterior | `listarHistorico`, ff5bacc e SQL33 | Preservar SQL, validação e endpoint |
| Guardas/cache/HEAD | Já disponíveis | [`estoque.routes.ts:8`](../src/modulos/estoque/estoque.routes.ts#L8), autenticar/exigirAdmin | Mesmas guardas antes de validar/consultar |
| Busca/slug/booleanos de catálogo | Convenções existentes | `produto.controller.ts:30–70`, `produto.repository.ts:100` | Trim/limites/slug e escape ILIKE equivalentes, validação própria dos filtros de saldo |
| Total/página coerentes | Já adotado no histórico | CTE/consulta única no repository | Aplicar uma instrução/snapshot também aos saldos |
| Fonte de saldo | Coluna com CHECK>=0 | `01_catalogo.sql:31` e helpers de baixa/devolução | Ler a coluna, sem somar histórico/reconciliar |
| Índices para esta leitura | Categoria e ativos no schema atual | `01_catalogo.sql:38–39` | Medir com EXPLAIN; nenhum índice/migração adicional justificado nesta rodada |

Implementação concentrada em
[`estoque.routes.ts:14`](../src/modulos/estoque/estoque.routes.ts#L14),
[`estoque.controller.ts`](../src/modulos/estoque/estoque.controller.ts),
[`estoque.service.ts`](../src/modulos/estoque/estoque.service.ts),
[`estoque.validacao.ts:25`](../src/modulos/estoque/estoque.validacao.ts#L25),
[`estoque.repository.ts:14`](../src/modulos/estoque/estoque.repository.ts#L14) e tipos do próprio módulo.

## 3. Rota, DTO, filtros, defaults e ordenações

`GET /api/estoque` e HEAD equivalente. Resposta200, sempre no-store/Vary Cookie:

```json
{"itens":[{"produtoId":42,"nome":"Filtro externo","ativo":true,"saldoAtual":7}],"total":1}
```

Sem campos adicionais de categoria, ficha, imagem ou histórico: nenhum consumidor identificado exige-os.
`total` é contado depois dos filtros e antes da página. Lista vazia:200 com itens[]/total0; página além do fim
mantém o total filtrado. Não transforma categoria válida inexistente em404.

| Query opcional | Regra |
|---|---|
| busca | Substring somente no nome, ILIKE sem diferenciar caixa; trim,1–150 unidades UTF-16 como na listagem de produtos, sem controles internos |
| categoria | Slug em minúsculas/hífens, trim,1–80 caracteres; mesmo padrão do catálogo. Inexistente válido: lista vazia |
| ativo | Apenas true/false minúsculos, sem espaços. Omitido inclui ativos e inativos |
| em_estoque | true:saldo>0; false:saldo=0; omitido inclui ambos |
| ordem | nome, -nome, saldo ou -saldo; padrão nome crescente; todas com produtoId crescente como desempate |
| pagina/limite | Padrões1/20, teto100; inteiros positivos canônicos e offset seguro, reaproveitando a validação numérica de estoque |

Busca escapa `!`, `%` e `_` com ESCAPE `!`; esses caracteres e barra invertida são literais, não curingas
fornecidos pelo usuário. Não pesquisa descrição ou marca. Não remove acentos nem promete normalização Unicode
adicional: segue o trim das consultas existentes. Ordenação textual segue a collation do PostgreSQL.

Desconhecidos/repetidos/arrays/objetos, strings vazias, booleanos fora do formato e paginação inválida retornam
400 com `{erro,detalhes?}` antes de consultar saldos. Não aceita produtoId, tipo/de/ate, incluir_inativos,
preços ou abaixoDe nesta listagem. A previsão antiga de abaixoDe não tinha implementação: o contrato desta
tarefa adota os filtros acima e rejeita esse parâmetro, sem criar alerta/limiar de estoque baixo.

Exemplos completos estão em [`estoque-saldos.http`](../http/estoque-saldos.http):

```text
GET /api/estoque
GET /api/estoque?categoria=filtros&ativo=true&em_estoque=true&ordem=-saldo
GET /api/estoque?busca=Filtro&pagina=2&limite=10
GET /api/estoque?ativo=false&em_estoque=false&ordem=nome
```

## 4. Semântica do saldo e compatibilidade

`saldoAtual = produtos.estoque`: unidades disponíveis segundo a regra vigente, já debitadas na criação da venda.
Não representa contagem física total ou saldo acrescido das unidades já comprometidas. Não adiciona campos de
reserva nem aplica segundo desconto. Produto inativo pode ter saldo, mas continua fora do catálogo público/novas vendas.

Saldo individual, histórico geral/por produto e escritas mantêm implementação. Os testes mostram0→5 depois de
entrada,5→3 ao criar venda com baixa e3→5 na devolução por cancelamento não pago, usando os helpers existentes
na transação do chamador. Nenhuma integração financeira foi criada para essa prova de estoque.
`saldoPosterior` continua histórico e `saldoAtual` continua atual; não foi renomeado campo do POST idempotente.

Rotas estáticas continuam antes de `/:produtoId`; o GET raiz não captura `/movimentacoes`. Leitura sem Origin
segue a política administrativa existente. Escritas continuam com Origin/idempotência e suas regras intactas.
O frontend não possui consumidor dessa listagem nova. `dados-demo.ts` usa saldo individual e POST, inalterados.
Não há implementação de frontend, dashboard, exportação, notificações ou novos fluxos de venda.

## 5. SQL, snapshot, segurança e análise de índices

A projeção é explícita: produtoId/nome/ativo/saldoAtual, a partir de produtos. Categoria informada é resolvida
por subconsulta do slug único dentro da mesma instrução. A CTE NOT MATERIALIZED alimenta count e página;
JSON agrega somente a página ordenada. Valores e booleans/LIMIT/OFFSET são parâmetros; ORDER BY vem de mapa
fechado com os quatro valores permitidos. Não há query por produto, locks de escrita ou consulta ao histórico.
Mesmo snapshot cobre total e itens. O índice existente por categoria continua utilizável nos filtros.

Referências técnicas: [CTE PostgreSQL17](https://www.postgresql.org/docs/17/queries-with.html),
[isolamento Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html).
Entre requisições, mudanças de saldo/ativo/nome podem deslocar páginas, especialmente com ordem por saldo.
Não promete snapshot de uma navegação inteira. COUNT e OFFSET muito alto continuam tendo custo proporcional;
não há truncamento silencioso para evitá-lo.

**Medição:** PostgreSQL17.11,10mil produtos fictícios nas12 categorias,75% ativos, cerca de1/3 zerados,
nomes repetidos e busca que encontra10% dos itens. Saldos são anteriores ao bootstrap de estoque; a abertura
legada foi gerada pelo SQL30 e reconciliada. Três EXPLAIN ANALYZE/BUFFERS por cenário, usando a SQL efetiva:

| Cenário, primeira página20 | Mediana(ms) |
|---|---:|
| Geral por nome | 7,403 |
| Saldo crescente | 7,065 |
| Saldo decrescente | 6,036 |
| Categoria filtros | 0,949 |
| Busca substring Filtro | 15,466 |
| Inativos zerados | 2,994 |
| Categoria+busca+ativo+disponibilidade | 2,583 |

Geral/saldo usam contagem por Index Only Scan no índice existente de categoria e Seq Scan/top-N heapsort para
a página. Categoria usa o índice de produtos por categoria (834 linhas no plano) e top-N; busca faz varredura
com ILIKE (1.000 correspondências). Nenhum plano lê movimentos/operações de estoque.
O teste de concorrência demonstra que a leitura não espera o lock de escrita do produto para retornar o último
estado confirmado, sem ver o saldo parcial entre UPDATE e INSERT do histórico.

**Decisão:** sem novo índice, extensão ou migração. A amostra não mostrou necessidade operacional que justificasse
DDL adicional, e não foi fornecido volume real/metas de latência. Os tempos não são SLA nem teste de carga; medir
o padrão real antes de decidir índices de nome/saldo ou busca. Foram preservados todos os schemas, inclusive33.
O harness e o JSON completo de21 planos tornam a medição reproduzível (seção7/10).

Segurança: reutiliza sessão vigente/conta ativa/papel atual de admin antes da validação/consulta. Visitante,
sessão inválida/revogada/expirada/conta inativa401; cliente/papel rebaixado403. X-Role não concede acesso.
GET/HEAD, incluindo erros, mantêm no-store e Vary Cookie; CORS não substitui autorização.
Falhas SQL usam500 genérico e logger redigido existente. Não acrescenta dados pessoais, cookie, hash, chaves,
mensagem do driver ou caminhos ao DTO/log. API pública mantém apenas emEstoque e os DTOs existentes, sem quantidades.

Fotos de todas as tabelas (contagens e hashes do conteúdo) antes/depois de leituras/HEAD/filtros/erros foram
idênticas: produtos/fichas/imagem, saldos, operações/movimentos, vendas/itens/pagamentos e sessões preservados.
As escritas necessárias para fixtures acontecem fora desses intervalos de comprovação; nenhuma é efeito do GET.
Isso não constitui auditoria completa de segurança do sistema nem valida a pendência financeira B2.

## 6. Arquivos alterados

| Arquivos | Alteração |
|---|---|
| `src/modulos/estoque/estoque.routes.ts` | Uma rota GET raiz com guardas/cache existentes |
| `estoque.controller.ts`, `estoque.service.ts` | Entrada e encadeamento da listagem, sem mudar escritas |
| `estoque.types.ts` | Filtros, quatro ordenações e envelope com SaldoProdutoAdmin |
| `estoque.validacao.ts` | Validador dedicado de filtros, reaproveitando inteiros seguros |
| `estoque.repository.ts` | SELECT parametrizado de saldos/total, ordenação fechada e um snapshot |
| `testes/estoque-saldos.test.mjs` (novo) |93 testes HTTP |
| `testes/integracao/estoque-saldos.test.mjs` (novo) |23 casos com PostgreSQL real |
| `testes/homologacao/estoque-saldos-explain.mjs` (novo) | Benchmark descartável reproduzível com10mil produtos |
| `http/estoque-saldos.http` (novo) | Exemplos de filtro, paginação, HEAD, erros e rotas preservadas |
| `api.md`, `docs/decisoes.md`, `testes/README.md`, `../README.md`, este relatório (novo) | Contrato, evolução D-49 e evidências |

Total:10 arquivos rastreados modificados e5 novos. Sem edição de migrations, package.json/lockfile, imagens,
vendas/pagamentos, middleware, app/server, frontend ou implementação de movimentações/baixa/devolução.

## 7. Comandos, resultados e verificações não executadas

Somente o container próprio `aquarilandia-estoque-saldos-pg-20261115`, tmpfs, banco/usuário fictícios teste,
porta63506, foi usado para integração. Cada suíte cria/remove schema próprio. O app de testes não inicia os
jobs do server.ts, nem acessa banco compartilhado, gateway ou e-mail reais.

| Comando/verificação | Resultado |
|---|---|
| Git status/log/worktree, fetch inicial/final, diff/ancestry | Base/entregas publicadas confirmadas; sem merge/rebase/reset/commit/push |
| `npm run typecheck` / `npm run build` backend | Passaram |
| Novos testes focados HTTP+PG | **116 passaram**,0 falhas/ignorados (93 HTTP+23 PG) |
| `npm test` backend | **1.411 passaram**,0 falhas/ignorados; inclui as93 novas verificações |
| `TEST_DATABASE_URL=... npm run test:integration` | **644 passaram**,0 falhas/ignorados; inclui os23 novos casos e regressões de histórico/imagens/vendas |
| `npm audit --json` | Zero vulnerabilidades em todas as gravidades; sem correção automática |
| `npm ls --depth=0` em backend/ | Dependências declaradas presentes; três extras herdados do ambiente (emnapi/runtime, sharp-wasm32, tslib), sem limpeza/instalação nesta tarefa |
| `node --check testes/homologacao/estoque-saldos-explain.mjs` | Passou |
| `TEST_DATABASE_URL=... ARQUIVO_EXPLAIN=... node --import tsx testes/homologacao/estoque-saldos-explain.mjs` | Passou;21 planos, dados preservados e abertura reconciliada |
| `git diff --check` + whitespace de arquivos novos | Conferidos ao encerrar |

Em backend/, reprodução focada:

```bash
NODE_ENV=test DATABASE_URL=postgres://fixture@127.0.0.1:1/fixture node --import tsx --test testes/estoque-saldos.test.mjs
NODE_ENV=test DATABASE_URL=postgres://fixture@127.0.0.1:1/fixture TEST_DATABASE_URL=postgres://teste:teste@127.0.0.1:PORTA/teste node --import tsx --test testes/integracao/estoque-saldos.test.mjs
TEST_DATABASE_URL=postgres://teste:teste@127.0.0.1:PORTA/teste ARQUIVO_EXPLAIN=/tmp/estoque-saldos-explain.json node --import tsx testes/homologacao/estoque-saldos-explain.mjs
```

O harness não usa DATABASE_URL como fallback; sem TEST_DATABASE_URL recusa execução. Não usar base de dev/loja:
as fixtures fazem DDL/DML somente nos schemas próprios e removem-nos ao terminar.
Primeiras execuções encontraram dois problemas nas **fixtures novas**: regex de log também capturava o texto
genérico permitido “Erro interno”, e um parâmetro compartilhado entre TEXT/VARCHAR precisava de cast explícito.
Foram corrigidos nos testes; os resultados acima são das execuções finais, sem mascarar erro de produção.

Não executados: frontend/E2E/lint frontend (nenhuma UI/consumidor afetado), build Docker/deploy, carga prolongada,
gateway real, migração/banco compartilhado. Backend não tem script de lint. Não reutilizei como aprovação os
logs temporários das rodadas antigas, que não estão mais disponíveis neste ambiente.

## 8. Falhas preexistentes e regressões

A falha temporal anterior de `vendas-admin.test.mjs` **não se manifestou nesta execução**, realizada por volta
de15h38 de15/11/2026 em America/Sao_Paulo: todos os testes dessa suíte passaram. O arquivo não foi editado.
As linhas384–400 ainda definem a venda em `now()-3h` e depois esperam encontrá-la no dia de hoje em São Paulo;
se esse deslocamento cruzar meia-noite, a premissa falha. O resultado diurno verde não significa correção.
Responsável sugerido: B2/tests, com fixture temporal determinística em tarefa própria, sem mudar regra comercial.
Os resultados620/1 do relatório anterior permanecem históricos; não são o resultado desta rodada.

Nenhuma regressão nova foi identificada nos testes executados. A pendência conhecida de estorno por webhook
continua com B2; esta consulta não altera cancelamento, decisão financeira, status ou crédito de unidades.
Não foi feita homologação financeira externa para atribuir resultado a essa pendência.

## 9. Conflitos, limites e pendências de B1

Fetch final manteve8c6f1b0(main), ff5bacc(B1) e7e9b6fd(B2). A entrega parte da main atual; B1/B2 são ancestrais.
Não há arquivos unmerged/marcadores ou alterações remotas concorrentes de listagem de saldos nesse snapshot.
Main e branch-backend têm a mesma árvore; o PR45 acrescentou somente a integração do histórico já publicado.
O diff local foi comparado com essas referências, sem criar commit ou fazer merge definitivo. Revalidar antes
de integrar: não é garantia sobre commits futuros ou trabalho privado de terceiros.

Sobreposições desta tarefa: roteador/controller/service/repository/types/validação de estoque e docs D-49/api.
O histórico ocupa alguns desses arquivos, mas suas funções/corpos foram preservados e os testes anteriores
passaram. Não há sobreposição nova de migração/índice. A previsão abaixoDe foi explicitamente substituída pelo
contrato solicitado, sem implementar limiar ou aceitar esse parâmetro silenciosamente.

Limitações: volume real/carga não medidos; paginação por offset pode deslocar com mudanças concorrentes; planos
e collation variam por ambiente. Worktrees temporárias antigas ausentes limitam a verificação de trabalho privado.
Não foi identificada pendência funcional desta listagem nos testes executados. Alertas, exportação/dashboard e
ferramentas adicionais continuam fora deste incremento e exigem escopo próprio. Não há nova reserva/regra de venda.
Não é necessária uma migração nova para esta entrega na base atual.

## 10. Localização exata da entrega revisável

- **Worktree:** `/tmp/aquarilandia-estoque-saldos-20261115`.
- **Branch:** `feat/estoque-listagem-saldos-20261115`, HEAD8c6f1b0, sem staging/commit.
- **Relatório:** `backend/docs/estoque-saldos-2026-11-15.md`.
- **Contrato/exemplos:** `backend/api.md`, `backend/http/estoque-saldos.http`.
- **Evidências:** `/tmp/aquarilandia-estoque-saldos-20261115-evidencias/`: logs dos testes atuais, EXPLAIN JSON,
  snapshots de preservação do original e registros das worktrees anteriores.

Nenhum commit, push ou deploy. Não remover esta worktree/pasta de evidências antes da revisão e transporte:
a entrega ainda depende da retenção de `/tmp`. Nenhuma migração ou atualização de container compartilhado foi feita.
Após confirmar zero schemas de teste restantes, o container descartável próprio foi encerrado/removido.
O container `aquarilandia-db` preexistente permanece em execução; logs e código revisável foram mantidos.
