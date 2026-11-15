# Revisão e conclusão da integração estoque/vendas — 14/11/2026

**Entrega local:** correção de prazo e revalidação da expiração, preservando criação e helpers existentes.
**Entrega para B2:** correção transacional do estorno por webhook, implementada/testada em árvore isolada e
fornecida como patch sobre `bdd1ed4`. Pagamentos/cancelamentos remotos não foram mesclados à branch de trabalho.

## 1. Git inicial/final e base examinada

Repositório real: `/home/mateus/Projetos/Aquarilandia`; o diretório duplicado configurado no ambiente não existe.
Nenhum AGENTS.md aplicável encontrado. Inspecionados contratos, decisões, relatórios históricos, schemas,
catálogo/estoque, vendas, pagamentos, expiração, segurança/configuração e comTransacao.

| Referência | Inicial e revalidada ao finalizar |
|---|---|
| Branch e HEAD | `branch-backend`, `555d0510ad5f7a07b94b76bc53ae07934a696c6f` |
| origin/main e origin/branch-backend | Ambas em `555d0510ad5f7a07b94b76bc53ae07934a696c6f` |
| origin/branch-backend-2 | `bdd1ed454b114dd3c7e2f3b0ac80ee6aa1399e40` |
| HEAD…B2 | `0 30`: HEAD é ancestral do remoto, com 30 commits adicionais ainda não integrados |
| Worktree inicial | Limpa, sem arquivos unmerged/marcadores; 428 fontes preservados por manifesto SHA-256 |
| Worktree final | 6 arquivos rastreados modificados e 2 novos, descritos na seção 4; HEAD/branch/índice mantidos |

Foram feitos apenas fetches para atualizar referências. Nenhum commit, push, merge definitivo, rebase, reset,
stash ou clean. A main local antiga não foi usada como base. As worktrees históricas prunable não foram limpas.
Preparação em `/tmp/aquarilandia-integracao-20261114/local`; árvore B2 obtida por git archive na pasta `combinado`.
Todos os arquivos fora da lista de alterações foram conferidos por hash; nenhum trabalho de outro integrante foi descartado.

## 2. O último pull e o trabalho remoto adicional

O reflog identifica **pull origin main em 12/11/2026 às 19:52:26, horário de São Paulo**, fast-forward de
`0834f70` para `555d051`. Não foi presumido que ORIG_HEAD representasse esse pull. São 37 commits no intervalo,
44 arquivos alterados, 4.936 inserções/113 remoções. O commit de merge tem data anterior ao pull; são eventos distintos.

O pull incorporou autenticação/recuperação e D-47; POST de frete/criação de venda, idempotência e totalEsperado;
SQL21 de idempotência; configuração obrigatória D-52/Compose restrito a localhost sem senha padrão; limpeza de
sessões/tokens, expiração e consultas de compras do cliente/admin. Não trouxe cancelamento/pagamento completos.
Os helpers baixa/devolução, catálogo, SQL30/31 e consultas administrativas continuam presentes e não precisaram ser recriados.

O remoto B2 acrescenta pagamento Pix/webhook/reconsulta, estornos e cancelamentos, administração de vendas,
notificações/e-mail, segurança HTTP e infraestrutura de demonstração/deploy. Inclui SQL22 e dependência helmet.
Foi testado como **árvore combinada isolada**, sem importar suas rotas/configurações no código local.

## 3. Matriz de requisitos antes de editar e resultado

| Requisito | Estado inicial / evidência | Ação e resultado |
|---|---|---|
| Baixa na criação, mesma transação | Concluído: venda.service.criar chama buscarParaVenda, insere venda/itens/histórico e baixarParaVenda com o mesmo client | Preservado; HTTP e PG reais verificam saldo/rollback |
| Quantidades/repetidos/locks/409 | Concluído: estoque-venda.validacao/service/repository; produtos ordenados, UPDATE condicional | Preservado; nenhuma nova interface de estoque |
| Histórico e unicidade multiproduto | Concluído: SQL31, operação única por venda/tipo, movimentos por produto, compensação referenciada | Preservado; regressões e reconciliação passaram |
| Expiração periódica e devolução | Parcial/incompatível: job existente esperava mais 5min além de expira_em e não revalidava o prazo após espera | Corrigido localmente e adaptado à árvore B2 |
| Cancelamento não pago | Ausente nesta branch; implementado no B2 em vendaService.cancelar | Sem criar fluxo paralelo; homologado na cópia B2 |
| Pago permanece baixado até refund | Implementado no B2: cancelamento_solicitado e refund em três etapas | Preservado e testado com gateway controlado/PG real |
| Refund confirmado por webhook | Incompatível no B2: pagamento virava estornado e venda/estoque continuavam pendentes | Defeito reproduzido, corrigido na árvore B2 e entregue em patch |
| Enviada/entregue não devolvem | Concluído nos helpers; guardas de estado/histórico e rotas B2 | Preservado e testado |
| Webhook não baixa novamente | Local preparatório; implementação real do processador existe no B2 | Homologado na árvore B2, sem chamada de baixa na confirmação |
| Segurança e disponibilidade pública | Sessão/papel atual/Origin, limite JSON, logs redigidos, emEstoque sem saldo privado | Preservados; suítes administrativas/públicas passaram |

## 4. Implementações, correções e arquivos

### Correção aplicada à branch atual

`src/modulos/vendas/venda.repository.ts` acrescenta `podeExpirarSobLock(vendaId, executor)`:
primeiro bloqueia a venda FOR NO KEY UPDATE, depois consulta status e prazo usando clock_timestamp. A segunda
consulta acontece depois da espera, evitando usar o now() do início de uma transação antiga. Candidato que mudou
para paga/cancelada ou cujo prazo mudou não é cancelado. A seleção pega expira_em vencido, sem tolerância extra.

`venda.tarefas.ts` usa a guarda antes de mudar estado/histórico e chamar o helper de devolução no mesmo client.
Mantém o job existente (intervalo5min, primeira execução30s), limite100, isolamento por venda, logs e limpezas.
Não adiciona job, reserva, gateway, rota ou transação interna ao estoque. Atraso até a próxima rodada/backlog não renova expira_em.

`testes/integracao/venda-expiracao.test.mjs`: o caso que aceitava a tolerância foi corrigido e foram adicionados
7 cenários significativos. Reconciliação é conferida após cada teste. `api.md`, D-16 em `docs/decisoes.md` e
`testes/README.md` agora descrevem o estado efetivo e as duas bases, sem tratar criação/expiração como ausentes.

### Correção implementada na árvore B2, entregue em patch

**Reprodução:** criar/pagar venda por HTTP, pedir cancelamento e simular falha do refund. Estado fica
cancelamento_solicitado e saldo8 (de10). A reconsulta autenticada passa a confirmar estornado; webhook retorna200,
mas o código original deixava a venda em cancelamento_solicitado e o saldo8. O pagamento já estornado também
saía da fila de tentativas. O teste novo falhou exatamente nessa assertiva antes da correção.

**Correção:** `pagamento.service.ts` compartilha `concluirCancelamentoComEstoque` entre webhook/reconsulta e
resposta do refund. Sob os locks existentes venda→pagamento, após confirmação financeira, estado/histórico e
estoque confirmam juntos no mesmo PoolClient. Sem transação aninhada. O pagamento indevido/excedente não cancela
a venda válida; a guarda exige pedido de estorno do pagamento confirmador e cancelamento_solicitado. E-mail só após COMMIT.
Assinaturas públicas/resultado do processador preservados. Nenhuma aprovação vem do body do cliente.

3 testes adicionados na suíte B2 `vendas-admin.test.mjs`: confirmação via webhook/repetição, webhook antes da
resposta HTTP do refund, e falha no crédito seguida de retry. Todos passaram, inclusive a reconciliação.

Patch pronto: [integracao-b2-bdd1ed4-2026-11-14.patch](patches/integracao-b2-bdd1ed4-2026-11-14.patch), SHA-256
`2e8034c135df4fe8af1cb0a3f0468efb4589521f3575592150f352929a5af500`.
Contém 7 arquivos: repository/tarefas de vendas, pagamento.service, duas suítes PG, api.md e decisoes.md.
Foi aplicado de verdade a uma cópia limpa de `bdd1ed4`; seus sete arquivos ficaram idênticos à árvore testada.

Para revisar/aplicar **somente numa área isolada baseada nesse commit B2**, sem as correções já aplicadas:

```bash
git apply --check /caminho/para/integracao-b2-bdd1ed4-2026-11-14.patch
git apply /caminho/para/integracao-b2-bdd1ed4-2026-11-14.patch
```

É uma alternativa de aplicação sobre B2, não um segundo passo obrigatório depois de mesclar as mesmas correções.
Não aplicar diretamente à branch local atual (ela ainda não contém os arquivos de pagamentos). Não aplicar duas vezes.
O patch não contém os 30 commits completos de B2: apenas os ajustes e testes desta rodada sobre aquela base.

Arquivos entregues no repositório: **6 modificados** (repository, tarefas, teste de expiração, api.md, decisoes.md,
README de testes) e **2 novos** (este relatório e patch). Nenhuma alteração em helpers/schema de estoque, auth,
frontend, package.json/lockfile, Docker/Compose ou dados compartilhados.

## 5. Contrato interno e responsabilidades

Permanecem iguais:

```ts
estoqueService.baixarParaVenda(vendaId, itens, client): Promise<void>
estoqueService.estornarVenda(vendaId, client): Promise<void>
```

B1 valida/consolida quantidades, trava produtos por ID, mantém UPDATE condicional, saldo/histórico/compensação
única e consulta quantidades originais. Não confirma dinheiro, não muda estado da venda, não inicia/comita transação.
B2 valida sessão/Origin/dono, preço/total/frete e idempotência comercial, grava venda/itens/estados/histórico e
chama os helpers com o mesmo PoolClient. Devolução exige cancelada; cancelamento_solicitado continua sem crédito.
Chamadas externas ficam fora dos locks. Enviada/entregue não têm devolução automática.

**Na branch local estão integrados:** POST /api/vendas→baixa, retry idempotente, frete, consultas de compras,
job existente→cancelamento por expiração→devolução. Os testes usam esses endpoints/worker e PostgreSQL reais.
**Somente na árvore B2 homologada:** pagamento, cancelamento não pago, cancelamento pago, reconsulta/refund e
confirmação de estorno por webhook com a correção. Não estão ativados na branch local por esta entrega.

## 6. Evidências de atomicidade, concorrência e idempotência

- Prazo futuro não expira; no vencimento e após dois minutos expira sem tolerância adicional.
- Uma seleção antiga aguarda o lock; mudança de prazo/pagamento/cancelamento anterior ao desbloqueio é respeitada.
- Uma transação iniciada antes do vencimento, que espera pelo lock até depois dele, usa o relógio atualizado.
- Duas rodadas concorrentes e cancelamento versus expiração geram um histórico de cancelamento e uma devolução.
- Venda multiproduto/repetidos baixa quantidades consolidadas; expiração devolve3 e2, mesmo com itens_venda alterado para99.
- Falha no segundo crédito desfaz primeiro crédito, operação, histórico e estado; próxima rodada recupera.
- Suites anteriores de falta de estoque, última unidade, falha após primeira baixa, falha posterior à criação,
  replay/locks, inativo/legado, alteração de itens e SQL31 foram preservadas e passaram.
- Na árvore B2: refund pendente mantém saldo baixado; confirmado por webhook devolve uma vez; concorrência
  com resposta do gateway não duplica histórico/crédito. Falha no crédito desfaz também status financeiro local;
  retry reconsulta e conclui. Pagamento excedente e venda enviada/entregue não recebem crédito indevido.
- Reconciliação após cada cenário novo: produtos.estoque = soma(delta), sem divergências.

## 7. Migrações e implantação

**Nenhuma migração nova necessária neste ciclo.** SQL30/31 e suas constraints já representam operações únicas
por venda/tipo, múltiplos produtos, referências originais e histórico imutável. Foram preservados byte a byte.
As suítes verificam bootstrap, abertura zero/positiva/inativa, repetição, rollback de DDL, runner e reconciliação.

Para base existente: executar somente em janela autorizada, com backup e revisão. SQL21 traz idempotência de
vendas (já veio no último pull); `db:migrar-estoque` aplica30/31, não substitui a migração21. A futura integração
de pagamentos B2 também requer SQL22. Não usar db:reset para atualizar banco com dados e não inferir baixas legadas.
Configuração D-52/Compose segura foi preservada; não foram lidas/impressas credenciais do .env.

Somente container `aquarilandia-integracao-pg-20261114`, PostgreSQL17-alpine, banco/usuário fictícios teste,
porta local efêmera53808 e tmpfs. Cada suíte criou/removeu seus schemas. Nenhuma conexão/migração na base compartilhada
ou de produção; o container descartável foi encerrado ao concluir.

## 8. Comandos, resultados e limites das verificações

| Verificação | Resultado |
|---|---|
| Git status/reflog/log/ancestry/fetch/ls-files -u | Último pull confirmado pelo reflog, HEAD limpo inicialmente; B2 adicional0/30 |
| Base recebida: npm run typecheck / npm test | Passaram; **1.100** testes,0 ignorados |
| Base recebida: TEST_DATABASE_URL=... npm run test:integration | **503** passaram,0 ignorados |
| Local corrigido: typecheck / npm test / build | Passaram; **1.100** testes,0 ignorados |
| Local corrigido: integração PG | **510** passaram,0 ignorados; inclui14 de expiração (7 novos) |
| Árvore B2: npm ci --ignore-scripts | Lockfile respeitado; dependências só na cópia, sem alterar versões/lockfiles originais |
| Árvore B2 corrigida: typecheck / npm test / build | Passaram; **1.197** testes,0 ignorados |
| Árvore B2 corrigida: integração PG | **575** passaram,0 ignorados; inclui3 novos de refund/webhook |
| Regressão de refund antes da correção | Reproduzida:1 falhou/17 passaram; venda permanecia cancelamento_solicitado |
| Suíte B2 de cancelamento depois da correção | **20** passaram,0 ignorados; subset dos575, não somar novamente |
| npm audit --json local e combinado | **0 vulnerabilidades** nas duas bases; sem audit fix/atualização de dependências |
| Patch B2: git apply --check, aplicação e comparação por hash | Passaram; sete arquivos idênticos aos homologados |
| git diff --check e whitespace dos novos arquivos | Passaram |

**Camadas reais:** Express/HTTP, sessão/autorização, PostgreSQL, transações/locks/constraints, persistência e
reconciliação. **Camadas controladas:** gateway Pix/e-mail nos testes financeiros e DB/sessão nas suítes unitárias.
Não declarar esses testes cobrança/estorno real ou homologação externa. Os timers não foram aguardados por cinco
minutos em produção; os testes invocam a mesma função executarExpiracao, sem criar agendador alternativo.

Não executados: navegador/E2E, frontend build/lint (sem alteração de UI), carga, deploy ou gateway/e-mail reais.
Lint backend não tem script próprio. Nenhum teste ignorado foi contado como aprovado. Logs de execução em
`/tmp/aquarilandia-integracao-20261114/` são temporários; testes e patch entregues tornam a verificação reproduzível.

## 9. Conflitos e incompatibilidades

Antes desta rodada: nenhuma entrada unmerged/marcador; HEAD é ancestral de B2. Os 30 commits trazem mudanças
substanciais nos mesmos arquivos compartilhados. Não havia conflito pendente na worktree; ausência de marcadores
não foi usada como prova de compatibilidade funcional.

O patch local de expiração **não aplica diretamente** ao snapshot B2 por diferenças de contexto em repository e
tarefas (B2 mudou seleção e acrescentou reconsulta). Isso demonstra sobreposição, não prova por si só conflito
de um merge Git. As correções foram adaptadas pontualmente preservando reconsulta, pagamentos, notificações e
segurança; o patch específico B2 aplica e foi efetivamente homologado. Nenhum arquivo B2 foi substituído pelo
equivalente antigo local. Não foi realizado merge de teste com commit nem merge definitivo; não garantir merge futuro.

Incompatibilidades corrigidas: tolerância adicional de5min; prazo não revalidado após espera; refund confirmado
por webhook deixando venda/estoque pendentes. Os dois primeiros estão corrigidos na branch local e no patch;
o último existe apenas no remoto e foi corrigido nele por meio da árvore testada/patch, sem falsa ativação local.

## 10. Pendências reais e próximo ciclo

1. Integrar os commits atuais de B2 e as correções do patch em revisão conjunta, a partir de refs atualizadas;
   repetir a homologação. Cancelamento/pagamento ainda não chegaram à branch local e não foram duplicados aqui.
2. Preservada a política financeira já existente no remoto: gateway indisponível durante reconsulta adia a ação
   em venda com Pix pendente, com corte operacional de1h; pagamento confirmado antes da transição é aceito pelo
   processador existente. Isso é tratamento de incerteza financeira de B2, não nova reserva/renovação de expira_em.
   Pode reter unidades além do prazo nominal. Monitorar/reconciliar essas pendências; não afirmar liberação física
   exatamente no minuto30 em falha externa, backlog ou servidor parado. Nenhuma nova tolerância foi introduzida.
3. Ledger ausente em venda legada continua tratamento excepcional explícito do B2: cancela sem fabricar crédito
   e registra alerta. Apurar legado antes de ativar fluxo; helper mantém409 se chamado sem baixa original.
   Venda que já tenha ficado presa em cancelamento_solicitado com pagamento estornado na versão anterior exige
   reconciliação autorizada/reconsulta do gateway. Não foram alterados dados retroativos nem criado um job de reparo.
4. O próximo ciclo recomendado é **integração definitiva supervisionada de B2 + patch e homologação de deploy**,
   incluindo migrations21/22/30/31 e configuração D-52, sem refazer estoque/catalogo nem criar outro checkout.
   Gateway real/Dev mode e operação produtiva exigem homologação própria, fora dos testes controlados desta rodada.

As decisões aprovadas D-16/D-21/D-26 foram aplicadas sem reservar unidades em uma tabela separada. O que permanece
fora da branch atual é trabalho comercial já existente no remoto, com um patch concreto e testado para integração.
