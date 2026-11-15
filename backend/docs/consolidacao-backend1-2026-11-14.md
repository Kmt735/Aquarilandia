# Consolidação exclusiva do Backend 1 após os pulls

**14/11/2026 — entrega B1 concluída em worktree isolada, pronta para revisão; sem commit ou push.**

Foram transportadas as correções locais de expiração e seus testes para a base atual. Catálogo, estoque e helpers
já estavam implementados e não precisaram de nova correção. A pendência de estorno por webhook de B2 continua
reproduzível e explicitamente fora desta implementação. Nenhuma regra financeira, imagem ou fluxo do frontend foi alterado.

## 1. Git inicial/final e localização da entrega

| Referência | Estado inicial e após fetch final |
|---|---|
| Repositório original | `/home/mateus/Projetos/Aquarilandia`; o caminho duplicado do ambiente não existe |
| Branch/HEAD original | `branch-backend` / `d37d6bee83957e5d100c6bc942677dbc456c8c45` |
| `origin/main` | `d37d6bee83957e5d100c6bc942677dbc456c8c45`, igual ao HEAD original |
| `origin/branch-backend` | `555d0510ad5f7a07b94b76bc53ae07934a696c6f`; original 32 commits adiante |
| `origin/branch-backend-2` | `7e9b6fd22556bd194588dc50b221079bfab15bfa`, ancestral da main; HEAD…B2 = 1/0 |
| Entrega desta task | `/tmp/aquarilandia-backend1-consolidado-20261114` |
| Branch da entrega | `integracao/backend1-pos-pulls-20261114`, criada a partir de `origin/main` |
| HEAD da entrega | `d37d6be`; HEAD…origin/main = 0/0. As correções estão na working tree, sem commit |
| Worktree anterior | `/tmp/aquarilandia-consolidada-20261114`, branch `integracao/consolidacao-20261114`, HEAD `7e9b6fd` + alterações locais; preservada |

A área original começou com seis arquivos rastreados modificados e dois novos. Não havia arquivos unmerged.
O último pull já havia incorporado B2; não foi refeito merge ou pull nesta rodada. Os fetches inicial/final não
revelaram novos commits nas referências comparadas. A branch local chamada main não substituiu origin/main na análise.

A nova worktree contém seis modificações rastreadas e três arquivos novos: o relatório desta task e cópias dos
dois registros históricos locais. Nenhum arquivo ficou staged. Os 455 arquivos originais e os 460 da worktree
anterior foram fotografados por SHA-256/status/HEAD para comprovar preservação. Só os metadados necessários à
criação da nova branch/worktree e os remote-tracking refs foram manipulados no Git compartilhado.

Nenhum AGENTS.md aplicável foi encontrado. Foram examinados api.md, D-16/D-21/D-26/D-44/D-48/D-49/D-50/D-51,
relatórios históricos, patch anterior, schemas, catálogo/estoque, transação e chamadas de vendas/pagamentos.
A proposta do Ciclo 3 é histórica: não foi implementada alocação/reserva separada nesta task.

### Matriz de alterações e responsabilidade

Nesta matriz, **base** significa o HEAD commitado d37d6be, não as modificações locais da área original.

| Alteração | Já está na base? | Existe apenas localmente? | Responsável | Ação necessária / realizada |
|---|---|---|---|---|
| Categorias/produtos/fichas/peixes, filtros e DTOs | Sim | Não | B1 | Preservar; regressões completas executadas |
| Desativação/reativação e consultas de inativos | Sim | Não | B1 | Preservar saldo/histórico e guardas; sem reimplementação |
| Movimentos administrativos, leituras, idempotência, SQL30/31 | Sim | Não | B1 | Preservar; migração e reconciliação já cobertas pelas suítes existentes |
| buscarParaVenda com locks e snapshots | Sim | Não | Catálogo B1, contrato consumido por B2 | Preservar assinatura/ordem; não trocar por leitura fora da transação |
| Seleção sem tolerância geral extra e revalidação pós-lock | Não | Área original e worktree anterior | Integração estoque/vendas, alteração pontual autorizada nesta task | Transportadas somente as diferenças de repository/worker |
| Sete regressões adicionais de expiração/reconciliação | Não | Área original e worktree anterior | Integração B1/B2 | Transportadas; suíte final de expiração tem 14 cenários |
| API/decisões/README relacionados à expiração | Parcial | Atualizações na área original | Documentação compartilhada | Consolidadas e referenciadas neste relatório |
| Refund por webhook/reconsulta concluindo venda/estoque | Não | Código corrigido na worktree anterior; patch histórico disponível na original | B2/pagamentos | Não transportar código; reproduzir e entregar evidência/ponto de integração |
| Testes comerciais 21/22, startup D-52 e E2E adicionais da worktree anterior | Não como conjunto adicional | Worktree anterior | B2/shared/frontend; bootstrap de estoque já coberto em B1 | Não copiar indiscriminadamente; preservar a worktree anterior |
| Relatório/patch do ciclo anterior | Não versionados na base | Dois arquivos novos na área original | Registros históricos compartilhados | Copiados byte a byte para manter referências; patch não foi aplicado |

## 2. Backend 1 já incorporado pelos pulls

Os commits `ad21af5` (inativos/carrinho), `6ee1325` (estoque administrativo e helpers) e `cff8596`
(buscarParaVenda) estão na história da base. O pull até d37d6be acrescentou os serviços B2 que consomem esses contratos.
Não se inferiu ausência de função a partir de relatórios antigos que descreviam a base de outubro/início de novembro.

Evidências principais, relativas a backend/:

- `src/routes/catalogo.routes.ts:24–38`: consultas públicas, admin para CRUD/inativos/reativação.
- `src/modulos/catalogo/produto.repository.ts:50–54`: INSERT sempre com estoque zero; `:19` desativa apenas ativo/timestamp;
  `:66–72` bloqueia/reativa sem alterar unidades. `produto.atualizacao.ts:13–30` rejeita estoque e campos protegidos.
- `src/modulos/catalogo/produto.service.ts:108` e repository `:78–93`: buscarParaVenda usa executor e ordenação de IDs;
  sem executor, a cotação não mantém locks. A criação de venda usa o executor transacional.
- `src/modulos/estoque/estoque.service.ts:23–42`: idempotência por ator/chave/hash, lock do produto e saldo+movimento
  na mesma comTransacao, com recusa de negativo/overflow.
- `src/modulos/estoque/estoque-venda.service.ts:13–70`: baixa e devolução idempotentes; devolução lê a baixa original.
- `db/init/30_estoque.sql` e `31_estoque_vendas.sql`: abertura, ledger, unicidade por operação/venda, compensação
  referenciada, integralidade diferida e proteção de histórico. Nenhuma dessas migrations foi editada.
- `src/modulos/catalogo/produto.projecoes.ts:2–4`: projeção pública emEstoque; não retorna quantidade/histórico.

Foi procurada escrita de unidades em src/ e scripts/. Os UPDATEs de saldo ficam nos repositories do módulo estoque;
o cadastro de catálogo insere zero e seus UPDATEs de edição usam campos fechados. B2 chama os helpers, sem outro
UPDATE direto de unidades. O script `scripts/dados-demo.ts:185–209` usa APIs de cadastro e movimentação com chave
idempotente; não recebeu autorização para rodar nem foi executado contra ambiente algum nesta task.

## 3. Mudanças locais consolidadas

Aplicado `git apply --check` e depois `git apply` ao diff dos **seis arquivos da área original**, sobre a nova
worktree limpa da main atual. Não foi aplicado o patch completo de B2 e não foi copiada a worktree antiga inteira.

| Arquivo relativo a backend/ | Mudança / justificativa |
|---|---|
| `src/modulos/vendas/venda.repository.ts` | Seleção com expira_em <= clock_timestamp(), sem cinco minutos extras. Acrescenta podeExpirarSobLock: lock da venda e segunda consulta de status/prazo após a espera |
| `src/modulos/vendas/venda.tarefas.ts` | Chama a guarda antes de cancelar/histórico/devolução, no mesmo client. Preserva reconsulta financeira, retorno VendaVencida e flag de uma hora introduzidos por B2 |
| `testes/integracao/venda-expiracao.test.mjs` | Ajusta a expectativa antiga de tolerância; acrescenta os sete casos locais de limite/locks/concorrência/quantidades/rollback, com reconciliação após cada cenário |
| `api.md` | Consolida a descrição do prazo/lock e a exceção financeira pendente; corrige o resumo de estoque que ainda sugeria helpers de venda não implementados; referencia esta entrega |
| `docs/decisoes.md` | Mantém D-16/D-50 e histórico, registra consolidação pontual sem nova decisão financeira ou número de decisão |
| `testes/README.md` | Explica os 14 cenários, comandos e limite de responsabilidade; não apresenta o teste de refund externo como aprovação de B1 |
| `docs/consolidacao-backend1-2026-11-14.md` (novo) | Este relatório, matriz, evidências e pendências |
| `docs/integracao-estoque-vendas-2026-11-14.md` e `docs/patches/integracao-b2-bdd1ed4-2026-11-14.patch` (novos nesta worktree) | Registros históricos locais preservados byte a byte; não são funcionalidades ou patch aplicado |

Os dois fontes e o teste de expiração transportados correspondem à implementação local já adaptada a B2.
Não houve necessidade de outra correção no catálogo ou no módulo estoque. Não foram acrescentados testes redundantes
para artificialmente aumentar o diff; os cenários exigidos já estão nas suítes existentes/alterações locais.

### Comportamento consolidado da expiração

1. A seleção produz candidatos vencidos em ordem de prazo/ID, sem a tolerância geral adicional de cinco minutos.
2. Dentro de comTransacao, podeExpirarSobLock executa SELECT…FOR NO KEY UPDATE e só depois lê status e expira_em
   com clock_timestamp. now() representaria o início da transação, anterior a uma possível espera longa.
3. Candidato pago/cancelado ou com prazo prorrogado não é cancelado/creditado. O WHERE do mudarStatus continua
   sendo defesa adicional. A validação do grafo de status foi mantida.
4. Cancelamento, histórico e estoqueService.estornarVenda usam o mesmo PoolClient. Qualquer falha inesperada
   propaga rollback, inclusive depois do primeiro crédito de uma venda multiproduto.
5. O helper usa os movimentos originais e unicidade por venda/operação; workers concorrentes não devolvem duas vezes.

Evidência: `venda.repository.ts:253–274`, `venda.tarefas.ts:42–65`, `utils/transacao.ts:6–25`.
O worker continua com a periodicidade existente de cinco minutos e primeira rodada após 30 segundos.

## 4. Funcionalidades e contratos preservados

| Contrato | Evidência / aceite verificado |
|---|---|
| Cadastro começa com zero | INSERT fixo em produto.repository:52–53; testes HTTP/PG de cadastro |
| PATCH não altera unidades/categoria/ativo | Whitelist de produto.atualizacao:13–30; rejeições/rollback nos testes de edição |
| Admin de estoque com sessão/papel atual/Origin | estoque.routes:14–16; HTTP/PG verificam 401/403, expiração/revogação e origem inválida |
| Idempotência administrativa | Constraint e hash por ator/chave; mesmo resultado no replay, 409 para intenção divergente; autorização reavaliada |
| Sem saldo negativo/overflow | Check de produto, limites INT32 e UPDATE condicional; testes de zero, insuficiência, máximo e compensação |
| Locks de baixa por ID | Consolidação/sort em estoque-venda.validacao:24, repository:38–58 e buscarParaVenda em ordem; arrays invertidos exercitados |
| Rollback integral | Falha no segundo movimento e erro posterior de B2 desfazem venda/itens/baixa; falha no segundo crédito desfaz cancelamento/histórico/crédito |
| Quantidades da baixa original | estornarVenda lê movimentacoes_estoque, sem consultar itens_venda para devolver; fixture altera itens e preserva a compensação original |
| Uma devolução, vários produtos | UNIQUE(venda_id,tipo_venda) na operação, referências únicas e triggers; repetição/concorrência gera uma operação de estorno |
| Inativo/reativação preserva saldo/histórico | Testes de remoção, reativação e compensação em inativo; compensar não reativa |
| Público apenas emEstoque | DTOs explícitos e rotas públicas testadas após baixa/devolução; sem saldo/histórico/IDs privados |
| Reconciliação | Assertions produtos.estoque = soma(delta), incluindo abertura e sem corrigir artificialmente divergência de legado |

Sessão, admin, Origin, parser de 100 KiB sem compressão, whitelist, SQL parametrizado, ordenação fechada,
cache administrativo e redação de logs foram preservados. Nenhum middleware ou DTO público foi refeito.
Os testes de catálogo/peixes verificam HTTP/PostgreSQL; não equivalem a uma nova avaliação de navegador/frontend.

## 5. Testes e verificações

Dependências já instaladas, correspondentes ao package-lock da base, foram copiadas para a worktree isolada.
Não houve npm install/ci, alteração de versões, autofix ou mudança de package.json/lockfile nesta task.
Node22; PostgreSQL17-alpine em container exclusivo `aquarilandia-b1-consolidacao-pg-20261114`, porta efêmera64344,
tmpfs e usuário/banco fictícios teste. Cada suíte cria/remove seu próprio schema. O banco preexistente não foi acessado.

| Comando/verificação | Resultado |
|---|---|
| Fetch, status/log/ancestry, worktree, comparação de conteúdo | Referências da seção1; nenhuma mudança remota adicional ao encerrar |
| git apply --check + git apply do diff local selecionado | Passaram; alterações efetivamente aplicadas, não apenas propostas |
| `npm run typecheck` | Passou |
| `npm test` | **1199 passaram**, zero falhas/ignorados |
| `TEST_DATABASE_URL=… npm run test:integration` | **572 passaram**, zero falhas/ignorados; inclui os 14 cenários de expiração, catálogo, estoque, permissões e integração com vendas |
| `npm run build` | Passou |
| `npm audit --json` | **0 vulnerabilidades** em todas as gravidades; nenhum autofix |
| `npm ls body-parser helmet --depth=2` | Express5.2.1→body-parser2.4.0; helmet8.3.0; dependências preservadas |
| Diagnóstico externo de B2: caso17 do teste de estorno | **1 falhou**, reproduzindo a pendência conhecida; não integra a suíte/diff de implementação B1 |
| `git diff --check`, whitespace de novos arquivos e marcadores | Passaram; sem arquivos unmerged. Patch histórico preservado com espaços de contexto próprios |
| Conferência de fontes/status/HEAD originais e da worktree anterior | Manifestos de preservação em `/tmp/aquarilandia-consolidacao-b1-20261114-evidencias/` |

O diagnóstico B2 usa HTTP e PostgreSQL reais com gateway/e-mail controlados. O script foi gerado somente na pasta de
evidências, adaptando caminhos do teste já existente na worktree anterior; não adiciona pagamentos ao módulo estoque.
A falha é exposta como falha, não contabilizada como aprovação. As suítes padrão verdes não a cobrem.

Logs: `typecheck.log`, `testes-http-unitarios.log`, `integracao-postgres.log`, `build.log`, `audit.json` e
`pendencia-b2-estorno.log`, na pasta de evidências. A instância descartável é encerrada ao finalizar.

**Não executados:** frontend/E2E/lint/build do frontend (nenhum arquivo frontend alterado), gateway/e-mail reais,
carga, deploy, migração/consulta na base compartilhada ou alteração de container/firewall existente.
Não há script de lint backend. Não houve teste ignorado por falta de PostgreSQL.
O PDF foi localizado em `/home/mateus/Projetos/Aquarilandia/API_Aquarilandia_Rotas.pdf`, mas pdftotext e bibliotecas
Python de leitura não estavam disponíveis; não foram instaladas. Esta task usou o contrato local, decisões explícitas
do pedido e registros históricos da divergência do PDF, sem tratar uma nova leitura direta como executada.

## 6. Evidências de atomicidade, unicidade e reconciliação

| Cenário PostgreSQL real | Teste/evidência |
|---|---|
| Vencida há dois minutos e exatamente no limite | venda-expiracao.test.mjs:105 e203; cancela sem tolerância geral extra |
| Prazo alterado enquanto aguarda lock | :212; candidato antigo permanece aguardando, sem crédito/histórico indevido |
| Pagamento confirma antes de liberar lock | :225; expiração não cancela nem devolve |
| Cancelamento concorrente e duas rodadas | :126 e236; uma compensação por venda |
| Prazo vence durante espera, depois de BEGIN | :249; usa relógio atualizado após lock |
| Itens alterados depois da baixa | :266; devolve quantidades originais de vários produtos |
| Segundo crédito falha, rollback e retry | :276; primeiro crédito/status/histórico desfeitos, rodada seguinte recupera |
| Última unidade e arrays invertidos | estoque-venda.test.mjs:136–159; sem negativo/resíduo e locks por ID observados |
| Devolução multiproduto/repetida/concorrente | :161–191; uma operação de estorno e todos os movimentos vinculados |
| Falha no histórico e no COMMIT diferido | :123–134,237–267; rollback integral de linhas/saldo/transição |
| Abertura/reaplicação/migração | estoque-migracao.test.mjs:29–147; preserva legado, recusa divergência e não cria nova abertura |
| Desativação/reativação/consultas públicas | produto-remocao, produtos-inativos e estoque-venda:290; DTO público sem saldo privado |

A suíte de expiração reconcilia ao final de cada caso (:37–41); os cenários de estoque também fazem assertions
explícitas da soma dos deltas. Os testes concorrentes usam conexões distintas e observam espera de lock por
pg_stat_activity, não apenas sleeps presumindo uma corrida. As fixtures são fictícias e restritas ao schema descartável.
Nenhum resultado financeiro externo foi presumido a partir do banco; gateway controlado não é homologação do provedor.

## 7. Conflitos, sobreposições e incompatibilidades

**Preexistentes:** não havia merge pendente nem marcadores no original. A sobreposição entre seleção/retorno antigos
e a reconsulta de B2 já havia sido adaptada na resolução do pull anterior: buscarVencidas continua retornando
VendaVencida com a flag financeira. Copiar a versão pré-B2 que devolvia apenas IDs quebraria esse fluxo; isso não foi feito.

**Nesta task:** diff local aplicou sem conflitos textuais em d37d6be. Catálogo/estoque/schemas/pagamentos/auth/frontend
foram comparados com HEAD; salvo os dois fontes autorizados da integração de expiração, os fontes desses módulos
permanecem byte a byte iguais à base. API/decisões/README tiveram somente atualização pertinente à consolidação.
Nenhum contrato incompatível foi escolhido silenciosamente. Não há garantia de merges futuros ou trabalho não publicado.

**Incompatibilidade funcional B2 confirmada:** no caso de refund por webhook, aplicarConsulta marca pagamento
estornado, mas processarCobranca não conclui a venda. concluirEstorno posteriormente exige pagamento ainda aprovado.
Reprodução nesta worktree: esperado cancelada, observado cancelamento_solicitado. O saldo permanece comprometido
porque a compensação não é chamada; o helper B1 corretamente exige estado cancelada e baixa original.
Não se deve contornar isso aceitando cancelamento_solicitado no estoque ou disparando devolução sem aprovação financeira.

Evidência: `src/modulos/pagamentos/pagamento.service.ts:191–197,231–236,299–317` (preservado).
Correção/testes existentes: `/tmp/aquarilandia-consolidada-20261114/backend/src/modulos/pagamentos/pagamento.service.ts`
e `backend/testes/integracao/vendas-admin.test.mjs:616–662` nessa worktree. O patch histórico está em
`docs/patches/integracao-b2-bdd1ed4-2026-11-14.patch`; inclui também correções de expiração já consolidadas aqui.
B2 deverá selecionar somente seus trechos/testes ainda ausentes, **não reaplicar o patch inteiro**.

## 8. Dependências de B2 e infraestrutura

- **B2:** concluir o refund confirmado por webhook/reconsulta/resposta HTTP na mesma transação de pagamento,
  status/histórico e chamada estornarVenda. O helper não decide aprovação financeira nem atualiza a venda sozinho.
- **B2+B1+loja:** aprovar a política financeira existente sob falha de reconsulta. Ela foi preservada: enquanto
  falha e o candidato não venceu há mais de uma hora, a rodada mantém unidades; após esse corte pode cancelar.
  Pagamento tardio enquanto a venda ainda aguarda segue o fluxo atual. Não se alterou a flag, o corte ou os estados.
- **B2:** idempotência de venda/pagamento, decisão de cancelamento e concorrência financeira continuam sob sua
  orquestração. O mesmo PoolClient deve ser passado; erro não pode ser capturado para confirmar negócio parcial.
- **Legado compartilhado:** venda sem baixa original continua sem crédito presumido; a exceção de cancelamento/log
  existente não reconcilia automaticamente vendas antigas. Diagnosticar e aprovar reparos separados, sem inventar saldo.
- **Infra/B1:** aplicar migrations existentes somente em janela autorizada, com backup/reconciliação. Nenhuma migração
  nova é exigida por este diff. O runner de estoque aplica30/31, não21/22; não usar db:reset para atualização.
- **Infra:** a publicação do banco/firewall apontada na revisão anterior permanece uma dependência operacional,
  sem nova intervenção ou acesso ao banco neste ciclo. Não foi usada como pretexto para alterar o container existente.
- **Frontend/B2:** checkout/login e outras integrações simuladas não foram abordados. Também não foram transportados
  os ajustes de browser, startup e migrations comerciais da worktree antiga para aumentar artificialmente o escopo.

## 9. Pendências reais B1 e próximo incremento

**Consolidação B1:** concluída nesta área revisável. Não há outra correção nova de catálogo/estoque identificada pelos
cenários exercitados; isso não certifica funcionalidades futuras ou o fluxo de pagamento ainda inconsistente.
Os fontes originais/alterações locais e a worktree anterior permanecem disponíveis; commits/deploy dependem de outra tarefa.

Pendências próprias ainda existentes:

1. Gestão de imagens ainda ausente. Há imagem_url e placeholder, mas não upload/armazenamento/remoção administrativa.
2. Listagem geral de estoque e filtros históricos tipo/de/ate continuam previstos e não implementados; as consultas
   atuais recusam filtros desconhecidos com400. Não se declarou esse CRUD/consulta ampliada como concluído.
3. Regras de catálogo do Monte seu Aquário e limites de consulta/ficha ainda precisam de contrato de integração;
   o frontend não pode ser autoridade de compatibilidade, preço ou quantidade vendável.
4. Reconciliação/implantação do legado precisa de procedimento operacional, sem alteração retroativa automática de ledger.

**Gestão de imagens pode ser o próximo incremento independente do B1**, após revisão desta consolidação. Antes de
codificar, fechar modelo/quantidade de imagens, armazenamento, tipos/tamanhos aceitos, autorização admin/Origin,
ordenação/principal e tratamento de falhas/arquivos órfãos. Reutilizar produto e DTO atuais; não misturar upload com
novos fluxos de estoque/pagamento. A pendência B2 não impede preparar esse incremento isolado, mas impede considerar
as vendas integralmente homologadas. Nenhuma parte de imagens foi implementada nesta task.
