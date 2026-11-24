# Painel administrativo e catálogo da demo — 19/11/2026

**Entrega local, sem commit, push, merge ou deploy.** Fluxo homologado: login real de admin → cadastro de
produto/ficha → entrada rastreável → catálogo público → adicionar/remover do carrinho. A entrega termina no
carrinho. O banco habitual do projeto não foi acessado ou modificado.

## 1. Causas reproduzidas e correções

| Sintoma na base e7a1589 | Reprodução e causa | Resultado desta tarefa |
|---|---|---|
| “Olá, Administrador”, mas sessão não reconhecida em Peixes e produtos | Formulário usava `services/conta.js` simulado: e-mail de exemplo virava admin em sessionStorage, sem `POST /api/auth/login`. `GET /api/produtos?pagina=1&limite=20&incluir_inativos=true` retornou **401**. | Login/logout/sessão reais; usuário/papel vêm da API. Recarregar abas restaura o cookie válido. Storage forjado não autoriza. |
| Pedidos cai no erro genérico e sugere esvaziar carrinho | `pages/admin/AdminPedidosPage.jsx` estava **vazio**; `App.jsx` tentava importá-lo via React.lazy. Chromium/Vite registrou `TypeError: Cannot convert object to primitive value` durante lazyInitializer. **Não havia requisição de listagem de vendas nem resposta HTTP causadora deste erro.** | Componente exportado, consulta real `GET /api/vendas?pagina=1&limite=20`, filtro `status`, paginação do servidor; vazio/rede/formato inválido tratados dentro da seção. Carrinho não é alterado. |
| Formulário real recusaria cadastro/edição depois de corrigir sessão | Enviava `imagemUrl`, que POST/PATCH recusam; PATCH também enviava `ficha.tipo`. Ficha de peixe oferecia campo desconhecido e não marcava temperatura/pH obrigatórios. | POST usa categoria numérica, centavos e `{tipo,dados}`; PATCH usa campos editáveis e `{dados}`. Sem URL de imagem no body; placeholder preservado. Campos/enums/obrigatórios das fichas alinhados ao schema. Erros `ficha.dados.*` aparecem no campo correspondente. |
| Cabeçalho da listagem conserva “Carregando…” em falha | Contagem dependia apenas da presença de dados, inclusive depois do erro. | Loading termina e vira “Consulta indisponível.” com retry e tratamento de acesso. |
| Aviso dizia que o servidor não possui estoque | API de movimentos já existia; faltava a ação na tela. | “Dar entrada no estoque”: quantidade/motivo, consulta de saldo, UUID por intenção e POST existente. Saldo é reconsultado após sucesso; nenhum PATCH de unidades. |

Evidências defensivas iniciais: `evidencias/reproducao-inicial.json`, `antes-catalogo.png` e `antes-pedidos.png`
em `/tmp/aquarilandia-demo-admin-20261119-of72xpbm/`. Usaram PG descartável e dados fictícios, sem credenciais
nos registros. O relatório de revisão anterior foi preservado como registro da base examinada naquela rodada.

## 2. Integração e segurança preservadas

- Reaproveitados seletivamente de **origin/branch-backend-2@1965fec**: `services/api.js`, `services/conta.js`,
  `AuthProvider`, guardas de carregamento nos layouts Admin/Conta, redefinição com token, hook de pedidos novos
  e correção das chaves duplicadas de status. Não foi feito merge global nem importado checkout/gateway/logística.
- Adaptados para a main: validação do usuário retornado; respostas antigas ignoradas; revalidação de sessão ao
  voltar à aba e após403;401 privado limpa o estado e oferece novo login. Falha500 não exibe detalhes internos.
  Cadastro atual retorna201 sem sessão; cadastro B2 retorna202 genérico. Ambos levam ao login, sem autologin falso.
- Chamadas privadas usam URL relativa `/api`, `credentials:include`, `cache:no-store` e timeout. Na demo, página
  e API são a mesma origem **http://127.0.0.1:4173**; não misturar com localhost/5173. Origin é o do navegador.
  Middleware/CORS/cookie do backend não foram relaxados. Cookie real conferido como HttpOnly e SameSite=Lax;
  Secure permanece condicionado a produção. A demo HTTP usa NODE_ENV=test.
- Autenticação, papel atual, Origin e SQL permanecem no servidor. Foram confirmados401 sem sessão,403 para
  cliente e403 com Origin não permitido, além da mudança de papel e revogação de sessão. Nenhuma guarda foi removida.
- Entrada usa `POST /api/estoque/movimentacoes`, body `{produtoId,tipo:"entrada",quantidade,motivo}` e
  `Idempotency-Key`. Não envia autor, saldo absoluto ou preço. Em rede/5xx, mantém corpo/chave da intenção em
  sessionStorage por admin/produto, inclusive após reload; nova tentativa não soma unidades novamente.
  A chave e o saldo não são autorização. Recusas4xx permitem corrigir o formulário; resposta de estoque inválida
  não é anunciada como sucesso. Se o armazenamento do navegador for bloqueado/limpo, não há persistência da
  intenção entre recargas; confira saldo/histórico antes de iniciar outra operação.
- Pedidos é **consulta apenas**, inclusive o detalhe. Nenhum botão de simular Pix, alterar pagamento, concluir
  estorno ou editar entrega foi importado. O DTO de lista é `{dados,total,pagina,limite}`; itens possuem
  `id,status,tipoEntrega,total,clienteNome,quantidadeItens,criadoEm`, com total em centavos. Não se busca todas
  as páginas para filtrar localmente. Não foi acrescentada busca por nome, que esta API não oferece.
- O launcher local bloqueia criação/cancelamento de vendas, cobranças e rotas de e-mail, limpa chaves de
  provedores do ambiente dos filhos e não inicia workers. Isso é proteção **da demo**, não uma mudança das
  permissões ou política financeira da aplicação normal.

Fontes principais: `frontend/src/services/{api,conta,admin,admin-pedidos,estoque}.js`,
`context/AuthProvider.jsx`, `pages/admin/*`, `components/organisms/EntradaEstoqueDialog.jsx`.
A proteção e os contratos existentes estão em `backend/src/modulos/auth/`, `middlewares/`,
`modulos/estoque/` e `backend/api.md`. Esses fontes de produção do backend não foram alterados.

## 3. Demo preparada e como usar

Banco exclusivo identificado: container **aquarilandia-demo-admin-1000**, PostgreSQL17, banco `aquarilandia_demo`.
A aplicação é restrita ao loopback. Admin provisionado com o mecanismo existente `scripts/criar-admin.ts`;
sem senha fixa no código, na linha de comando ou no relatório. Acesso fica no arquivo privado:

`/tmp/aquarilandia-demo-admin-1000/acesso-admin.json`

Abra esse arquivo **no editor** e use seus campos no login; não o versione nem compartilhe. Diretório700 e
arquivos600. Senha aleatória é gerada na primeira preparação; reexecução mantém o acesso existente. Para a
primeira preparação em outra máquina, EMAIL_ADMIN/SENHA_ADMIN podem ser fornecidos por ambiente, sem `--senha`.

Na raiz real do projeto, com Docker local e dependências já instaladas:

```bash
cd /home/mateus/Projetos/Aquarilandia
node backend/scripts/demo-local.mjs preparar
node backend/scripts/demo-local.mjs iniciar
```

O primeiro comando só inicializa o banco vazio **identificado como demo** e o admin. Recusa adotar container/banco
alheio; nunca lê `.env` do projeto nem usa DATABASE_URL herdada. Reexecutado, não reseta dados nem carrega produtos
por SQL. O segundo executa os builds e serve frontend/API juntos em **http://127.0.0.1:4173/entrar**.
Se essa demo já estiver rodando, abra o endereço; não inicie outra instância na mesma porta. Em outra porta livre:
`PORTA_DEMO=4175 node backend/scripts/demo-local.mjs iniciar` — a origem é ajustada junto.

Passo a passo na interface:

1. Entre com o acesso privado. Abra **Pedidos**: deve aparecer a lista vazia real. Recarregue; a sessão deve continuar.
2. Abra **Peixes e produtos → Novo item**. Categoria Peixes; nome fictício; preço em reais, como19,90. Nome científico
   **diferente dos existentes**, água doce, tamanho adulto5cm, aquário mínimo40L, pacífico, iniciante,
   temperatura mínima24/máxima28°C e pH mínimo6/máximo7. Cadastre: o backend recebe1990 centavos e estoque zero.
3. Na linha criada, **Dar entrada no estoque**. Digite quantidade inteira positiva e motivo fictício; confirme.
   Confira a mensagem de saldo e conclua. Não altere unidades pelo formulário de edição do produto.
4. Abra a loja/detalhe: produto disponível com placeholder. Os peixes elegíveis podem aparecer nos destaques,
   respeitando a ordenação e o limite atual de três; nenhum destaque foi fixado.
5. Saia do admin e use uma janela anônima. Adicione um peixe e um acessório ao carrinho, confira preços/quantidades
   e total; remova um, confira o total menor, remova o outro e confira o estado vazio. **Pare no carrinho.**
6. Depois de sair, URLs administrativas levam ao login; cliente comum não recebe permissão administrativa.

Três itens foram cadastrados **pela interface**, com entradas pela API, no banco exclusivo:

| ID | Produto fictício | Categoria | Preço | Entrada/saldo |
|---|---|---|---|---|
| 1 | Demo Peixe Aurora | peixes, com ficha | R$19,90 | 8 |
| 2 | Demo Peixe Coral | peixes, com ficha | R$24,50 | 8 |
| 3 | Demo Acessório Azul | acessorios, sem ficha especializada | R$12,35 | 5 |

O ensaio de visitante adicionou1 Aurora +1 Acessório: **R$32,25**; depois da primeira remoção, R$12,35; ao final,
carrinho vazio. Saldos permaneceram8/8/5. Reexecução do ensaio reaproveitou os itens existentes sem novas entradas.
Pedido real não foi criado: a aba mostra o vazio do banco exclusivo. Não houve cobrança, estorno ou e-mail real.

Ctrl+C encerra o site iniciado no seu terminal. Para parar somente o banco exclusivo, preservando dados:
`node backend/scripts/demo-local.mjs parar`. O estado privado usa `/tmp`; não é provisionamento permanente de
homologação/produção e pode desaparecer na limpeza/reinicialização da máquina. Não apagar o estado nem os containers
para tentar reparar banco do projeto. A pasta privada não é servida pelo HTTP.

## 4. Verificações e evidências

Todas as execuções usaram cópia isolada de fontes e dependências existentes. Nenhum npm install/audit fix,
lockfile ou versão alterado. Banco de testes separado: `aquarilandia-admin-testes-20261119`, tmpfs/porta62345;
suítes usam schemas próprios. O banco da demo acima foi mantido para uso, sem dados da loja.

| Comando/verificação | Resultado |
|---|---|
| Backend `npm run typecheck` / `npm run build` | Passaram |
| Backend `npm test` | **1.411 passaram**, zero ignorados |
| Backend `TEST_DATABASE_URL=<descartável> npm run test:integration` | **656 passaram**, zero ignorados |
| Frontend `npm test` | **110 passaram**, zero ignorados;10 novos casos de API/contratos |
| Frontend `npm run lint` | Passou, zero erros/avisos;4 erros anteriores corrigidos pelas partes compatíveis de B2 |
| Frontend `npm run build` | Passou; aviso de chunk maior que500kB permanece |
| Frontend `TEST_DATABASE_URL=<descartável> npm run test:e2e` | **36 passaram**, zero ignorados;31 anteriores+5 novos |
| E2E administrativos após ajuste final do handler para lint | **5 passaram**, revalidando o formulário final |
| `node --check backend/scripts/demo-local.mjs` | Passou |
| Launcher preparar/reexecutar/iniciar + ensaio de navegador no build servido pelo Express | Passaram;3 itens preparados, sessão/restauração, Pedidos vazio, estoque e carrinho reais |
| `git diff --check` e whitespace de arquivos novos | Passaram |

Os5 E2E novos cobrem sessão/cookie, reload, storage forjado, cliente/visitante, Origin, mudança/revogação de papel,
cadastro de dois peixes/produto, PATCH com ficha, erros por campo, estoque/idempotência após resposta perdida e reload,
lista vazia/falha de rede/formato inesperado de Pedidos e carrinho sem baixa de estoque. As falhas artificiais usam
interceptação só para testar erro/resposta perdida; o aceite positivo usa API/PostgreSQL reais. A listagem populada/
paginação administrativa também permanece coberta nas integrações backend; a demo não inventou pedidos.

Tentativas auxiliares falharam por seletores excessivamente exatos, tempo insuficiente para a sequência longa e
nome científico duplicado entre fixtures. Foram corrigidos os testes; o fluxo final passou. O último ajuste de
handler apenas deslocou a criação do submit para o evento, mantendo a referência da intenção fora do render e
zerando o erro de lint. Erros SQL42703/42P01 no E2E da vitrine são falhas deliberadas, não regressões espontâneas.

Logs, comparações e capturas temporárias: `/tmp/aquarilandia-demo-admin-20261119-of72xpbm/evidencias/`.
`demo-resultado.json`, `demo-pedidos.png`, `demo-catalogo-admin.png` e `demo-carrinho-mobile.png` documentam o ensaio.
Não foram feitos gateway/e-mail reais, carga, auditoria completa de acessibilidade ou homologação de produção.
Backend não tem script lint; frontend não tem typecheck separado configurado. Nenhuma auditoria nova de dependências
foi executada: versões não mudaram; alertas e riscos financeiros anteriores não são considerados resolvidos.

## 5. Git, arquivos e integração futura

Base/HEAD: **branch-backend@e7a15897d168cbc5d86244e2d949e91965269cea**, igual a origin/main. Fetch final confirmou
origin/branch-backend@167b7d4 e origin/branch-backend-2@1965fec, divergência main…B2 **6/1**. A branch local
continua10 commits adiante do upstream B1. Inicialmente havia somente a revisão anterior não rastreada; ela foi
preservada byte a byte. Nenhum conflito ativo ou arquivo staged; mudanças desta tarefa continuam locais.

Arquivos alterados/adicionados, agrupados:

- Sessão: `frontend/src/services/{api,conta,admin}.js`, `context/AuthProvider.jsx`,
  `components/templates/{AdminLayout,ContaLayout}.jsx`, `pages/conta/{Entrar,CriarConta,RedefinirSenha}Page.jsx`.
- Catálogo/estoque: `pages/admin/{AdminProdutos,AdminItemForm}Page.jsx`, `data/fichas-admin.js`,
  `services/estoque.js`, `components/organisms/EntradaEstoqueDialog.jsx`, `components/molecules/ErroAdmin.jsx`.
- Pedidos somente leitura: `services/admin-pedidos.js`, `pages/admin/{AdminPedidos,AdminPedidoDetalhe,AdminInicio}Page.jsx`,
  `hooks/usePedidosNovos.js`, `utils/statusPedido.js`.
- Testes: `frontend/testes/admin-api.test.mjs`, `testes/e2e/{admin-sistema.mjs,admin-demo.spec.mjs,sistema.mjs}`.
  O harness reserva as portas antes de importar app/env para usar o Origin correto nas escritas reais.
- Demo/documentação: `backend/scripts/demo-local.mjs`, `README.md`, este relatório. **28 arquivos nesta entrega**.
  Nenhum schema, produção backend, package.json/lockfile ou fluxo de vendas foi alterado.

Comparação de três vias **por arquivo, com git merge-file em cópias temporárias**, base comum87651de,
sem executar merge no repositório: a main coincide com a base de trabalho, mas a futura integração com B2 tem
**11 arquivos com conflitos textuais potenciais**. Três já existiam: `services/frete.js`,
`pages/checkout/RetornoPagamentoPage.jsx`, `pages/PoliticaPage.jsx`. Oito sobreposições desta tarefa:

| Arquivo frontend | Resolução recomendada quando integrar B2 |
|---|---|
| `context/AuthProvider.jsx` | Combinar sessão real de B2 com invalidação de respostas antigas e estados de revalidação/erro desta tarefa. |
| `services/api.js`, `services/conta.js` | Conciliar adição do helper com validação de DTO,401/403 e erros genéricos; manter os contratos reais. |
| `pages/conta/CriarContaPage.jsx` | Preservar mensagem202 de B2 e redirecionamento ao login; não restaurar autologin simulado; fallback201 é compatibilidade com a base atual. |
| `pages/admin/AdminPedidosPage.jsx`, `services/admin-pedidos.js` | Manter paginação/filtro do servidor e validação da lista; esta tarefa não importa ações financeiras de B2 nem seu download de todas as páginas. |
| `pages/admin/AdminPedidoDetalhePage.jsx` | Nossa entrega é leitura; B2 possui ações reais. Liberá-las somente no ciclo financeiro aprovado, sem apagar silenciosamente o trabalho remoto. |
| `testes/e2e/sistema.mjs` | Combinar schemas/fixtures novos de B2 com a inicialização por Origin real e os testes administrativos desta entrega. |

Não há prova de compatibilidade do conjunto B2+estas mudanças: ele **não foi integrado/testado como conjunto**.
A simulação registra sobreposições, não garante merge futuro. Evidência: `comparacao-branches.json` e
`evidencias/conflitos/`. A próxima integração deve partir de refs novamente atualizadas e preservar os dois lados.

## 6. Pendências

- A correção financeira adicional de B2 e a integração de checkout/logística continuam fora do escopo; não usar
  esta demo como aprovação de vendas, pagamentos, estornos ou segurança comercial.
- O cabeçalho em320px, foco do carrossel e VLibras/CSP da revisão anterior não foram corrigidos por esta tarefa.
  O modal novo usa diálogo rotulado, campos associados e mensagens de status/erro; não é certificação WCAG AA.
- Ajustes negativos/saída, upload de imagem e gestão de pedidos não foram acrescentados ao painel. Placeholder é
  intencional. O contador de novos considera a primeira página de100, não uma auditoria completa da fila.
- As demais etapas do checkout ainda contêm simulação nesta base. Para o ensaio aqui documentado, pare no carrinho.

O Git não recebeu commit/push/merge/rebase/reset; os dados exclusivos da demo e seu acesso privado ficam fora do Git.
