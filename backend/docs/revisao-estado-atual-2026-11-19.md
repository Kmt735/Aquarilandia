# Aquarilândia — revisão técnica e de segurança do estado atual

**19/11/2026 — relatório unificado, atualizado após o pull e a revisão do frontend no navegador.**
Fuso de referência: America/Sao_Paulo. Somente diagnóstico/documentação; nenhuma correção de produção nesta rodada.

## 1. Resumo executivo

O Backend 1 já possui catálogo PostgreSQL, onze fichas especializadas, categorias administrativas, cadastro/edição,
desativação/reativação, imagem principal e estoque com histórico, idempotência e integração transacional com vendas.
Essas entregas **estão na main**. Não se deve planejar novamente sua implementação. A correção de conclusão do
estorno de `167b7d4` também está integrada e seus testes reais passaram novamente.

**Depois do pull, a worktree local e origin/main estão em `e7a1589`.** O pull feito pelo usuário trouxe 54 arquivos
de frontend, sem mudanças no backend ou nos manifests/lockfiles. Melhorou filtros, mensagens e a navegação entre
guia e montador; acrescentou VLibras. O Backend 2 está em `1965fec`, com checkout real, logística e proteções
defensivas **ainda fora da main**. A combinação main/B2 continua com três conflitos textuais conhecidos e não foi
homologada. Na base atual, autenticação e pedidos do frontend continuam simulados, embora as APIs já existam.

**Para apresentar hoje:** o catálogo tem aspecto consistente nas capturas desktop de 1440 px e mobile de 390 px,
e os **31 E2E passaram com PostgreSQL real descartável**, inclusive Peixes em destaque. Porém, não está comprovada
conformidade integral com WCAG AA: em 320 px o cabeçalho mede cerca de 341 px e corta o menu. Há ainda um item
focado por teclado parcialmente fora do carrossel, VLibras bloqueado pela CSP do backend e um aviso administrativo
incorreto sobre estoque. A apresentação do catálogo precisa distinguir as telas simuladas de uma operação real.
As evidências, as dez heurísticas de Jakob Nielsen e a fila de ajustes para hoje estão nas seções 4.4–4.6 e 7.1.

**Risco mais urgente: confirmação financeira insuficiente na main.** Uma sonda com respostas fictícias, sem rede,
confirmou que o adaptador aceita refund pendente e de valor parcial. A conclusão manual também não exige comprovação
do gateway. A branch B2 já contém proteções para ambos: a prioridade conjunta é revisar/integrar essa entrega e
homologar o conjunto, em vez de reimplementar a correção no B1.

**Primeira tarefa para a necessidade de hoje:** corrigir o cabeçalho em 320 px e validar navegação/foco por teclado,
sem reduzir a área útil dos controles nem esconder o excesso com CSS. É uma tarefa de frontend com apoio de B1,
sem mudança no contrato da API. Nenhuma dessas correções foi implementada nesta revisão.

**Próxima tarefa funcional exclusiva de B1, depois dos bloqueios da apresentação:** oferecer consulta pública
paginada de produtos com ficha opcional, reaproveitando o mapeamento do detalhe, para o montador. Hoje ele faz
consultas adicionais por produto, lê só 100 itens por grupo e conserva itens sem ficha quando o detalhe falha.
O incremento depende de acordo do DTO com frontend; não exige refazer estoque, vendas ou pagamentos.

Validação consolidada: **backend da main: 1.411 unitários/HTTP e 656 integrações PG aprovados na primeira fase**;
o backend não mudou no pull. Nesta atualização, **100 testes frontend e 31 E2E passaram**, sem ignorados, e ambos
os builds passaram novamente. Lint frontend continua falhando com quatro erros preexistentes. Foram coletados
19 estados com axe: zero violações automáticas apontadas, mas verificações inconclusivas em todos eles;
oito amostras adicionais de contraste atenderam aos mínimos examinados. Isso não certifica acessibilidade.
B2 isolado mantém os resultados anteriores: 1.434 unitários/HTTP, 669 PG e 89 frontend, lint/builds aprovados.
Nenhum pagamento, e-mail, migração ou reparo foi executado em banco do projeto/produção.

## 2. Base analisada

### 2.1 Git e preservação

| Referência | SHA examinado / estado |
|---|---|
| Repositório real | `/home/mateus/Projetos/Aquarilandia`; caminho duplicado informado pelo ambiente não existe |
| Worktree atual pós-pull — **P** | `branch-backend`, `e7a15897d168cbc5d86244e2d949e91965269cea`; dez commits adiante do upstream B1; inicialmente só este relatório não rastreado |
| Worktree na primeira fase — **L**, histórica | `87651debb681c16dc6ed9bfcd700086e26808e27`; era limpa, quatro commits adiante do upstream B1; não é mais o HEAD local |
| `origin/main` — **M** | `e7a15897d168cbc5d86244e2d949e91965269cea`; igual a P, seis commits adiante de L |
| `origin/branch-backend` | `167b7d408549632c110ef0eb580b8aa65a40e166`, ancestral de L/M/B2 |
| `origin/branch-backend-2` — **B2** | `1965feccdb2314de663122cae2afc618c0313c30`; um commit adiante de L, divergente de M em **6/1** commits |
| Outras referências relevantes | `origin/branch_secundaria_aquarilandia@cc27684` contém as mudanças de frontend incorporadas pelo merge PR49 na main |
| Instruções locais | Nenhum AGENTS.md aplicável encontrado nos ancestrais ou nas árvores backend/frontend |

O reflog confirma o pull do usuário em **19/11/2026 às 08:05:22 -0300**, `pull origin main: Fast-forward`,
de L para P. O agente fez somente fetch, inclusive nesta atualização; não executou pull nem integração.
As referências remotas examinadas permaneceram iguais. A branch local chamada `main` está antiga e **não** foi
usada como representação da main atual. Foram lidos README,
api.md, decisões, relatórios recentes, schemas 01/10/15/20/21/22/30/31/32/33 e, em B2, as evoluções 34/35.

**L → M:** 54 arquivos de frontend alterados, sem diferença em backend/package/lockfiles. Inclui filtros/água/faixa
de preço, mensagens de carrinho, união guia/montador, rotas e VLibras; commits `3b33118`, `b5786c8`, `6b15b09`,
`cc27684` e merges PR48/49. O backend de L e M é byte a byte o mesmo na comparação Git.

**L → B2:** commit `1965fec`, 112 arquivos, incluindo auth/sessões, gateway/reconciliação, logística, contratos,
frontend real e testes. Não confundir sua existência no remoto com integração à main. A correção financeira anterior
está em ambas; as proteções posteriores de 17–18/11 estão só em B2.

A primeira fase usou cópias de L/M/B2 em `/tmp/aquarilandia-revisao-20261119-o48d56vq/{local,main,backend2}`
e preservou seus 498 arquivos originais. Esta atualização exportou o HEAD pós-pull para
`/tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/local`, com manifesto inicial de **508 arquivos**, incluindo
o relatório preexistente. Os outros **507 arquivos** foram preservados por SHA-256, assim como HEAD/índice.
Worktrees antigas constam como prunable e suas pastas não existem neste ambiente; não foi feita poda nem se
presume recuperação de alterações privadas. Nenhum fonte de produção foi editado para executar os testes.

### 2.2 Conflitos e incompatibilidades

**Conflito ativo:** nenhum; `git ls-files -u` vazio. **Simulação textual:** `git merge-tree` de três vias, com base
comum `87651de`, sem atualizar refs, índice ou worktree. Seu exit code 0 **não** significa ausência de conflitos.
O resultado textual foi inspecionado e contém marcadores em:

| Arquivo | Duas alterações / resolução recomendada para integração futura |
|---|---|
| `frontend/src/services/frete.js` | M mantém simulação e acrescenta validação/mensagens; B2 usa cotação real, serviços e centavos. Preservar API real de B2 e portar a validação útil de M sem reintroduzir tarifa ou resposta simulada. |
| `frontend/src/pages/checkout/RetornoPagamentoPage.jsx` | M altera o tratamento da resposta simulada; B2 consulta a venda real. Preservar confirmação pelo backend e conferir quando limpar o carrinho, sem fabricar pagamento aprovado. |
| `frontend/src/pages/PoliticaPage.jsx` | M ajusta aviso editorial; B2 acrescenta políticas/introdução e tratamento de provisoriedade. Conciliar conteúdo aprovado e avisos sem apagar nenhum lado automaticamente. |

Também mudaram dos dois lados, sem marcadores nessa simulação: `frontend/src/data/loja.js`,
`pages/conta/CriarContaPage.jsx` e `utils/statusPedido.js`. Exigem revisão funcional: cadastro de B2 retorna
**202 genérico**, não DTO/autologin; novas retiradas exigem unidade e entregas usam serviço/embalagem; pedidos reais
usam centavos e estados do backend. Não basta escolher “ours/theirs” nem obter build verde.

B2 ainda altera `src/modulos/catalogo/produto.logistica.ts` e rotas do catálogo, área de B1: o trabalho já existe,
mas propriedade/revisão devem ser combinadas. A migração 35 é requisito para a nova cotação, e a 34 para reconciliação.
Nenhuma foi aplicada em banco do projeto. **Não há resultado de testes da combinação M+B2**, pois os conflitos
não foram resolvidos nesta rodada. As suítes separadas não comprovam compatibilidade do conjunto.

### 2.3 Limites documentais

O PDF `API_Aquarilandia_Rotas.pdf` existe, ignorado pelo Git. Esta sessão não tinha pdftotext/pypdf/PyPDF2/PyMuPDF;
a tentativa de extração com recursos locais não produziu texto. **Não foi possível reler integralmente o PDF.**
O confronto atual usa api.md/decisoes.md e código; a divergência histórica “baixa no pagamento” do PDF foi registrada
em relatórios anteriores, mas não foi revalidada diretamente neste ciclo. Não atribuo aprovação integral ao PDF.

As referências **M/P** abaixo são do snapshot e7a1589, agora também local; backend é idêntico em L. Referências
**B2** identificam 1965fec, disponível apenas no remoto/cópia. Caminhos/linhas não devem ser transplantados entre
versões. As constatações de navegador desta atualização são da base P, não da combinação P+B2.

## 3. Matriz de funcionalidades

Estados: **implementada**, **parcial**, **pendente**, **não verificada**. “PG” significa teste atual com PostgreSQL
descartável, não acesso a dados da loja. B1 = catálogo/estoque (“Dev 2” nos documentos); B2 = auth/clientes/vendas/
pagamentos/orçamentos, conforme `backend/api.md:6–17`.

| Funcionalidade / rota | Estado, main e consumidor | Evidência / testes atuais | Impacto / responsável |
|---|---|---|---|
| Categorias públicas, `GET /api/categorias[/:id]` | **Implementada**, main, menus/home/loja consomem | `categoria.repository.ts:11–34`; testes categorias + PG | Numéricos, `{itens,total}`, paginação; B1 |
| POST/PATCH/DELETE categorias | **Implementada**, main; UI própria não confirmada | `categoria.service.ts:64–95`, repository:45–58; `integracao/categorias-crud.test.mjs` | Admin/Origin; duplicidade/FK 409, inclusive produto inativo; B1 |
| Preservação de slug estrutural | **Implementada**, main | `categoria.repository.ts:5–8,45–51`, service:75–83 | Onze discriminadores protegidos atomicamente; não propor essa correção novamente; B1 |
| Listagem produtos / filtros gerais e técnicos | **Implementada**, main; loja/busca consomem | `produto.repository.ts:97–168`, `catalogo.parametros.ts`; testes produtos/tecnicos + PG | Somente ativos, total antes da página, desempate ID; B1 |
| Detalhe e onze fichas | **Implementada**, main; detalhe/comparação/montador consomem | `produto.repository.ts:172–254`, `ficha.definicoes.ts`; testes detalhe/cadastro/edição + PG | `ficha:{tipo,dados}` ou null, sem dados internos; B1 |
| Atalhos `/api/peixes[/:id]` | **Implementada**, main; home/lista/detalhe | `peixe.repository.ts:9–35,40–46`; testes peixes + PG | Produto ativo, slug peixes e ficha obrigatórios; mesmo ID/preço; B1 |
| POST/PATCH produtos e ficha | **Implementada**, main; admin consome endpoints | `produto.service.ts:50–96`, validações/campos fechados; PG cadastro/edição | Uma transação; estoque inicial zero; categoria/estoque/ativo protegidos no PATCH; B1 |
| Desativação, leitura de inativos, reativação | **Implementada**, main; UI existe, sessão do frontend ainda simulada | `catalogo.routes.ts:13–39`, `produto.repository.ts:15–28`; testes inativos/remoção + PG | Público 404; admin explícito; saldo/histórico preservados; B1 + frontend/B2 |
| Imagem principal PUT/DELETE e leitura pública | **Implementada**, main; público exibe; upload não possui tela completa confirmada | `imagem/*`, limites/processamento, `imagem.repository.ts:29–30`; 41 PG de produto-imagem e migração | Uma imagem WebP, placeholder, ativo para mídia pública; B1, UI com frontend |
| Movimento administrativo de estoque | **Implementada**, main; UI de gestão não entregue nesta base | `estoque.service.ts:11–46`, schema30; testes estoque + PG | Entrada/ajuste/saída, ator/motivo/idempotência, sem edição direta no produto; B1 |
| Saldos/histórico por produto e geral | **Implementada**, main; consumo frontend não confirmado | `estoque.routes.ts:16–19`, schemas30/31/33; testes estoque-leituras/saldos + PG | Filtros, paginação, saldo vs histórico, sessão/admin/cache; B1 |
| `buscarParaVenda` + baixa/devolução | **Implementada e integrada**, main | `produto.service.ts:109–121`, estoque-venda service/repository; PG produto-venda/estoque-venda/venda-criacao | B1 fornece helpers; B2 orquestra no mesmo client |
| Criação/cancelamento/expiração de venda | **Implementada** no backend main; frontend de M ainda simula | `venda.service.ts:400–476,587–680`, `venda.tarefas.ts`; PG criação/idempotência/expiração/admin | Backend real não implica checkout real na UI; B2 |
| Pix/webhook/conclusão transacional de estorno | **Parcial** quanto à segurança financeira, main | `pagamento.service.ts:148–398`, gateway:290–309; PG pagamentos/webhook/admin | Defeito de conclusão anterior corrigido; prova da resposta direta ainda insuficiente; B2 |
| Reconciliação periódica financeira | **Pendente na main**, implementada em B2 | B2 schema 34, pagamento.repository/service e tarefas | Reprocessamento de eventos/cobranças conhecidas; homologação combinada pendente; B2 |
| Login, conta, endereços e checkout reais no frontend | **Parcial** no projeto: APIs main reais, UI M mock; implementados em B2 | M `services/{conta,pedidos,frete,orcamentos,admin-pedidos}.js`; B2 `services/api.js`, conta/pedidos reais | Integrar trabalho existente, não refazer auth/vendas; B2 + frontend |
| Home: Peixes em destaque / categorias | **Implementada e verificada** no navegador com PG descartável | P `HomePage.jsx:16`, CategoryBand:32, catalogo:55–92; 9 E2E da vitrine passaram | Três elegíveis, vazio legítimo, erro/retry, resposta atrasada e independência de categorias confirmados; B1 + frontend |
| Busca, filtros, comparação, carrinho | **Implementada e verificada na amostra** de E2E | P catalogo:55–98, SearchBox, CompararPeixesPage:25–34, CartProvider:61–102; suíte completa31 + unitários100 | Sem autoridade de preço/saldo no navegador; header320 e foco no carrossel têm achados separados; frontend com B1 |
| “Monte seu Aquário” / guia unificado | **Parcial**, main; guia/montador e heurísticas locais existem | M `services/montagem.js:9–28`, `lib/compatibilidade.js:5–26`, `MontadorAquario.jsx:48–70` | Fichas por N+1, truncamento por grupo e regras ainda provisórias; B1 + frontend + loja |
| Logística por embalagem / unidade retirada | **Pendente na main**, implementada em B2 | B2 schema 35, `produto.logistica.ts:17–47`, frete.transporte, `entrega-logistica.test.mjs` | Exige tarifas/embalagens e revisão B1 do catálogo; B2+B1+loja |
| Serviços / orçamentos | Serviços públicos **implementados em memória**; orçamentos main **implementados** em PG | `controllers/catalogo.controller.ts:2–6`, services/catalogo; orcamento.routes/controller/repository, schema15 | POST público, GET/PATCH admin; resposta/exclusão integral não devem ser inventadas; catálogo B1, atendimento B2 |
| Implantação/worker efetivamente rodando | **Não verificada** | Dockerfile/compose/Caddy/server existem; nenhuma inspeção de ambiente publicado | Saúde, credenciais, migrações, monitoramento e backup dependem de infra |

O schema tem **12 categorias iniciais e 11 tabelas de ficha**, ligadas por produto_id; acessórios não têm ficha
especializada. Produtos têm categoria FK, preço/estoque INTEGER não negativos e ativo; preço não é um float nem
uma tabela de histórico de preços. Venda guarda nome/preço/quantidade/subtotal como snapshot. Movimento de estoque
guarda antes/depois/delta/referências e autoria, não histórico comercial de preço. Evidência: `01_catalogo.sql:18–64,
238–250`, `20_vendas.sql:112–126`, `30_estoque.sql:30–78`, `31_estoque_vendas.sql:21–149`.

## 4. Integração e divergências de contrato

### 4.1 Frontend ↔ catálogo

| Fluxo | Encadeamento real / regra |
|---|---|
| Peixes em destaque | M `HomePage.jsx:16` → `listarPeixes({disponibilidade:'disponivel',limite:3})` → `catalogo.js:55–92` → `/api/peixes?em_estoque=true&pagina=1&limite=3` → produtos JOIN categorias JOIN peixes, ativo e saldo positivo, ORDER BY nome/id. Nenhuma rota admin monta a vitrine. |
| Encontre pelo que você precisa | `CategoryBand` → useCategorias → listarCategorias → `/api/categorias` paginadas → categorias PostgreSQL. Ordenação editorial dos blocos é local; existência vem da API, não de lista estática substituta. |
| Loja/busca | listarProdutos → categorias para resolver slug → `/api/produtos`; parâmetros técnicos/generalistas validados no backend. Busca científica dos peixes usa `/api/peixes`. |
| Comparação/detalhe | IDs numéricos → obterPeixe/obterProduto → mesmo detalhe persistido; comparação lê fichas, até três IDs. Ausência/404 tem estado explícito. |
| Carrinho | localStorage v2 guarda só `{id,qtd}`. `conferirCarrinho` consulta detalhes reais; remove 404/inativo/esgotado, atualiza preço e bloqueia avanço na falha temporária. Não reserva. |

DTO público básico: `{id,categoriaId,categoria,nome,descricao,marca,preco,imagemUrl,emEstoque}`; preço inteiro em
centavos. Detalhe acrescenta ficha e a listagem de peixes já a inclui. `catalogo-mapeamento.js:29–60` preserva
centavos/ID, não inventa saldo quando só conhece disponibilidade e sanitiza URLs de imagem; ficha ausente vira null,
foto ausente/recusada vira placeholder. Quantidade administrativa/histórico não são dados públicos.

`useConsulta.js:11–20` e `CartProvider.jsx:61–92` desconsideram respostas de efeitos já descartados. Isso protege a
UI de respostas antigas nesses caminhos; não equivale a snapshot transacional de várias páginas HTTP.
M `catalogo.js:81–89` busca todas as páginas para operações que a API não oferece diretamente, como Z–A e preço em
peixes; filtrar apenas uma página seria incorreto e não é a implementação atual. O custo cresce com o catálogo.

**Vazio legítimo:** banco sem produto elegível retorna `{itens:[],total:0}`; seed cria categorias, não produtos.
Inativo/sem ficha/saldo zero não deve aparecer nos destaques. Falha de consulta é erro/retry, não vazio nem mock.
A correção de vitrine anterior está presente e **os nove E2E específicos passaram novamente**. Os cenários reais
cobrem muitos elegíveis com limite de três, nenhum elegível, inativos/sem ficha, nomes/preços/links/imagens,
falha de categorias independente da vitrine, erro real no banco com retry e resposta atrasada com loading.
A captura antiga de falha não se reproduziu como erro permanente nesta base com API/PG funcionais. Isso não
comprova que o banco/configuração usados na apresentação tenham peixes válidos; eles não foram acessados.

**Mocks remanescentes:** CATALOGO_MOCK é opt-in, falso por padrão, com selo; não é fallback de erro. Não tem guarda
automática por build de produção (`config/ambiente.js:1–7`, catalogo:106–110). Na main, conta/pedidos/frete/orçamento
simulados são outra questão: criar conta no PostgreSQL não faz o formulário mock emitir sid. B2 já trocou esses
services por API real. `aviseMe` permanece simulado (`catalogo.js:114–117`) e D-28 exclui envio de chegada da entrega.

**Lacuna do montador:** `services/montagem.js:15–16` conserva item sem ficha se detalhe falhar; linhas25–26 leem
somente até 100 itens de cada grupo, ignorando o restante do total. O dado básico não permite avaliar todos os
limites técnicos. `lib/compatibilidade.js:5–26` declara regras provisórias, inclusive lotação e água das plantas.
Isso é uma limitação funcional confirmada, não estoque reservado ou compatibilidade garantida no servidor.

### 4.2 Venda ↔ estoque: invariantes efetivamente verificadas

| Regra | Evidência, garantia e limite |
|---|---|
| Preço/ativo do servidor e confirmação de preço | `venda.service.ts:623–633`: buscarParaVenda com client e locks ordenados, precificar, calcular total, conferir totalEsperado; divergência409 sem gravar. Preço do navegador não é autoridade. |
| Baixa na criação, não no pagamento | service:646 em diante grava venda/itens/histórico e chama baixa na mesma comTransacao; `estoque-venda.repository.ts:55–59` usa UPDATE condicional ativo/estoque >= quantidade. Produto indisponível gera 409 por produtoId/quantidade; sem saldo administrativo exposto. |
| Sem reserva separada | produtos.estoque é disponível após débito; venda aguardando tem expira_em de 30 min. Carrinho não altera unidades. `20_vendas.sql:48–73`, D-16/D-50. |
| Uma compensação integral por venda | `estoque-venda.service.ts:45–70` lê somente baixa original, nunca itens_venda alterado; estado cancelada e histórico sem envio exigidos. UNIQUE(venda_id,tipo_venda), referência única à operação/movimento original e constraint trigger diferido no SQL31 defendem replay/parcial. |
| Mesma transação | Helper exige PoolClient/BEGIN ativo; `utils/transacao.ts:6–25` COMMIT ou ROLLBACK integral. Não abre transação financeira dentro do estoque. Locks venda/produtos mantêm serialização com PATCH/DELETE/reativar. |
| Cancelamento e expiração não pagos | `venda.service.ts:410–427`, `venda.tarefas.ts:42–70`: cancelar+histórico+estornar juntos. Testes PG exercitam último saldo, rollback, locks, replays e itens alterados. |
| Cancelamento pago | Enquanto cancelamento_solicitado, saldo permanece debitado. Confirmação pertinente conclui no helper compartilhado de pagamentos; PG admin17–26 cobre webhook, concorrência, rollback multiproduto, duplicata e recuperação. A insuficiência de prova do caminho direto/manual está na seção5. |
| Enviada/entregue | Cancelamento comum recusado; helper também verifica histórico de envio. Reembolso financeiro, sozinho, não prova devolução física comercializável. |
| Worker | `server.ts:3–7`, tarefas:14–16,180–184: primeira rodada 30 s, intervalo 5 min, não inicia com NODE_ENV=test. Testes provam a rotina, não a execução numa implantação. Lote de 100 vencidas e gateway/filas podem aumentar tempo efetivo de processamento. |

Confirmação de pagamento aprovado não debita estoque novamente (D-21); confirmação de refund pode executar a
compensação vinculada à baixa original. Não confundir os dois tipos de processamento do webhook.

**Exceções vigentes, não regras novas aprovadas:** D-16 e api.md registram retenção quando a reconsulta financeira
falha, com corte após mais de uma hora de vencimento. A consulta aprovada pode pagar venda ainda aguardando mesmo
após expira_em (`pagamento.service.ts:173–189`). Logo “30 minutos” não é garantia atual de liberação em tempo real.
A própria documentação mantém essa política pendente de aprovação conjunta; não adote a proposta antiga de TTL
rígido do Ciclo3 como implementação vigente. Testes de expiração revalidam relógio/estado sob lock, mas isso não
aprova uma política financeira diferente.

Outra exceção preservada: ausência de baixa original é logada e permite finalizar cancelamento sem criar crédito;
outros erros fazem rollback. Não fabricar baixa retroativa ou alterar saldo para “consertar” registros legados.

### 4.3 Contratos que ainda precisam de alinhamento

- Prefixo real é `/api`; listas de catálogo/estoque usam `{itens,total}`, enquanto clientes/vendas usam `{dados,total,...}`.
  Erros atuais são `{erro,detalhes?}`; validação de catálogo geralmente400 e módulos B2 usam422. Não há migração global
  para um envelope único autorizada. O frontend novo deve mapear cada contrato explicitamente.
- B2 acrescentou cadastro202 genérico, mínimo Pix100 centavos, unidade obrigatória de retirada e serviço/embalagem
  para entrega. Não ligar frontend M simulado ao backend B2 assumindo que os corpos/respostas são iguais.
- Serviços continuam estáticos e não são uma tabela de produtos/fichas. Orçamentos possuem POST/GET/PATCH de status;
  resposta, exclusão e CRUD completo não existem só porque um contrato antigo os propôs.
- README:80–81 e trechos históricos de testes dizem que criação/cancelamento/pagamento ainda dependem da integração;
  isso está desatualizado para o backend main. Relatórios antigos “sem commit” descrevem sua data, não o Git atual.
- Documentação de B2 atualiza logística, mas D-24 ainda declara integração com transportadora fora da entrega. A entrega
  existente é cálculo por tarifas contratadas configuráveis, **não** API online de transportadora. A loja precisa
  aprovar tarifas/prazos, regras e responsabilidade por embalagem, sem inventar preço comercial.


### 4.4 Frontend após o pull: evidências visuais e defeitos reproduzidos

**Parecer para hoje:** a amostra visual apresenta identidade consistente, boa hierarquia, títulos legíveis,
cartões, filtros e temas claro/escuro coerentes. Foi examinada em Chromium, desktop 1440×1000 e mobile emulado
390×844, além da home 320×800. Não há base para declarar o frontend inteiro “pronto e acessível”: há falhas
concretas abaixo, fluxos simulados e critérios que dependem de inspeção manual/tecnologia assistiva.
Os cartões de teste usaram dados fictícios e placeholders quando cabível; isso não mede a qualidade das fotos
ou o preenchimento do catálogo real da loja.

Evidências desta atualização: `/tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/evidencias/` (**E**).
Screenshots são de execução real do frontend/backend sobre PG descartável. Os caminhos temporários não são
artefatos permanentes do repositório.

| ID / prioridade / classificação | Reprodução, esperado e observado | Evidência / origem | Correção proposta e aceite |
|---|---|---|---|
| F01 — **P1 hoje, bug confirmado** | Home, viewport320: cabeçalho deve caber e preservar navegação. Documento mede341 px; menu começa em296,61 px, largura44, terminando em340,61. Cerca de21 px ficam fora da viewport; body com clip esconde a sobra. | `frontend/src/components/organisms/SiteNav.jsx:63–70`, `components/atoms/Logo.jsx:8–12`, `index.css:290–291`; E `home-mobile-320.json`, `reflow-foco.json`, screenshot `home-mobile-320-viewport.png`. SiteNav/Logo não mudaram no pull: indício de falha anterior, reproduzida agora, não atribuída ao Ciclo2. | Frontend: compactar marca/disposição dos controles no breakpoint estreito. Aceite320/360/390: navegação inteira visível, sem overflow da página, alvos/nome acessível preservados; conferir também zoom. Não resolver apenas ocultando a rolagem. Relevante a WCAG1.4.10. |
| F02 — **P1 se VLibras for requisito da apresentação, falha confirmada de integração** | Abrir build pelo Express com seus headers reais. Esperado widget inicializar; script bloqueado por `script-src-elem`, widget ausente, página HTTP200. | `frontend/src/components/organisms/VLibras.jsx:3–22`, `frontend/src/main.jsx:6,13`; `backend/src/app.ts:42–56`; E `csp-vlibras.json`, screenshot `home-build-csp.png`. Introduzido pelo pull, commit `cc27684`; a CSP já existia. | Frontend+infra/segurança: levantar origens de script/assets/conexões e compatibilidade de implantação, decidir confiança/privacidade, configurar somente o necessário e repetir teste do build. Não remover CSP nem liberar script globalmente. VLibras é complementar, não substitui acessibilidade nativa. |
| F03 — **P2, corrigir texto hoje, confirmado** | Painel de produtos informa que “o servidor ainda não tem” operação de estoque. Esperado explicar a limitação da tela; backend já possui movimentos e histórico. | `frontend/src/pages/admin/AdminProdutosPage.jsx:87–88`; APIs de estoque na seção3; E screenshot `admin-catalogo-viewport.png`. Texto anterior ao pull. | Frontend com B1: informar que o ajuste não está disponível nessa tela e depende de movimentação rastreável. Não habilitar PATCH direto de estoque como atalho. Texto deve corresponder às APIs reais. |
| F04 — **P1 para demonstração por teclado, usabilidade confirmada; conformidade específica não concluída** | Home320, Tab do botão de adicionar de peixe ao link “Ver todos os peixes”. Esperado item focado e conteúdo legível; link fica focado em x256,63…481,25, scrollLeft0, viewport320: somente parte aparece. | `frontend/src/components/organisms/Vitrine.jsx:11–21,41–50`, snap obrigatório; E `reflow-foco.json`, `reflow-corrigido.log`, screenshot `home-carrossel-teclado320.png`. Carrossel horizontal é intencional; origem exata desta interação não isolada entre ciclos. | Frontend: fazer item focado entrar na área visível, conciliando rolagem e snap; testar Tab/Shift+Tab sem prender foco. Não classificar toda rolagem horizontal como bug. O item não fica totalmente oculto: esta evidência sozinha não comprova violação de WCAG2.4.11 AA. |
| F05 — **P0 antes de vendas reais; limite funcional confirmado, não regressão do catálogo** | Login apresenta conta de exemplo; pedidos/confirmação ainda simulados. Checkout promete cartão e página hospedada, divergindo do backend Pix transparente. | `frontend/src/services/conta.js:17–23`, `services/pedidos.js`, `pages/checkout/EtapaPagamentoPage.jsx:61–98`; S06. Pull não integrou B2. | B2+frontend: integrar trabalho real já existente e homologar após resolver S01 e conflitos. Para apresentar catálogo hoje, identificar claramente protótipo e não anunciar compra/pagamento/admin real como concluídos. |
| F06 — **P2 qualidade, confirmado** | `npm run lint` termina com quatro erros; build passa com chunk576,56 kB, gzip182,12 kB. | `frontend/src/utils/statusPedido.js:16–18`, `hooks/usePedidosNovos.js:34`; E logs lint/build. Erros de lint anteriores ao pull, corrigidos separadamente em B2. | Revisar/portar correções existentes e repetir lint. Divisão de bundle pode ser etapa posterior. O aviso de tamanho não é medição de lentidão em dispositivo real; não houve Lighthouse/Core Web Vitals nesta rodada. |

**Peixes em destaque não falhou na integração examinada.** Não é necessário inventar peixe estático nem usar rota
administrativa na vitrine. Um catálogo vazio continua sendo resultado legítimo; erro de rede/banco tem mensagem e
retry distintos. A confirmação do conteúdo real disponível para a apresentação exige ambiente e dados aprovados.

### 4.5 Acessibilidade: o que foi verificado e o que permanece aberto

Referência técnica: [WCAG2.2, W3C](https://www.w3.org/TR/WCAG22/). Nesta revisão usamos critérios A/AA como referência,
varredura automática e testes dirigidos de teclado/renderização. Conformidade exige todos os critérios aplicáveis
no escopo completo; “axe sem violações” não significa “site WCAG AA”. Heurísticas de Nielsen também não substituem
essa verificação.

| Verificação / critério de referência | Resultado observado e evidência | Limite / ação |
|---|---|---|
| Estrutura, nomes e relações; WCAG1.1.1/1.3.1/4.1.2 | axe-core4.14.1 em **19 estados**, tags wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa: **zero violações automaticamente apontadas**. `lang=pt-BR`, um H1 em cada estado. Botões de adicionar incluem o produto no nome acessível. E `resumo-acessibilidade.json` e JSON de cada tela. | Amostra de home claro/escuro/320, loja desktop/mobile, peixes mobile escuro, guia, montador, login/cadastro/erros, detalhe, comparação, carrinho, filtros, busca/menu e catálogo admin desktop/mobile. Não cobre todas as rotas, estados e tecnologias assistivas. |
| Teclado e atalhos; WCAG2.1.1/2.1.2/2.4.1/2.4.7 | Primeiro Tab alcança “Pular para o conteúdo”; Enter foca `#conteudo`. Busca foca input rotulado; 12 Tabs permanecem no diálogo, Escape devolve foco à busca. Menu também contém a sequência testada e, após terminar o fechamento, retorna a “Abrir menu”. Guia/montador com setas/histórico passou no E2E. E `teclado-movimento.json`, `reflow-foco.json`. | Positivo na sequência examinada, não prova de ordem de foco integral em todas as telas. F04 requer ajuste no carrossel. Três estados modais tiveram verificação axe `aria-hidden-focus` inconclusiva; não convertida automaticamente em defeito nem em aprovação. |
| Formulários e erro; WCAG3.3.1/3.3.2/4.1.3 | Submit vazio de login marca ambos inputs `aria-invalid=true`, associa `aria-describedby` às mensagens e foca e-mail, primeiro inválido. Estados loading/erro/vazio/retry e contagem de filtros foram exercitados. `components/molecules/FormField.jsx:8–36`, `components/atoms/Input.jsx:6–7`; E `formulario-erros.json`. | Login atual é mock: isso valida mensagem local, não autenticação real nem anúncio de erros por leitor de tela. Anúncio por tecnologia assistiva permanece não verificado. |
| Reflow; WCAG1.4.10 | **Problema confirmado em320:** header corta controle. Demais estados examinados em390/1440 não apresentaram overflow horizontal da página. Tabela de dados e carrossel possuem comportamentos próprios de rolagem. E JSON de viewport e F01. | Corrigir header e repetir320/360/390; verificar zoom200%/400%, texto ampliado e espaçamento. Essa extensão manual não foi executada nesta rodada. |
| Contraste; WCAG1.4.3 | Todos os19 estados tiveram `color-contrast` inconclusivo por fundos/gradientes. Medição complementar em texto do hero, dois títulos e descrição do rodapé, claro/escuro: **8/8 amostras atenderam**. Texto normal: mínimos medidos6,96/7,78 no hero e6,07/5,73 no rodapé; títulos13,43/15,62. E `contraste-amostral.json`. | Foram usadas cores computadas e amostras de fundo renderizado, com texto temporariamente transparente só no DOM de teste. Mínimos examinados4,5:1 normal e3:1 grande. Não cobre todos os cartões, controles, foco, estados disabled, sobreposições e fotos; contraste integral permanece aberto. |
| Preferência de movimento | Com `prefers-reduced-motion:reduce`, zero bolhas e zero animações CSS rodando no instante examinado; `index.css:311–317`. E `teclado-movimento.json`. | Resultado da amostra, não auditoria de todos os vídeos/animações do projeto. |
| VLibras | Falha de CSP reproduzida no build servido pelo backend (F02). | Resolver integração se for requisito; não usar o widget como selo de acessibilidade. Não houve homologação do avatar/tradução. |

Os scans do catálogo administrativo usaram **sessão fictícia válida no PG e usuário visual de teste explícito**;
não comprovam que o login atual do frontend autentique de fato no backend. O script externo do VLibras foi
bloqueado deliberadamente durante as varreduras isoladas; a incompatibilidade CSP foi testada separadamente
com o build e os headers reais. Não foram usados dados ou contas da loja.

**Não verificado:** NVDA/JAWS/VoiceOver, dispositivos iOS/Android físicos, todas as resoluções/rotas, zoom/texto
ampliado e espaçamento, contraste completo de elementos não textuais, todos os alvos de toque, anúncios reais
de regiões live, tradução em Libras e ambiente publicado. Portanto **não declarar atendimento integral à WCAG AA**.

### 4.6 As dez heurísticas de Jakob Nielsen, aplicadas ao estado atual

Usamos os [dez princípios de Nielsen, NN/G](https://www.nngroup.com/articles/ten-usability-heuristics/) como roteiro
de revisão qualitativa. A tabela cruza comportamento do projeto e evidências locais; não é uma certificação nem
um teste com usuários. “Atendida na amostra” não significa cobertura integral de toda a aplicação.

| Heurística | Evidência positiva no frontend | Lacuna e conclusão da amostra |
|---|---|---|
| 1. Visibilidade do estado do sistema | Vitrine com skeleton/loading, erro/retry e vazio distintos; total e filtros ativos; confirmação ao adicionar ao carrinho. E2E reais passaram. | **Parcial:** pagamento simulado pode aparentar estado financeiro real. Preservar feedback e integrar fonte real antes de venda. |
| 2. Correspondência com o mundo real | Português, R$, categorias familiares, unidades de ficha e guia explicativo; preços conferidos com centavos no backend. | **Parcial:** aviso falso de estoque F03 e promessa de cartão/página externa F05 contradizem o funcionamento. |
| 3. Controle e liberdade | Fechar busca/menu com Escape, retorno de foco, retirar item, limpar filtros e voltar no histórico; cenários passaram. | **Parcial:** menu cortado em320 e item focado parcialmente fora da área visível reduzem o controle (F01/F04). |
| 4. Consistência e padrões | Temas, cartões, botões, campos e navegação coerentes nas capturas desktop/mobile. | **Parcial:** UI de checkout não corresponde ao meio Pix do backend; contratos privados divergentes ainda exigem integração B2. |
| 5. Prevenção de erros | Formulário valida obrigatórios; filtros validam faixa; carrinho reconfere preço/disponibilidade; produto inativo não é vendido pela API. | **Atendida na amostra do catálogo:** não estender aprovação ao checkout mock ou às lacunas financeiras S01. |
| 6. Reconhecimento em vez de memorização | Categorias visíveis, chips de filtros, comparação e fichas; dados do carrinho recuperados por ID. | **Atendida na amostra:** falta de ficha/detalhe no montador pode deixar a decisão técnica incompleta (S10). |
| 7. Flexibilidade e eficiência | Atalho de busca, teclado em abas, filtros na URL e histórico, atalhos de comparação; E2E aprovados. | **Parcial:** F04 prejudica teclado no carrossel; montador faz chamadas adicionais e trunca catálogo. |
| 8. Estética e design minimalista | Hierarquia visual clara, bom espaçamento e consistência de cor nas capturas1440/390; movimento reduzido respeitado na amostra. | **Parcial:** reflow320 falha; aparência consistente não comprova velocidade em celulares nem acessibilidade completa. |
| 9. Reconhecer, diagnosticar e recuperar erros | Mensagens de campo, foco no primeiro inválido, retry sem fallback estático; erros de API não exibem SQL nos cenários examinados. | **Atendida na amostra:** a autenticação real e a recuperação financeira combinada com B2 ainda precisam de homologação. |
| 10. Ajuda e documentação | Guia unificado, orientações de montagem, glossário/ajuda no código e interface examinada; navegação das abas aprovada. | **Parcial:** corrigir ajuda falsa F03; regras do montador/políticas precisam de aprovação da loja. VLibras indisponível não deve ser anunciado como recurso homologado. |

Não foi identificada uma regressão geral da vitrine por causa deste pull. A melhoria visual/navegação é real,
mas coexistem defeitos antigos, uma incompatibilidade nova de CSP e fluxos ainda simulados. Nenhuma heurística
autoriza esconder erros da API, contornar permissão administrativa ou fabricar disponibilidade para a apresentação.

## 5. Segurança: achados priorizados

Prioridades: P0 antes de operação comercial; P1 antes da integração/homologação final; P2 próximo endurecimento.
“Confirmado” pode ser evidência estática ou reprodução defensiva, distinguida abaixo; não significa incidente real.

| ID / prioridade / estado | Evidência e como ocorre | Impacto concreto | Responsável / correção recomendada |
|---|---|---|---|
| S01 — **P0, confirmado em M; corrigido no código B2** | M `gateway.ts:302–308` exige só originalId; sonda isolada aceitou PENDING e COMPLETE parcial. `venda.service.ts:441–457` e `pagamento.service.ts:417–430` concluem manualmente com permissão/tentativas/motivo, sem consultar refund. | Pode cancelar/creditar estoque sem devolução financeira integral comprovada. Autorização admin não substitui comprovação financeira. | B2, revisão B1 do efeito de estoque: integrar proteção existente `gateway.ts:290–308`, pagamento.service:423–460 e venda.service:422–460 de 1965fec. Testar valor/status/vínculo e nenhum crédito prematuro. |
| S02 — **P1, confirmado por revisão em M; corrigido em B2** | `auth.service.ts:215–235` verifica hash fora da transação e depois cria sessão sem reler credenciais; troca/anonimização também têm janelas após verificação. | Corrida com redefinição pode emitir sessão baseada na senha antiga; revogação pretendida fica incompleta. Não reproduzido contra contas reais. | B2: reaproveitar revalidação de hash/email sob lock em1965fec (`auth.service.ts:228–237`, cliente.service); testes concorrentes de ciclo0-autenticacao já existem e passaram na branch. |
| S03 — **P1, condicional à implantação; proteção adicional em B2** | M `Caddyfile:12–19` remove query/cookie/assinatura, mas não X-Webhook-Secret nem Referer; webhook aceita esse header (`webhook.ts:30–34`); recuperação usa token na URL. `notFound` reflete originalUrl (`errorHandler.ts:5–6`). | Segredos/URLs sensíveis podem chegar a access logs ou respostas de rotas inexistentes. Não houve inspeção de logs publicados ou vazamento real nesta rodada. | Infra+B2: integrar filtros de header/Referer e política no-referrer de B2; revisar também eco de URL em404 e todos os proxies. Não registrar headers/corpos sensíveis. |
| S04 — **P1, confirmado por revisão em M; tratamento em B2** | `venda.service.ts:500–547` avança logística com status da venda, sem comprovar estado financeiro atual; reconsulta de estorno espontâneo em M pode alterar só pagamento. | Pedido pode avançar após estorno/disputa fora do cancelamento normal, apesar de o estoque estar contabilmente consistente. | B2: integrar reconsulta fora dos locks e revalidação financeira sob lock de 1965fec; preservar vedação de devolução automática pós-envio. |
| S05 — **P1, lacuna confirmada em M; correção existente em B2** | Job M só expira/limpa/tenta refund; não varre eventos financeiros falhos/cobranças canceladas (`venda.tarefas.ts:123–184`). | Perda de webhook pode deixar dinheiro tardio ou processamento pendente sem recuperação independente do navegador. | B2+infra: integrar reconciliação/schema 34 e monitorar backlog. Ela só encontra cobranças com ID conhecido; timeout antes de persistir ID ainda exige retry idempotente/revisão do provedor. |
| S06 — **P1, confirmado em frontend M; integrado somente em B2 isolado** | `services/conta.js:17–23` concede papel visual pelo e-mail de exemplo; pedidos.js simula compra/confirmação; admin.js real exige sid. | UI aparenta autenticação/pagamento sem efeito real; catálogo admin recebe401. **Não comprova bypass do servidor**, que continua protegendo dados. | B2+frontend: integrar services/Provider/checkout reais existentes; testar storage forjado não autenticando e confirmação apenas pelo backend. |
| S07 — **P2, condicional / parcial em M; middleware em B2** | Sessão/login e algumas leituras privadas não têm no-store/Vary uniformes; controladores de vendas/orçamentos e estoque já têm proteção específica. | Respostas pessoais podem ser armazenadas conforme navegador/proxy. Não há evidência de cache compartilhado efetivamente vazando. | Shared/B2: integrar no-store/Vary nas famílias privadas e validar também erros401/403; não confundir CORS com isolamento de cache. |
| S08 — **P2, confirmado no lock M** | Audit frontend completo: zod alto, minimatch/ESLint/config-array moderados; produção sem dev=0. B2 lock já atualiza as versões e retorna0. | Risco na cadeia de desenvolvimento/build, não evidência de endpoint Express explorável por essas bibliotecas. | Frontend: integrar lock corrigido existente e validar instalação limpa; não executar audit fix --force. Backend audit atual=0. |
| S09 — **P2 segurança; P1 de apresentação se exigido; falha funcional confirmada no build local** | P `VLibras.jsx:3–22` injeta script externo; `app.ts:42–56` mantém script-src self e connect-src self. Navegador registrou violação script-src-elem e widgetInicializado=false, servindo o build pelo Express real. | VLibras não funciona nessa implantação padrão. Alteração irrestrita da CSP para contornar pode ampliar confiança em terceiro no checkout. Ambiente publicado não foi inspecionado. | Frontend+infra: resolver F02 com origens mínimas, revisão de assets/rede/privacidade e teste do build; não remover CSP nem liberar scripts globalmente. |
| S10 — **P2, confirmado no código do montador** | `services/montagem.js:15–26`: primeira página de 100 e detalhe falho mantido sem ficha. | Opções incompletas e análise técnica sem dados suficientes; não é prova de catálogo vazio nem de compatibilidade aprovada. | B1+frontend: consulta de fichas paginada/limitada, carregar páginas e expor estado parcial/erro; validar regras com loja. |
| S11 — **P2, condicional / não verificado operacionalmente** | `pagamento.service.ts:351–363` agrupa tentativas só no processo; timers/rate limits usam memória; notificações após COMMIT não têm outbox durável. | Réplicas podem repetir chamadas financeiras; queda após COMMIT pode perder aviso. Ledger continua prevenindo devolução local duplicada. | B2+infra: definir topologia e necessidade de lease/outbox/store de rate limit; não segurar locks SQL durante rede. Testes atuais não são carga ou múltiplos processos. |

### 5.1 O que está protegido e foi reconfirmado

- **Permissão efetiva:** `autenticar` consulta hash de sid, validade e conta ativa, lendo papel atual do banco
  (`sessao.repository.ts:15–25`); exigirAdmin não usa papel do body/storage. GET/HEAD de inativos/estoque/imagens
  administrativas/vendas/orçamentos têm guardas; acesso do cliente a endereço/venda filtra dono e retorna404 para
  recurso alheio. Suítes de permissões, revogação e alteração de papel passaram em PG.
- **Cookie/CSRF:** HttpOnly, SameSite=Lax, Secure em produção e expiração; logout/redefinição revogam sessões no
  banco. Escritas autenticadas exigem Origin configurado. CORS com credenciais é configuração de navegador,
  **não** substituto de autenticação, dono ou Origin. Rotas de catálogo/estoque checam sessão/admin antes de Origin;
  parte de B2 verifica Origin antes da sessão. Ambas protegem a escrita, embora a ordem afete status/custo da rejeição.
- **Entrada/SQL:** listas fechadas de campos e enums, inteiros/limites, SQL parametrizado; ordenação e nomes de
  tabela de ficha vêm de opções internas, não de concatenação livre de usuário. Produto PATCH não altera
  estoque/ativo/categoria/id. Categoria estrutural não muda slug. `express.json` mantém100 KiB, rejeita compressão,
  mapeia413/415/400; erros500 não expõem SQL/stack (`app.ts:72–84`, `errorHandler.ts:9–27`).
- **Imagens:** guardas antes de parser; um arquivo até 5 MiB, teto de dimensões/pixels/tempo/concurrency; MIME/extensão/
  assinatura/decoder coerentes; reencoda WebP sem EXIF/GPS, nome gerado, diretório externo e mídia pública de produto
  ativo. Sem path do cliente como destino. `imagem.upload.ts:6–44`, processamento:26–55, limites:1–9. PG/filesystem
  real passaram; capacidade de produção não foi medida.
- **Privacidade:** listagem pública de orçamentos permanece fechada; POST público/GET/PATCH admin em schema15.
  Respostas administrativas são projetadas, sem credenciais, sessão ou hash. Produtos públicos não expõem quantidade
  de estoque, ledger ou ativo. Nenhum dado de cliente real foi acessado na revisão.
- **Webhook:** segredo obrigatório + HMAC do corpo cru + reconsulta autenticada; a chave pública incorporada ao
  código **não é um segredo privado vazado**. Evento duplicado é controlado no banco e por estado/ledger; metadata
  não escolhe livremente a venda. A insuficiência S01 é no caminho direto/manual, não ausência dessas proteções.
- **Configuração:** NODE_ENV e DATABASE_URL obrigatórios, HTTPS/segredos/e-mail exigidos em produção; .env atuais
  não são rastreados e .dockerignore os exclui. Imagem final roda como usuário node e contém só runtime backend e
  frontend estático (`Dockerfile:7–54`). Não foi feita varredura completa de segredos do histórico nem validação
  das credenciais reais. Desenvolvimento sem chave de e-mail imprime mensagem/token no terminal (`email.ts:79–80`):
  usar só dados fictícios e não encaminhar esses logs a observabilidade compartilhada.

### 5.2 Correção financeira anterior: resultado exato da revisão

**Corrigido e integrado:** `167b7d4` eliminou o estado “pagamento estornado, venda ainda em cancelamento solicitado,
estoque comprometido” para o fluxo pertinente. M `pagamento.service.ts:241–270,315–398` compartilha o client,
relê os vínculos sob lock, não credita cobrança indevida/manual e recupera pagamento já estornado pelo job/retry.
Valor de consulta divergente não comprova refund. Erro SQL desfaz toda a conclusão local; gateway fica fora dos locks.

`integracao/vendas-admin.test.mjs:17–26` (nomes dos casos) sustenta confirmação por webhook, mesmo evento e eventos
distintos, webhook×resposta direta, rollback no segundo produto pelos dois caminhos, retry sem novo refund, fila
legada, valor/cobrança incorretos, cobrança duplicada/manual, estado após lock e envio/entrega. Reconciliação de saldo
com ledger é verificada após os cenários. `integracao/pagamentos.test.mjs`, `webhook.test.mjs` e testes gateway
sustentam consulta pelo provedor controlado, assinatura, valor e vínculo. Não são uma transação financeira real.

**Não resolvido por aquela correção:** resposta direta do adaptador deve ser prova financeira válida antes de
invocar a conclusão. Sonda `/tmp/.../evidencias/refund-prova.mjs`, executada sobre builds reais com fetch inteiramente
substituído, obteve:

| Resposta fictícia do refund para valor esperado 12345 | M | B2 | Resultado esperado |
|---|---|---|---|
| status PENDING, amount 12345, originalId correto | aprovado=true | aprovado=false | Recusar conclusão |
| status COMPLETE, amount 100, originalId correto | aprovado=true | aprovado=false | Recusar valor parcial |
| status COMPLETE, amount 12345, originalId correto | aprovado=true | aprovado=true | Aceitar |

Não houve tráfego ao provedor nem desenvolvimento de exploit. São verificações legítimas do invariante financeiro.
O [contrato oficial de refund](https://docs.abacatepay.com/pages/transparents/refund) informa campos de estado/valor;
a recomendação é aplicar as conferências já implementadas em B2 e homologar com o provedor em ambiente autorizado.

## 6. Verificações executadas

### 6.1 Ambiente e resultados

**Primeira fase, mantida como histórico verificável:** Node22.23.3/npm10.9.9; dependências existentes copiadas,
sem instalação de dependências do projeto. M/L compartilham o mesmo backend. PG17-alpine
descartável `aquarilandia-revisao-pg-20261119`, tmpfs, porta efêmera58386 e dados fictícios. Nenhum compose do projeto,
volume, .env ou banco existente foi usado. As suítes criaram/removeram seus próprios schemas; conferência final
retornou zero schemas remanescentes. Container exclusivo encerrado/removido depois dos testes.

| Base / comando | Resultado | Evidência em `/tmp/aquarilandia-revisao-20261119-o48d56vq/evidencias/` |
|---|---|---|
| M backend `npm run typecheck` / `npm run build` | **Passou** ambos | backend-main-typecheck/build.log |
| M backend `npm test` | **Passou:1.411**, zero falhas/ignorados | backend-unitarios.log |
| M backend `TEST_DATABASE_URL=... npm run test:integration` | **Passou:656**, zero falhas/ignorados | backend-integracao.log |
| M frontend `npm test`, reexecução com subprocessos permitidos | **Passou:100**, zero falhas/ignorados | frontend-main-unitarios-reexec.log |
| L frontend, mesmo comando | **Passou:89**, zero falhas/ignorados | frontend-local-unitarios-reexec.log |
| M/L frontend `npm run build` | **Passou** ambos, aviso de chunk grande permanece | frontend-main/local-build.log |
| M/L frontend `npm run lint` | **Falhou:4 erros em cada base** | frontend-main/local-lint.log |
| B2 backend typecheck/build/`npm test` | **Passou**,1.434 testes, zero ignorados | backend2-unitarios.log, backend-backend2-typecheck/build.log |
| B2 `TEST_DATABASE_URL=... npm run test:integration` | **Passou:669**, zero falhas/ignorados | backend2-integracao.log |
| B2 frontend testes/lint/build | **Passou**,89 testes, zero ignorados | frontend-backend2-unitarios/lint/build.log |
| M frontend, primeira tentativa `npm run test:e2e -- --grep 'vitrine desktop: três cartões'` | **Bloqueada inicialmente** por Chromium ausente; **impedimento superado nesta atualização**, conforme tabela abaixo | e2e-main-tentativa.log; log completo atual em E |
| `playwright test --list` na main | **Passou** descoberta:31 casos em5 arquivos, incluindo9 da vitrine | e2e-main-lista.log |
| Auditoria M backend completa / `--omit=dev` | **Passou:0/0 vulnerabilidades** | audit-backend-completo/producao.json |
| Auditoria M frontend completa | **Falhou:4 alertas**,1 alto+3 moderados | audit-frontend-completo.json |
| Auditoria M frontend `--omit=dev` | **Passou:0** | audit-frontend-producao.json |
| Auditoria B2 frontend completa / `--omit=dev` | **Passou:0/0 no lockfile B2**; ver limitação abaixo | audit-backend2-frontend-completo/producao.json |
| Sonda defensiva de refund, sem rede | **Invariante falhou em 2 respostas de M**; B2 atendeu 3/3 | refund-prova.json/.mjs |
| Git status/ancestry/diff/merge-tree | **Passou inspeção**;3 arquivos com conflito futuro, nenhum conflito ativo | merge-tree.txt e SHAs da seção2 |
| Hashes de fontes e `git diff --check` | **Passou**; só relatório adicionado | fontes-iniciais.json e preservação final |

Os quatro erros de lint são preexistentes em L e permanecem em M: três chaves duplicadas em
`frontend/src/utils/statusPedido.js:16–18` e `react-hooks/set-state-in-effect` em `hooks/usePedidosNovos.js:34`.
Esses arquivos já receberam correções em B2; revisar o resultado da integração antes de criar correção duplicada.

As primeiras execuções frontend dentro da restrição reportaram apenas4/5 arquivos; foram desconsideradas como
contagem definitiva e repetidas com casos individuais. Uma tentativa auxiliar com `--test-isolation=none` falhou
por opção incompatível com Node22, antes de testar; os resultados válidos acima são de `npm test` normal.
Backend não possui script lint e frontend não possui typecheck configurado: **não executados**, não aprovados.
Suíte combinada M+B2, carga, gateway/e-mail/CEP reais, Caddy real e implantação: **não executados**.
Os testes B2 usam provedores controlados; isso não confirma tarifas, domínio, conta do gateway ou operação externa.
Os31 E2E da base P foram executados depois, conforme a subseção seguinte; o bloqueio inicial não permanece.

### 6.2 Dependências: distinguir lockfile, instalação e produção

Backend: body-parser **2.4.0** e Express **5.2.1** conferidos tanto no lock quanto nos módulos instalados;
o relato antigo de body-parser2.3.0 não descreve a instalação examinada. Auditoria backend completa e runtime=0.

M/L: minimatch **10.2.6** e zod **4.5.4** no lock e na instalação copiada. Os avisos atuais são
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) e
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); as versões corrigidas informadas pelos
avisos são11.0.1 e4.6.6. Os dois outros alertas são a cadeia ESLint/config-array. Não há prova de impacto nessas
bibliotecas por entrada pública da aplicação; auditoria de runtime sem dev ficou zerada.

B2 lock já registra minimatch **11.0.9**/zod **4.6.7** e move plugin Tailwind/Vite para dev. **Não foi executado npm ci**:
a cópia B2 usou as dependências locais anteriores para compilar/testar; essas duas versões instaladas nela continuam
10.2.6/4.5.4. Portanto audit0 do lock B2 **não** comprova atualização dos módulos instalados nesta revisão. A integração
futura precisa instalar reproduzivelmente aquele lock e repetir testes/audit. Os relatos antigos de cinco alertas
altos ou de audit geral zerado são históricos, não o resultado observado agora.


### 6.3 Atualização pós-pull: navegador, apresentação e acessibilidade

Base P=e7a1589, exportada com `git archive HEAD`; dependências já existentes reaproveitadas nas cópias temporárias.
Foi baixado **Chromium156.0.8078.4, build1248, pelo Playwright1.64.1 já instalado**, para diretório de testes.
A primeira tentativa de abrir o navegador revelou bibliotecas ausentes; `apt-get download libnspr4 libnss3
libasound2t64` e `dpkg-deb -x` extraíram-nas em `/tmp`, sem instalação no sistema. A execução usou
`PLAYWRIGHT_BROWSERS_PATH=.../browsers` e `LD_LIBRARY_PATH=.../libs/usr/lib/x86_64-linux-gnu`.

axe-core4.14.1 foi obtido do registro oficial npm, com SHA512 conferido, e usado como ferramenta temporária;
não entrou em package.json, lockfile ou node_modules do projeto. Os testes diagnósticos adicionais também
ficaram somente em `/tmp`. O PostgreSQL17-alpine foi **outro container exclusivo**,
`aquarilandia-front-pg-20261119`, tmpfs/porta65080, dados fictícios. Nenhum banco/container do projeto foi alterado.
Conferência final: zero schemas de teste remanescentes; esse container foi encerrado e removido.

Prefixo **E** nas evidências abaixo: `/tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/evidencias/`.

| Comando / verificação nesta atualização | Resultado exato | Evidência |
|---|---|---|
| Git status/reflog/log/diff/ancestry e `git fetch origin` | **Inspecionado:** pull FF L→P;54 arquivos frontend; zero mudanças backend/manifests; P=M; B2 não integrado; nenhum unmerged | Seção2, comparações Git atuais |
| Backend `npm run build` na cópia P | **Passou** | E `backend-build.log` |
| Frontend `npm run build` na cópia P | **Passou**, aviso chunk576,56 kB | E `frontend-build.log` |
| Frontend `npm test` com subprocessos permitidos | **Passou:100**, zero falhas/ignorados | E `frontend-testes.log` |
| Frontend `npm run lint` | **Falhou:4 erros** já descritos | E `frontend-lint.log` |
| `NODE_ENV=test DATABASE_URL=<sentinela-sem-banco> TEST_DATABASE_URL=<PG-descartável> npm run test:e2e`, com browser/libs temporários | **Passou:31/31**, zero ignorados, cerca de1,5 min; frontend, backend e PostgreSQL reais | E `e2e-completo.log`; suíte versionada `frontend/testes/e2e/` |
| `node local/frontend/node_modules/@playwright/test/cli.js test --config auditoria.config.mjs`, tags/telas da seção4.5 | **14 rotinas diagnósticas executadas**, sem falha do harness; scans produziram achados/inconclusivos, não aprovação irrestrita | E `auditoria-a11y.log`, JSON individuais |
| Mesmo comando com `--grep 'Revisão CSP\|Revisão reflow\|Revisão contraste'` | **3 rotinas complementares executadas**, CSP/reflow/contraste; problemas documentados, não “três critérios acessíveis aprovados” | E `verificacoes-complementares.log`, `csp-vlibras.json`, `reflow-foco.json`, `contraste-amostral.json` |
| Reexecução com `--grep 'Revisão WCAG administração'`, incluindo390 px | **Executada**, completou19 estados axe no total | E `admin-mobile-confirmacao.log`, `admin-catalogo-mobile.json` |
| Reexecução final com `--grep 'Revisão reflow'` | **Executada**, confirmou Tab no carrossel e retorno de foco do menu | E `reflow-corrigido.log`, `reflow-foco.json` |
| Inspeção das capturas desktop, mobile320/390, claro/escuro, loja, filtros, login, montador e admin | **Realizada na amostra**; F01–F05 documentados; dados do PG de teste | E `screenshots/` |
| Typecheck/backend unitários/integração completa/audits nesta atualização | **Não repetidos**: backend/manifests/lockfiles idênticos aos já verificados na primeira fase | Resultados anteriores mantidos na seção6.1; E2E atual usa PG real |
| Preservação dos507 arquivos além do relatório; `git diff --check`; whitespace do relatório não rastreado | **Passou**; única edição deste turno é o relatório | E `preservacao-final.json`; seção8 |

Não houve caso ignorado na suíte31. Os erros SQL deliberados42703/42P01 de testes de indisponibilidade fazem parte
dos cenários e não são falhas espontâneas do ambiente. Duas tentativas auxiliares de aperfeiçoar a sonda de foco
falharam por seletor excessivamente exato: o botão inclui o nome do peixe no nome acessível. O seletor foi corrigido
**só no teste temporário**, e a execução final confirmou o comportamento em F04; não atribuí esses timeouts ao produto.

Capturas úteis: [home desktop clara](</tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/evidencias/screenshots/home-desktop-claro-viewport.png>),
[home desktop escura](</tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/evidencias/screenshots/home-desktop-escuro-viewport.png>),
[menu cortado em320](</tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/evidencias/screenshots/home-mobile-320-viewport.png>),
[filtros mobile](</tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/evidencias/screenshots/filtros-mobile-viewport.png>),
[aviso admin](</tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/evidencias/screenshots/admin-catalogo-viewport.png>).
São artefatos temporários desta máquina e não acompanham o relatório no Git.

## 7. Próximos ciclos do Backend 1


### 7.1 Prioridade imediata: frontend apresentável hoje

Esta fila responde à urgência atual e precede os próximos incrementos funcionais do B1. **É proposta de trabalho,
não implementação feita ou autorização para alterar os outros módulos nesta revisão.**

| Ordem | Tarefa pequena / responsáveis | Dependências e aceite objetivo |
|---|---|---|
| **1** | **Corrigir F01 e rever F04:** frontend, apoio de B1 para cenários. Ajuste localizado em SiteNav/Logo/Vitrine. | Nenhuma mudança de API. Header inteiro em320/360/390 e desktop, sem perder nome/área útil; Tab/Shift+Tab deixam controles focados legíveis; Escape devolve foco; temas e zoom conferidos;31 E2E continuam passando. Primeiro pedido concreto recomendado ao Codex. |
| **2** | **Definir o que será apresentado:** loja/equipe/frontend+B2. Catálogo real pode ser demonstrado; conta/pedidos atuais são protótipo. Corrigir F03 com B1. | Avisos/textos não devem prometer compra real, cartão, gateway hospedado ou ausência de API de estoque. Se a apresentação exigir fluxo real, integração B2 e S01 tornam-se bloqueadores, não mera troca de texto. |
| **3** | **VLibras/CSP, se obrigatório hoje:** frontend+infra/segurança. | F02 reproduzido. Revisar dependências/origens/privacidade e testar build pelo servidor real; manter CSP restritiva. Se não homologado, registrar que o recurso não está disponível; não anunciar acessibilidade completa. |
| **4** | **Zerar os quatro erros de lint**, revisando correções já existentes em B2; frontend/B2. | Escopo localizado, sem incorporar checkout/logística inteiro por atalho. Lint termina0; testes100 e E2E31 continuam aprovados. Atualizações de dependências ficam na integração controlada do lock, não em audit fix geral. |
| **5** | **Conferir ambiente da apresentação**, equipe/infra com B1. | API/PG acessíveis, migrações já aprovadas aplicadas por responsável, peixes ativos+ficha+saldo positivo quando esse conteúdo for esperado; imagens reais/placeholder corretos; CORS/sessão/HTTPS coerentes. Sem publicar dados fictícios silenciosamente ou forjar estoque fora do ledger. Banco/configuração reais não foram inspecionados nesta revisão. |
| **6** | **Aceite rápido acessível após os ajustes**, frontend/equipe. | Repetir31 E2E e inspeção320/390/desktop claro/escuro; teclado/skip/foco, estado vazio/erro/retry, leitura dos preços e navegação até detalhe; completar contraste inconclusivo, zoom e leitor de tela no escopo escolhido. Sem declarar WCAG AA até cobrir todos os critérios aplicáveis. |

**Pedido concreto sugerido:** “Corrija somente o reflow do cabeçalho em320 px e a exposição do item focado por
teclado na vitrine, preservando a identidade, alvos e contratos; adicione regressão de navegador, verifique320/360/390
e desktop, Tab/Shift+Tab/Escape, temas, testes/lint/build. Não altere checkout, permissões ou estoque.”

O aumento de bundle deve ser medido depois; não há evidência de que uma reorganização ampla do frontend seja
necessária para resolver os defeitos demonstrados. A integração financeira segura continua prioritária antes de
qualquer operação comercial, mesmo se a apresentação visual já estiver aprovada.

### 7.2 Ordem dos ciclos funcionais, após os ajustes da apresentação


| Etapa / motivo | Escopo e arquivos prováveis | Dependências | Critério objetivo de aceite |
|---|---|---|---|
| **0. Integração/homologação conjunta, antes de venda real** | Revisar B2 existente, resolver os 3 conflitos, contratos202/unidade/frete, preservando frontend M e catálogo/ledger. Envolve rotas compartilhadas, api.md, frontend services/checkout, schemas34/35. B1 revisa estoque e produto.logistica, não reimplementa auth/gateway. | B2+frontend+infra; contrato financeiro/comercial e janela de migração autorizada | Ref aprovada integrada; instalação limpa do lock; lint/typecheck/build, suítes de ambos e31 E2E+checkout real com PG/fornecedores fictícios; S01 rejeita pendente/parcial/manual sem prova; zero segunda baixa/crédito; nenhuma migração em base real durante desenvolvimento. |
| **1. Próximo incremento funcional B1: fichas públicas opcionais na listagem** | Definir opção como `incluir_ficha=true` ou consulta equivalente, com mapeamento público das11 fichas e null explícito. `produto.types/controller/repository`, projeções/fichas, parâmetros, api.md e testes. Preservar resposta padrão sem opção. | Acordo curto de DTO com frontend; não depende de novo checkout/schema | HTTP/PG para11 tipos/sem ficha/inativo/valores inválidos; IDs/centavos/envelope/total/ordem preservados; número de queries limitado por página, sem N+1; nenhum saldo/custo logístico interno exposto. |
| **2. Completar consumo do montador** | Frontend `services/montagem.js`, estados de carga parcial e testes, consumindo o incremento 1 e todas as páginas relevantes; B1 fornece fixtures/contrato. | Frontend + contrato 1; regras da loja continuam separadas | Catálogo com 101+ itens por grupo sem perda; falha de ficha visível e sem alegar compatibilidade; retry funciona; desativação/alteração de preço revalidada; E2E real sem mock de catálogo. |
| **3. Gestão visual de imagem/estoque, se entrar no escopo do site** | Frontend adapta APIs já prontas; B1 documenta erros, idempotência, limites e entrega homologação. Não criar outro saldo/CRUD nem enviar estoque via PATCH produto. | Decisão frontend/equipe sobre tela e autoria; autenticação real integrada | Admin faz upload/placeholder e movimento com histórico; cliente/visitante401/403; replay não duplica; operações aparecem nas leituras; origem/cache/permissão preservados. |
| **4. Operação de estoque/imagens** | Plano e teste de restauração coordenada DB+arquivos; migrações incrementais e agendamento/monitoramento da limpeza e expiração; testes operacionais de infra. | Infra+B1+B2, autorização da loja; não executar reparo implícito | Restore prova referências/imagens/ledger; limpeza não apaga arquivo referenciado; backlog e erros observáveis; reconciliação disponível=soma(delta) em fixtures/ambiente autorizado; worker efetivamente rodando comprovado. |
| **5. Regras técnicas do montador aprovadas** | Levantar lacunas de ficha/compatibilidade e só então propor schema/regras versionadas; `lib/compatibilidade.js` atual não é decisão comercial aprovada. | Loja+frontend+B1; B2 apenas se houver bloqueio comercial no checkout | Regras/unidades/fontes documentadas e aprovadas; campos desconhecidos tratados explicitamente; casos-limite reais; nenhuma garantia baseada em dados ausentes ou em quantidades do navegador. |

**B1 pode iniciar sozinho:** desenhar/mensurar a consulta de ficha opcional, preparar fixtures PostgreSQL e propor
DTO/testes, revisar os efeitos de produto.logistica e atualizar documentação do seu domínio em tarefa posterior.
Publicar contrato novo, integrar B2, alterar política financeira/TTL, tarifas, implantar workers ou migrar dados reais
exige coordenação. Não atribuir ao B1 a entrega integral de vendas, pagamentos, autenticação ou frontend.

**Retirar da fila como “ainda não implementado”:** GET categorias/produtos/peixes e detalhes; filtros técnicos;
POST/PATCH produtos/fichas; desativação/reativação e leitura de inativos; proteção de slug estrutural; imagem principal;
movimentos/saldos/histórico de estoque; buscarParaVenda e baixa/devolução integradas; expiração backend; proteção de
GET orçamentos; correção transacional do estorno de 167b7d4. Há limitações/integrações de UI, não ausência desses módulos.
Também não reescrever checkout real, reconciliação, proteção de credenciais ou embalagem/frete: já existem em B2,
faltando integração/homologação conjunta.

**Perguntas ainda necessárias:** quem revisa/assume o cadastro logístico dentro de catálogo; qual contrato de ficha
opcional e de dados ausentes; quais tarifas/regras aprovadas pela loja; qual política final de pagamento após prazo
ou falha do gateway; topologia/monitoramento e responsável pelos jobs; homologação de gateway/e-mail/CSP/VLibras;
quais regras do montador poderão ser apresentadas como aprovadas. Não há informação suficiente para declarar
operação comercial segura ou ambiente publicado homologado.

## 8. Estado final do Git

Única edição autorizada nesta atualização: **o relatório preexistente
`backend/docs/revisao-estado-atual-2026-11-19.md`**, que continua não rastreado e sem staging.
Branch/HEAD permaneceram `branch-backend@e7a15897d168cbc5d86244e2d949e91965269cea`, igual a origin/main,
dez commits adiante de origin/branch-backend. Nenhum unmerged; índice preservado. Os **507 outros arquivos** do
manifesto inicial desta atualização foram conferidos por SHA-256, sem mudança. Fetch apenas atualizou referências.
O pull L→P foi executado pelo usuário antes desta atualização; não pelo agente. Nenhum merge, rebase, reset,
commit, push, deploy ou alteração de frontend/backend foi feito nesta rodada.

```text
## branch-backend...origin/branch-backend [ahead 10]
?? backend/docs/revisao-estado-atual-2026-11-19.md
```

Verificações da primeira fase estão em `/tmp/aquarilandia-revisao-20261119-o48d56vq/`; navegador, capturas,
instrumentação e evidências pós-pull em `/tmp/aquarilandia-front-pos-pull-20261119-3f_qj476/`. Essas pastas são
temporárias, não armazenamento permanente. Chromium, bibliotecas extraídas e axe só existem nessa área de testes;
nenhum pacote/dependência/lockfile do projeto foi alterado. Ambos os PostgreSQL descartáveis foram removidos ao
fim de suas fases. Nenhum .env, dado do banco do projeto ou conta real foi consultado/reparado.

O relatório omite credenciais, tokens, cookies e dados pessoais. As evidências usam fixtures fictícias.
O resultado é uma revisão defensiva e de usabilidade com limites explícitos; não certificação de segurança,
conformidade integral de acessibilidade ou homologação de operação comercial.
