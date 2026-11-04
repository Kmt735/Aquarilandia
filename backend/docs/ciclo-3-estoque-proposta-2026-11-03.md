# Ciclo 3 — proposta do contrato de estoque

**Data:** 03/11/2026. **Situação: proposta para aprovação conjunta; não altera decisões vigentes.**

Backend 1 significa catálogo/estoque, chamado de “Dev 2” em documentos antigos. Backend 2 significa clientes/vendas/pagamentos, atribuído a Celio nesses documentos. Hoje são módulos do mesmo Express e do mesmo PostgreSQL, não dois serviços HTTP independentes.

**Recomendação:** retirar do saldo disponível na criação da venda, na mesma transação de venda/itens/alocação/histórico. Manter alocação explícita com validade de 30 minutos. Pagamento aceito confirma essa alocação, sem segundo débito. Cancelamento não pago/expiração libera uma vez; cancelamento pago devolve unidades comercializáveis depois da confirmação do estorno financeiro. Carrinho não reserva. Esta recomendação se apoia nas decisões e no código combinado, não somente no PDF.

## 1. Estado comprovado e base examinada

### Git e integração

| Referência | Estado observado |
|---|---|
| Worktree real | `/home/mateus/Projetos/Aquarilandia`; a pasta duplicada informada pelo ambiente não existe. Nenhum AGENTS.md aplicável foi encontrado. |
| Branch local / HEAD | `branch-backend`, `afa0d352fe078afe7a78baca43d2029d59d008b2`; árvore inicialmente limpa. Último pull foi fast-forward de `origin/main`. |
| Remoto `main` | `afa0d35`, igual ao HEAD examinado. A branch local chamada `main` está antiga e não foi usada como base da análise. |
| Remoto `branch-backend` | `856e733`, ancestral do HEAD; branch local já estava 27 commits adiante antes desta análise. |
| Ciclo 2 | Commit `ad21af5` é ancestral do HEAD. A referência da worktree `/tmp/aquarilandia-ciclo-2-20261031` está marcada como prunable e a pasta não existe; não havia trabalho não commitado nessa pasta para integrar. O relatório histórico do Ciclo 2 descreve seu estado de 31/10, não o estado atual. |
| Remoto `branch-backend-2` | Na primeira leitura era `41e8fbd`, já integrado. Após a interrupção avançou a `821e8c5d059738614e3ae6338bba950a189e3150`: contém o HEAD examinado e acrescenta sete commits. Foi atualizado somente o remote-tracking ref com fetch. |

Os sete commits novos do Backend 2 implementam recuperação de senha, exigência de senha atual para mudar e-mail e documentação/testes relacionados. Alteram auth/clientes, `middlewares/rateLimit.ts`, `backend/api.md`, `backend/docs/decisoes.md` e exemplos HTTP. Não criam estoque nem rotas funcionais de vendas. A relação ancestral foi confirmada com `git rev-list --left-right --count HEAD...origin/branch-backend-2`, resultado `0 7`: nesse snapshot, uma integração seria fast-forward, sem resolução textual de merge. Isso não comprova compatibilidade funcional de implementações futuras. Não houve merge, rebase, reset, commit ou push.

**Sobreposição que exige coordenação:** a próxima implementação deve partir de referências atualizadas e combinar mudanças em `types/index.ts`, `utils/transacao.ts`, schemas, rotas agregadoras, `api.md` e `decisoes.md`. Não refazer auth, recuperação de senha, gateway ou transições do outro integrante. O número D-47 já está ocupado no remoto: esta proposta não reserva número de decisão.

### Evidências no código e no schema

Os caminhos/linhas abaixo são da base local `afa0d35`, salvo indicação explícita do remoto.

| Fato observado | Evidência |
|---|---|
| Produto tem categoria, preço inteiro não negativo, estoque inteiro não negativo e ativo. Categoria tem nome/slug únicos. Onze fichas especializadas usam o ID do produto. | [`01_catalogo.sql`](../db/init/01_catalogo.sql), linhas 18–39 e 46 em diante. |
| POST fixa estoque inicial zero; PATCH aceita somente nome, descrição, marca, preço e ficha. | [`produto.repository.ts`](../src/modulos/catalogo/produto.repository.ts), linhas 49–54; [`produto.validacao.ts`](../src/modulos/catalogo/produto.validacao.ts), 58–60; [`produto.atualizacao.ts`](../src/modulos/catalogo/produto.atualizacao.ts), 10–30. |
| DELETE muda apenas ativo/timestamp; reativação também preserva unidades. Edição/reativação usam lock de produto. | [`produto.repository.ts`](../src/modulos/catalogo/produto.repository.ts), 14–26 e 63–71; [`produto.service.ts`](../src/modulos/catalogo/produto.service.ts), 31–46. |
| A disponibilidade pública é `estoque > 0`, sem divulgar quantidade. Peixes exigem ativo, slug peixes e ficha; o filtro de disponíveis é aplicado antes da paginação. | [`produto.projecoes.ts`](../src/modulos/catalogo/produto.projecoes.ts), 2–4; [`peixe.repository.ts`](../src/modulos/catalogo/peixe.repository.ts), 9–35. |
| Não existe módulo de estoque, tabela de movimentações ou alocações nos arquivos de schema. A busca de escritas em estoque encontrou apenas o INSERT de produto com zero no código de produção. Há escritas diretas em fixtures/testes SQL, que não são fluxo de vendas. | `backend/src/modulos/`, `backend/db/init/`; `produto.repository.ts:51`; `backend/db/testes/verificar_clientes_vendas.sql:53`. |
| Vendas possuem cliente, snapshots de entrega, totais inteiros, status e expira_em de 30 minutos. Itens têm quantidade positiva, snapshot de preço/nome, subtotal conferido e UNIQUE(venda_id,produto_id). | [`20_vendas.sql`](../db/init/20_vendas.sql), 48–105 e 112–126. |
| Histórico é de status de venda, não de estoque. Há autoria obrigatória para cliente/admin. DOMAIN valida valores de status; não valida sozinho o grafo de transições. | `20_vendas.sql:33–35` e `137–148`; [`venda.transicoes.ts`](../src/modulos/vendas/venda.transicoes.ts), 23–56. |
| O repository muda status com WHERE no estado anterior e insere histórico na mesma conexão. Não chama a função de autorização de transições. | [`venda.repository.ts`](../src/modulos/vendas/venda.repository.ts), 46–69. O futuro service deverá validar transição, ator, dono e regras de entrega. |
| Existem router e controller de vendas, mas estão vazios. Service contém contagens/resumos; não há criar/cancelar/pagar venda por HTTP. | [`venda.routes.ts`](../src/modulos/vendas/venda.routes.ts), 1–3; [`venda.controller.ts`](../src/modulos/vendas/venda.controller.ts), 1; [`venda.service.ts`](../src/modulos/vendas/venda.service.ts), 25–41; [`routes/index.ts`](../src/routes/index.ts), 25–27. |
| Pagamentos exigem gateway_cobranca_id NOT NULL, sem UNIQUE nesse campo; gateway_pagamento_id é único. Há tentativas de estorno, mas não estorno_solicitado_em. | `20_vendas.sql:164–182`. Não há persistência/orquestração de pagamentos implementada. |
| eventos_webhook tem ID externo único, JSONB, processado_em e tentativas; ainda não é usada pelo handler. | `20_vendas.sql:196–208`; [`pagamento.controller.ts`](../src/modulos/pagamentos/pagamento.controller.ts), 17–25. |
| Adaptador Pix real existe: recebe valor/IDs internos, timeout, criação, consulta e reembolso. Ainda não é chamado por rota de pagamento da venda. | [`gateway.ts`](../src/modulos/pagamentos/gateway.ts), 175–224, 231–250 e 262–293; `venda.routes.ts:3`. |

**Implementado não significa fluxo concluído:** a tabela de status permite aguardando_pagamento, paga, em_separacao, enviada, pronta_retirada, entregue, cancelamento_solicitado e cancelada. O grafo existe como função pura e o repository tem proteção concorrente, mas falta o service que os conectará às rotas, ao estoque e aos pagamentos.

### Divergências de contrato efetivamente encontradas

O PDF disponível, página 4, determina baixa na confirmação do pagamento, usa `/me/pedidos`, `produto_id`, status como `pago` e webhook do Mercado Pago. A documentação local usa `/api/vendas`, camelCase, `paga` e AbacatePay/Pix transparente. D-15/D-16/D-26 e `20_vendas.sql:10–11` preveem baixa na criação; D-21 diz que o webhook confirma pagamento sem mexer em estoque. Nada disso demonstra que a baixa já exista.

Há ainda divergência local entre `api.md:1313–1318`, que cita chave de idempotência de estorno no gateway, e D-22/gateway.ts, que não a usam. **Essa divergência já foi corrigida no remoto `branch-backend-2@821e8c5`, em api.md, seção 8**, e aguarda integração na main; não propor outra correção concorrente. O que continuará necessário é idempotência interna do negócio.

## 2. Fluxo atual de compra: real, simulado e ausente

| Etapa | Comportamento atual e limite | Evidência |
|---|---|---|
| Catálogo público | PostgreSQL, IDs numéricos, centavos, emEstoque. O último pull acrescentou modo demonstrativo explícito, desligado por padrão, que troca a consulta por mock. | [`catalogo.js`](../../frontend/src/services/catalogo.js), 33–88; [`ambiente.js`](../../frontend/src/config/ambiente.js), 1–7. |
| Adicionar/conferir carrinho | Persiste somente `{versao:2,itens:[{id,qtd}]}`; consulta detalhe público, atualiza preços, remove 404/esgotados e bloqueia continuação com falha temporária. Confere ao abrir/voltar à aba. | [`carrinho.js`](../../frontend/src/services/carrinho.js), 42–73; [`CartProvider.jsx`](../../frontend/src/context/CartProvider.jsx), 43–86 e 119–131. |
| Quantidade | Teto visual de 99; emEstoque comprova apenas que existe alguma unidade, não que a quantidade pedida caiba. Alterar quantidade não reserva nem debita. | `carrinho.js:3`; `CartProvider.jsx:102–104`; [`catalogo-mapeamento.js`](../../frontend/src/services/catalogo-mapeamento.js), 46–51. |
| Monte seu Aquário | Usa catálogo público ou modo demo e adiciona várias intenções ao mesmo carrinho. Quantidade real geralmente desconhecida; completar ficha pode falhar e manter o item sem ficha. Cada grupo carrega somente até 100 itens nesta implementação. | [`montagem.js`](../../frontend/src/services/montagem.js), 9–28; `CartProvider.jsx:89–99`; `carrinho.js:85–104`. Não é reserva/garantia de compatibilidade no servidor. |
| Login/endereço/frete no site | Auth/conta do frontend e cotação de frete continuam simuladas em services próprios. Login visual não cria cookie sid real. Backend tem auth real e cálculo puro de frete, mas router de frete está vazio. | [`conta.js`](../../frontend/src/services/conta.js), 1–22; [`AuthProvider.jsx`](../../frontend/src/context/AuthProvider.jsx), 5–17; [`frete.js`](../../frontend/src/services/frete.js), 1–35; [`frete.service.ts`](../src/modulos/vendas/frete.service.ts), 34–65; `frete.routes.ts:3`. |
| Iniciar checkout | Carrinho/revisão desabilita avanço durante conferência; etapas seguintes usam usuário/rascunho do protótipo. Essa proteção de UI não substitui autorização ou validação futura no servidor. | [`EtapaCarrinhoPage.jsx`](../../frontend/src/pages/checkout/EtapaCarrinhoPage.jsx), 16 e 42–44; [`EtapaEntregaPage.jsx`](../../frontend/src/pages/checkout/EtapaEntregaPage.jsx), 70–78. |
| Criar/pagar | criarPedido fabrica EX-xxxx e grava sessionStorage; devolve URL de sucesso local. Não há POST real de venda ou cobrança. O frontend ainda descreve página hospedada/cartão, incompatível com a decisão nova de Pix transparente. | [`pedidos.js`](../../frontend/src/services/pedidos.js), 23–38; [`EtapaPagamentoPage.jsx`](../../frontend/src/pages/checkout/EtapaPagamentoPage.jsx), 28–36; D-18. |
| Confirmar/cancelar | A segunda consulta simulada marca paga. Cancelamento só muda o objeto local; retorno pode limpar carrinho após essa confirmação simulada. | `pedidos.js:43–69`; [`RetornoPagamentoPage.jsx`](../../frontend/src/pages/checkout/RetornoPagamentoPage.jsx), 47–59. |
| Webhook/backend | Valida segredo e HMAC sobre corpo cru. Para evento válido retorna 200, sem persistir evento, reconsultar gateway ou mudar venda. Isso é um incremento preparatório, não confirmação de pagamento funcional. | [`webhook.ts`](../src/modulos/pagamentos/webhook.ts), 21–45; `pagamento.controller.ts:8–25`; teste real [`webhook.test.mjs`](../testes/integracao/webhook.test.mjs), 81–94. |

### Peixes em destaque: resultado da revisão anterior

A correção `856e733` está integrada, com D-46, consulta independente de categorias, `em_estoque=true`, limite 3, texto neutro de erro e nove E2E específicos em [`vitrine.spec.mjs`](../../frontend/testes/e2e/vitrine.spec.mjs). O relato anterior da conversa registra os testes executados em 02/11. Seus artefatos temporários não estão mais disponíveis após a reinicialização do ambiente.

Nesta rodada, foram reexecutados unitários e integração de catálogo, sem repetir o navegador. O modo de demonstração do último pull deve permanecer desligado na homologação real; há selo explícito em `MainLayout.jsx:63`, mas o flag não tem bloqueio automático por NODE_ENV. Não afirmar que a revisão não ocorreu ou que o montador novo já foi homologado por aqueles E2E antigos. Catálogo sem ativo+ficha+saldo positivo continua legitimamente vazio.

## 3. Regra proposta, matriz de eventos e invariantes

### Significado único dos números

**D = produtos.estoque = unidades livres para novas vendas.** Não é contagem física total da loja. Reservas já foram descontadas de D; não subtrair novamente uma coluna de reserva ao calcular disponibilidade. `emEstoque = D > 0` e as projeções/filtros públicos permanecem compatíveis.

Cada item de venda terá alocação `reservada → confirmada` ou `reservada → liberada`; uma confirmada poderá tornar-se `devolvida` por cancelamento elegível. A criação faz o único débito. A confirmação muda estado, não unidades. Quantidades de itens ficam imutáveis após a criação. Reserva vale até vendas.expira_em, sem renovação por retry ou nova tentativa Pix.

Somente unidades comercializáveis podem voltar ao disponível. Cancelamento/estorno financeiro não prova devolução física. Primeiro incremento de venda deverá tratar cancelamento integral antes do envio/retirada; devoluções pós-entrega e parciais exigirão fluxo próprio aprovado.

Na matriz, B1 executa a operação de estoque; B2 decide/orquestra eventos de venda/pagamento. q é a quantidade persistida e validada no servidor. Todos os efeitos compostos descritos são da mesma transação, salvo chamadas ao gateway explicitamente externas.

| Evento | Responsável | Pré-condições | Saldo / alocação | Histórico, resultado e compensação |
|---|---|---|---|---|
| Entrada administrativa | B1, admin | Sessão/papel atual/Origin; produto existe; q inteiro positivo e motivo | D+q; pode estar inativo | Movimento entrada com antes/depois, ator e chave; não reativa. Correção futura é movimento inverso, nunca apagar histórico. |
| Ajuste positivo | B1, admin | Mesmas guardas; justificativa de correção | D+q | Tipo ajuste_positivo; impedir overflow INTEGER. |
| Ajuste negativo / saída administrativa | B1, admin | D>=q; causa/motivo; não atingir unidades alocadas | D-q | ajuste_negativo/saida; 409 se insuficiente, sem escrita parcial. Perda de unidade já alocada exige incidente coordenado com B2. |
| Adicionar/editar/remover carrinho | Frontend | ID/quantidade válidos na UI | Nenhuma reserva ou alteração | Reconsulta ajuda UX; servidor continuará refazendo toda a validação. |
| Criar venda + reservar | B2 chama B1 | Cliente ativo autenticado, Origin, idempotência; todos ativos, preço/entrega válidos, D>=q | D-q; alocação reservada por item, TTL 30 min | Venda+itens+movimentos+alocações+resultado idempotente confirmam juntos. Falha em qualquer item desfaz tudo. |
| Criar cobrança / cobrança pendente | B2 | Venda do dono, aguardando, não expirada; total do banco; prazo Pix respeita a venda | Sem novo débito; mantém reservada | Registra tentativa/cobrança. Timeout de criação é estado indeterminado, não pagamento recusado. |
| Tentativa de pagamento recusada/falha definitiva | B2 | Resultado reconsultado, vinculado à cobrança local | Não debita nem libera sozinho; pode tentar outra até TTL | Atualiza pagamento; cancelamento definitivo da venda ou TTL chama liberação. Falha de rede não deve ser traduzida em recusa. |
| Pagamento aprovado aceito | B2 chama confirmação B1 | Cobrança/valor/método/ambiente conferidos; venda aguardando; prazo válido sob lock; alocação reservada | D não muda; alocação confirmada | Pagamento, status paga, histórico e confirmação atômicos. Nenhuma segunda baixa. |
| Cancelar antes de pagar | B2, dono/admin | Venda aguardando; transição permitida | D+q uma vez; liberada | Cancelada + movimento compensatório na mesma transação. Cobrança paga tardiamente será reembolsada, sem reabrir alocação. |
| Expirar reserva | Worker B2 chama B1 | Aguardando e relógio do banco >= expira_em, rechecados sob lock | D+q uma vez; liberada | Cancela por sistema e registra liberação. Concorrência entre workers/cancelamento usa a mesma proteção de negócio. |
| Solicitar cancelamento pago | B2, dono/admin | paga/em_separacao/pronta_retirada; ainda não enviado/retirado | D não muda; confirmada permanece | Vai a cancelamento_solicitado, bloqueia despacho; marca estorno pendente e confirma transação antes de HTTP ao gateway. |
| Estorno pago concluído | B2 chama B1 | Reembolso do pagamento efetivo confirmado; cancelamento elegível; unidades comercializáveis ainda sob controle da loja | D+q uma vez; devolvida | Finaliza cancelada + devolução + resultado financeiro na mesma transação. Repetição não credita novamente. |
| Estorno falha / resposta se perde | B2 | Tentativa vinculada ao pagamento, não ao último evento recebido | Sem devolução antecipada | Mantém cancelamento_solicitado; reconcilia e tenta até limite existente de 5, depois resolução admin com evidência. Timeout não autoriza presumir sucesso/falha. |
| Pagamento após cancelamento/expiração | B2 | Reconsulta comprova dinheiro recebido, mas venda não aceita mais pagamento | Não reabre, não redebita, não devolve de novo | Reembolso integral desse pagamento. Venda cancelada permanece final; estado/tentativas do reembolso ficam no pagamento, não numa transição proibida de venda. |
| Segunda cobrança paga da mesma venda | B2 | Outro pagamento já foi aplicado | Nenhuma nova alteração | Registra verdade financeira e reembolsa excedente. O reembolso da cobrança excedente não cancela a venda válida nem chama devolução de estoque. |
| Reembolso espontâneo / devolução depois do envio | B2 + administração; B1 só após autorização física | Reconsulta financeira; localizar pagamento efetivo; não usar cancelamento comum após envio | Nenhum crédito automático por webhook | Reconciliar/bloquear atendimento quando aplicável. Devolução física exige inspeção e referência ao débito; produto morto/danificado não vira disponível. Fluxo de retorno fica fora do primeiro incremento. |
| Desativar no carrinho / antes da criação | B1 + frontend | Não há venda/reserva consolidada | D preservado | API pública 404/remove; nova venda 409 por item indisponível. Não confundir D positivo com produto comprável. |
| Desativar durante venda válida | B1; B2 mantém compromisso | Reserva já consolidada | Sem liberação/cancelamento automático | Pagamento/compensação dessa venda não exigem ativo novamente. Se motivo for segurança/perda física, acionar incidente/cancelamento explícito; não apenas alterar ativo. |
| Reativar | B1, admin | Guardas atuais | D/alocações preservados | Não recria reservas nem reinsere automaticamente item removido do carrinho; compra nova passa por validação completa. |
| Duas vendas pelo último saldo | B2+B1 | Locks ordenados + UPDATE condicional | Só uma debita; outra recebe 409 | Perdedor não deixa venda/itens/movimentos residuais. CHECK >=0 é defesa adicional, não solução isolada. |
| Repetir requisição ou evento | Dono de cada fluxo | Chave e hash iguais, autorização atual; ou mesmo efeito de negócio já aplicado | Nenhuma aplicação extra | Mesmo resultado/recurso para retry HTTP; mesmo evento não reaplica; eventos distintos da mesma cobrança também não duplicam efeitos. Hash diferente para mesma chave: 409. |

**Expiração proposta:** TTL lógico rígido de 30 minutos, sem renovar. Decidir aceitação sob lock da venda, usando o relógio real do banco após a espera. Em igualdade com expira_em, está vencida. Pagamento cuja confirmação só possa ser aplicada após esse limite segue o caminho de reembolso, mesmo que haja atraso de webhook; esse custo de experiência precisa de aprovação do B2. Se a equipe preferir tolerância, deverá definir duração e impedir liberação durante essa tolerância — não adotar exceção implícita.

Worker de expiração com execução periódica, por exemplo a cada minuto, reprocessável e monitorado. Atraso do worker mantém unidades indisponíveis conservadoramente; não permite pagar venda vencida nem cria estoque. Não expirar vendas por dentro de uma operação que já segurou locks dos produtos, pois isso inverteria a ordem de locks.

### Invariantes de aceite

1. D nunca fica negativo ou acima de 2147483647; quantidade é positiva e inteira. Totais/subtotais são centavos inteiros e precisam caber nas colunas atuais, com cálculo intermediário seguro.
2. Toda mudança de D gera movimento imutável com produto, causa, operação, antes/depois, data e autoria. Reconciliar D com a soma dos deltas, incluindo abertura de legado.
3. Cada item de venda tem no máximo uma alocação; sua quantidade coincide com o item persistido. Confirmar pagamento não altera D.
4. Cada débito recebe no máximo uma compensação integral no escopo inicial. Chaves diferentes não podem contornar o estado da alocação ou creditar mais do que foi debitado.
5. Venda/itens/débito/alocação/histórico confirmam ou desfazem juntos. O mesmo vale para cancelamento/liberação e conclusão de estorno/devolução.
6. Duas vendas não comprometem a mesma unidade. Desativação, alteração de preço e reserva são serializadas sobre o produto.
7. Preço é lido sob lock ao criar e congelado no item. Cobrança usa total persistido da venda; não reprificar a venda já reservada nem confiar em preço/total/ativo vindos do navegador.
8. Uma única cobrança pode ser aplicada ao cumprimento de uma venda; dinheiro de outra cobrança é conciliado separadamente. Reembolsar pagamento excedente/tardio não causa devolução duplicada de unidades.
9. Compensação e atendimento de venda existente funcionam para produto inativo; criação nova exige ativo. Toda autorização vem do backend.
10. Nenhuma chamada externa acontece enquanto os locks de negócio estão abertos. Falha/timeout externo tem reconciliação e retry idempotente, nunca rollback fictício de dinheiro já movimentado.

## 4. Comparação das alternativas

| Alternativa | Benefício | Consequência e custo real |
|---|---|---|
| Baixar só no pagamento, sem reserva | Menos tabelas iniciais | Várias cobranças podem disputar a última unidade; uma compra pode pagar e não receber. Exige refund após cobrança bem-sucedida. Não recomendada. |
| Reservar na criação e baixar estoque físico no pagamento | Separa físico, reservado e disponível | Exige schema e regras para saldo físico/reservado, expiração, consumo e disponibilidade = físico-reservado. Alteraria projeções/filtros atuais e D-16/D-21. É válida, mas maior mudança conjunta. |
| Debitar disponível na criação, com alocação explícita | Mantém emEstoque/projeções e decisões locais; impede prometer a mesma unidade | Exige histórico, estados da alocação, worker de expiração e compensação. Pagamento apenas confirma o compromisso; não debita de novo. **Recomendada para a base atual.** |

O schema atual fornece saldo e vencimento da venda, mas não rastreia qual débito ocorreu, qual foi liberado, nem idempotência de movimentos. Portanto, não representa sozinho uma reserva segura. Não basta renomear estoque ou acrescentar um booleano reservado.

A opção recomendada mantém a intenção de D-15/D-16/D-26, da seção 8 e do schema de vendas; formaliza o ciclo de vida faltante. O PDF e as decisões novas deverão ser harmonizados depois da aprovação, sem apresentar a divergência como resolvida nesta rodada.

## 5. Contratos propostos entre os responsáveis

### B1 fornece; B2 orquestra

Continuar como serviços internos com o mesmo PoolClient. Não criar chamada HTTP entre os dois módulos para tentar compartilhar uma transação. Se virarem processos/bancos separados, esta proposta precisará ser substituída por protocolo distribuído e compensações próprias.

Interfaces abaixo são **propostas, ainda inexistentes**, mantendo os nomes já documentados quando possível. Tipos comuns ficam em `backend/src/types/index.ts`; contexto nunca vem livremente do cliente.

| Interface | Contrato proposto |
|---|---|
| produtoService.buscarParaVenda(ids, tx) | IDs únicos/ordenados; lê nome, preço, ativo e categoria com lock de produtos. Mesmo executor obrigatório da criação. Service de vendas resolve indisponíveis sem revelar catálogo administrativo. |
| estoqueService.registrarMovimentacao(dados, contextoAdmin, tx) | Apenas tipos administrativos permitidos; valida quantidade/motivo, limite/negatividade e idempotência; saldo+histórico juntos. |
| estoqueService.baixarParaVenda(vendaId, itens, contexto, tx) | Débito condicional de disponível e alocações reservadas; todos os itens ou nenhum; chave lógica determinada pelo servidor. |
| estoqueService.confirmarVenda(vendaId, referenciaPagamento, tx) | Confirma alocações reservadas sem novo débito. B2 já validou estado/prazo/cobrança e segura o lock da venda. |
| estoqueService.estornarVenda(vendaId, contexto, tx) | Lê quantidades das próprias alocações; libera/devolve elegíveis uma vez. Não recebe do navegador a quantidade a restituir. Não consulta repository de vendas. |

B2 fornece venda/itens, estado, autoria e referências financeiras validados; chama os services B1 no mesmo client. B1 não aprova pagamento, não muda status de venda por SQL e não decide refund. B2 não altera produtos.estoque ou tabelas de movimento diretamente. Estoque não muda preço.

### Escrita administrativa proposta

`POST /api/estoque/movimentacoes`, sessão + admin atual + Origin. Exemplo de body:

```json
{"produtoId":42,"tipo":"entrada","quantidade":10,"motivo":"Reposição conferida"}
```

Tipos iniciais: entrada, ajuste_positivo, ajuste_negativo, saida. Quantidade sempre positiva; tipo determina o sinal. Rejeitar desconhecidos e campos protegidos, inclusive estoque absoluto, vendaId, atorId, origem, saldoAtual, preco e tipos internos de reserva/estorno. A conta autenticada determina autoria.

Header Idempotency-Key obrigatório, UUID textual canônico. Primeiro sucesso e replay devolvem o mesmo recurso/status 201, por exemplo `{operacaoId,produtoId,tipo,quantidade,saldoAnterior,saldoAtual,criadoEm}`. Contexto de replay pode ser informado em header separado. Leituras previstas em `/api/estoque`, `/api/estoque/movimentacoes` e `/api/estoque/:produtoId` são admin, paginadas, no-store e Vary: Cookie; registrar o caminho estático movimentacoes antes do parâmetro produtoId.

### Venda e preço: fronteira com frontend

Manter a nomenclatura local `/api/vendas`, sujeita à aprovação de B2 e à atualização do PDF; não criar um segundo cadastro de pedidos. Fragmento proposto dos itens:

```json
{"itens":[{"produtoId":42,"quantidade":2,"precoEsperado":4999}]}
```

Entrega/endereço seguem contrato de B2, com dados buscados pelo servidor e dono obtido de req.usuario, nunca clienteId do body. precoEsperado é somente uma condição de confirmação de mudança, **não a fonte de preço**. A proposta exige-o na criação para devolver 409 e pedir reconfirmação se o preço atual sob lock for outro. Essa extensão ao PDF precisa de acordo: o PDF prevê somente ID e quantidade. Alternativa seria uma cotação do servidor vinculada a confirmação explícita, antes da venda; não aceitar silenciosamente preço maior.

Normalizar produtos repetidos somando quantidades, rejeitando preços esperados conflitantes e overflow; preservar índices para erros por item. Definir limite operacional de itens com B2 (proposta inicial: 100 IDs distintos), sem confundir o teto visual 99 com saldo ou regra comercial aprovada.

Na transação de criação: reivindicar idempotência; conferir cliente/endereço; bloquear produtos por ID; ler preço/ativo/categoria; calcular totais e frete a partir desses dados; persistir venda e cópias de itens; chamar baixa/alocação; gravar resultado; COMMIT. O cálculo de frete existente é puro e pode ser rechecado rapidamente nessa etapa. Nenhuma cotação externa deve manter locks abertos.

O checkout real deverá usar sessão sid com credentials e Origin, enquanto catálogo público pode continuar com credentials:omit. UI exibe mudanças de preço/indisponibilidade, mas não autoriza nem valida saldo no lugar do servidor. Criação retorna 201 com ID, estado, itens/totais em centavos e expiraEm do servidor. Cobrança posterior usa esses snapshots. GET da venda mostra estado atual; replay da criação não cria nova reserva nem reinicia o prazo.

### Erros e idempotência

Preservar `{erro, detalhes?}` e evitar migração global do formato nesta implementação. Body/ID/booleanos inválidos: 400; sem sessão: 401; papel/Origin: 403; venda de outro cliente: 404; estoque/preço/estado/hash de chave conflitante: 409; impedimento de entrega e mínimo Pix: 422; falha externa: 502; indisponibilidade transitória de lock: 503 genérico, sem mensagem SQL. Detalhes por campo/índice, sem nome de produto inativo, SQL, stack ou saldo administrativo bruto.

| Ação | Unicidade proposta e proteção adicional |
|---|---|
| Criação de venda | `(cliente autenticado, rota lógica, Idempotency-Key)` + hash canônico de itens/entrega/preços esperados; resultado/ID persistidos junto com o negócio. Mesma chave com dados diferentes: 409. |
| Movimento admin | Escopo servidor `admin:<id>` + chave, hash e operação persistidos. Reavaliar sessão/papel antes de replay. |
| Reserva | Chave lógica `reserva:venda:<id>` + UNIQUE por item de venda; não depende de uma nova chave enviada pelo navegador. |
| Liberação/devolução | Referência única ao débito original + transição da alocação. Cancelamento e expiração não podem creditar ambos. Primeiro escopo é compensação integral. |
| Webhook | ID externo único já existente em eventos_webhook; aplicar por cobrança/pagamento local e pela alocação, também quando o gateway enviar IDs de evento diferentes para o mesmo efeito. |
| Criação Pix | Manter o mesmo pagamentoId/externalId em retry; impedir duas criações locais concorrentes. Após timeout sem cobrançaId, reconciliar antes de nova criação. |
| Refund | Chave de negócio interna por pagamento/cobrança + estado persistido; não inventar header/chave externa que a AbacatePay não oferece. Resposta já reembolsada deve convergir ao mesmo resultado local. |

Não apagar a unicidade de efeitos de negócio por simples expiração de cache. Mesmo que respostas HTTP sejam compactadas, preservar chave/hash/recurso suficientes para impedir reexecução indevida de uma intenção antiga. Repetir após expiração de venda não deve criar automaticamente outra venda; uma nova compra exige nova intenção/chave.

**Ponto não verificado:** `gateway.ts:196–198` trata externalId como idempotência externa. A página oficial consultada mostra o campo, mas não permitiu confirmar formalmente a garantia em todos os casos de timeout/repetição. Isso exige validação documental/Dev mode pelo B2 antes de prometer retry automático de criação. Não foi realizada cobrança real nesta análise. O adaptador hoje só reconsulta por cobrançaId, não resolve sozinho uma criação cujo ID se perdeu.

### Transações e concorrência

Reutilizar [`comTransacao`](../src/utils/transacao.ts), linhas 6–25, uma única conexão e executor obrigatório nos métodos mutáveis. Não abrir transações independentes dentro do estoque nem deixar repository cair no executor default db. O helper já faz rollback e descarta conexão quando rollback falha; não implementa sozinho retry, timeout ou regra de negócio.

Em operações sobre venda existente: reivindicar requisição/evento; travar venda, depois pagamentos necessários em ordem, produtos por ID crescente e alocações. Na criação não há venda existente a disputar: bloquear cliente/endereço antes dos produtos, inserir a venda nova com os valores calculados e não adquirir depois locks de outra venda. Empregar o mesmo `FOR NO KEY UPDATE` do catálogo para produtos e UPDATE condicional com ativo/saldo. Compensações não filtram ativo. Preservar serialização com PATCH/DELETE/reativar.

Em Read Committed, o PostgreSQL reavalia a condição de UPDATE após esperar outra escrita. Locks de linha duram até o fim da transação; ordem consistente reduz deadlocks. Essa é a base da proposta, não uma prova de que o fluxo inexistente já seja seguro. Ver [isolamento PostgreSQL 17](https://www.postgresql.org/docs/17/transaction-iso.html) e [locks PostgreSQL 17](https://www.postgresql.org/docs/17/explicit-locking.html).

Para o prazo, ler `clock_timestamp()` após conseguir o lock da venda; `now()` representa o começo da transação e poderia anteceder uma espera longa. Ver [funções de data do PostgreSQL 17](https://www.postgresql.org/docs/17/functions-datetime.html).

Limites iniciais **propostos para homologação**, não medidos: lock_timeout 2 s, statement_timeout 5 s, transações curtas e até três retries do bloco inteiro para deadlock/serialização, sempre idempotentes. Não fazer retry dentro de transação já abortada nem repetir HTTP financeiro cegamente. Valores finais dependem de teste de carga e acordo com infraestrutura.

Gateway, envio de e-mail e chamadas externas ficam entre transações curtas. Inbox de webhook deve ser gravada antes do ACK; worker pode usar claim com lease/SKIP LOCKED, consultar gateway fora da transação e aplicar negócio+processado_em atomicamente depois. Falha antes da persistência: 5xx; 2xx só depois de aceite durável ou descarte intencional de evento não suportado.

## 6. Schema, segurança e ordem de implementação

### Mudanças necessárias de schema — propostas, não executadas

| Área / dono | Alteração e restrições necessárias |
|---|---|
| B1 — operacoes_estoque | ID de operação, escopo/chave não nulos, hash, tipo, autoria/referência e resultado; UNIQUE(escopo,chave). Escopo gerado no servidor evita ambiguidade de NULL em índices e colisões entre contas. |
| B1 — movimentacoes_estoque | Produto, operação, tipo, quantidade positiva, delta, saldo anterior/posterior não negativos, data, autoria e motivo. UNIQUE(operacao_id,produto_id). FK para compensação com unicidade no escopo integral, CHECK de aritmética e sinal por tipo; sem exclusão em cascata. Histórico append-only, com proteção de escrita adequada ao papel de aplicação. |
| B1 — alocacoes_estoque | Chave `(venda_id,produto_id)`, quantidade, estado, referências/timestamps de reserva e resolução. FK composta para o item existente, aproveitando UNIQUE de itens_venda. Igualdade de quantidades é validada no service/transação e na reconciliação, não por CHECK que finja consultar outra tabela. Vencimento tem como fonte vendas.expira_em. |
| B2 — pagamentos | Permitir etapa local anterior à chamada externa: hoje gateway_cobranca_id NOT NULL impede criar pagamentoId durável antes de criar cobrança. Propor ID de cobrança anulável somente na fase de criação, fase explícita e UNIQUE(gateway,gateway_cobranca_id) quando preenchido. Não usar um ID fictício de gateway como preenchimento. |
| B2 — reconciliação/estorno | Adicionar estorno_solicitado_em já previsto em D-22 e conclusão/referências necessárias; registrar qual pagamento foi aplicado à venda. Permitir registrar outras cobranças realmente pagas para reembolso, sem uma constraint que impeça registrar a verdade financeira. |
| B2 — inbox/outbox/idempotência | Usar eventos_webhook de fato, com claim/retentativa durável, dados mínimos e resultado atômico; persistir criação idempotente de venda/cobrança e tarefas de refund/reconciliação. Não manter flags somente em memória. |

Novas tabelas não existem hoje. A migração deve ser incremental, revisada e testada, com atualização do bootstrap `backend/db/init/30_estoque.sql` previsto em api.md. O projeto ainda não possui um runner de migrações versionadas: combinar a execução/registro com infraestrutura. Não adotar a orientação histórica de db:reset para bases com dados.

Se houver saldo legado positivo, registrar movimento de abertura que reconcilie o valor existente sem incrementá-lo novamente, sob pausa/locks apropriados. Não inferir reservas retroativas de vendas existentes: é preciso apurar se houve débito real e decidir o tratamento do legado. Cadastro novo continua zero e reativação continua sem entrada.

### Segurança e riscos de integração

| Classificação / prioridade | Evidência e consequência | Tratamento / responsável |
|---|---|---|
| Proteção confirmada no catálogo | autenticar lê sid e consulta sessão vigente/cliente ativo/papel atual; exigirAdmin verifica o papel do servidor; exigirOrigem compara origem fixa. Cookie HttpOnly, SameSite=Lax, Secure em produção. | Reusar em estoque. Ver `middlewares/autenticar.ts:8–17`, `exigirAdmin.ts:4–7`, `exigirOrigem.ts:5–7`, `sessao.repository.ts:15–25`, `sessao.cookie.ts:8–13`, `catalogo.routes.ts:26–36`. |
| Lacuna funcional confirmada, P0 antes de ativar vendas | Webhook responde 200 sem inbox/processamento; rotas de venda vazias. Se configurado para receber pagamentos reais agora, não produzirá confirmação durável. A configuração real no gateway não foi verificada. | B2: persistência/orquestração antes de habilitar o fluxo real. Não confundir o teste que comprova ausência de escrita com pagamento implementado. |
| Regra futura obrigatória, P0 | CORS não autoriza cliente/admin nem impede chamada direta com credencial; papel, origem ou saldo fornecidos no body não são autoridade. | Estoque admin: sessão/admin/Origin; venda: sessão/Origin/dono, com 404 para recurso alheio. Helpers de reserva/liberação não ganham endpoints públicos. B1+B2. |
| Proteção parcial confirmada | JSON é limitado a 100 KiB e rejeita compressão; rawBody foi acrescentado para HMAC. Erro interno é genérico e logs gerais levam contexto/SQLSTATE. | Preservar `app.ts:15–21`, `errorHandler.ts:9–27`, `registrarErro.ts:1–5`. Validar arrays, inteiros, duplicados, limites e lista fechada de campos nas novas rotas. |
| Webhook: proteção existente e etapa ausente | Segredo + HMAC de corpo cru existem; a reconsulta e vínculo ao pagamento local ainda não são executados. Assinatura com chave pública não substitui segredo nem confirmação de valor. | B2: localizar cobrança pelo próprio banco, conferir gateway/ambiente/valor, nunca escolher venda pelo metadata do evento. Não exigir Origin/cookie no webhook. Ver `webhook.ts:21–45`, `gateway.ts:226–250`. |
| Logs: proteção confirmada no gateway, risco de configuração no email | Gateway não imprime token, payload ou Pix. `utils/email.ts:51–52` imprime destinatário/texto em desenvolvimento sem chave; os novos commits remotos passam a usá-lo em recuperação de senha. NODE_ENV ausente assume development (`config/env.ts:5`). | B2/infra: separar logs de demonstração, configurar produção corretamente, não centralizar conteúdo sensível. A afirmação “nenhum dado sensível em qualquer log” seria incorreta. |
| Segredo em URL, risco dependente de infraestrutura | Webhook usa query webhookSecret; access logs/proxy não foram inspecionados. `errorHandler.ts:5–6` ainda reflete originalUrl em 404. | Infra/shared: redigir query/segredo nos logs e evitar eco em erros. Não logar rawBody, cookie, credenciais, QR Pix, endereço ou motivo livre. |
| Modo demo, risco de configuração | Flag VITE_CATALOGO_MOCK troca o catálogo inteiro e pode ser ativado num build; não há guarda por produção. Não demonstra estoque real. | Frontend/infra: build/homologação real com flag false e comprovação de tráfego PostgreSQL; impedir misturar demonstração com venda real. Não expor quantidade pública só para atender TODO do montador. |

Idempotência não dispensa autorização: replay também exige sessão válida e permissão atual. Worker/gateway usam contexto interno validado, não um papel enviado por HTTP. Leituras de estoque/histórico ficam restritas a admin. Ledger guarda IDs técnicos/causa, sem cópias de telefone, endereço, payload financeiro ou sessão.

As verificações não constituem auditoria de segurança completa nem homologação de gateway em produção. A [documentação oficial do webhook](https://docs.abacatepay.com/pages/webhooks/security) confirma segredo e HMAC; [reembolso transparente](https://docs.abacatepay.com/pages/transparents/refund) descreve somente reembolso total, recusa de repetição e dependência de saldo. A chave idempotente interna não transforma o gateway em uma transação do PostgreSQL.

### Etapas pequenas, dependências e aceite

| Etapa | Dono / módulos prováveis | Dependência e critério objetivo |
|---|---|---|
| 0. Aprovar contrato | B1+B2+frontend; proposta, api.md e decisoes.md | Fechar escolhas da seção 8 e incorporar a base remota relevante sem duplicar D-47. Só então atualizar decisão vigente. |
| 1. Migração/histórico e movimentos admin | B1; db/init/30_estoque.sql, migração incremental, src/modulos/estoque/{types,validacao,repository,service,controller,routes}, routes/index.ts | Após regra/schema aprovados. Saldo+movimento+idempotência atômicos; 401/403/Origin; 409 sem negativo; histórico conciliável; zero mudança em vendas. É o primeiro incremento de código recomendado. |
| 2. Consulta transacional e alocações internas | B1; produto.service/repository, estoque.service/repository e types/index.ts | Após tipos combinados com B2. Testar ativos/preço sob lock, dois compradores, compensação integral única e nenhuma segunda baixa em confirmar. Não publicar reserva direta ao cliente. |
| 3. Criar/cancelar/expirar venda | B2 consome B1; venda.service/controller/routes/repository, worker, frete e testes compartilhados | Após helpers prontos. Mesmo client para tudo; cópias/totais do servidor, idempotência, cancelamento concorrente, TTL e recuperação do worker. Não liberar checkout real sem expiração operacional. |
| 4. Persistir/orquestrar pagamento | B2; pagamentos, migrations, eventos_webhook, inbox/outbox/reconciliação | IDs locais estáveis antes de HTTP; criação indeterminada reconciliada; confirmação e estorno repetíveis; pagamento tardio/excedente sem nova baixa. Adaptador existente é reutilizado. |
| 5. Integração real do frontend | Frontend+B2, suporte B1 | Substituir auth/frete/pedidos simulados; Pix transparente, confirmar preço do servidor, tratar 409/expiraEm e reconsultar status. Modo demo separado; carrinho continua intenção. |

Hoje B1 pode preparar especificação, fixtures e revisão de migrations de catálogo sem tocar no outro backend. A semântica de reserva, assinaturas e schema compartilhado exigem acordo antes de codificar. Não atribuir a B1 a implementação integral de venda, cobrança, worker financeiro ou checkout.

## 7. Cenários de teste e verificações executadas

### Aceite futuro com PostgreSQL real

| Cenário | Assertivas necessárias |
|---|---|
| Entrada/ajustes/saída admin | Saldo/delta/antes/depois corretos, motivo e ator; inativo não reativa; inválidos/401/403/Origin não escrevem. |
| Falha no histórico/alocação | Trigger de teste falha depois do UPDATE; saldo, venda, itens e operação idempotente ficam como antes. |
| Duas vendas para D=1 | Duas conexões, barreira por lock observável; exatamente uma venda confirmada e um débito; outra 409 e nenhuma linha residual. |
| Múltiplos itens em ordens opostas | IDs normalizados em ordem; uma falha no segundo item desfaz o primeiro; deadlock/retry não duplica operação. |
| Preço/PATCH e DELETE/reativar concorrentes | Lock determina snapshot; nenhum preço antigo calculado fora da transação é gravado; nova venda de inativo falha, compensação de venda existente funciona. |
| Quantidades duplicadas/limites | Somar antes de comparar com D; recusar overflow, fração, negativo, campos protegidos e preço esperado conflitante. |
| Repetição HTTP | Mesma chave e corpo simultâneos: mesmo recurso, um efeito; outra conta não acessa resultado; hash diferente 409; chave antiga não renova TTL. |
| Confirmar pagamento | Valor/cobrança/dono/ambiente corretos; um paga e uma confirmação de alocação; D não muda novamente. Valor divergente/status desconhecido não libera atendimento. |
| Webhook igual e eventos diferentes da mesma cobrança | Inbox deduplica; guardas de negócio também deduplicam. Falha antes/depois do ACK e após reconsulta pode ser reprocessada sem duplo débito ou crédito. |
| Cancelamento × pagamento × expiração | Combinações em duas conexões, inclusive exatamente no deadline e após espera por lock; um estado final válido, um histórico por efeito e, se tardio, reembolso sem reabrir reserva. |
| Worker repetido/indisponível | Dois workers não liberam duas vezes; atraso não aceita pagamento vencido; reinício recupera pendências; monitorar vencidas não resolvidas. |
| Estorno pago | Sucesso, já reembolsado, falta de saldo, timeout e falha de COMMIT após resposta externa; convergir a uma compensação integral, nunca liberar só por tentativa. |
| Duas cobranças/mesma venda | Uma aplicada ao atendimento; outra registrada/reembolsada, sem cancelar venda válida nem repor estoque. |
| Inativo/peixe e consultas públicas | Reservar última unidade altera emEstoque/vitrine; sem ficha continua fora dos atalhos; liberar inativo não o torna público; reativar preserva histórico. |
| Retorno físico/perdas | Nenhum webhook financeiro reintegra sozinho unidade enviada, morta ou danificada; crédito vinculado não excede débito; parcial fora do contrato inicial. |

Testes com pagamento usam adaptador falso controlado para cenários de rede, mas saldo/locks/constraints/rollback usam PostgreSQL real. Homologação Dev mode do gateway é separada e não deve ser confundida com mocks unitários ou testes comerciais reais. Nenhum teste futuro de movimentação pode ser declarado aprovado antes de existir implementação.

### Executado nesta análise

Foram usados os fontes de HEAD em cópia isolada via git archive, dependências já instaladas e banco descartável separado. Após a interrupção, os logs temporários desapareceram; as mesmas verificações foram repetidas no mesmo HEAD para registrar evidência atual. Nenhuma dependência do projeto foi instalada ou alterada neste ciclo.

| Comando / verificação | Resultado |
|---|---|
| git status/log/reflog/worktree, ls-remote, ancestry e diff | Base/correções confirmadas; detectado avanço do Backend 2; fetch somente da referência remota; sem operação de integração. |
| Backend npm run typecheck | Passou. |
| Backend npm test | 818 testes, todos passaram; nenhum ignorado. Inclui gateway com fetch falso, regras de transição, catálogo, permissões e parsers. |
| Backend TEST_DATABASE_URL=... npm run test:integration | 341 testes passaram, nenhum ignorado; PostgreSQL 17 descartável. Inclui transições concorrentes/rollback, sessão, produtos e webhook que deliberadamente não processa eventos. |
| Frontend npm test | 89 testes passaram, nenhum ignorado; catálogo/carrinho/montagem, sem prova de checkout real. |
| PDF | Lido; divergência de baixa confirmada na página 4. |
| Navegador/E2E neste ciclo | Não reexecutado; Chromium/artefatos temporários da revisão anterior não estão disponíveis neste ambiente retomado. Testes versionados da vitrine estão presentes. |
| Gateway real / produção / access logs | Não exercitados/inspecionados; nenhuma cobrança, estorno, deploy ou acesso a conta da loja. |
| Build/lint nesta rodada | Não executados: alteração apenas documental. Não tratar resultados antigos como nova aprovação. |
| Fontes e whitespace ao encerrar | Os 387 arquivos versionados originais foram preservados por comparação SHA-256; git diff --check e conferência de whitespace do documento passaram. Única adição: este relatório. |

## 8. Decisões para aprovação e pendências

1. **Baixa:** aprovamos D como disponível, débito na criação e confirmação sem segundo débito, com alocação explícita? Se escolher físico/reservado separado, revisar schema, DTO/projeções e D-16/D-21 juntos.
2. **Prazo:** manter 30 minutos rígidos, sem renovação? Aceitar reembolso quando a confirmação chegar após o prazo, ou definir tolerância explícita antes de liberar unidades?
3. **Cancelamento pago:** manter devolução de unidades após reembolso confirmado, antes do envio, somente se comercializáveis? Como tratar perda de peixe já alocado sem recolocá-lo à venda?
4. **Pagamento tardio/excedente:** aprovar reembolso por pagamento sem reabrir venda cancelada nem creditar estoque novamente? Qual coluna/referência identificará o pagamento efetivo da venda?
5. **Preço:** adotar precoEsperado como precondição, ou uma cotação do servidor com reconfirmação? Quais limites de itens/quantidades e totais serão aceitos?
6. **Fronteira:** confirmar monólito/PostgreSQL compartilhados e assinaturas com executor obrigatório; B1 estoque, B2 orquestração de venda/pagamento/workers, frontend integração.
7. **Idempotência externa:** B2 confirma a garantia de externalId na criação Pix e o procedimento para timeout sem cobrançaId antes de habilitar retry automático?
8. **Operação:** quem mantém worker de expiração/reconciliação, monitora atraso e conduz migração sem reset? Como apurar saldo/vendas legados e validar retorno físico?

Pendências anteriores ainda abertas: auth/frete/pedidos do frontend simulados; rotas reais de venda/cotação/pagamento não publicadas; inbox/processamento do webhook; provedor de e-mail/conta produtiva do gateway/valores finais de frete; modo demo e montador precisam de homologação real própria. A correção de Peixes em destaque já existe e foi integrada, não é uma pendência de implementação ausente. A nova recuperação de senha e a correção documental do estorno estão no remoto do Backend 2 e não foram mescladas ou testadas por este ciclo.

**Primeira tarefa concreta após aprovação:** implementar somente a migração de histórico e o POST administrativo de movimentações, com saldo+histórico+idempotência na mesma transação, testes reais de concorrência/rollback e guards existentes; preservar vendas/pagamentos. Depois, entregar os helpers de alocação para B2 consumir. Este documento não autoriza nem executa essas implementações.
