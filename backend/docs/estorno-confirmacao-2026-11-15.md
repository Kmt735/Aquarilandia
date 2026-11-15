# Conclusão do estorno financeiro — correção e homologação

**15/11/2026. Correção funcional em área isolada, sem commit, push, integração definitiva ou deploy.**
Webhook/reconsulta e resposta direta de estorno agora concluem pagamento, cancelamento/histórico e devolução B1
na mesma transação. Reprodução anterior falhou como esperado; validação final: **1.411 testes unitários/HTTP e
656 integrações PostgreSQL passaram**, sem ignorados. Gateway e e-mail foram controlados; nenhuma operação financeira
ou mensagem real. A listagem de saldos recém-publicada foi preservada.

## 1. Base utilizada e alterações anteriores preservadas

| Item | Estado inicial e reconfirmado após fetch final |
|---|---|
| Repositório real | `/home/mateus/Projetos/Aquarilandia`; o caminho duplicado do ambiente não existe; nenhum AGENTS.md aplicável encontrado |
| Repositório original | `branch-backend`, limpo, HEAD `033efed6befa4cd466f237e00e950691f13156be` |
| `origin/branch-backend` | `033efed6befa4cd466f237e00e950691f13156be`, entrega de saldos já publicada |
| `origin/main` / base desta correção | `da22d31cda57cb64751af1ad1d87ecda91c2e598`, merge PR46 dos saldos; mesma árvore de arquivos de 033efed |
| `origin/branch-backend-2` | `7e9b6fd22556bd194588dc50b221079bfab15bfa`, ancestral; não contém correção adicional deste defeito |
| Área revisável | `/tmp/aquarilandia-estorno-confirmacao-20261115`, branch `fix/pagamentos-conclusao-estorno-20261115`, HEAD da22d31 + alterações sem commit |
| Entrega anterior de saldos | `/tmp/aquarilandia-estoque-saldos-20261115`, branch `feat/estoque-listagem-saldos-20261115`, HEAD 033efed, limpa e preservada |

Foram lidos contratos, decisões D-16/D-21/D-22/D-50, relatórios, schemas, pagamentos/gateway/webhook, vendas,
cancelamento, tarefas, estoque, transações e notificações. A worktree histórica `aquarilandia-consolidada-20261114`
não está disponível: seu registro está prunable. O patch versionado existe; não foi necessário recuperar a pasta.
Nenhuma worktree antiga foi removida ou podada, e não se presume preservação de arquivos privados de pastas ausentes.

Manifestos SHA-256 confirmaram **484 fontes idênticos** tanto no original quanto na entrega de saldos, além de
HEAD/status inalterados. Índice original limpo. Dependências já instaladas foram copiadas para a área isolada;
nenhuma instalação, alteração de versão ou lockfile. Fontes de frontend/infraestrutura e helpers B1 não foram editados.

## 2. Reprodução e causa do defeito

Na produção **não modificada**, foi acrescentado apenas o teste 17 de `testes/integracao/vendas-admin.test.mjs`:
criar venda/Pix e pagar por HTTP, solicitar cancelamento com estorno inicialmente recusado, mudar a consulta
controlada para `estornado` e enviar webhook assinado. Aplicação Express e PostgreSQL reais, não serviço HTTP simulado.

| Dado | Antes da correção | Esperado e observado depois |
|---|---|---|
| Pagamento | `estornado` | `estornado` |
| Venda | `cancelamento_solicitado` | `cancelada` |
| Saldo (abertura 10, compra de 2) | 8 | 10 |
| Operações de devolução | 0 | 1 |

Comando de reprodução, em `backend/` (somente URL fictícia descartável):

```bash
NODE_ENV=test DATABASE_URL=postgres://testes-sem-banco@127.0.0.1:1/testes_sem_banco \
TEST_DATABASE_URL=postgres://teste:teste@127.0.0.1:59697/teste \
node --import tsx --test testes/integracao/vendas-admin.test.mjs
```

Resultado anterior: **17 passaram, 1 falhou**; diagnóstico exato:
`{"pagamento":"estornado","venda":"cancelamento_solicitado","saldo":8,"devolucoes":0}`.
Evidência: `/tmp/aquarilandia-estorno-confirmacao-20261115-evidencias/reproducao-antes.log`.

**Causa confirmada:** em da22d31, `pagamento.service.ts:193–203` (`aplicarConsulta`) só atualizava o pagamento;
`processarCobranca:235–241` não chamava a conclusão de cancelamento. `concluirEstorno:304` e
`tentarEstornoPendente:331` só aceitavam `aprovado`; `pagamento.repository.ts:335–339` só enfileirava aprovados.
O pagamento já estornado perdia os caminhos automáticos de conclusão.

## 3. Correção aplicada e trechos históricos reaproveitados

Foram adaptados **somente** os trechos de estorno do patch
[`integracao-b2-bdd1ed4-2026-11-14.patch`](patches/integracao-b2-bdd1ed4-2026-11-14.patch): helper compartilhado,
invocação por reconsulta no mesmo client, aviso depois do COMMIT e os três cenários de confirmação/race/rollback.
Não foi aplicado o patch inteiro; trechos de expiração já incorporados permaneceram iguais.

Complementos necessários à base atual:

- Reconsulta antes de novo pedido financeiro; recuperação pela fila existente de conclusão local já `estornado`.
- Conferência do valor também para estorno e da cobrança canônica; vínculos relidos após locks.
- Preservação dos discriminadores `pagamento indevido` e `estorno manual`. A conclusão manual de uma cobrança
  duplicada substitui o detalhe antigo por `estorno manual`; tratá-lo como pagamento confirmador seria incorreto.
- Agrupamento de tentativas simultâneas por pagamento neste processo, liberado inclusive em caso de erro.
- Correção temporal autorizada **somente da fixture do caso 9**: criado_em de três vendas em horários fixos
  do mesmo dia em São Paulo. Não altera filtro de datas, expiração nem qualquer regra comercial.

Evidências atuais: [`pagamento.service.ts`](../src/modulos/pagamentos/pagamento.service.ts), linhas 157–163,
241–270 e 315–398; [`pagamento.repository.ts`](../src/modulos/pagamentos/pagamento.repository.ts), 141–151 e 335–350.

## 4. Estados, vínculos, locks e fronteira transacional

| Caminho | Pré-condição e efeito |
|---|---|
| Webhook/reconsulta | Consulta autenticada, cobrança igual à solicitada, pagamento encontrado pelo vínculo do banco; valor do estorno igual ao valor local. Locks venda → pagamento, releitura dos vínculos, aplicação financeira e helper de cancelamento no mesmo PoolClient. |
| Resposta direta de estorno | Adaptador aprovou ou reconheceu já reembolsado. Nova transação curta, locks venda → pagamento, revalidação de venda/cobrança/estado/pedido; grava estornado e chama o mesmo helper. |
| Conclusão do cancelamento | Exige venda `cancelamento_solicitado`, pagamento da mesma venda, `estornado`, pedido de estorno e detalhe diferente de indevido/manual. Muda venda, insere histórico e chama `estoqueService.estornarVenda(vendaId, client)` sem transação aninhada. |
| Cobrança indevida ou manual | Só o estado financeiro pertinente; não cancela a compra válida nem devolve estoque por essa cobrança. Divergência de valor não apaga essas marcas. |
| Venda enviada/entregue | Cancelamento comum continua 409. Reconsulta de estorno espontâneo pode registrar verdade financeira, mas não cancela/reintegra unidades. Mesmo um estado pendente adulterado é bloqueado pelo histórico de envio no helper B1. |

Produto é bloqueado pelo helper B1 em ID crescente, depois de venda/pagamento. Saldo e movimentos derivam das
quantidades **originais imutáveis**, preservando unicidade por venda e compensação. Confirmação de pagamento não
baixa novamente, e cancelamento solicitado mantém o saldo debitado até a confirmação financeira.

Erro SQL durante qualquer crédito/registro desfaz pagamento, venda, histórico e movimentos da conclusão.
O pedido de cancelamento que já havia sido confirmado em transação anterior permanece pendente para retry.
Preservada a exceção preexistente **específica** de ausência de baixa original: registra inconsistência e conclui
cancelamento financeiro sem fabricar crédito. Outros erros de estoque não são engolidos.

Chamadas de gateway ficam fora de transações/locks; teste com conexão independente adquire sale/payment/product
por NOWAIT durante o pedido financeiro. Notificações são disparadas depois de `comTransacao` resolver o COMMIT;
o teste de e-mail consulta o banco em outra conexão e vê o estado já confirmado. Nenhum e-mail é enviado no rollback.

Segurança preservada: assinatura sobre corpo cru e segredo do webhook, consulta pelo adaptador autenticado,
deduplicação de eventos, sessão/dono/admin/Origin nas rotas existentes, respostas genéricas e logs com IDs locais/códigos.
Nenhum endpoint aceita uma aprovação financeira do navegador. Gateway, middleware, controllers e cookies não foram
alterados; respectivas suítes existentes passaram. Isso não é uma nova auditoria completa de segurança.

## 5. Recuperação após sucesso externo e falha local

1. Após sucesso externo e falha SQL, o banco mantém pagamento aprovado e cancelamento solicitado; evento de webhook
   falho mantém `processado_em` vazio e tentativa registrada. Não se presume rollback do dinheiro no gateway.
2. Retry do webhook/reconsulta ou job consulta novamente a cobrança autenticada. Se já estornada, só confirma a
   transação local; **não chama refund novamente**. Falha de consulta mantém a pendência, sem crédito presumido.
3. Registros do defeito antigo já `estornado` com cancelamento solicitado e vínculo elegível entram na fila do job
   existente (até 50 por rodada), inclusive com cinco tentativas. O limite de cinco continua para **novos pedidos**
   financeiros; não impede finalizar um resultado externo comprovado. Não há varredura/reparo executado em base real.
4. Consulta `pendente`/`recusado`/divergente não autoriza um novo refund. Aprovação atual e pedido ainda pertinente
   são conferidos antes da chamada. A resposta direta relê novamente estado e vínculo sob lock.
5. Replays do mesmo evento ou eventos diferentes usam as mesmas guardas de negócio; somente quem altera a venda
   notifica, e o ledger impede segunda devolução. O registro processado do evento continua separado e posterior à
   transação comercial: perda desse ACK pode repetir leitura, sem repetir o efeito.

A tentativa financeira agora acrescenta uma consulta ao gateway; se a consulta estiver indisponível, preserva o
cancelamento pendente em vez de pedir refund sem confirmação atual. Isso pode aumentar a latência ou adiar uma
tentativa até o próximo retry; não altera corpos/status públicos nem contabiliza essa consulta como refund recusado.

**Limite explícito:** o mapa de tentativas em curso é por processo, não um lease durável distribuído. Duas réplicas
podem consultar `aprovado` antes de uma delas enviar refund; não se promete ausência de pedido redundante entre
réplicas. A proteção financeira externa continua sendo a recusa de refund repetido tratada pelo adaptador existente;
os efeitos locais são protegidos no PostgreSQL independentemente do mapa. Uma consulta externa atrasada que ainda
mostre aprovado também depende dessa defesa. Não foi criada garantia nova do gateway nem feita homologação real.
Se houver execução em múltiplas instâncias, B2/infra devem avaliar claim/lease durável com reconciliação; nunca segurar
locks SQL durante rede. Notificações também continuam sem outbox durável: queda após COMMIT pode perder o e-mail,
embora não perca o efeito comercial. Essas limitações não foram escondidas pelos testes.

## 6. Testes, resultados e verificações não executadas

Node **v22.23.3**, npm **10.9.9**. Container exclusivo `aquarilandia-estorno-pg-20261115`, PostgreSQL 17-alpine,
tmpfs, banco/usuário/senha fictícios `teste`, porta efêmera 59697. Cada suíte criou/removeu seus schemas; consulta
final confirmou zero schemas de testes remanescentes. Nenhuma conexão em PostgreSQL compartilhado/produção.

| Comando/verificação em backend/ | Resultado e evidência em `/tmp/aquarilandia-estorno-confirmacao-20261115-evidencias/` |
|---|---|
| Reprodução antes da correção, HTTP + PG | 17 passaram, 1 falhou como esperado; `reproducao-antes.log` |
| Primeira validação de pagamentos + admin | 47 passaram; `alvo-primeira-correcao.log` |
| `npm run typecheck` | Passou; `typecheck-final.log` |
| `npm test` | **1.411 passaram**, 0 falhas/ignorados; `unitarios-http-final.log` |
| `TEST_DATABASE_URL=... npm run test:integration` | **656 passaram**, 0 falhas/ignorados; `integracao-final.log` |
| Nova cobertura na suíte admin | **12 testes adicionais**, total 29/29 na integração final; casos 17–26 com variantes |
| `npm run build` | Passou; `build-final.log` |
| `npm audit --json` | **0 vulnerabilidades** em todas as gravidades; `audit.json`; nenhuma correção automática |
| `git diff --check` e whitespace do documento novo | Passaram |
| Fetch, ancestry, diff de árvores e unmerged | Referências abaixo; nenhum conflito pendente |
| SHA-256 + HEAD/status original/saldos | Ambos preservados; `preservacao-final.json` |

A primeira execução completa após adicionar o caso 26 encontrou **uma falha no novo observador de locks**:
o PostgreSQL mantinha o snapshot estatístico na transação do teste. Corrigido usando `pg_stat_clear_snapshot()`
antes da sondagem, mantendo prova de espera real em vez de sleep presumido. A suíte direcionada passou 29/29,
e a suíte completa final passou 656/656. Esse erro de harness não foi atribuído a código preexistente.
O caso temporal 9 não falhou na reprodução diurna desta rodada; o problema anterior está documentado e sua premissa
dependente de horário foi removida somente da fixture, conforme autorização expressa.

Cobertura real: webhook assinado, mesmo evento e eventos distintos concorrentes; webhook enquanto refund aguarda;
retries simultâneos sem segundo pedido no processo; trigger que falha no **segundo** produto em ambos os caminhos;
rollback integral e retry sem novo refund; fila de pagamento já estornado com cinco tentativas; confirmação
pendente/recusada; cobrança duplicada/manual, inclusive enquanto a compra correta aguarda estorno; valor/cobrança
divergentes; envio/entrega e histórico de envio adulterado; classificação relida após lock observado; saldo reconciliado
com `sum(delta)` após cada cenário. Produtos, peixes, saldos/histórico B1, autenticação e demais rotas existentes
estão na integração completa e não regrediram no escopo testado.

Não executados: navegador/E2E ou verificações de frontend (sem alterações de UI), carga, múltiplos processos de
aplicação, gateway real, envio real de e-mail e deploy. Backend não possui script lint. Eventos financeiros são
controlados; os efeitos SQL, locks, constraints e compensações são reais. Não tratar isso como homologação do
gateway em produção ou inspeção dos dados da loja.

## 7. Arquivos alterados e conflitos encontrados

| Arquivo | Alteração |
|---|---|
| `src/modulos/pagamentos/pagamento.service.ts` | Helper de conclusão, reconsulta antes de refund, validação de vínculos/valor, proteção da classificação e agrupamento por processo |
| `src/modulos/pagamentos/pagamento.repository.ts` | Projeta vínculos sob lock e inclui conclusão local pendente na fila existente |
| `testes/integracao/vendas-admin.test.mjs` | 12 regressões, reconciliação e ajuste temporal pontual do caso 9 |
| `api.md` | Fluxo atual, recuperação e limites; remove descrição desatualizada de correção apenas histórica |
| `docs/decisoes.md` | Nota de correção da D-22, sem renumerar decisões ou escolher política nova |
| `testes/README.md` | Cobertura/comando e distinção dos resultados históricos |
| `docs/estorno-confirmacao-2026-11-15.md` | Este relatório |

**Nenhum** schema, migração, helper B1, arquivo de vendas/tarefas/gateway, dependência, frontend ou configuração foi
editado. Nenhum conflito textual ou arquivo unmerged encontrado. Após fetch final: HEAD…origin/main **0/0**,
HEAD…origin/branch-backend **1/0**, HEAD…origin/branch-backend-2 **9/0**. Main e branch-backend têm árvores idênticas;
a diferença de um commit é o merge PR46. Não há patch remoto novo concorrente nestes arquivos no snapshot examinado.
Não foi feito merge/rebase/reset/stash/clean/commit/push. Isso não garante integração sem conflitos com mudanças
futuras ou trabalho privado de terceiros. A sobreposição deliberada é no módulo de pagamentos B2 e docs/testes
compartilhados, autorizada nesta tarefa; a decisão financeira e os contratos públicos existentes foram preservados.

## 8. Procedimento proposto para diagnosticar registros antigos

**Somente proposta; nenhuma consulta ou correção foi executada nos dados da loja.** B2 conduz com administração/infra,
backup e autorização próprios, em conexão restrita. Primeiro inventariar sem dados pessoais:

```sql
-- Consulta de leitura; candidata não equivale a autorização para crédito.
SELECT v.id AS venda_id, v.status AS venda_status,
       p.id AS pagamento_id, p.status AS pagamento_status, p.valor,
       p.estorno_solicitado_em, p.status_detalhe, p.estorno_tentativas,
       EXISTS (SELECT 1 FROM operacoes_estoque o
               WHERE o.venda_id=v.id AND o.tipo_venda='baixa_venda') AS tem_baixa,
       EXISTS (SELECT 1 FROM operacoes_estoque o
               WHERE o.venda_id=v.id AND o.tipo_venda='estorno_venda') AS tem_devolucao,
       EXISTS (SELECT 1 FROM historico_status_venda h
               WHERE h.venda_id=v.id AND h.status_novo IN ('enviada','entregue')) AS passou_envio
FROM vendas v JOIN pagamentos p ON p.venda_id=v.id
WHERE v.status='cancelamento_solicitado' AND p.status='estornado'
ORDER BY v.id, p.id
LIMIT 100;
```

Para cada candidata:

1. Conferir cobrança canônica **no banco restrito**, gateway/ambiente, valor e confirmação autenticada do estorno
   integral. Não usar payload de webhook, último evento ou captura do navegador como comprovação. Não colocar
   cobrança completa, Pix, assinatura, token ou dados pessoais em logs/planilhas públicas.
2. Identificar o pagamento efetivo e o pedido aplicável pelo histórico e pelas marcas preservadas. Verificar todas
   as cobranças da venda, inclusive extras/manual. Se o vínculo/classificação foi perdido ou há dúvida, **parar a
   conclusão automática e encaminhar a B2**: o schema ainda não tem FK explícita de pagamento efetivo na venda.
3. Conferir baixa original, seus movimentos/quantidades, ausência de crédito anterior, estado/histórico sem envio
   e unidades elegíveis para devolução. Ausência de baixa não autoriza inventar saída retroativa nem repor saldo;
   a exceção antiga só registra inconsistência e permite finalizar financeiramente sem crédito. B2+B1 apuram legado.
4. Depois da revisão e integração autorizadas, reconsultar **individualmente** pelo fluxo interno existente
   `pagamentoService.processarCobranca(cobrancaId)`. Não criar endpoint público ou SQL de UPDATE em lote. Com gateway
   confirmado estornado, esse caminho só aplica conclusão local protegida, sem pedir refund novamente. O job também
   pode recuperar candidatas elegíveis automaticamente ao ser habilitado; revisar o inventário antes da implantação.
5. Confirmar cancelada, pagamento estornado, exatamente um histórico de conclusão e uma operação integral de
   devolução vinculada à baixa. Reconciliar produtos envolvidos com ledger (IDs passados como parâmetro):

```sql
SELECT p.id, p.estoque, COALESCE(sum(m.delta),0) AS saldo_historico
FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id
WHERE p.id=ANY($1::integer[])
GROUP BY p.id
HAVING p.estoque::bigint <> COALESCE(sum(m.delta),0);
```

Esperado: zero divergências; não corrigir divergência com UPDATE direto. Registrar resolução por IDs locais,
responsável, evidência financeira restrita e referência da operação, sem copiar dados pessoais. Vendas enviadas,
entregues, crédito já existente ou pagamento indevido/manual ficam para reconciliação específica; não forçar o helper.

## 9. Entrega revisável e limitações remanescentes

Entrega integral em **`/tmp/aquarilandia-estorno-confirmacao-20261115`**, branch
**`fix/pagamentos-conclusao-estorno-20261115`**, sem commit. Apenas seis arquivos rastreados modificados e este novo
relatório; índice sem staging. O original e a entrega anterior continuam limpos em 033efed. Evidências temporárias:
**`/tmp/aquarilandia-estorno-confirmacao-20261115-evidencias/`**. Pasta `/tmp` não é armazenamento permanente: revisar
e integrar somente após decisão da equipe. Container próprio encerrado/removido após os testes; infraestrutura
existente preservada.

Permanecem: classificação legada sem referência explícita ao pagamento efetivo; necessidade de conciliar dados reais
individualmente; ausência de lease distribuído e outbox de notificações; limites/garantias do gateway não homologados
em produção; exceção de vendas sem baixa; política de expiração/pagamento tardio de uma hora não decidida nesta
correção. Nenhuma dessas pendências autoriza reposição sem baixa comprovada ou relaxamento das guardas B1.
