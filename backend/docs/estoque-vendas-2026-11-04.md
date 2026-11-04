# Estoque vinculado a vendas — contrato interno e homologação

**04/11/2026. Backend 1 implementado; orquestração comercial do Backend 2 ainda a integrar.**

## 1. Git, referências e preservação

Repositório real: `/home/mateus/Projetos/Aquarilandia`; o caminho duplicado configurado no ambiente continua
inexistente. Nenhum AGENTS.md aplicável foi encontrado. Foram examinados api.md, decisões D-16/D-21/D-26,
proposta do Ciclo3, relatórios administrativos anteriores, schemas, estoque, sessão/admin/Origin, transação,
vendas/pagamentos e os sete commits adicionais do Backend2. O PDF já havia sido confrontado nos relatórios
anteriores; nesta tarefa as decisões explícitas do pedido determinam baixa na criação, sem reserva separada.

| Referência | Estado inicial e rechecado por fetch ao encerrar |
|---|---|
| Branch/HEAD | `branch-backend` / `afa0d352fe078afe7a78baca43d2029d59d008b2` |
| `origin/main` | `afa0d352fe078afe7a78baca43d2029d59d008b2`, igual ao HEAD |
| `origin/branch-backend` | `856e7331f55344076f3d6ef5fb81942ec752ac4b`; local já estava 27 commits adiante |
| `origin/branch-backend-2` | `821e8c5d059738614e3ae6338bba950a189e3150`; divergência HEAD…remoto **0/7** |

Inicial: **6 arquivos rastreados modificados + 17 novos**, total 404 fontes (387 rastreados). Os incrementos
administrativos e de leituras ainda estavam sem commit; a homologação anterior não os integrou por merge.
Final: **7 rastreados modificados + 24 novos**. Acréscimo desta rodada: 7 arquivos; evolução localizada em 13
arquivos anteriores. HEAD/branch/índice mantidos, sem arquivos unmerged ou marcadores de conflito.
Nenhum merge/rebase/reset/stash/clean/commit/push foi executado. Somente remote-tracking refs atualizadas por fetch.

Trabalho preparado/testado em `/tmp/aquarilandia-estoque-vendas-20261104/local` com todos os fontes locais,
incluindo novos/não commitados. Manifesto SHA-256 inicial protege os 404 arquivos; aplicação final limita-se
aos 20 arquivos listados na seção6. SQL 30, proposta do Ciclo3, relatórios anteriores, autenticação, código
comercial e frontend foram preservados byte a byte. Não foram instaladas dependências ou alterados lockfiles.

## 2. D-16/D-21/D-26 e funções efetivas

Exportadas por `src/modulos/estoque/estoque.service.ts`:

```ts
estoqueService.baixarParaVenda(vendaId: number, itens: ItemMovimento[], client: PoolClient): Promise<void>
estoqueService.estornarVenda(vendaId: number, client: PoolClient): Promise<void>
// types/index.ts: ItemMovimento = { produtoId: number; quantidade: number }
```

São funções internas, sem controller/rota pública. Não mudam status, criam venda, abrem transação ou chamam
gateway. Não há executor default/pool próprio. Toda leitura, lock e escrita usa o PoolClient recebido.
Uma sondagem SAVEPOINT/RELEASE exige BEGIN ativo (sem BEGIN:25P01 antes de escrita); não toma controle da
transação. O chamador deve propagar falhas até `comTransacao`; o helper compartilhado mantém COMMIT/ROLLBACK.
Evidências: `estoque-venda.repository.ts:9`, `estoque-venda.service.ts:13` e `utils/transacao.ts:6`.

**Baixa — D-16/D-26:**

1. Valida vendaId/itens numéricos positivos até 2147483647; exige campos próprios produtoId/quantidade,
   rejeita extras, soma repetidos sem overflow e ordena por ID, sem alterar o array recebido.
2. Bloqueia a venda FOR NO KEY UPDATE. Se já existe baixa com a mesma intenção consolidada, retorna sem
   nova escrita; quantidade/conjunto diferente 409. Retry não recria unidades mesmo após pagar/cancelar.
3. Primeira baixa exige `aguardando_pagamento` e itens já persistidos. Bloqueia itens e produtos por ID crescente;
   exige igualdade com itens_venda e produto existente/ativo com unidades suficientes. Não exige ficha técnica
   de uma categoria: regras adicionais de elegibilidade comercial continuam no catálogo/B2.
4. Antes de escrever, reúne **todos** os indisponíveis. Lança `ItensIndisponiveisError extends AppError`,409,
   mensagem `Estoque insuficiente`, propriedade interna `itensIndisponiveis: [{produtoId,quantidade}]` e detalhes
   `itens.<produtoId>.quantidade` com ID/quantidade solicitada. Não informa saldo exato, SQL ou nome de inativo.
   Mudança do detalhe antes documentado por índice/"Só restam N" é intencional: não havia consumidor comercial
   implementado e a tarefa exige IDs/quantidades sem exposição desnecessária.
5. Cria uma operação e um movimento por produto; mantém SQL parametrizado
   `UPDATE produtos SET estoque=estoque-$2 ... WHERE id=$1 AND ativo AND estoque >= $2`.
   Erro em qualquer item desfaz também a venda, itens e operação no rollback do chamador.

**Devolução — `estoque-venda.service.ts:45`:**

- Exige venda já `cancelada`, bloqueada no mesmo client; recusa `cancelamento_solicitado`, enviada/entregue
  e qualquer outro estado. Também recusa passagem registrada por envio/entrega no histórico de status.
- B2 deve gravar a transição/histórico **antes da chamada, na mesma transação**, após validar cancelamento
  não pago/expiração, ou após aprovação do estorno financeiro de venda paga. B1 não decide aprovação financeira.
- Busca somente `movimentacoes_estoque` da baixa original. Não lê itens_venda para devolver; alterações e até
  remoção de itens depois da baixa não mudam as quantidades originais. Ausência de baixa 409, sem crédito presumido.
- Bloqueia produtos por ID crescente, verifica overflow antes dos créditos e mantém UPDATE condicional de limite.
  Devolve a produto inativo sem reativá-lo. Repete/concorre sem somar novamente; compensação é integral nesta interface.
- Não pago expirar, não pago cancelar e pago cancelar após refund são **pontos de chamada ainda pendentes em B2**,
  não três fluxos operacionais de produção comprovados por este incremento.

**Pagamento — D-21:** confirmação não chama baixa. Teste real verifica o webhook preparatório repetido sem
segunda alteração, e retry do helper após status paga é no-op. Hoje `pagamento.controller.ts:17` apenas confirma
recebimento; persistência/processamento financeiro continua ausente. O teste não homologa um pagamento real.

`AppError` mantém o formato local `{erro,detalhes?}`. IDs inválidos400; venda inexistente404; indisponibilidade,
itens divergentes, estado incompatível, ausência de baixa ou overflow 409. SQL inesperado segue500 genérico do
handler existente. A assinatura interna devolve void, não uma nova resposta HTTP comercial.

## 3. Migração, constraints e movimentos

Nova `db/init/31_estoque_vendas.sql`, versão `002_movimentos_venda`; SQL 30/versão 001 não foi editado.
`npm run db:migrar-estoque` agora aplica/verifica 30 e 31 em ordem na mesma comTransacao, com lock_timeout 5s.
Em base existente, o runner bloqueia operações antes de produtos; bootstrap vazio executa os arquivos ordenados.
DDL tem transação/rollback, não reset. Implantar em janela autorizada com backup/pausa de escritas: DDL concorrente
com fluxos que já seguram locks pode exceder timeout/deadlock e deve abortar/reagendar, sem forçar continuidade.

| Área | Restrição/resultado |
|---|---|
| operacoes_estoque | origem adicional venda; venda_id FK sem cascata; tipo_venda baixa_venda/estorno_venda; referência original; sem autor admin/chave HTTP/hash |
| Unicidade | UNIQUE(venda_id,tipo_venda) **na operação**, UNIQUE(operacao_original_id); não nas linhas de produto |
| Referência | FK composta operação original/venda garante a mesma venda; trigger exige original de tipo baixa |
| movimentacoes_estoque | Novos tipos com delta negativo/positivo e quantidade positiva; movimento_original_id BIGINT FK/UNIQUE no estorno; UNIQUE(operação,produto) preservado |
| Compensação | Trigger confere produto/quantidade/referência exatos da baixa; CHECKs mantêm sinal e aritmética em BIGINT sem negativo |
| Integralidade | Constraint trigger diferido exige todos os itens na baixa e todos os movimentos originais na devolução; não permite operação vazia/parcial no COMMIT |
| Imutabilidade | Triggers anteriores de UPDATE/DELETE/TRUNCATE preservados; transacao_venda XID8 interno impede acrescentar movimentos comerciais depois do COMMIT original |

`transacao_venda` é metadado técnico definido pelo banco, não chave de idempotência, autoria ou dado público.
Operações administrativas/abertura antigas ficam com novas colunas null. A migração não muda saldo/timestamp,
não cria baixa retroativa de vendas antigas e não duplica abertura. Na reaplicação confere reconciliação.

Histórico administrativo mantém paginação/ordem/total/cache/permissões anteriores. Só em origem venda adiciona
`vendaId` e `operacaoOriginalId` (null na baixa); usa tipos baixa_venda/estorno_venda, autorId null e motivos fixos.
Admin/abertura mantêm exatamente o DTO anterior. `saldoPosterior` continua histórico; saldo atual permanece no
GET por produto. IDs internos de movimento/XID8/hash/chave não são expostos. Filtros tipo/de/ate continuam
não implementados e recebem400; o POST admin continua recusando tipos internos de venda.

**Prova multiproduto:** teste PostgreSQL cria uma baixa com dois movimentos e um estorno com dois movimentos;
novas operações iguais falham23505. Duas chamadas concorrentes de estorno geram somente uma operação e dois
créditos. Referências originais/quantidades conferidas; operação parcial falha no COMMIT e desfaz saldo/venda/itens.
Dados legados positivos/inativos e movimentos administrativos anteriores permanecem iguais após duas aplicações.

Somente container `aquarilandia-estoque-vendas-pg-20261104`, PostgreSQL17-alpine, banco/usuário fictícios teste,
porta efêmera56595 e tmpfs. Suítes criaram/removeram seus próprios schemas; nenhuma migração/conexão em base
compartilhada ou de produção. Reconciliação nas suítes de estoque: produtos.estoque = soma(delta), sem divergências.

## 4. Pontos de integração e responsabilidades de B2

| Ponto futuro | Chamada/obrigação |
|---|---|
| Criação (`venda.service`/controller/routes) | Validar sessão/Origin/dono, IDs/quantidades/preços/frete no servidor, criar venda e itens, chamar baixarParaVenda no mesmo client antes do COMMIT. Nenhuma escrita direta de unidades. |
| Cancelamento não pago | Lock/revalidar venda e transição, gravar cancelada+histórico e chamar estornarVenda na mesma transação. Erro deve desfazer tudo. |
| Expiração | Job B2 a cada 5 min; TTL 30 min por vendas.expira_em; lock/revalidar aguardando/vencida, cancelar+histórico+estornarVenda juntos. Não criado nesta tarefa. |
| Cancelamento pago | Manter cancelamento_solicitado durante pendência. Gateway fora dos locks/transações longas; após confirmação financeira, lock/revalidar, gravar cancelada+histórico e chamar estornarVenda. |
| Webhook/pagamento | Reconsulta/vínculo/valor/idempotência e disputa com cancelamento/expiração em B2. Nunca segunda baixa; dinheiro tardio/excedente não implica novo crédito de unidades. |
| Enviada/entregue | Nenhuma devolução automática; retorno físico eventual exige fluxo próprio futuro. |

O helper **não prova aprovação de refund** lendo cancelada: esse estado é a pré-condição confiada ao orquestrador.
Não há ainda referência inequívoca ao pagamento efetivo/estorno aprovado que permita B1 deduzi-lo sozinho sem
substituir o fluxo do colega. B2 precisa garantir essa transição e não usar "esgotou tentativas" como aprovação
financeira automática. Enquanto cancelamento_solicitado, B1 recusa devolver mesmo se alguém chamar prematuramente.

O schema atual de B2 (`20_vendas.sql`) não foi editado; usam-se seus nomes/estados reais e FKs existentes.
`venda.routes.ts`/controller ainda são preparatórios e service contém apenas contagens/resumo/transições auxiliares.
Não existe criação funcional para testar por HTTP: a integração foi feita com comTransacao e vendas/itens reais.
`produtoService.buscarParaVenda`/ProdutoVenda ainda não implementados; fechar leitura de preço/ativo sob locks
e snapshots com B2 antes de ligar checkout. Helper de estoque não reprecifica venda, não calcula total/frete.

## 5. Integração das branches e conflitos

Os mesmos sete commits adicionais do Backend2 permanecem fora do HEAD: 260cdcc (rate limit), c3d59a7/7c839ad
(recuperação), 1bd810d (invalidação de links), 0b7a33c (senha atual na troca de e-mail), 5b29a1e (testes), 821e8c5 (docs).
Não alteram vendas/cancelamento/refund funcional, schemas, transação compartilhada ou escrita de estoque.

Patch HEAD→origin/branch-backend-2 aplicado **de fato** sobre outra cópia completa, `combinado`. Sem conflitos
textuais; D-47 remota e D-48/D-49/D-50 locais coexistem. Correção documental remota de estorno mantida nessa
cópia. Nenhum desses arquivos remotos foi copiado ao original como integração definitiva.

Typecheck/build, 980 testes HTTP/unitários, 446 integrações PG e 4 cenários cruzados auth/estoque passaram.
Código combinado continua sem outra rotina alterando unidades fora do módulo estoque; catálogo insere zero.
Mudanças no types/index.ts limitadas a ItemMovimento já previsto; B2 não o alterou nesses commits.

**Sobreposições/ajustes de contrato:** erro por produtoId/quantidade substitui a proposta antiga de índice/saldo
exato; estados cancelada antes do helper e ordem de locks precisam ser observados por B2. O PDF previa baixa
no pagamento, mas as decisões explícitas desta tarefa adotam D-16. A proposta de alocação separada do Ciclo3
continua documento histórico, não implementado. Não foi feita escolha silenciosa de política comercial.

Não há incompatibilidade funcional comprovada no escopo homologado. Isso não garante merges futuros nem testa
trabalho não publicado de terceiros; revalidar referências e contratos ao implementar/criar rotas comerciais.

## 6. Arquivos, comandos e resultados

| Arquivos desta rodada | Motivo |
|---|---|
| `db/init/31_estoque_vendas.sql` (novo) | Evolução002, integridade, unicidade/compensação/imutabilidade |
| `scripts/migrar-estoque.ts` | Executar30+31 atomicamente com ordem de locks e logs genéricos |
| `src/modulos/estoque/estoque-venda.{service,repository,validacao}.ts` (3 novos) | Helpers transacionais e erro de domínio |
| `estoque.service.ts`, `estoque.types.ts`, `estoque.repository.ts` | Exportar helpers e leitura compatível dos novos movimentos |
| `src/types/index.ts` | ItemMovimento compartilhado |
| `testes/estoque-venda.test.mjs`, `testes/integracao/estoque-venda.test.mjs` (novos) | 25 validações e 33 cenários PG/HTTP reais |
| Integrações anteriores estoque/leituras/migração e harness homologacao/estoque-backend2 | Fixtures passam por002; 2 novos cenários de migração/legado/rollback |
| `README.md`, `api.md`, `docs/decisoes.md`, `testes/README.md`, este documento | Contrato, D-50, implantação/comandos e evidências |

Total 20 arquivos, dos quais 7 novos. Os demais fontes iniciais preservados por hash. Sem edição do frontend,
auth, middleware, webhook, gateway, vendas, package.json/lockfile ou SQL30.

| Comando/base | Resultado final |
|---|---|
| Git status/log/ls-files -u, fetch, diff/ancestry, busca de marcadores | Referências acima, 0/7 para B2; sem conflitos pendentes |
| Cópia combinada: git apply --check + git apply | Patch realmente aplicado, não só simulado |
| Local npm run typecheck / npm run build | Passaram |
| Local npm test | **965 passaram**, 0 falhas/ignorados; 25 novos |
| Local TEST_DATABASE_URL=... npm run test:integration | **419 passaram**, 0 falhas/ignorados; 33 por venda + 2 de migração novos |
| Combinado npm run typecheck / npm run build | Passaram |
| Combinado npm test | **980 passaram**, 0 falhas/ignorados |
| Combinado TEST_DATABASE_URL=... npm run test:integration | **446 passaram**, 0 falhas/ignorados |
| Combinado harness testes/homologacao/estoque-backend2.test.mjs | **4 passaram**, separados dos 446; login, D-47, revogação e replay |
| npm audit --json, local e combinado | **0 vulnerabilidades** em todas as gravidades; nenhuma correção automática |
| npm run db:migrar-estoque via suítes | Bootstrap/evolução/reaplicação/rollback, preservação de legado e reconciliação passaram |
| git diff --check + whitespace de arquivos novos | Passaram |

Logs temporários: `/tmp/aquarilandia-estoque-vendas-20261104/`. Fontes finais conferidos contra a cópia testada.
Não contar a primeira execução do teste unitário dentro da restrição de subprocessos (só reportava o arquivo);
ela foi refeita com execução real, 25 testes individuais, e incluída na suíte final 965.

**Não executados:** navegador/E2E, testes/build/lint frontend (nenhuma alteração de UI), lint backend (não há
script), gateway/checkout reais, carga ou implantação. Nenhuma cobrança/estorno real. Ações de venda foram
fixtures reais PostgreSQL dentro do helper compartilhado; não uma rota comercial inexistente.

## 7. Riscos remanescentes e próximos responsáveis

1. **B2 — antes de ativar vendas:** implementar os pontos da seção4. Serialize webhook/expiração/cancelamento
   sob o lock da mesma venda e revalide prazo/estado após esperar. O saldo está protegido, mas a decisão financeira
   e a corrida pagamento versus cancelamento não foram implementadas por B1.
2. **B2 — aprovação financeira:** só concluir cancelada após aprovação real para venda paga. O estado atual e
   o histórico de envio são guardas B1; não substituem prova financeira, idempotência/inbox/reconciliação do gateway.
3. **B1+B2 — preço/contrato:** fechar buscarParaVenda transacional e snapshots antes de checkout; alinhar 409 por
   produtoId com o futuro consumidor. Respostas do navegador/carrinho não autorizam preço, quantidade ou saldo.
4. **Infra/B1 — implantação:** migrar antes do código que consulta novos campos, com backup/pausa/reconciliação.
   Vendas antigas sem baixa original receberão 409 ao devolver; apurar legado, sem inferir/dobrar crédito.
5. **Transação do chamador:** não capturar falha e confirmar a venda; não executar HTTP ao gateway sob locks.
   Constraints são defesa adicional. Retry por deadlock/serialização deve repetir o bloco de negócio inteiro
   e respeitar idempotência comercial de B2; helper não repete chamadas financeiras.
6. **Segurança preservada:** helpers sem endpoint; tipos internos recusados na escrita admin; sessão/papel atual,
   Origin nas escritas existentes, 100 KiB/compressão rejeitada e logs redigidos mantidos. API pública continua
   expondo somente emEstoque, sem saldo/histórico/IDs de operação. Testes aprovados não são auditoria completa.

Não há reserva separada, worker de expiração, checkout, segundo fluxo de pagamento ou alterações no frontend.
O incremento disponibiliza as operações internas para B2 integrar com o fluxo dele.
