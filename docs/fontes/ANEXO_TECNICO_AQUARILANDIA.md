# Aquarilândia

Anexo técnico de arquitetura e implementação

CEFET-MG · Campus Varginha · Novembro de 2026

Este anexo preserva a documentação de código da consolidação de 23/11/2026, com referência ao checkout 50e5924. Resultados de testes mantêm as datas e os escopos dos relatórios originais. Este conteúdo integra o Apêndice A de DOCUMENTACAO_COMPLETA_AQUARILANDIA.pdf, na pasta docs.

---

## 1. Arquitetura e organização do código

### 1.1 Visão de comunicação

```text
Cliente no navegador
    |
    | React, rotas, componentes, contexto e serviços HTTP
    v
/api — Express
    |
    | middlewares -> rota -> controller -> service -> repository
    v
PostgreSQL

Serviços do backend -> AbacatePay, Resend e consulta de CEP
Imagens de produtos -> diretório persistente configurado
```

Em desenvolvimento, o Vite encaminha `/api` ao backend. No modelo de produção documentado, Caddy recebe o tráfego HTTPS e o Express serve o frontend compilado e a API na mesma origem. O banco fica em rede interna do Docker.

### 1.2 Estrutura do repositório

```text
Aquarilandia/
  frontend/
    src/components/atoms, molecules, organisms, templates, ui
    src/pages, context, hooks, services, data, lib, utils, mocks
    testes/
    docs/
  backend/
    src/config, middlewares, routes, modulos, utils
    db/init/
    scripts/
    testes/
    http/
    docs/
    api.md
  docs/
    prototipo-v4.html
    DOCUMENTACAO_COMPLETA_AQUARILANDIA.pdf
    fontes/
    visuais/
    ferramentas/
  README.md
```

### 1.3 Frontend e estado

Atomic Design organiza peças básicas, combinações e seções. Templates definem estruturas de páginas; páginas coordenam a composição; hooks compartilham comportamento. O frontend concentra o acesso à API em `src/services`, separando o formato recebido da apresentação.

O carrinho usa contexto e armazenamento local. Autenticação usa `AuthProvider` e consulta de sessão ao backend. Feedbacks e painéis possuem providers próprios. Filtros podem usar a URL; tema e progresso de interação são preferências locais quando aplicável. Nenhum dado de storage local concede papel administrativo ou confirma pagamento.

### 1.4 Backend em camadas

| Camada | Responsabilidade |
| --- | --- |
| Rotas e middlewares | Associar caminhos e métodos, validar acesso e encaminhar a operação |
| Controller | Ler a requisição e devolver o status e o corpo HTTP |
| Service | Aplicar regras de negócio, validação e coordenação transacional |
| Repository | Executar SQL parametrizado e mapear dados persistidos |
| Tipos e validações | Definir contratos e regras de entrada do módulo |
| Utilitários compartilhados | Transações, erros, e-mail e funções comuns |

Os módulos principais são catálogo, autenticação, clientes, estoque, vendas, pagamentos e orçamentos. O adaptador `gateway.ts` concentra a comunicação com AbacatePay, reduzindo o acoplamento do domínio ao formato do fornecedor.

### 1.5 Convenções

O código usa nomes em português para o domínio, funções e variáveis em `camelCase`, tipos em `PascalCase` e arquivos organizados por entidade e função. O SQL usa nomes em `snake_case`; a API apresenta campos em `camelCase`, com exceções de parâmetros já contratadas, como `preco_min` e `tipo_agua` no catálogo.

As regras completas e as exceções estão em `backend/api.md`. Ao integrar, o contrato específico de uma rota deve prevalecer sobre uma convenção genérica ou um exemplo antigo.

## 2. Banco de dados e migrações

### 2.1 Modelo relacional

| Grupo | Tabelas ou estruturas | Finalidade |
| --- | --- | --- |
| Catálogo | `categorias`, `produtos` | Identidade, categoria, preço, disponibilidade e publicação |
| Fichas técnicas | `peixes`, `aquarios`, `filtros`, `bombas`, `iluminacao`, `termostatos`, `racoes`, `condicionadores`, `substratos`, `plantas`, `decoracoes` | Campos próprios das onze categorias especializadas |
| Clientes | `clientes`, `enderecos_cliente` | Cadastro e endereços vinculados ao titular |
| Acesso | `sessoes`, `tokens_recuperacao_senha` | Sessões e recuperação com validade e revogação |
| Atendimento | `orcamentos` | Solicitação de serviço e andamento |
| Vendas | `vendas`, `itens_venda`, `historico_status_venda` | Compra, itens e trilha de estados |
| Financeiro | `pagamentos`, `eventos_webhook`, `pagamentos_checkout` | Cobranças, eventos e tentativas de checkout de cartão |
| Estoque | `operacoes_estoque`, `movimentacoes_estoque`, `migracoes_estoque` | Intenção, movimentos e controle de evolução do estoque |
| Logística | `produto_logistica` e snapshots na venda | Embalagem, preparação, unidade e serviço contratado |

### 2.2 Relacionamentos principais

Uma categoria possui vários produtos. As fichas especializadas se relacionam ao produto correspondente. Um cliente possui endereços, sessões e vendas. Cada venda reúne itens, registros de histórico e pagamentos. Os movimentos de estoque se vinculam ao produto e à operação que os originou; movimentos por venda preservam essa referência.

Os registros da venda guardam cópias de nome, preço e entrega para preservar o histórico mesmo quando o catálogo ou o endereço do cliente muda. A unidade e o serviço de transporte escolhidos também são registrados conforme as migrações de logística.

### 2.3 Regras de integridade

Dinheiro é armazenado em centavos inteiros. Chaves estrangeiras preservam vínculos entre entidades; constraints impõem limites, estados e combinações válidas. O estoque não admite saldo negativo, e a criação da venda e sua baixa devem confirmar ou desfazer juntas.

Os dados pessoais têm regras próprias de alteração e anonimização. O projeto mantém vendas ao anonimizar uma conta e impede a operação em determinadas situações de venda em andamento.

### 2.4 Evolução do schema

| Arquivo SQL | Conteúdo |
| --- | --- |
| `01_catalogo.sql` | Catálogo, fichas e categorias iniciais |
| `10_clientes.sql` | Clientes, endereços, sessões e recuperação de senha |
| `15_orcamentos.sql` | Solicitações de orçamento |
| `20_vendas.sql` | Vendas, itens, histórico, pagamentos e eventos |
| `21_vendas_idempotencia.sql` | Controle de repetição na criação de vendas |
| `22_pagamentos_estorno.sql` | Campos e regras de acompanhamento de estorno |
| `30_estoque.sql` | Operações e histórico administrativo de estoque |
| `31_estoque_vendas.sql` | Vínculo de baixa e compensação por venda |
| `32_produto_imagem.sql` | Identificação e referência da imagem principal |
| `33_estoque_consultas.sql` | Índice para consultas de histórico |
| `34_pagamentos_reconciliacao.sql` | Suporte à reconciliação de eventos e cobranças |
| `35_entrega_logistica.sql` | Embalagem e snapshots logísticos |
| `36_pagamentos_cartao.sql` | Tentativas e recuperação de checkout de cartão |

No Compose, os scripts de inicialização rodam em ordem na primeira criação de um volume vazio. Em banco existente, arquivos novos exigem aplicação incremental conforme o procedimento do módulo. Subir novamente o container não reaplica automaticamente todo o diretório.

Migrações devem preservar dados e ser precedidas do backup e da janela de manutenção apropriados. `db:reset` remove dados e não serve para atualizar um banco com informações a conservar.

## 3. API e contratos de integração

### 3.1 Convenções HTTP

A API usa o prefixo `/api`, recursos no plural e JSON. IDs de entidades do catálogo são numéricos. Valores monetários do contrato são inteiros em centavos, exceto projeções explícitas de apresentação no frontend.

As listagens de catálogo e estoque normalmente usam `{ itens, total }`. Outros módulos podem ter envelopes diferentes: compras do cliente, por exemplo, são adaptadas a partir de `dados`. A integração precisa respeitar cada DTO.

| Status | Uso geral |
| --- | --- |
| 200 | Consulta ou operação concluída com resposta |
| 201 | Recurso ou movimento criado, conforme o contrato |
| 202 | Solicitação aceita com mensagem genérica, como cadastro e recuperação de senha válidos |
| 204 | Sucesso sem corpo |
| 400 | Entrada malformada ou parâmetro inválido em contratos que usam esse status |
| 401 | Sessão ausente ou inválida |
| 403 | Permissão ou origem recusada |
| 404 | Recurso ou rota não encontrado |
| 409 | Conflito de estado, estoque, idempotência ou atualização comercial |
| 422 | Validação de dados de negócio nos módulos que adotam esse status |
| 429 | Limite de uso excedido |
| 500, 502, 503 | Falha interna, de integração ou indisponibilidade |

Exemplo de erro de validação, com mensagem ilustrativa:

```json
{
  "erro": "Dados inválidos",
  "detalhes": { "email": "Digite um e-mail válido." }
}
```

### 3.2 Catálogo e administração de produtos

| Método | Caminho | Acesso e função |
| --- | --- | --- |
| GET | `/api/health` | Saúde da aplicação e do banco |
| GET | `/api/categorias` e `/api/categorias/:id` | Leitura pública |
| POST, PATCH, DELETE | `/api/categorias` e `/api/categorias/:id` | Administração conforme a operação |
| GET | `/api/produtos` e `/api/produtos/:id` | Lista e detalhe públicos de produtos ativos |
| GET | `/api/produtos?incluir_inativos=true` | Consulta administrativa de ativos e inativos |
| POST | `/api/produtos` | Cadastro de produto e ficha, com estoque inicial zero |
| PATCH | `/api/produtos/:id` | Edição parcial dos campos permitidos |
| DELETE | `/api/produtos/:id` | Desativação do produto |
| POST | `/api/produtos/:id/reativar` | Reativação administrativa |
| PUT, DELETE | `/api/produtos/:id/imagem` | Substituição ou remoção de imagem |
| GET, PUT | `/api/produtos/:id/logistica` | Consulta e substituição dos dados privados de embalagem |
| GET | `/api/peixes` e `/api/peixes/:id` | Produtos ativos da categoria peixes com ficha |
| GET | `/api/servicos` | Serviços oferecidos |

Cadastro e ficha especializada são persistidos na mesma transação. O PATCH comum não é um atalho para mudar estoque, categoria ou situação de publicação. Categoria com produto vinculado não pode ser removida; a desativação de um produto preserva seus vínculos históricos.

### 3.3 Conta e clientes

| Método | Caminho | Função |
| --- | --- | --- |
| POST | `/api/auth/cadastro` | Solicitar cadastro sem revelar se o e-mail já existe |
| POST | `/api/auth/login` e `/api/auth/logout` | Iniciar ou encerrar sessão |
| GET | `/api/auth/sessao` | Recuperar a sessão atual |
| POST | `/api/auth/esqueci-senha` e `/api/auth/redefinir-senha` | Recuperar acesso |
| GET, PATCH, DELETE | `/api/clientes/me` | Consultar, alterar ou anonimizar a própria conta |
| PATCH | `/api/clientes/me/senha` | Alterar senha |
| GET, POST | `/api/clientes/me/enderecos` | Listar e cadastrar endereços próprios |
| PATCH, DELETE | `/api/clientes/me/enderecos/:enderecoId` | Alterar ou remover endereço próprio |
| GET | `/api/clientes/me/vendas` e `/api/clientes/me/vendas/:id` | Acompanhar compras próprias |
| GET, PATCH, DELETE | `/api/clientes` e `/api/clientes/:id` | Operações administrativas conforme método e caminho |
| GET | `/api/clientes/:id/vendas` | Compras de um cliente para administração |

O cadastro válido retorna 202 e mensagem genérica, sem login automático. Rotas de cliente são registradas antes das guardas administrativas para evitar conflito entre `/me` e `/:id`.

### 3.4 Operação comercial

| Método | Caminho | Função |
| --- | --- | --- |
| POST | `/api/frete/calcular` | Cotar itens e entrega ou retirada |
| POST | `/api/vendas` | Criar compra com validação e baixa transacional |
| POST | `/api/vendas/:id/pagamentos` | Gerar Pix ou checkout de cartão para o dono |
| POST | `/api/vendas/:id/cancelar` | Solicitar ou executar cancelamento permitido |
| GET | `/api/vendas` e `/api/vendas/:id` | Listar e consultar vendas como admin |
| GET | `/api/vendas/:id/historico` | Histórico administrativo |
| POST | `/api/vendas/:id/status` | Avançar situação logística permitida |
| POST | `/api/pagamentos/webhook` | Receber evento autenticado do gateway |
| GET | `/api/pagamentos/configuracao` | Informar capacidade pública de simulação |
| POST | `/api/pagamentos/:id/concluir-estorno` | Conclusão administrativa sujeita à prova financeira |
| POST | `/api/pagamentos/:id/simular` | Simulação administrativa condicionada ao ambiente de teste |
| POST | `/api/vendas/:id/simular-pagamento` | Simulação do próprio pagamento no ambiente de demonstração permitido |

### 3.5 Estoque e orçamentos

| Método | Caminho | Função |
| --- | --- | --- |
| GET | `/api/estoque` | Saldos administrativos com filtros |
| GET | `/api/estoque/:produtoId` | Saldo de um produto |
| GET | `/api/estoque/movimentacoes` | Histórico geral ou filtrado |
| POST | `/api/estoque/movimentacoes` | Entrada, saída ou ajuste administrativo |
| POST | `/api/orcamentos` | Solicitação pública de orçamento |
| GET | `/api/orcamentos` | Acompanhamento administrativo |
| PATCH | `/api/orcamentos/:id` | Atualização de atendimento conforme campos permitidos |

Os filtros, DTOs, limites e exemplos completos estão em `backend/api.md`, nos relatórios específicos e nos arquivos HTTP de `backend/http`. Esta visão agrupa as famílias de rotas; o acesso não é idêntico em todos os métodos.

## 4. Autenticação, autorização e segurança

### 4.1 Senhas e sessões

As senhas usam Argon2. O login compara credenciais e revalida seu estado sob lock antes de criar uma sessão. O token da sessão é enviado por cookie `sid`; sua configuração considera `httpOnly`, `SameSite` e proteção de transporte em produção. O banco guarda a representação derivada do token para consulta.

O backend consulta o papel e a situação atual da conta. Uma sessão revogada, expirada ou associada a conta inativa não deve continuar autorizando operações. Alteração e recuperação de senha possuem regras de revogação de acessos.

### 4.2 Recuperação e proteção contra enumeração

Cadastro e recuperação válidos usam mensagens genéricas para não expor a existência de uma conta. O login executa verificação de hash fictício quando a conta não existe ou está inativa, reduzindo a diferença de trabalho em relação à senha incorreta de uma conta existente.

O token de recuperação tem formato validado, expiração e uso único. Novo pedido invalida o anterior; redefinição troca a senha e revoga acessos na mesma transação. A mensagem de e-mail é montada com `FRONTEND_URL` e enviada após a confirmação da transação.

### 4.3 Permissões e origem

As guardas distinguem autenticação de permissão administrativa. Recursos pessoais também são filtrados pelo dono: saber o ID de um endereço ou de uma venda não autoriza acesso.

As escritas protegidas verificam a origem configurada. Em clientes, vendas e orçamentos, há cadeias que recusam origem inválida antes da consulta da sessão. O webhook tem uma cadeia diferente, pois o gateway não envia cookie e `Origin` de navegador; sua validação usa segredo, assinatura e reconsulta financeira.

### 4.4 Entradas, SQL e respostas

O backend usa validações explícitas, listas de campos permitidos e queries parametrizadas. Campos internos como papel, autor, saldo e preço final não são definidos livremente pelo navegador. Filtros e paginação possuem formatos e limites próprios.

O parser JSON possui limite de tamanho e descompressão recusada. Helmet configura cabeçalhos e política de conteúdo. As rotas de conta e operação privada usam proteção de cache. Falhas inesperadas devem responder sem expor SQL, credenciais ou conteúdo sensível.

### 4.5 E-mail, logs e segredos

O envio usa mensagens de texto e valida destinatário e assunto. Nos fluxos documentados, falha do provedor depois do COMMIT não desfaz a operação de negócio. Os testes de falha verificam cenários específicos de resposta e tratamento de dados.

Os logs do proxy têm regras para retirar cookies, assinaturas, referências e parâmetros sensíveis. `Referrer-Policy: no-referrer` limita o envio do endereço de recuperação em requisições seguintes.

Segredos pertencem ao ambiente privado do backend. Variáveis `VITE_*` são públicas no frontend e não podem conter chaves de gateway ou e-mail.

## 5. Controle de estoque

### 5.1 Saldo e histórico

O estoque administrativo possui saldo atual e movimentos rastreáveis. A operação guarda intenção, autoria e chave de repetição; o movimento registra produto, delta, saldo anterior e saldo posterior. O histórico é protegido contra alterações comuns que apagariam a rastreabilidade.

Entradas e ajustes positivos aumentam o saldo; saídas e ajustes negativos o reduzem. A quantidade enviada é positiva, e o tipo define o sinal. O backend impede saldo abaixo de zero e grava saldo e histórico na mesma transação.

### 5.2 Exemplo de movimentação

Uma entrada usa `POST /api/estoque/movimentacoes`, sessão administrativa, origem válida e header `Idempotency-Key` com UUID no formato exigido. Exemplo ilustrativo de body:

```json
{
  "produtoId": 42,
  "tipo": "entrada",
  "quantidade": 10,
  "motivo": "Reposição conferida"
}
```

A primeira operação e sua repetição válida retornam 201 com o snapshot original do movimento. A mesma chave, para o mesmo administrador, com uma intenção diferente retorna 409. Repetir uma resposta perdida não pode somar a entrada novamente.

Produto inativo pode receber movimento e continua inativo. A operação não altera preço, categoria, ficha ou publicação. O PATCH de produto não substitui esse fluxo.

### 5.3 Consultas

`GET /api/estoque` lista saldos com busca, categoria, situação ativa, disponibilidade, ordem e paginação. O padrão inclui ativos e inativos. O DTO apresenta `produtoId`, `nome`, `ativo` e `saldoAtual`; o total é calculado depois dos filtros e antes da página.

O histórico combina `produtoId`, `tipo`, `de`, `ate`, `pagina` e `limite`. O início é inclusivo e o fim exclusivo. Datas exigem fuso explícito; não há corte oculto de histórico por período padrão.

### 5.4 Vínculo com vendas

Os helpers internos de baixa e devolução recebem a conexão transacional do chamador. A criação da venda grava itens e baixa estoque na mesma transação. Idempotência e constraints impedem uma segunda baixa da mesma operação de venda.

Cancelamento e expiração usam compensação ligada à baixa original. Não há uma segunda tabela de reserva independente: a baixa na criação segura as unidades durante o prazo de pagamento. A confirmação financeira não baixa novamente.

## 6. Vendas, pagamentos e cancelamentos

### 6.1 Criação da compra

O cliente envia IDs, quantidades, escolha de entrega e total esperado com uma chave de idempotência. O backend consulta os produtos e o endereço, recalcula os valores, valida disponibilidade e cria venda, itens, histórico e baixa juntos. Se qualquer etapa falhar, a transação é desfeita.

O total esperado ajuda a detectar mudanças entre cotação e confirmação, sem substituir o preço do banco. A mesma chave não cria compras sucessivas, e mudança de intenção com a mesma chave deve produzir conflito.

### 6.2 Estados do pedido

| Caminho | Sequência principal |
| --- | --- |
| Entrega | `aguardando_pagamento → paga → em_separacao → enviada → entregue` |
| Retirada | `aguardando_pagamento → paga → em_separacao → pronta_retirada → entregue` |
| Não pago cancelado ou expirado | `aguardando_pagamento → cancelada` |
| Cancelamento com devolução financeira | `paga/em_separacao/pronta_retirada → cancelamento_solicitado → cancelada` |

As transições dependem de acesso, estado atual e situação financeira. A expiração considera o prazo persistido, normalmente de 30 minutos, e reconsulta pagamentos conforme as regras documentadas antes de devolver unidades.

### 6.3 Pix transparente

O backend solicita uma cobrança com valor em centavos e devolve QR Code e código copia e cola. O cliente paga no aplicativo do banco. A loja não precisa receber dados de cartão nesse fluxo.

`POST /api/vendas/:id/pagamentos` usa Pix como padrão. A cobrança é associada ao pagamento e à venda; respostas desconhecidas ou inconsistentes do fornecedor não podem ser convertidas em aprovação.

### 6.4 Checkout de cartão

Com `{ "metodo": "cartao" }`, o backend cria ou recupera uma tentativa de checkout e devolve a URL hospedada validada. A escolha de crédito, débito ou outras opções disponíveis ocorre na página do fornecedor, segundo a habilitação da conta.

O projeto não recebe número, validade ou CVV. A tentativa possui referência própria e marca de início do envio para tratar concorrência e resposta incerta. Em timeout, a recuperação deve consultar a tentativa existente, evitando criar cobranças duplicadas por repetição cega.

O retorno do navegador não aprova a venda. A habilitação do método na conta da loja e a operação real precisam ser validadas separadamente dos testes locais com fornecedor substituído.

### 6.5 Webhooks e reconciliação

O webhook valida o segredo recebido e a assinatura do corpo cru. A assinatura, isoladamente, não deve ser tratada como prova suficiente de origem financeira. O backend reconsulta a cobrança na API, confere vínculos, valor e situação e aplica a mudança permitida.

Os eventos possuem persistência e controle de processamento. Uma repetição não deve reaplicar os efeitos. Tarefas de reconciliação recuperam eventos e cobranças conhecidas que ficaram pendentes, sem depender exclusivamente do navegador.

Há um limite explícito: se uma cobrança tiver sido criada externamente sem que seu ID fosse persistido, a recuperação depende dos mecanismos de referência e webhook. Falha permanente desses caminhos exige conferência no painel do fornecedor.

### 6.6 Estorno e cancelamento

Cancelar uma venda paga exige coordenar estado local e resultado financeiro. A solicitação marca a intenção sob transação; a chamada externa ocorre fora dos locks; a conclusão revalida e grava pagamento, cancelamento, histórico e compensação de estoque na transação adequada.

Resposta pendente, parcial ou com vínculo incorreto não comprova devolução integral. A conclusão administrativa também depende de reconsulta financeira, conforme as correções pré-deploy; a descrição de um administrador não substitui essa prova.

Pagamento tardio de venda cancelada ou cobrança duplicada gera tentativa de devolução sem reabrir a compra. Disputa impede avanços logísticos indevidos. Após envio ou entrega, o retorno físico precisa ser tratado antes de considerar reposição automática de mercadoria.

## 7. Entrega, retirada e logística

### 7.1 Regras de atendimento

A retirada permite escolher Centro ou Matosinhos e tem frete zero. A unidade escolhida integra a intenção da compra e é copiada para o pedido. O estoque permanece global; a equipe precisa confirmar disponibilidade na unidade antes de marcar a retirada como pronta.

Peixes vivos são restritos à entrega em São João del-Rei. O backend consulta o CEP e usa o município identificado, incluindo o código IBGE, em vez de confiar no texto da cidade ou em um intervalo numérico presumido. Fora da área permitida, a retirada continua sendo uma alternativa.

### 7.2 Embalagem

O cadastro logístico é separado da ficha técnica e da imagem. Ele informa peso da unidade já embalada, comprimento, largura, altura, prazo de preparação e permissão para envio convencional. Medidas físicas do aquário não substituem automaticamente as da embalagem pronta.

Cada unidade é tratada como um volume separado na cotação documentada. Não há consolidação automática de todo o carrinho em uma caixa. Restrições comerciais de vidro, líquidos e outros materiais precisam estar refletidas no contrato e na permissão de envio.

### 7.3 Cálculo de transporte

O sistema usa tarifas configuráveis, por cobertura, peso e dimensões. Não consulta preços online de uma transportadora contratada. Peso tarifável considera o maior entre peso real e cubado, com fator de cubagem vindo das condições aprovadas. O prazo combina preparação e transporte.

O cliente pode escolher uma modalidade elegível. Ao criar a venda, o servidor recalcula preço e prazo usando dados atuais; serviço ou total incompatível com a cotação anterior pode retornar 409 sem criar a venda.

### 7.4 Condições de produção

Sem `FRETE_TRANSPORTE_JSON` aprovada, as entregas em produção permanecem indisponíveis e a retirada continua possível. Tarifas de demonstração são usadas apenas no ambiente de teste.

O pedido preserva serviço, preço e prazo. O rastreio convencional é informado pela equipe conforme o contrato. A implementação não compra etiquetas nem agenda coleta ou rastreia transportadoras automaticamente.

## 8. Imagens de produtos

O backend administra uma imagem principal por produto, com upload, substituição e remoção. A imagem enviada passa por validação e reencodificação em WebP. O contrato documenta limite de 5 MiB para o arquivo, controle de tamanho do corpo e restrições de processamento.

O formulário de cadastro permite selecionar a foto antes de salvar o produto. O frontend cria o registro e envia a imagem usando o ID retornado. Se o upload falhar, o produto permanece cadastrado e a interface direciona para a edição com uma mensagem para tentar novamente. Na edição, é possível substituir ou remover a foto.

O cadastro comum, a ficha, o estoque e a imagem têm operações próprias. O tratamento de falhas precisa evitar que um arquivo parcial vire imagem publicada ou que uma substituição malsucedida retire a referência válida anterior.

`IMAGENS_DIR` aponta para diretório persistente externo ao build. O Compose de produção monta um volume para as imagens. Limpeza de órfãos consulta referências e coordena operações, com janela de proteção definida no módulo.

Backup precisa incluir PostgreSQL e arquivos. Restaurar apenas o banco não recupera os bytes das imagens. Réplicas que dependem desse armazenamento precisam compartilhar a mesma base e volume; disco local não fornece replicação entre servidores.

## 9. Testes e evidências de qualidade

### 9.1 Estratégia

Os testes de backend cobrem validações, HTTP, autenticação, permissões e regras de domínio. As integrações usam PostgreSQL real em schemas ou bancos descartáveis. Os E2E exercitam a aplicação pelo navegador com API e persistência de teste.

Gateway, e-mail, CEP e tarifas podem ser substituídos por fixtures explícitas para testar cenários de erro e concorrência sem executar operações externas reais. Essa separação precisa constar dos resultados: PostgreSQL real em um teste não implica pagamento real.

### 9.2 Resultados registrados

| Fonte e escopo | Resultado histórico |
| --- | --- |
| Segurança de 26/10 | 471 testes unitários/HTTP e 215 integrações aprovados na revisão registrada |
| Imagem principal de 14/11 | 1.216 unitários/HTTP, 614 integrações PostgreSQL e 27 E2E aprovados na base do incremento |
| Consultas de estoque de 15/11 | 1.318 unitários/HTTP aprovados; integração geral com 620 aprovados e uma falha temporal preexistente; 22 testes específicos de consulta aprovados |
| Saldos de estoque de 15/11 | 1.411 unitários/HTTP e 644 integrações aprovados na rodada registrada |
| Correção de estorno de 15/11 | 1.411 unitários/HTTP e 656 integrações aprovados, com fornecedores controlados |
| Logística de 17/11 | 1.434 unitários/HTTP, 669 integrações PostgreSQL e 32 testes Chromium aprovados na base descrita |
| Revisão de 19/11, snapshot `e7a1589` | 100 testes frontend e 31 E2E aprovados; builds aprovados e quatro erros de lint preexistentes naquela base |

Os resultados correspondem às datas e bases de cada relatório. As contagens são apresentadas por rodada e não constituem um total acumulado nem uma execução na base `50e5924`.

### 9.3 Regressões importantes

As evidências técnicas abordam tentativa de acesso a recurso de outro cliente, revogação de sessão, repetição idempotente, compras concorrentes da última unidade, rollback após falha, expiração, pagamento tardio, estorno, consulta de histórico, indisponibilidade do provedor e persistência de imagem.

### 9.4 Repetição de verificações

Em `backend/`, com dependências instaladas:

```bash
npm run typecheck
npm test
npm run build
```

Com `TEST_DATABASE_URL` previamente definida para PostgreSQL exclusivo e descartável:

```bash
npm run test:integration
```

Em `frontend/`:

```bash
npm test
npm run lint
npm run build
```

E2E exige também PostgreSQL descartável configurado e navegador disponível:

```bash
npm run test:e2e
```

As suítes de integração criam estruturas e dados. A variável `TEST_DATABASE_URL` deve apontar exclusivamente para o banco descartável de testes.

## 10. Execução local, demonstração e implantação

### 10.1 Preparação local

O Dockerfile documentado usa Node 22 e o banco local usa PostgreSQL 17. Para reproduzir o ambiente, usar versões compatíveis com os manifests e a instalação bloqueada pelos lockfiles.

Na raiz do projeto, preparar o backend:

```bash
cd backend
npm ci
cp .env.example .env
```

Preencher o arquivo privado com as configurações locais antes de subir os serviços. `DATABASE_URL` deve corresponder ao usuário, banco, host e senha efetivamente configurados. O pool em `src/config/db.ts` lê a URL validada por `src/config/env.ts`.

No backend, após configurar o ambiente:

```bash
npm run db:up
npm run dev
```

Em outro terminal, a partir da raiz:

```bash
cd frontend
npm ci
npm run dev
```

O padrão é frontend em `http://localhost:5173` e API em `http://localhost:3333/api`. O Vite encaminha as chamadas de `/api`. Alterar a origem exige alinhar a configuração de CORS e sessão.

Banco vazio executa os scripts de inicialização. Banco existente precisa das migrações correspondentes antes de usar funcionalidades novas, conforme cada relatório; não se presume que `db:up` atualize sozinho o schema.

### 10.2 Configurações principais

| Variável ou grupo | Uso |
| --- | --- |
| `DATABASE_URL`, `DB_USER`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT` | Conexão e inicialização do PostgreSQL conforme ambiente |
| `CORS_ORIGIN`, `FRONTEND_URL`, `API_URL` | Origem autorizada e endereços públicos coerentes |
| `GATEWAY_ACCESS_TOKEN`, `GATEWAY_WEBHOOK_SECRET` | Credenciais privadas do gateway e validação de eventos |
| `EMAIL_API_KEY`, `EMAIL_REMETENTE` | Envio de e-mail |
| `IMAGENS_DIR` | Persistência de imagens |
| `FRETE_TRANSPORTE_JSON` | Condições comerciais aprovadas de transporte |
| `FRONTEND_DIST`, `NODE_ENV`, `DOMINIO` | Publicação do frontend e ambiente de execução |
| `VITE_CATALOGO_MOCK` | Catálogo de exemplo no frontend, desligado por padrão |
| `PERMITIR_SIMULACAO_PIX`, `VITE_SIMULACAO_PIX` | Recursos de demonstração, sujeitos às travas do backend |

Os arquivos `.env.example` e `.env.producao.example` são a referência de preenchimento das configurações locais e de produção.

### 10.3 Diagnóstico do catálogo

```bash
curl -i http://localhost:3333/api/health
curl -i 'http://localhost:3333/api/peixes?pagina=1&limite=3'
curl -i 'http://localhost:5173/api/peixes?pagina=1&limite=3'
```

Saúde 200 com banco disponível distingue a API funcional. Conexão recusada ou erro do proxy aponta para serviço ou porta; saúde 503 aponta para indisponibilidade de persistência. Uma resposta 200 com lista vazia pode representar um catálogo sem produtos elegíveis.

Peixes em destaque precisam de produto ativo, categoria correta, ficha e disponibilidade. O seed inicial de categorias não representa um catálogo comercial completo. Corrigir carregamento não exige apagar o banco.

### 10.4 Demonstração

Há dois contextos documentados: uma apresentação local com fluxo comercial em modo Dev e um launcher administrativo isolado que permite demonstrar catálogo e estoque, bloqueando operações comerciais e e-mail. Eles não devem ser tratados como um único ambiente.

O launcher administrativo é iniciado, conforme `backend/docs/demo-admin-2026-11-19.md`, a partir da raiz:

```bash
node backend/scripts/demo-local.mjs preparar
node backend/scripts/demo-local.mjs iniciar
```

O launcher usa banco exclusivo e gera as credenciais em arquivo privado. O roteiro de apresentação comercial está em `backend/docs/apresentacao-local.md`, com suas configurações locais específicas.

### 10.5 Produção

O modelo documentado publica domínio e HTTPS pelo Caddy; aplicação e banco não expõem portas diretamente à internet. Frontend e API compartilham o endereço público para preservar o modelo de sessão. A imagem da aplicação roda com usuário sem privilégios de root.

A implantação requer domínio, servidor, configuração privada, conta recebedora do gateway, provedor de e-mail e persistência. O procedimento detalhado está em `backend/docs/deploy.md`. Ele inclui Docker 28 ou posterior para a configuração de rede descrita, preparação do servidor, DNS, HTTPS, webhook e verificações.

Com esses pré-requisitos concluídos, o comando de publicação documentado, dentro de `backend/`, é:

```bash
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml up -d --build
```

Em banco existente, as migrações devem preceder a atualização da aplicação. Mudanças no Caddy podem exigir recriação específica do serviço conforme o guia.

### 10.6 Backup e manutenção

O plano inclui backup do PostgreSQL, cópia protegida para fora do servidor e teste de restauração. Imagens exigem backup coordenado do volume. Atualização da aplicação deve preservar volumes de dados.

Trocar uma senha no arquivo de ambiente não troca automaticamente a credencial de um PostgreSQL já inicializado. Rotação precisa coordenar banco e aplicação. O webhook definitivo também precisa usar o segredo correto no fornecedor e no backend.

Antes de vendas reais, confirmar recebimento na conta da loja, processamento dos eventos, estado do pedido, e-mail e fluxo financeiro combinado. Testes em Dev não comprovam repasse de dinheiro ou habilitação de cartão em produção.

## 11. Colaboração com Git

### 11.1 Fluxo de contribuição

A equipe utiliza branches por funcionalidade, commits pequenos e pull requests revisados. Novas branches partem da main atualizada, e a integração por revisão preserva a rastreabilidade das mudanças.

Exemplo de início de trabalho, com a árvore local já preparada:

```bash
git switch main
git pull --ff-only
git switch -c feat/nome-da-funcionalidade
```

O padrão de commits relatado segue Conventional Commits, como `feat(home): ...`, `fix(carrinho): ...`, `docs: ...` e `chore: ...`. As descrições de PR devem explicar problema, comportamento resultante, validação e limites relevantes.

### 11.2 Conflitos e preservação

Antes de mudar de branch ou integrar atualizações, a equipe verifica alterações locais com `git status` e `git diff`. A resolução de conflitos considera a versão de origem, os contratos da API e os testes dos módulos envolvidos. Os arquivos são revisados para remover marcadores de conflito antes do commit.

