# Revisão do último pull e cadastro de produtos — 25/10/2026

## Estado observado antes de editar

- `git reflog --date=iso`: único pull registrado em **24/10/2026, 20:38:57 -0300**, fast-forward
  de `61fca98` para `c1194a6`. HEAD continua `c1194a6`; não há pull posterior registrado entre os incrementos.
  Não foi executado outro pull/fetch nesta tarefa; esta revisão cobre o estado local disponível.
- Comparação feita com `git log 61fca98..HEAD`, `git diff 61fca98..HEAD` e `git diff HEAD`, além de leitura
  dos arquivos ainda não rastreados. O intervalo do pull altera 170 arquivos, incluindo o redesign do frontend.
- `git ls-files -u` vazio e nenhum marcador de conflito encontrado em backend/frontend/README. Isso não foi
  usado como prova de compatibilidade: esquema, sessão, contratos, DTOs e rotas foram confrontados abaixo.
- Já estavam locais: consultas PostgreSQL de categorias/produtos/peixes, filtros, CRUD de categorias,
  `exigirAdmin`/`exigirOrigem`, DTOs, testes, documentação dos incrementos e scripts de teste em `package.json`.
  O PDF também estava não rastreado. Esses arquivos foram preservados; não houve reset/clean/stash nem commit.

## Origem das alterações e compatibilidade

| Área | Veio do pull (`61fca98..c1194a6`) | Já era local antes desta tarefa | Resultado da comparação |
|---|---|---|---|
| Banco | `db/init/01_catalogo.sql`, `10_clientes.sql`, `20_vendas.sql`, script de constraints e Docker | Consultas SQL e fixtures dos incrementos | Compatíveis: SERIAL numérico, preço INTEGER em centavos, estoque não negativo, 11 tabelas 1:1 e categoria sem desativação. Nenhum SQL fonte foi modificado. |
| Autenticação | Argon2, cadastro/login, cookie-parser, hash de sessão, consulta `sessoes` + papel atual, `types/express.d.ts` | Guardas de admin/Origin e seu uso em categorias | Compatíveis: o papel é `cliente`/`admin`, vem do banco e preenche `req.usuario`. POST de produtos reutiliza exatamente essa cadeia. |
| CORS | `app.ts` com origem fixa, sem habilitar credenciais | `api.md` já exigia sessão por cookie e `credentials: true` | Divergência funcional localizada resolvida: adicionado `credentials: true`, mantendo origem fixa. Preflight verificado. |
| Rotas | Montagem `/api`, auth, orçamentos migrados, routers vazios de clientes/vendas/frete/webhook | Router do catálogo com consultas persistentes e escrita de categorias | Adicionado somente POST de produtos. GETs preservados; nenhum router do outro integrante foi reorganizado. |
| DTOs | Tipos antigos de mock (ID textual/preço em reais) e tipos de cliente/sessão | DTOs de catálogo numéricos, centavos, `{ itens, total }`, ficha discriminada | Os tipos de mock locais já foram removidos e não eram usados por auth/vendas. A resposta do POST usa a própria consulta pública existente. |
| Transações | `api.md` descrevia `utils/transacao.ts`, mas o arquivo não existia | Nenhum helper transacional implementado | Implementado o helper compartilhado previsto, com liberação e descarte se rollback falhar. Repositories recebem executor opcional; service orquestra. |
| Testes/dependências | Lockfile, scripts de verificação SQL e exemplos `.http` | Runner Node/tsx, 286 testes HTTP e 122 de integração | Dependências/lockfile mantidos. Todas as suítes anteriores continuam passando; adicionados testes de POST e regressões reais de cadastro/login. |
| Frontend | Redesign, páginas individuais e dados locais próprios | Nenhuma integração HTTP de catálogo no frontend | Sem consumidor de POST a adaptar; frontend foi mantido byte a byte. Os testes desta tarefa não certificam a interface gráfica. |

Evidências do código recebido, preservado: [schema do catálogo](../db/init/01_catalogo.sql:17),
[sessões e papel](../src/modulos/auth/sessao.repository.ts:13),
[autenticar](../src/middlewares/autenticar.ts:7), [cookie do login](../src/modulos/auth/auth.controller.ts:15),
[tipo da requisição](../src/types/express.d.ts:6), [montagem das rotas](../src/routes/index.ts:21).
A correção CORS está em [app.ts](../src/app.ts:11); a nova rota em
[catalogo.routes.ts](../src/routes/catalogo.routes.ts:19).

## Conflitos de comportamento e decisões pendentes

1. **Formato de listas e erros.** O PDF, página 1, usa `{ itens, total }` e `{ erro: codigo, mensagem }`;
   as convenções genéricas locais ainda descrevem `{ dados, total, pagina, limite }` e erro por campo com `422`.
   Os incrementos já adotaram o envelope do PDF para o catálogo e mantiveram `AppError`/`errorHandler` local.
   POST preserva essa escolha: validação `400`, duplicidade científica `409`, erro inesperado `500` sem detalhes
   internos. Nenhuma mudança global em auth ou nas demais listas. Ver [erros](../src/middlewares/errorHandler.ts:8)
   e as seções específicas de categorias/produtos em [api.md](../api.md).
2. **Baixa de estoque em momentos diferentes.** O PDF, página 4, prevê baixa no pagamento; o SQL recebido diz
   baixa na criação da venda ([20_vendas.sql](../db/init/20_vendas.sql:10)), assim como D-16 e D-21 em
   [decisoes.md](decisoes.md). Os services/routers de vendas ainda são esqueletos
   ([venda.service.ts](../src/modulos/vendas/venda.service.ts:1),
   [venda.routes.ts](../src/modulos/vendas/venda.routes.ts:3)). A decisão exige os dois responsáveis; não foi
   sobrescrita nem implementada aqui. O cadastro independe dela: nasce com estoque zero e rejeita saldo positivo.
3. **Discriminador de ficha é o slug.** Os detalhes/filtros/atalhos locais dependem dos 11 slugs estruturais.
   A proteção já implementada em categorias permanece ([categoria.repository.ts](../src/modulos/catalogo/categoria.repository.ts:52)).
   O cadastro lê a categoria no banco e usa `FOR SHARE` até COMMIT para impedir mudança/exclusão durante a gravação.
   Categorias especializadas passam a exigir ficha no novo POST; leituras de dados legados sem ficha continuam
   retornando `ficha: null` em produtos e omitindo o peixe nos atalhos. Não se alterou o schema para exigir isso
   globalmente nem foram corrigidos dados de produção nesta tarefa.
4. **Documentado não significa implementado.** Auth só registra cadastro/login
   ([auth.routes.ts](../src/modulos/auth/auth.routes.ts:7)); sessão de consulta, logout e recuperação não foram
   implementados aqui. Os contratos futuros de vendas/estoque continuam documentados, sem novos endpoints.
   O filtro público `incluir_inativos=true` continua recusado; ter um middleware admin não libera esse filtro.

## Implementação deste incremento

O corpo completo, defaults, precisão, enums e regras estão na seção de cadastro de [api.md](../api.md).
Produto e ficha são inseridos e consultados na mesma transação. A resposta só é enviada após COMMIT e coincide
com o detalhe público. Tabelas/colunas de ficha vêm de uma lista fechada; valores usam parâmetros SQL.
Nome científico duplicado aciona a constraint do banco e desfaz também o produto intermediário. Estoque é
fixado em zero, sem aceitar imagem/ativo/campos internos. A entrada positiva futura precisa de movimento e
atualização de saldo atômicos, com motivo e responsável; esse módulo permanece ausente.

Arquivos modificados nesta tarefa, comparados ao snapshot anterior (e não apenas a HEAD, que não contém os
incrementos locais): `src/app.ts`, `src/routes/catalogo.routes.ts`, `src/modulos/catalogo/produto.controller.ts`,
`produto.service.ts`, `produto.repository.ts`, `produto.types.ts`, `src/utils/transacao.ts`,
`src/modulos/catalogo/ficha.definicoes.ts`, `ficha.repository.ts`, `produto.validacao.ts`,
`testes/produto-cadastro.test.mjs`, `testes/integracao/produto-cadastro.test.mjs`,
`testes/fixtures/produto-cadastro.mjs`, `testes/README.md`, `api.md`, `docs/decisoes.md`,
este relatório e o `README.md` da raiz. Os demais arquivos locais anteriores não foram alterados.

## Verificações

| Verificação em `backend/` | Resultado |
|---|---|
| `npm run typecheck` | Passou |
| `npm test` | 392 testes passaram, nenhum ignorado |
| `TEST_DATABASE_URL=… npm run test:integration` | 174 testes passaram, nenhum ignorado |
| `npm run build` | Passou |
| `git diff --check` (na raiz) | Passou; alterações de arquivos ainda não rastreados também conferidas |
| Script original de constraints de clientes/vendas | 37 verificações OK |

A integração usa PostgreSQL 17 descartável
e schemas exclusivos, removidos ao final. Cobre as 11 fichas mínimas/completas, campos obrigatórios, limites,
defaults, permissões/sessões/Origin, associação incompatível, categoria excluída concorrentemente, duplicidade
científica concorrente, rollback real da ficha e da leitura final e paridade de POST com GETs.

O script **original** `db/testes/verificar_clientes_vendas.sql` foi executado sem alterações em outro schema
descartável com os três scripts de init: **37 verificações OK**, nenhuma `FALHOU`. As mensagens ERROR de
recusa são esperadas e conferidas pelo próprio script (SQLSTATE/constraint). Isso valida as constraints do pull,
sem afirmar que os fluxos HTTP de vendas/pagamentos já existam. Cadastro/login reais, cookie e sessão também
foram exercitados pela nova integração; nenhum arquivo de implementação desses módulos foi editado.
