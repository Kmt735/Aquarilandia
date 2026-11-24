# Histórico de planejamento e segurança do backend da Aquarilândia

Registro consolidado em 23/11/2026 para complementar a documentação de frontend com a preparação técnica, as revisões de segurança e o planejamento de entrega do backend.

Fonte histórica: trecho da [conversa compartilhada com o Claude](https://claude.ai/share/21def996-b82e-49dc-931e-4ec195b20361), fornecido pelo usuário em texto. O trecho reúne um roteiro inicial de estudos e mensagens posteriores sobre os lotes de desenvolvimento. As mensagens iniciais não têm data; o calendário de entrega mencionado vai de 15 a 19 de novembro de 2026. Parte do relato de envio de e-mail está truncada.

As referências ao código correspondem ao checkout local `50e5924`, consultado em 23/11/2026. Elas confirmam a presença das implementações citadas, sem certificar sua operação em produção. Resultados de testes relatados na conversa permanecem históricos; nenhuma suíte foi executada nesta consolidação.

## Preparação para construir o backend

O ponto de partida foi a necessidade de estudar como estruturar o backend com segurança. O escopo considerado incluía catálogo, fichas de peixes, administração de produtos, estoque e orçamentos, com compras online em uma etapa posterior.

A orientação foi aprender os fundamentos enquanto se construíam entregas pequenas da Aquarilândia. Segurança deveria acompanhar a implementação, incluindo validação de entradas, permissões por recurso, proteção de senhas e transações de estoque.

### Roteiro de estudos proposto

Foi sugerido um período de 12 semanas, com aproximadamente 8 a 10 horas por semana. Essa duração era uma estimativa de estudo, sem registro de execução semana a semana no trecho fornecido.

| Semana | Conteúdo | Exercício previsto |
| --- | --- | --- |
| 1 | HTTP, JSON, cookies, CORS e APIs REST | Desenhar rotas, métodos e respostas do projeto |
| 2 | Node.js, TypeScript, Promises e tratamento de erros | Filtrar um catálogo de peixes por parâmetros |
| 3 | Framework e organização em camadas | Criar um CRUD em memória |
| 4 | Modelagem relacional, chaves e normalização | Desenhar o diagrama ER e criar tabelas no PostgreSQL |
| 5 | SQL, índices, constraints e transações | Consultar fichas e praticar baixa de estoque transacional |
| 6 | Migrations, seeds e alternativas de ORM | Persistir o catálogo com paginação e filtros |
| 7 | Validação de entrada e erros padronizados | Validar body, parâmetros e query das rotas |
| 8 | Hash de senha, sessões e autorização | Proteger a administração com autenticação e papéis |
| 9 | Segurança de aplicações web | Exercitar controles de acesso, tentativas de login e entradas inválidas |
| 10 | Imagens, orçamentos e dados pessoais | Implementar fotos de produtos e persistência de orçamentos |
| 11 | Testes, implantação, integração contínua e backup | Preparar a aplicação para publicação |
| 12 | Gateway, webhooks e idempotência | Exercitar compras com pagamentos de teste |

Express/Fastify, Prisma/Drizzle, Supabase, Zod, Cloudinary, Vitest/Supertest, Render/Railway e Mercado Pago/Stripe foram apresentados como alternativas de estudo. Sua menção na conversa não significa adoção no projeto.

## Escolhas presentes no projeto atual

| Tema | Implementação no checkout consultado | Referência |
| --- | --- | --- |
| API | Node.js, TypeScript e Express | [Dependências e scripts](../package.json), [aplicação](../src/app.ts) |
| Persistência | PostgreSQL com `pg`, SQL nos repositórios e scripts SQL de evolução | [Pool de conexão](../src/config/db.ts), [endereços](../src/modulos/clientes/endereco.repository.ts), [scripts SQL](../db/init/) |
| Autenticação | Hash Argon2, sessões e verificações de acesso | [Serviço de autenticação](../src/modulos/auth/auth.service.ts), [rotas de clientes](../src/modulos/clientes/cliente.routes.ts) |
| Validação | Funções próprias nos módulos | [Validação de clientes](../src/modulos/clientes/cliente.validacao.ts), [autenticação](../src/modulos/auth/auth.service.ts) |
| E-mail | Resend pela API HTTP; mensagens em texto simples | [Envio de e-mail](../src/utils/email.ts) |
| Pagamentos | AbacatePay v2, com Pix e checkout hospedado para cartão | [Adaptador do gateway](../src/modulos/pagamentos/gateway.ts), [contrato de cartão](pagamento-cartao.md) |
| Estoque de vendas | Baixa na criação da venda, na mesma transação dos itens; confirmação de pagamento não deve baixar novamente | [Criação da venda](../src/modulos/vendas/venda.service.ts), [integração de estoque e vendas](integracao-estoque-vendas-2026-11-14.md) |
| Imagens | Processamento e armazenamento em diretório persistente configurado | [Imagem principal](imagem-principal-2026-11-14.md) |
| Testes | Backend com o runner `node:test`, incluindo suítes HTTP e integração PostgreSQL; frontend com E2E Playwright | [Scripts backend](../package.json), [scripts frontend](../../frontend/package.json), [guia de testes](../testes/README.md) |
| Implantação prevista nos arquivos | Docker Compose com aplicação, PostgreSQL e Caddy; site e API na mesma origem | [Roteiro de deploy](deploy.md), [Compose de produção](../docker-compose.prod.yml) |

A sugestão inicial de baixar estoque somente depois do pagamento foi superada pelo fluxo de criação transacional da venda. Cancelamento, expiração e estorno possuem regras próprias de devolução, descritas nos contratos de estoque e pagamentos. O roteiro de estudos não deve ser usado para substituir essas regras.

## Revisões de segurança relatadas na conversa

O trecho posterior descreve o lote 14a como uma etapa de fechamento de achados de uma revisão anterior. A aprovação relatada pertence àquele contexto e não equivale a uma auditoria integral do sistema atual.

| Tema | Registro histórico | Evidência disponível no repositório |
| --- | --- | --- |
| Enumeração de contas pelo tempo do login | A conversa relata tempos antes de aproximadamente 1,3 ms contra 59 ms, e depois 59,7 ms contra 59,5 ms | O [login](../src/modulos/auth/auth.service.ts) verifica um hash fictício para conta inexistente ou inativa; os [testes de login](../testes/login-tempo.test.mjs) conferem trabalho de hash e respostas equivalentes |
| Propriedade dos endereços | Foi relatado que um teste detectou a remoção proposital do filtro de dono | O [repositório](../src/modulos/clientes/endereco.repository.ts) filtra por cliente; a [suíte de endereços](../testes/integracao/enderecos.test.mjs) inclui acesso ao endereço de outro cliente. O resultado específico da mutação depende do relatório original |
| Indisponibilidade do e-mail | Foi relatada preservação das operações e ausência de vazamento nos cenários testados | Existem [testes de falha do provedor](../testes/integracao/email-falha.test.mjs) e [testes de recuperação de senha](../testes/recuperacao-senha.test.mjs) |
| Ordem da proteção de origem | Foi solicitada a correção R-06 para rejeitar escrita administrativa sem `Origin` antes de consultar a sessão | As [rotas de orçamentos](../src/modulos/orcamentos/orcamento.routes.ts) aplicam essa ordem; há [testes de acesso](../testes/orcamentos-acesso.test.mjs) |
| Envio real de recuperação de senha | O trecho relata HTTP 202 na rota e HTTP 200 no Resend; o identificador do envio está truncado | O fluxo e o provedor existem no código. O registro completo do envio e a confirmação de recebimento precisam acompanhar a evidência histórica |
| Cobertura de rotas | A conversa relata redução de três rotas sem teste para zero | A afirmação se limita ao inventário daquela revisão; não estabelece cobertura total do checkout atual |

Os tempos de login são medições históricas de uma amostra. A implementação busca reduzir diferenças observáveis; os números não demonstram impossibilidade de enumeração de contas em qualquer ambiente.

### Configuração de e-mail discutida

A conversa orientou configurar `EMAIL_API_KEY` e `EMAIL_REMETENTE` no backend e testar a recuperação de senha sem expor token ou link nos relatos. Também distinguiu o uso de um remetente de teste do domínio definitivo de produção.

Para operar o projeto, seguir a configuração do [deploy](deploy.md) e de [vendas reais](producao-real.md). O código exige a configuração de e-mail em produção. Na recuperação de senha, a mensagem usa `FRONTEND_URL`, o token é de uso único e o envio ocorre depois da transação. O aceite do provedor não comprova, sozinho, recebimento ou chegada à caixa de entrada.

## Planejamento de integração e entrega

O calendário mencionado na conversa previa:

| Data planejada | Atividade |
| --- | --- |
| 15/11/2026 | Adiantar revisões e pendências, se necessário |
| 16/11/2026 | Apoiar a integração do frontend com as rotas do backend |
| 17/11/2026 | Repetir a revisão de base, atualizar o README e congelar o código |
| 18/11/2026 | Publicar no VPS, configurar domínio, e-mail e webhook definitivo e ensaiar a apresentação |
| 19/11/2026 | Apresentar com simulação de Pix no ambiente de demonstração e desativá-la depois |

Essas datas representam o planejamento registrado. O trecho não comprova execução de cada etapa nem publicação do sistema.

### Responsabilidades mencionadas

- **Celio:** encaminhar integração dos lotes, reunir respostas dos relatórios, acompanhar a revisão final e confirmar o encerramento de credenciais e acessos temporários citados na conversa.
- **Mateus:** revisar pull requests, decidir o escopo do “Avise-me”, preparar dados de catálogo e estoque e revisar o contrato de erro da rota de estoque.
- **Gabriel e Augusto:** integrar o frontend às APIs, com referência histórica ao trabalho identificado como #51.
- **Equipe:** providenciar VPS e domínio e alinhar o texto acadêmico ao escopo entregue.
- **Loja:** validar valores de frete e políticas de troca e entrega.

Essas atribuições pertencem ao planejamento histórico. O trecho não confirma a conclusão de cada item. A orientação de integrar pela `main` e solicitar revisão deve permanecer no capítulo de colaboração; os comandos de commit e push colados na conversa são parte do histórico.

### Simulação de Pix

O [gateway atual](../src/modulos/pagamentos/gateway.ts) condiciona a simulação à combinação de `PERMITIR_SIMULACAO_PIX` com uma chave de teste. Também registra aviso de configuração se a variável estiver ligada com uma chave que não seja de teste. A demonstração deve seguir o [roteiro de deploy](deploy.md); a publicação para vendas reais tem procedimento próprio em [produção real](producao-real.md).

## Ajustes na documentação principal

| Capítulo | Conteúdo a incorporar |
| --- | --- |
| Metodologia e aprendizado | Estudo orientado ao projeto, entregas incrementais e revisão contínua de segurança |
| Arquitetura | Rotas, controllers, services, repositórios, PostgreSQL e tratamento de erros |
| Segurança | Senhas, sessões, propriedade de recursos, origem das escritas e proteção de informações nos cenários de e-mail |
| Testes e resultados | Separação entre testes locais, integração com PostgreSQL, simulações de fornecedores e evidências de envio real |
| Evolução do backend | Passagem das alternativas iniciais para as escolhas efetivamente presentes no código |
| Integração | Substituição de serviços simulados por chamadas de conta, pedidos, frete e orçamentos à API |
| Implantação | Topologia documentada, configurações de ambiente, backup, e-mail e webhook |
| Limitações e pendências | Decisões comerciais e comprovações ainda necessárias para declarar entrega operacional |

Na seção de situação atual do documento de frontend, conta, endereços, pedidos, frete e orçamentos precisam ser reavaliados: os serviços [conta](../../frontend/src/services/conta.js), [pedidos](../../frontend/src/services/pedidos.js), [frete](../../frontend/src/services/frete.js) e [orçamentos](../../frontend/src/services/orcamentos.js) já chamam o backend. A presença dessas chamadas deve ser acompanhada da validação do fluxo completo.

A indicação antiga de que só há Pix também precisa ser atualizada: existe implementação de cartão. A habilitação comercial desse método na conta recebedora e sua validação no ambiente definitivo continuam sendo condições separadas da presença do código.

## Evidências necessárias para fechar o histórico

- [ ] Recuperar os relatórios `revisao-base.md` e `revisao-base.json` citados na conversa; seus conteúdos não constam do anexo.
- [ ] Identificar a descrição e o encaminhamento dos achados R-07, R-08 e R-13 e dos itens 7 e 9 do PDF. Os identificadores isolados não permitem reconstruir o conteúdo.
- [ ] Associar os lotes 11, 12, 13 e 14a aos commits e pull requests correspondentes e registrar quais foram integrados.
- [ ] Anexar o resultado completo do envio real de e-mail, sem credenciais nem token de recuperação, e a confirmação de recebimento.
- [ ] Confirmar se houve revogação da chave mencionada como exposta e remoção do túnel e de seu webhook temporário. O trecho contém a solicitação, sem confirmação de execução.
- [ ] Registrar decisões finais da loja sobre frete, políticas e escopo de avisos de disponibilidade.
- [ ] Registrar ambiente, versão e resultados da validação final, incluindo publicação caso tenha ocorrido.

Os relatórios de revisão antigos, como a [revisão de 19/11/2026](revisao-estado-atual-2026-11-19.md), descrevem snapshots específicos. Pendências atribuídas a uma branch naquele momento precisam ser comparadas ao código e à versão da entrega antes de serem repetidas como situação atual.
