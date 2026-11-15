# Ampliação das consultas administrativas de movimentos de estoque

**15/11/2026. Implementação funcional em worktree isolada; sem commit, push ou deploy.**
`GET /api/estoque/movimentacoes` consulta agora o histórico geral ou filtrado por produto, tipo e período.
Preserva `{itens,total}`, campos do DTO, autorização, paginação, histórico imutável e chamadas antigas por produto.
**Validação:**1.318 testes HTTP/unitários aprovados; integração geral620 aprovados/1 falha preexistente reproduzida
na base. Todos os22 testes de consultas de estoque passaram. A suíte geral de integração não está aprovada integralmente.

## 1. Base utilizada e preservação

| Área/referência | Estado observado |
|---|---|
| Repositório real | `/home/mateus/Projetos/Aquarilandia`; caminho duplicado do ambiente inexistente; nenhum AGENTS.md aplicável encontrado |
| Branch principal local / remoto B1 | `branch-backend` / `origin/branch-backend`: `b872486068735351bcf300e54e262f4ce03820d5`, limpa |
| Imagem principal | Commit `b872486` já publicado e incorporado à main; a informação anterior de entrega sem commit ficou histórica |
| Base desta rodada / main remota | `35fbdf03db0ea7decf10fbc95340fc37f7844654`, merge PR44 de imagens; mesma árvore de arquivos de b872486 |
| Remoto B2 | `7e9b6fd22556bd194588dc50b221079bfab15bfa`, ancestral da base |
| Entrega anterior de imagens | `/tmp/aquarilandia-imagem-principal-20261114`, HEAD b872486, limpa; preservada |
| Áreas anteriores com alterações locais | `/tmp/aquarilandia-backend1-consolidado-20261114` (d37d6be) e `/tmp/aquarilandia-consolidada-20261114` (7e9b6fd); preservadas, inclusive correções financeiras privadas de B2 |

Fetch inicial encontrou o avanço da main de c6617e3 para35fbdf0, sem diferença de arquivos em relação a B1.
Não transportei patches antigos nem reimplementei imagens/consolidação. Foram lidos contrato, D-49/D-48/D-50,
schemas30/31, migração32, estoques, DTO, sessão/admin, transação e testes/consumidores existentes.
As dependências já instaladas, correspondentes ao lockfile da base, foram copiadas para esta área isolada.
Não houve instalação nem alteração de versões/lockfile; package.json muda somente para incluir o comando da33.

Snapshots SHA-256, conjunto de fontes, HEAD e status foram feitos antes de editar em quatro áreas:
original474 arquivos, imagens474, B1 anterior456, combinada460. A conferência final está em `preservacao-final.log`.
O novo trabalho está somente na localização da seção10. Nenhum reset, stash, clean, rebase ou merge definitivo.

## 2. Matriz do que existia e do que foi implementado

Evidências do estado anterior referem-se ao HEAD35fbdf0; links apontam para arquivos atuais.

| Requisito | Estado anterior | Evidência | Alteração necessária/realizada |
|---|---|---|---|
| Imagens/catálogo/baixa e devolução | Implementados e incorporados à main | commit b872486; `imagem/`, `estoque-venda.*`, schemas30/31/32 | Nenhuma reimplementação/edição |
| Histórico por produto | Implementado, produto obrigatório | `estoque.validacao.ts` anterior:24–35; repository anterior:14–44 | Produto passou a opcional; chamada antiga preservada |
| Histórico geral | Ausente; sem produto retornava400 | Mesmo validador anterior; D-49 original | Mesma rota agora responde200 sem exigir produto |
| Tipo | Ausente/rejeitado | Schema31:58–63; validador anterior | Lista fechada dos sete tipos reais do histórico |
| Período | Ausente/rejeitado | D-49 original e api.md anterior:258–260 | Datas existentes com fuso, UTC e intervalo `[de,ate)` |
| Sessão/admin/cache/HEAD | Implementados | [`estoque.routes.ts:7`](../src/modulos/estoque/estoque.routes.ts#L7), autenticar/exigirAdmin | Reutilizados sem editar middlewares/rotas/controller |
| Total e página em um snapshot | Implementados para produto | Repository anterior:16–42 | Preservado em uma instrução, agora com filtros opcionais |
| Ordem estável | Data/ID internos decrescentes | Repository anterior:33–37 | Preservada; sem expor ID de movimento |
| Índice | `(produto_id,criado_em,id)` | [`30_estoque.sql:65`](../db/init/30_estoque.sql#L65) | Novo índice global data/ID só após medição, em33 |
| Validação canônica | Existia, mas regex numérica aceitava quebra de linha final | `lerInteiroConsulta` anterior:10; comportamento de `$` em regex JS | Reforço local com rejeição de whitespace; novas datas exigem consumo integral |

Arquivos centrais: [`estoque.validacao.ts:27`](../src/modulos/estoque/estoque.validacao.ts#L27),
[`estoque.repository.ts:14`](../src/modulos/estoque/estoque.repository.ts#L14),
[`estoque.types.ts`](../src/modulos/estoque/estoque.types.ts).

## 3. Contrato efetivo dos filtros e paginação

Somente `produtoId`, `tipo`, `de`, `ate`, `pagina` e `limite`. Todos opcionais; duplicados, arrays/objetos,
campos extras, strings vazias ou entradas malformadas recebem400 antes de consultar histórico.

| Campo | Regra |
|---|---|
| produtoId | Decimal canônico1–2147483647, sem sinal/zeros à esquerda/fração/expoente/espaços. Se informado e inexistente:404, mesmo com outros filtros sem resultado. Inativo incluído. Ausente: consulta geral |
| tipo | entrada, ajuste_positivo, ajuste_negativo, saida, abertura, baixa_venda, estorno_venda. Corresponde a `m.tipo`, nunca a origem da operação |
| de | Início inclusivo: `m.criado_em >= de` |
| ate | Fim exclusivo: `m.criado_em < ate` |
| Período | Pode ter somente um limite; ambos exigem `de < ate` pelo instante UTC. Não aplica período padrão nem trunca histórico |
| pagina/limite | Padrões1/20; limite1–100. Inteiros canônicos positivos seguros; `(pagina-1)*limite` precisa ser seguro |

Formato de data aceito: ISO8601 estendido **`AAAA-MM-DDTHH:mm:ss[.ffffff]Z`** ou **`±HH:mm`** no lugar de Z.
Ano0001–9999, também depois da conversão UTC; segundos obrigatórios; fração opcional1–6 dígitos. `T`/`Z`
maiúsculos. Hora00–23, minuto/segundo00–59, offset com hora00–23/minuto00–59. Não aceita data impossível,
hora24, segundo60, ausência de fuso, vírgula decimal, espaços ou precisão que PostgreSQL arredondaria.
Valida componentes gregorianos/bissexto antes de construir Date; anos1–99 não viram1901–1999.
Converte UTC sem perder a fração e compara intervalos com BigInt de microssegundos. Nenhum timestamp gravado é alterado.
O DTO continua serializando `criadoEm` em ISO UTC com três casas, por compatibilidade.

Exemplos:

```text
GET /api/estoque/movimentacoes
GET /api/estoque/movimentacoes?produtoId=42&pagina=1&limite=20
GET /api/estoque/movimentacoes?tipo=baixa_venda
GET /api/estoque/movimentacoes?de=2026-11-01T00:00:00Z&ate=2026-12-01T00:00:00Z
GET /api/estoque/movimentacoes?produtoId=42&tipo=entrada&de=2026-11-01T00:00:00-03:00&ate=2026-12-01T00:00:00-03:00&limite=10
```

Offset positivo precisa de `%2B` em URL, ou URLSearchParams/`curl --data-urlencode`.
`2026-11-01T00:00:00-03:00` equivale a `2026-11-01T03:00:00Z`; usá-los como de/ate do mesmo intervalo dá400.
Um intervalo de apenas1 microssegundo é válido e foi exercitado sem perda de precisão.

Envelope/DTO mantidos:

```json
{"itens":[{"operacaoId":"6229c4e2-a4c4-4bb7-a07d-43b9048bde90","produtoId":42,"tipo":"entrada","quantidade":2,"delta":2,"saldoAnterior":5,"saldoPosterior":7,"criadoEm":"2026-11-03T15:00:00.000Z","motivo":"Reposição conferida","origem":"admin","autorId":9}],"total":1}
```

Venda continua acrescentando somente `vendaId` e `operacaoOriginalId`, com autorId null. Abertura mantém autoria
null e quantidade/delta originalmente registrados, inclusive0. Nenhum campo pessoal novo, saldo público ou ID
interno de movimento. Total é número seguro após todos os filtros e antes do recorte; conversão do count não
fica limitada ao INTEGER32 da versão anterior. Página além do fim mantém total e itens[]; sem resultado total0.

## 4. Compatibilidade e consumidores

Chamadas antigas por produto mantêm resposta, inexistente404, inativo acessível, ordenação e defaults.
O POST permanece fechado aos quatro tipos administrativos e exige Origin/idempotência como antes.
Não confundir `estorno_venda` do histórico de unidades com autorização de refund financeiro.
`GET /api/estoque/:produtoId` continua sem aceitar query. `GET /api/estoque` (lista geral de **saldos**) continua
não implementado; não foi criado endpoint concorrente para movimentos.

A busca no frontend não encontrou consumidor dessa leitura administrativa. `dados-demo.ts` consome o **POST**
de movimentos, inalterado. Os consumidores GET encontrados são testes existentes, adaptados somente onde os
filtros antes rejeitados passaram a ser válidos. Não houve edição de frontend, catálogo público, imagens ou venda.

## 5. SQL, snapshot e análise dos índices

Uma instrução SQL contém CTE de movimentos filtrados, contagem, recorte ordenado e existência opcional de produto.
Somente os fragmentos fixos dos filtros entram na montagem; todos os valores, LIMIT e OFFSET são parâmetros.
Não há concatenação de conteúdo livre. JOIN com operação é feito na página de até100 movimentos, sem query por item.
CTE `NOT MATERIALIZED` permite planejamento separado de contagem e recorte, sem materializar todo o DTO do histórico.
Mesma instrução preserva snapshot entre existência, total e página; não precisa lock de escrita para ler.
Fundamentos: [CTE PostgreSQL17](https://www.postgresql.org/docs/17/queries-with.html),
[Read Committed](https://www.postgresql.org/docs/17/transaction-iso.html).

Ordem mantida: `criado_em DESC,id DESC`, sobre valores persistidos, com ID BIGSERIAL exclusivamente interno.
Inserções entre requisições podem deslocar páginas: não oferece snapshot/cursor de uma navegação inteira.
OFFSET alto e COUNT de todo o histórico continuam tendo custo; não foram trocados por cortes silenciosos.

Medição reproduzível em **PostgreSQL17.11** (imagem17-alpine já disponível),600 produtos,120.000 movimentos,
quatro tipos admin, ativos/inativos, datas distribuídas por aproximadamente500 dias e empates de horário.
Histórico/saldos da fixture reconciliados. Três EXPLAIN ANALYZE/BUFFERS por cenário, mediana em ms, antes/depois
do índice candidato; mesmos dados/SQL. Não é carga de produção nem garantia de latência/SLA.

| Consulta | Só índices anteriores | Com índice global33 |
|---|---:|---:|
| Geral, primeira página20 | 46,470 | 18,338 |
| Por produto | 0,574 | 0,580 |
| Tipo entrada | 35,742 | 11,510 |
| Período de um mês | 29,683 | 1,756 |
| Tipo + período | 19,181 | 1,941 |

Sem33, geral/período usavam varredura e top-N sort para a página. Com33, recorte geral usa Index Scan sobre
20 linhas; período conta7.440 linhas via Index Only Scan e busca20 para a página. O índice por produto continua
escolhido na consulta antiga. Espaço do novo índice na amostra:3.809.280 bytes (~3,63 MiB).
Variações pequenas do caso por produto são ruído desta medição. COUNT geral ainda lê todas as entradas;
o índice não torna sua complexidade constante. Não acrescentei outro índice por tipo sem evidência de necessidade.
O uso de B-tree para ORDER BY/LIMIT é descrito na [documentação oficial](https://www.postgresql.org/docs/17/indexes-ordering.html).

**Migração nova:** [`33_estoque_consultas.sql`](../db/init/33_estoque_consultas.sql) adiciona somente
`idx_movimentacoes_estoque_data(criado_em DESC,id DESC)`. Mantém30/31/32 e linhas existentes byte a byte.
É repetível/atômica, com lock_timeout5s. Nenhuma reabertura de saldo, reconciliação automática ou nova regra de escrita.
Bootstrap novo a inclui; banco existente usa `npm run db:migrar-consultas-estoque` ou psql com ON_ERROR_STOP e
transação única, em janela autorizada com backup e pausa das escritas. CREATE INDEX normal bloqueia escritores
durante a construção; não há promessa de migração online. O runner antigo continua somente30/31.
Consulta funciona sem33, com possível custo maior. Não apliquei33 em banco compartilhado ou container existente.

## 6. Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `src/modulos/estoque/estoque.types.ts` | Filtros opcionais e enum fechado dos sete tipos |
| `src/modulos/estoque/estoque.validacao.ts` | Datas/filtros estritos, intervalo UTC microsegundo, proteção contra newline em parâmetros numéricos |
| `src/modulos/estoque/estoque.repository.ts` | Histórico geral, filtros parametrizados, um snapshot, JOIN após página e count seguro |
| `db/init/33_estoque_consultas.sql` (novo) | Índice global justificado pelo EXPLAIN |
| `scripts/migrar-consultas-estoque.ts` (novo), `package.json` | Comando separado para aplicar/verificar33, erro redigido |
| `testes/estoque-leituras.test.mjs` |156 cenários HTTP de saldo/histórico/filtros/validação/guardas |
| `testes/integracao/estoque-leituras.test.mjs` |22 cenários PostgreSQL; reaproveita as fixtures existentes e adiciona7 casos |
| `testes/homologacao/estoque-consultas-explain.mjs` (novo) | Workload descartável e planos reproduzíveis da SQL efetiva |
| `http/estoque-consultas.http` (novo) | Exemplos de leitura/HEAD, filtros/offset positivo/erros |
| `api.md`, `docs/decisoes.md`, `testes/README.md`, `../README.md`, este relatório (novo) | Contrato, evolução da D-49, execução/implantação/evidências |

Total:10 arquivos rastreados modificados e5 novos. Sem alteração de lockfile/dependências, rotas/controller,
helpers de venda, services de escrita, imagem, autenticação, app.ts, frontend ou schemas já aplicados.

## 7. Comandos, resultados e verificações não executadas

Somente container novo `aquarilandia-estoque-consultas-pg-20261115`, tmpfs, usuário/banco fictícios teste,
porta efêmera54593. Suítes criam/removem schemas próprios. Nenhuma conexão à base de desenvolvimento/loja.

| Verificação | Resultado real |
|---|---|
| Git status/log/worktree, fetch inicial/final, ancestry/diff | Base e imagens incorporadas confirmadas; sem integração de branches |
| Backend `npm run typecheck` / `npm run build` | Passaram, inclusive depois do último ajuste de validação |
| Typecheck isolado do novo script com `tsc --ignoreConfig ... --noEmit scripts/migrar-consultas-estoque.ts` | Passou |
| Backend `npm test` final | **1.318 passaram**,0 falhas/ignorados; a suíte HTTP de leituras contém156 casos |
| `TEST_DATABASE_URL=... npm run test:integration` final | **620 passaram /1 falhou**,621 casos,0 ignorados; a falha é o teste B2 descrito abaixo |
| Integração específica de leituras de estoque | **22 passaram** dentro da suíte final; inclui todos os7 novos cenários e migração33 |
| Reprodução sem o incremento | `vendas-admin.test.mjs` em archive do HEAD35fbdf0: **16 passaram /1 falhou**, mesma asserção/resultado |
| `TEST_DATABASE_URL=... ARQUIVO_EXPLAIN=... node --import tsx testes/homologacao/estoque-consultas-explain.mjs` | Passou;120mil movimentos reconciliados,30 planos reais (3×5×2) |
| Migração33 via comando npm na integração | Primeira aplicação, reaplicação, definição válida, timeout/rollback e preservação dos dados passaram |
| `npm audit --json` | Zero vulnerabilidades em todas as gravidades; sem correção automática |
| `npm ls --depth=0` em backend/ | Passou; dependências declaradas presentes, nenhuma instalação/atualização nesta rodada |
| `git diff --check` e whitespace de novos arquivos | Conferidos ao encerrar; sem conflitos unmerged/marcadores |

**Falha preexistente confirmada:** [`vendas-admin.test.mjs:384`](../testes/integracao/vendas-admin.test.mjs#L384)
faz a venda A ficar em `now()-3h`; linhas386–400 filtram pelo dia atual em São Paulo e esperam que A pertença a hoje.
A execução ocorreu pouco depois de00h de15/11 em São Paulo: A pertence ao dia14, então a resposta correta ao
filtro é `[]`, mas o teste espera `[16]`. Mesmo resultado no HEAD sem alterações desta tarefa, com PG descartável.
Não é evidência de regressão de filtro de estoque, nem de bug da consulta de vendas.
**Responsável sugerido: B2/tests.** Fixar datas da fixture dentro de um dia conhecido e ajustar os limites a esse
dia, sem alterar regra comercial para agradar ao teste. O arquivo/fluxo B2 não foi modificado nem a falha ocultada.

Não executados: navegador/E2E/frontend/lint frontend (nenhuma edição/consumidor de UI afetado), Docker build/deploy,
gateway/e-mail reais, carga prolongada ou migração compartilhada. Backend não dispõe de script de lint.
Resultados históricos de imagens não foram apresentados como novas execuções E2E. As integrações backend de
imagem/catálogo/estoque existentes foram executadas pela suíte geral e não tiveram falha nesta rodada.

## 8. Segurança e leituras sem alterações de dados

Sessão/admin atuais precedem a validação e o SELECT. Reutiliza
[`autenticar`](../src/middlewares/autenticar.ts#L8),
[`exigirAdmin`](../src/middlewares/exigirAdmin.ts#L4) e
[`sessao.repository`](../src/modulos/auth/sessao.repository.ts#L15), sem escrever último acesso ou renovar sessão.
Visitante/sessão revogada/expirada/conta inativa401; cliente ou papel rebaixado403. Cabeçalho X-Role não concede acesso.
GET/HEAD mantêm no-store/Vary Cookie, inclusive erro, sem exigir Origin como nas leituras anteriores.
Escritas continuam com Origin; CORS não é tratado como autorização ou CSRF.

Lista de campos/tipos fechada, datas e inteiros estritos, filtros/limite/offset parametrizados. Newline final em
inteiros/datas é recusado explicitamente (regex `$` de JS, isoladamente, pode casar antes dessa quebra).
Erros mantêm `{erro,detalhes?}`; banco retorna500 genérico e logger existente redige mensagem livre.
Não adiciona telefone/e-mail/nome do ator, cookie, hash, chave de idempotência, SQL ou caminho interno ao DTO/log.
IDs de venda/operação que já existiam ficam apenas nas leituras administrativas.

Nos testes reais, fotos completas de **todas as tabelas** (contagem+hash do conteúdo, incluindo produtos/fichas,
operações/movimentos, vendas/itens/pagamentos/sessões) antes/depois das leituras válidas/inválidas/HEAD/erro
foram idênticas. Os helpers de fixture criam dados antes da foto; nenhuma asserção depende de autorizar escrita
pelo GET. Teste concorrente existente confirma ausência de movimento/saldo parcial antes do COMMIT da escrita.
Reconciliação executada nas fixtures não encontrou divergência; não virou efeito colateral do endpoint.

## 9. Conflitos, limitações e pendências

Fetch final manteve35fbdf0(main), b872486(B1) e7e9b6fd(B2). HEAD é a main atual e os demais são ancestrais;
não há mudança remota concorrente nos arquivos desta entrega nem arquivos unmerged/marcadores.
Comparação de árvores main/B1 sem diferença; o merge PR44 é apenas inclusão do trabalho já preservado.
Não se criou commit temporário para simular o diff local como merge: a conclusão é sobre essas referências e
as alterações examinadas, sem garantia para trabalho privado/novos commits futuros.

Sobreposições introduzidas: script no package.json, docs compartilhados/D-49 e nome da migração33.
Revalidar referências antes de integrar, principalmente se B2 criar nova migração com o mesmo número.
Sobreposição preexistente: correção financeira e ajustes da worktree combinada continuam locais àquela área;
não foram copiados para contornar testes ou mudar refund/expiração. Nenhuma incompatibilidade nova comprovada
entre esta leitura e as rotas existentes; a falha temporal B2 antecede o incremento.

Pendências separadas: fixture temporal de vendas-admin; estorno confirmado por webhook sob responsabilidade B2;
lista geral de saldos ainda ausente; aplicação operacional do índice com backup/janela, e medição em volume real.
Não há novo movimento, reconciliação automática, frontend/dashboard/exportação, mudança de disponibilidade,
pagamento, sessão ou política financeira. Históricos antigos permanecem documentos de suas respectivas rodadas.

## 10. Entrega revisável

- **Worktree:** `/tmp/aquarilandia-estoque-consultas-20261115`.
- **Branch:** `feat/estoque-consultas-movimentacoes-20261115`, HEAD35fbdf0, sem staging/commit.
- **Relatório:** `backend/docs/estoque-consultas-2026-11-15.md`.
- **Contrato/exemplos:** `backend/api.md`, `backend/http/estoque-consultas.http`.
- **Evidências:** `/tmp/aquarilandia-estoque-consultas-20261115-evidencias/`, incluindo logs finais, JSON EXPLAIN,
  cópia da base para reprodução da falha B2 e snapshots das quatro áreas preservadas.

Nenhum commit, push ou deploy. A migração foi aplicada somente nos schemas descartáveis; o container preexistente
não foi alterado. Não remover a worktree/pasta temporária antes da revisão e transporte, pois ainda dependem de `/tmp`.
O PostgreSQL exclusivo desta tarefa foi encerrado/removido após confirmar zero schemas de teste restantes.
O container `aquarilandia-db` preexistente permanece em execução. Logs e entrega revisável foram mantidos.
