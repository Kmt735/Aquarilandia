# Estoque — consultas administrativas e homologação com Backend 2

**03/11/2026. Implementado e testado em cópias isoladas; sem merge definitivo, commit ou push.**

## 1. Estado inicial e final do Git

Repositório real: `/home/mateus/Projetos/Aquarilandia`. O caminho duplicado configurado no ambiente não existe.
Nenhum AGENTS.md aplicável foi encontrado. Foram lidos o contrato PDF disponível, api.md, decisões, proposta
do Ciclo 3, relatório administrativo anterior, schemas, sessão/admin/Origin, transação e estoque.

| Referência | Snapshot examinado após fetch e rechecado ao encerrar |
|---|---|
| Branch de trabalho / HEAD | `branch-backend` / `afa0d352fe078afe7a78baca43d2029d59d008b2` |
| `origin/main` | `afa0d352fe078afe7a78baca43d2029d59d008b2`, igual ao HEAD |
| `origin/branch-backend` | `856e7331f55344076f3d6ef5fb81942ec752ac4b`; local já estava 27 commits adiante |
| `origin/branch-backend-2` | `821e8c5d059738614e3ae6338bba950a189e3150`; `HEAD...remoto = 0 7` |
| Ciclo 2 | `ad21af5` integrado; diretório antigo em /tmp ausente, referência prunable preservada |

A main local antiga não foi usada como base. `git ls-files -u` vazio e busca de marcadores sem conflitos.
Inicialmente havia **6 arquivos rastreados modificados e 13 novos**, do incremento anterior: preservados.
Ao final permanecem esses arquivos, com a evolução descrita abaixo e **4 novos adicionais** (17 novos no total).
HEAD, branch e índice não foram alterados. Referências remotas foram atualizadas apenas por fetch.
Não houve merge/rebase/reset/stash/clean/commit/push, poda de worktrees ou edição no frontend/Backend 2.

O manifesto SHA-256 inicial contém 400 fontes (387 rastreados e 13 novos). A aplicação desta rodada foi
limitada a 14 arquivos explicitamente listados na seção 6; os demais fontes, inclusive a proposta do Ciclo 3,
SQL 30, script de migração e autenticação, foram preservados byte a byte. O trabalho local não foi substituído
por um checkout de HEAD; as cópias incluíram também os arquivos ainda não commitados.

## 2. Backend 2 e combinação realmente executada

Sete commits adicionais, confirmados novamente por fetch:

| Commit | Mudança |
|---|---|
| `260cdcc` | Limites de requisição para recuperação de senha |
| `c3d59a7` | `POST /auth/esqueci-senha` |
| `7c839ad` | `POST /auth/redefinir-senha` |
| `1bd810d` | Troca de senha invalida links de recuperação |
| `0b7a33c` | Senha atual para trocar e-mail |
| `5b29a1e` | Testes de recuperação/D-47 |
| `821e8c5` | D-47, recuperação e correção documental de estorno |

Fontes locais completos foram copiados para `/tmp/aquarilandia-estoque-leituras-20261103/local`.
Outra cópia, `combinado`, recebeu **de fato** `git diff --binary HEAD origin/branch-backend-2` via `git apply`.
Foi executada a aplicação combinada com Express, sessões e PostgreSQL real, não apenas `git apply --check`.
Dependências existentes foram reutilizadas; sem npm install/ci, alteração de versões ou lockfile.

**Resultado:** typecheck/build, 955 testes HTTP/unitários, 411 integrações e 4 testes cruzados passaram.
O harness reproduzível está em `testes/homologacao/estoque-backend2.test.mjs`, executado separadamente somente
na cópia combinada; não roda nos globs padrão da base local que ainda não contém as novas rotas de auth.
Ele comprova login real de admin, D-47 (422 sem senha/200 com senha e revogação dos tokens), redefinição
revogando acesso às duas leituras e ao replay (401), e novo login permitindo replay sem segunda entrada.
Autoria continua vinculada ao mesmo ID, mesmo após mudar e-mail/senha. Nenhum e-mail real foi enviado.

## 3. Conflitos e compatibilidade funcional

| Área | Evidência / resultado / encaminhamento |
|---|---|
| Conflitos textuais | Nenhum na aplicação real do patch sobre os fontes locais; sem marcadores ou entradas unmerged. |
| Documentação compartilhada | api.md e decisoes.md alterados dos dois lados. Na cópia combinada, D-47 remota, D-48 administrativa e D-49 de leituras coexistem. A correção remota do estorno foi preservada nessa cópia. Não copiar os documentos combinados de volta como integração definitiva. |
| Schema/executor/guardas | Os sete commits não alteram schemas, `utils/transacao.ts`, `types/index.ts`, autenticar/admin/Origin ou o módulo de estoque. Testes combinados exercitam o mesmo PoolClient/guardas atuais. |
| Escritas de saldo | Busca em `backend/src` local, remoto e combinado: só estoqueRepository atualiza unidades (`estoque.repository.ts:70`). Cadastro de produto insere zero (`produto.repository.ts:49`); PATCH, DELETE e reativação preservam unidades. Fixtures SQL não são fluxo de produção. |
| Vendas/cancelamento/refund | Nenhuma nova implementação comercial nesses commits. Rotas de venda continuam preparatórias; não há baixa, liberação ou devolução automática concorrente com este módulo. Não foi necessário escolher política comercial para integrar as leituras. |
| Preço/disponibilidade/frontend | Projeções públicas continuam centavos e `emEstoque = estoque > 0` (`produto.projecoes.ts:4`). Testes reais confirmam a requisição da vitrine e exclusão de inativos/sem ficha. Nenhum consumidor público foi direcionado a rota administrativa. |

Não foi encontrada incompatibilidade funcional no escopo testado. Isso não garante merges futuros:
novos commits e alterações não commitadas de terceiros não acessíveis neste repositório precisam de nova revisão.
Integração definitiva dos sete commits ainda cabe à equipe; a worktree original não recebeu seu código.

## 4. Contrato efetivamente implementado

| Rota | Parâmetros / resposta |
|---|---|
| `GET /api/estoque/:produtoId` | Sem query; `{produtoId,nome,ativo,saldoAtual}` inclusive inativos. |
| `GET /api/estoque/movimentacoes` | `produtoId` obrigatório; pagina=1/limite=20 (máximo100); `{itens,total}`. |

Usa `/:produtoId` **já previsto em api.md**, em vez da sugestão condicional `/produtos/:id`; sem novo alias.
O caminho estático de histórico precede o parâmetro (`estoque.routes.ts:14`). Ambas usam sessão e papel atual
admin (`autenticar.ts:13`, `sessao.repository.ts:15`, `exigirAdmin.ts:4`); visitante/revogado/expirado/inativo
401, cliente403. GET não exige Origin, conforme leituras administrativas existentes; POST continua exigindo-o.
GET e HEAD recebem no-store/Vary Cookie antes das guardas, inclusive nas respostas de erro.

Exemplo de saldo:

```json
{"produtoId":42,"nome":"Peixe de exemplo","ativo":false,"saldoAtual":7}
```

Exemplo de histórico:

```json
{"itens":[{"operacaoId":"6229c4e2-a4c4-4bb7-a07d-43b9048bde90","produtoId":42,"tipo":"entrada","quantidade":2,"delta":2,"saldoAnterior":5,"saldoPosterior":7,"criadoEm":"2026-11-03T15:00:00.000Z","motivo":"Reposição conferida","origem":"admin","autorId":9}],"total":1}
```

`saldoAtual` é presente; `saldoPosterior` do histórico é snapshot imutável. O POST mantém seu DTO histórico
original com saldoAtual, inclusive no replay. Origem/tipo abertura e autorId null identificam legado.
autorId é somente FK técnica para auditoria; sem nome/e-mail, sessão, chave idempotente, hash ou credenciais.
Datas ISO UTC com milissegundos; o ID BIGSERIAL do movimento só desempata dentro do banco.

Validação sem coerção de arrays/valores repetidos: strings decimais canônicas positivas, ID até INT32MAX,
paginação e offset seguros. Query fechada a produtoId/pagina/limite; tipo/de/ate ainda retornam400.
Inexistente404; novo sem histórico200 com lista vazia; falha do banco500 genérico sem SQL ou stack.
Formato `{erro,detalhes?}` local preservado, diferente de `{erro:codigo,mensagem}` do PDF; o PDF não define
esses DTOs de auditoria. A política de baixa divergente do PDF permanece pendente, sem implementação implícita.

`estoque.repository.ts:14` calcula existência, total e página numa consulta parametrizada/snapshot único.
Ordena por criado_em DESC e id DESC; total anterior à paginação, mesmo fora do fim. Entre requisições,
inserções podem deslocar páginas: paginação offset não promete snapshot de toda a navegação.
As leituras não alteram saldo, histórico, sessão ou migração; saldo e histórico lidos em requests distintos
podem representar instantes diferentes, sem que isso signifique corrupção.

## 5. Banco, migração, concorrência e reconciliação

Somente container **`aquarilandia-estoque-leituras-pg-20261103`**, imagem PostgreSQL17-alpine, usuário/banco
fictícios `teste`, porta local efêmera63716, volume tmpfs. Cada suíte criou/removeu schema próprio.
Nenhuma conexão/migração no banco compartilhado ou de produção; o serviço Compose existente não foi usado.

Nenhuma mudança de schema nesta rodada. Reutiliza SQL30 e índice `(produto_id,criado_em,id)` existente.
Verificados bootstrap vazio e banco legado com abertura zero/positiva/inativa, sem incremento/recriação.
O teste novo roda **`npm run db:migrar-estoque` duas vezes** sobre seu schema com dados/movimentos e confere
saldo, ativo, timestamp e contagens inalterados; leitura da abertura continua igual. A suíte anterior também
testa aplicação incremental inicial, rollback de DDL e recusa de drift manual (SQLSTATE55000).

Reconciliação real após movimentos e concorrência: `produtos.estoque::bigint = COALESCE(sum(delta),0)` para
todos os produtos do schema; nenhuma divergência. Leitura não legitima drift nem cria abertura de reparação.
Uma conta SQL com permissão direta ainda pode alterar produtos fora do service; o mecanismo atual detecta
isso na reaplicação/reconciliação, não promete proibir qualquer operador do banco.

Teste concorrente bloqueia o INSERT de histórico **depois** do UPDATE com advisory lock controlado:
GET observa saldo/histórico anteriores ao COMMIT; ao liberar, vê saldo3/histórico2. Sem saldo5→3 exposto
antes do movimento correspondente. Suítes anteriores também mantêm rollback, última unidade, replay concorrente
e serialização com PATCH/DELETE/reativação. Não simula uma venda ainda inexistente.

## 6. Arquivos alterados nesta rodada

| Arquivos | Motivo |
|---|---|
| `src/modulos/estoque/estoque.types.ts` | DTOs e filtros de leitura |
| `estoque.validacao.ts` | Validação canônica, parâmetros fechados e paginação |
| `estoque.repository.ts` | Saldo real e histórico paginado em snapshot único |
| `estoque.service.ts`, `estoque.controller.ts`, `estoque.routes.ts` | Leituras/404/guardas/cache; POST preservado |
| `testes/estoque-leituras.test.mjs` | 54 testes HTTP novos |
| `testes/integracao/estoque-leituras.test.mjs` | 15 testes PostgreSQL novos |
| `testes/homologacao/estoque-backend2.test.mjs` | 4 testes cruzados, somente na versão combinada |
| `api.md`, `docs/decisoes.md`, `testes/README.md` | Contrato, D-49 e comandos/condições de homologação |
| `docs/estoque-admin-2026-11-03.md` | Nota de evolução; preserva contagens históricas do primeiro incremento |
| Este relatório | Evidências e limites da entrega |

README principal, package.json, agregador de rotas, SQL30, script de migração e testes anteriores continuam
com as modificações locais que já existiam, sem novas alterações desta rodada. Nenhuma dependência alterada.

## 7. Comandos e resultados

Executados com Node/dependências existentes, sockets locais liberados e banco descartável. Logs em
`/tmp/aquarilandia-estoque-leituras-20261103/`; são artefatos temporários, não garantia de retenção.

| Base / comando | Resultado |
|---|---|
| Git status/log/worktree/ls-files -u, fetch, ancestry/diff | Referências acima; 0/7 para Backend2; sem conflito pendente |
| Cópia combinada: `git apply --check` e `git apply` | Patch realmente aplicado; D-47/D-48/D-49 preservadas |
| Local: `npm run typecheck` | Passou |
| Local: `npm test` | **940 passaram**, 0 falhas/ignorados; inclui54 novas HTTP |
| Local: `TEST_DATABASE_URL=... npm run test:integration` | **384 passaram**, 0 falhas/ignorados; inclui15 novas PostgreSQL |
| Local: nova integração após usar comando npm de migração | **15 passaram**; sem ampliar a contagem anterior |
| Local: `npm run build` | Passou |
| Local: `npm audit --json` | **0 vulnerabilidades** em todas as gravidades |
| Combinada: `npm run typecheck`, `npm run build` | Passaram |
| Combinada: `npm test` | **955 passaram**, 0 falhas/ignorados |
| Combinada: `TEST_DATABASE_URL=... npm run test:integration` | **411 passaram**, 0 falhas/ignorados |
| Combinada: `node --import tsx --test testes/homologacao/estoque-backend2.test.mjs` com TEST_DATABASE_URL | **4 passaram**, 0 falhas/ignorados; separados dos411 |
| Combinada: `npm audit --json` | **0 vulnerabilidades** |
| Frontend local: `npm test` | **89 passaram**, 0 falhas/ignorados |
| Frontend local: `npm run build` | Passou; aviso existente de chunk maior que500kB |
| Final: `git diff --check` e whitespace dos arquivos novos | Passaram |

A primeira execução do teste novo revelou nome científico duplicado na **fixture** (constraint real);
a fixture foi corrigida para valores únicos. As execuções finais acima passaram. Não houve correção de
produção motivada por essa fixture.

**Não executados:** navegador/E2E e lint frontend (nenhuma alteração de UI; backend não declara script lint),
gateway/checkout reais, deploy ou teste de carga. Não se declaram essas verificações aprovadas.
Catálogo público foi verificado por HTTP/PostgreSQL; isso não é nova homologação visual da vitrine.

## 8. Riscos e acordos pendentes

1. **Antes de vendas reais — B1+B2:** aprovar saldo disponível vs físico/reservado, momento do débito, estados,
   expiração, compensação e idempotência de negócio propostos no Ciclo3. Este incremento não os aprova.
2. **Antes de integrar rotinas comerciais — B2:** não escrever estoque diretamente; usar futuro service B1
   com o mesmo PoolClient de venda/itens/histórico. Não há helper comercial implementado por esta tarefa.
3. **Integração de branches — equipe:** combinar os sete commits a partir de refs atualizadas, preservar D-47
   e a correção de estorno remotas, D-48/D-49 e trabalhos locais. Reexecutar testes se a base mudar.
4. **Operação — B1/infra:** implantar migração incremental com backup/verificação/reconciliação na janela
   autorizada. Não usar db:reset nem aplicar esta tarefa diretamente em banco compartilhado.
5. **Auth/e-mail — B2/infra:** recuperação depende do provedor/configuração. O modo desenvolvimento imprime
   conteúdo de e-mail; o harness interceptou esses logs e não configura ambiente produtivo. Revogação vale
   para a próxima autorização; não se promete interromper retroativamente uma operação já autorizada em voo.
6. **Histórico — B1:** tipo/de/ate e lista geral continuam pendentes; volume alto pode exigir revisão de plano
   SQL/cursor com medições. Total e página têm snapshot por resposta, não de uma sessão de navegação inteira.

Vitrine já corrigida continua usando rota pública; saldo zero ou nenhum peixe ativo com ficha é vazio legítimo.
Não foram criados mocks de estoque nem fallback que esconda falha de banco. Reservas, checkout, pagamento e
frontend permanecem fora deste incremento.
