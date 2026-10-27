# Estado da segurança e revisão do PATCH — 26/10/2026

## Escopo e estado do repositório

Revisão do backend local, código, lockfile e testes. Não é certificação de segurança nem verificação do
ambiente publicado. Estado inicial: branch `branch-backend`, HEAD `80f9ac8`, árvore limpa, índice sem entradas
de conflito e nenhum marcador encontrado no backend/frontend/README. O histórico local mostra o commit de
integração de 25/10 sobre `c1194a6` (um pai), não um merge aberto. O pull anterior é o fast-forward de 24/10;
não houve novo pull nesta rodada. As consultas persistentes, POST e CRUD de categorias já estão nesse commit.
Não foram encontradas decisões novas do outro responsável alterando schema/auth desde o incremento anterior.

Foram relidos SQL, `api.md`, PDF atual (cinco páginas), POST, consultas e guardas. As divergências existentes
de envelope/erros e de baixa de estoque foram preservadas/documentadas; não há decisão silenciosa sobre vendas.
Não houve alteração de schema, dependências, frontend, login, clientes, orçamentos ou vendas. As únicas mudanças
compartilhadas são o parser JSON e o tratamento de seus erros, explicadas abaixo, além da rota do catálogo.

## Controles observados e verificados

| Área | Fato observado | Evidência e limite |
|---|---|---|
| Papel de admin | Vem de `clientes.papel`, não de cookie/body/header. Cadastro insere colunas explícitas e usa default `cliente`. | [cliente.repository.ts:13](../src/modulos/clientes/cliente.repository.ts:13), [10_clientes.sql:29](../db/init/10_clientes.sql:29), [sessao.repository.ts:14](../src/modulos/auth/sessao.repository.ts:14). Integração existente verifica tentativa de cadastro como admin e mudança de papel no banco. Não foi criado outro mecanismo de admin. |
| Sessão | Token aleatório de 32 bytes, hash SHA-256 armazenado; consulta exige sessão não vencida e conta ativa. Papel é lido a cada requisição. | [sessao.ts:3](../src/modulos/auth/sessao.ts:3), [sessao.repository.ts:14](../src/modulos/auth/sessao.repository.ts:14), [autenticar.ts:8](../src/middlewares/autenticar.ts:8). Testes reais: token inválido, vencido, conta inativa, papel rebaixado e sessão removida. |
| Senha/cookie | Argon2id; login cria token novo e não devolve hash. Cookie `HttpOnly`, `SameSite=Lax`, caminho `/`, expiração de sete dias, `Secure` somente em `NODE_ENV=production`. Sem `Domain` explícito. | [senha.ts:3](../src/modulos/clientes/senha.ts:3), [auth.service.ts:94](../src/modulos/auth/auth.service.ts:94), [auth.controller.ts:15](../src/modulos/auth/auth.controller.ts:15). Testes existentes fazem cadastro/login reais e verificam HttpOnly/SameSite; TLS/flags da publicação não foram verificados. |
| Administração do catálogo | Categorias, POST e novo PATCH usam sessão → papel atual admin → Origin exato. | [catalogo.routes.ts:14](../src/routes/catalogo.routes.ts:14), [catalogo.routes.ts:20](../src/routes/catalogo.routes.ts:20), [exigirAdmin.ts:4](../src/middlewares/exigirAdmin.ts:4), [exigirOrigem.ts:5](../src/middlewares/exigirOrigem.ts:5). HTTP/PG comprovam `401`/`403` e nenhuma edição. Não extrapolar essa proteção para outros routers. |
| CORS/CSRF | CORS usa origem fixa e credenciais; Origin é validado separadamente nas escritas do catálogo. | [app.ts:11](../src/app.ts:11), [exigirOrigem.ts:6](../src/middlewares/exigirOrigem.ts:6). CORS controla o navegador, não autentica chamadas e não substitui a checagem CSRF. Cliente HTTP pode informar Origin; ainda precisa de sessão admin. |
| Entrada e SQL do PATCH | Whitelist de campos em todos os níveis, categoria/estoque/ativo/ID/tipo/imagem protegidos; estado final validado; SQL com valores parametrizados e identificadores fechados. | [produto.atualizacao.ts:10](../src/modulos/catalogo/produto.atualizacao.ts:10), [produto.validacao.ts:53](../src/modulos/catalogo/produto.validacao.ts:53), [produto.repository.ts:21](../src/modulos/catalogo/produto.repository.ts:21), [ficha.repository.ts:7](../src/modulos/catalogo/ficha.repository.ts:7). Testes incluem chaves de protótipo, dados inválidos, faixas e tentativas de campos protegidos. Não é uma busca exaustiva por todas as formas de injeção. |
| Transação e concorrência | Lock `FOR NO KEY UPDATE` antes de ler o estado, categoria `FOR SHARE`, apenas campos enviados no SQL, validação e DTO na mesma conexão. | [produto.service.ts:23](../src/modulos/catalogo/produto.service.ts:23), [produto.repository.ts:14](../src/modulos/catalogo/produto.repository.ts:14), [transacao.ts:6](../src/utils/transacao.ts:6). PG real confirma duas edições, faixa alterada concorrentemente, FK de categoria e rollback inclusive do timestamp. Escritores SQL externos sem o protocolo não foram certificados. |
| Respostas/PII | DTOs de catálogo têm projeções explícitas; falhas inesperadas retornam somente mensagem genérica. Cliente/login respondem dados da própria conta, sem hash; router de clientes ainda não implementa uma listagem. | [produto.projecoes.ts:2](../src/modulos/catalogo/produto.projecoes.ts:2), [auth.service.ts:111](../src/modulos/auth/auth.service.ts:111), [cliente.routes.ts:3](../src/modulos/clientes/cliente.routes.ts:3), [errorHandler.ts:25](../src/middlewares/errorHandler.ts:25). A exceção confirmada de PII é orçamentos, abaixo. |

## Falhas confirmadas e prioridades

Prioridades: **P0** corrigir antes de disponibilizar a API; **P1** próxima correção de segurança; **P2** corrigir
com a configuração/observabilidade. A classificação descreve o backend examinado, não comprova incidente real.

### S-01 — P0 / alta — Orçamentos expostos sem autenticação — corrigida em 26/10/2026

- **Arquivo/linha:** [orcamento.routes.ts:7](../src/modulos/orcamentos/orcamento.routes.ts:7),
  [orcamento.controller.ts:10](../src/modulos/orcamentos/orcamento.controller.ts:10),
  [orcamento.service.ts:32](../src/modulos/orcamentos/orcamento.service.ts:32).
- **Como ocorre:** GET público devolve o array inteiro, incluindo nome, telefone, serviço, mensagem, ID e data.
  Qualquer cliente que alcance a API pode ler pedidos de orçamento de outras pessoas; CORS não impede curl
  ou outro servidor de acessar a rota.
- **Evidência:** num processo local isolado, POST de uma fixture fictícia retornou `201`; GET sem cookie
  retornou `200` e a fixture com todos os campos acima. Nenhum dado real foi consultado ou exposto no relatório.
- **Correção sugerida/responsável:** Backend 2 / Celio: proteger GET com sessão/admin, adicionar testes `401`/`403`
  e minimizar/paginar a resposta administrativa. Não foi alterado o módulo do outro responsável.
- **Atualização posterior autorizada:** nesta rodada de correção de orçamentos, POST foi mantido público e
  todos os demais caminhos receberam `autenticar, exigirAdmin`. A lista usa projeção explícita dos dados de
  atendimento e `Cache-Control: no-store`. Visitante/cliente recebem `401`/`403` sem dados pessoais; papel,
  ativo e sessão são reconsultados no banco. Testes HTTP e integração com PostgreSQL cobrem o bloqueio,
  revogação, expiração, erros e criação pública. Detalhe, resposta/edição e exclusão continuam incompletos,
  atrás da guarda, sem implementação de CRUD. Formato legado, paginação, persistência e rate limit permanecem
  pendentes. As afirmações de escopo/verificações do restante deste relatório referem-se à rodada anterior do PATCH.
  Verificação desta correção: typecheck/build/diff passaram; **484 testes HTTP** e **228 testes de integração**
  passaram, sem testes ignorados. Código de catálogo/PATCH e autenticação foi preservado byte a byte em relação
  ao início desta rodada. A proteção de leitura de orçamentos não resolve os demais achados de segurança.

### S-02 — P1 / alta — body-parser vulnerável — mitigado na aplicação, atualização pendente

- **Arquivo/linha:** [package-lock.json:920](../package-lock.json:920),
  [app.ts:13](../src/app.ts:13). Árvore instalada: `express@5.2.1 → body-parser@2.3.0`.
- **Como ocorre:** o alerta GHSA-27r3-jxmh-p828 trata de DoS no processamento de corpos comprimidos antes da
  autenticação/roteamento. O parser anterior usava as opções padrão de descompressão.
- **Evidência:** `npm audit --json` consultou o registro e retornou código **1**, com **1 alerta alto**, nenhum
  crítico. `npm ls body-parser --all` confirmou a versão instalada. O
  [aviso do mantenedor](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
  inclui 2.3.0 entre as versões afetadas e recomenda `inflate: false` como mitigação quando não se usa compressão.
- **Feito nesta tarefa:** parser com `inflate: false`; gzip em PATCH, POST e login retorna `415` antes de acessar
  sessão/banco. Nenhum fluxo do produto exige compressão. A restrição global foi registrada em `api.md`.
  Não se executou um payload de DoS para derrubar o processo nem `npm audit fix`/instalação/atualização.
- **Pendente/responsável:** infraestrutura compartilhada / ambos: atualização controlada para árvore corrigida
  (body-parser 2.4.0 ou superior compatível), lockfile e regressões. O alerta do audit **permanece**; mitigação
  não significa dependência corrigida nem ausência de outros riscos.

### S-03 — P1 / alta — Login/cadastro sem limitação de tentativas na aplicação — pendente

- **Arquivo/linha:** [auth.routes.ts:7](../src/modulos/auth/auth.routes.ts:7),
  [app.ts:11](../src/app.ts:11), [auth.service.ts:97](../src/modulos/auth/auth.service.ts:97).
- **Como ocorre:** não há middleware de rate limit/controle por conta/IP nesse caminho. Requisições repetidas
  podem tentar credenciais e consumir Argon2/consultas. Limite de bytes não limita quantidade de tentativas.
- **Evidência:** inspeção da cadeia completa de middlewares e dependências; chamadas inválidas chegam à
  validação sem limitador. Não se realizou força bruta ou teste de exaustão. Um eventual limitador no proxy
  publicado não foi verificado; o fato confirmado é a ausência no backend.
- **Correção sugerida/responsável:** Backend 2 + infraestrutura: limites por IP/conta, resposta `429` e testes;
  revisar também cadastro e formulário público de orçamentos. Não foi introduzido um mecanismo de auth paralelo.

### S-04 — P1 / média — Logout de sessão documentado, mas ausente — pendente

- **Arquivo/linha:** [auth.routes.ts:7](../src/modulos/auth/auth.routes.ts:7),
  [auth.service.ts:12](../src/modulos/auth/auth.service.ts:12).
- **Como ocorre:** o token tem validade de sete dias e não existe rota de logout que o revogue no banco e limpe
  o cookie. Apagar só o cookie do navegador não invalidaria uma cópia do token. A consulta já respeita remoção
  de sessão e conta inativa; não é correto afirmar que a revogação no banco está quebrada.
- **Evidência:** `POST /api/auth/logout` local retornou `404`; router só cadastra login/cadastro. Integrações
  confirmam que remover a sessão ou mudar papel/ativo no banco afeta a próxima escrita.
- **Correção sugerida/responsável:** Backend 2: implementar logout/revogação usando o mecanismo existente e
  CSRF; documentar expiração/revogação. Recuperação/troca de senha também não estão registradas nesse router.

### S-05 — P2 / baixa — Payload excessivo virava 500 — corrigido

- **Arquivo/linha:** [app.ts:13](../src/app.ts:13), [errorHandler.ts:9](../src/middlewares/errorHandler.ts:9).
- **Como ocorria:** o parser já tinha limite padrão de 102400 bytes, mas o erro de tamanho caía no handler genérico
  e era logado como falha interna. Não havia aceitação ilimitada de corpos JSON.
- **Evidência antes:** PATCH com descrição de 103000 caracteres retornou `500` genérico. **Depois:** testes
  HTTP confirmam `413` sanitizado, sem consulta de sessão/banco e sem log do corpo. Limite agora explícito em
  100 KiB. Erros de codificação comprimida retornam `415`; JSON malformado permanece `400`.
- **Responsável:** Backend 1, ajuste compartilhado diretamente necessário à entrada do PATCH; benefício
  global documentado, sem alterar login ou regras de outros services.

## Riscos que dependem de configuração ou cenário

| ID / prioridade / gravidade | Arquivo/linha e condição | Evidência, recomendação e responsável |
|---|---|---|
| R-01 / P1 / média — CSRF de autenticação | [auth.routes.ts:7](../src/modulos/auth/auth.routes.ts:7), [auth.controller.ts:15](../src/modulos/auth/auth.controller.ts:15): login/cadastro não passam por `exigirOrigem`, embora login altere o cookie. | Origem inválida com corpo inválido chegou à validação (`422`), confirmando ausência do controle. **Isso não prova exploração CSRF em navegador**: JSON estrito, preflight e SameSite afetam o cenário. Aplicar a convenção de Origin no módulo de auth e testar navegador/fluxo real; Backend 2. CORS não deve ser a única defesa. PATCH já exige Origin separadamente. |
| R-02 / P1 / alta se publicado sem HTTPS — cookie/transporte | [auth.controller.ts:17](../src/modulos/auth/auth.controller.ts:17), [server.ts:4](../src/server.ts:4), [env.ts:3](../src/config/env.ts:3): Secure depende de `NODE_ENV=production`; processo não termina TLS. | Código lido; HTTPS, proxy, flags e origem confiável do ambiente publicado não foram examinados. Infraestrutura/ambos: exigir HTTPS, NODE_ENV correto e CORS_ORIGIN exato; testar cookie real na publicação. Não confundir fallback de desenvolvimento com configuração de produção comprovadamente insegura. |
| R-03 / P1 / alta se exposto com defaults — banco | [docker-compose.yml:7](../docker-compose.yml:7), [docker-compose.yml:11](../docker-compose.yml:11), [env.ts:4](../src/config/env.ts:4): credenciais padrão e porta publicada no compose de desenvolvimento. | Exposição real/firewall/usuário de aplicação não verificados. Infraestrutura/ambos: credenciais próprias, bind/rede privada, menor privilégio e separação de usuário de migração. Não foram lidos nem divulgados segredos de `.env`. |
| R-04 / P2 / média — logs sem redação | [errorHandler.ts:25](../src/middlewares/errorHandler.ts:25): erros desconhecidos são passados inteiros a `console.error`. | Falha SQL pode conter detalhes de linha/parâmetros. Respostas HTTP genéricas foram testadas; armazenamento/acesso/retensão dos logs e ocorrência real de PII não foram verificados. Ambos/infra: registrar campos mínimos e redigir dados sensíveis. Não há evidência de senha em texto puro sendo devolvida pela API. |
| R-05 / P1 / média — acúmulo de orçamentos | [orcamento.service.ts:6](../src/modulos/orcamentos/orcamento.service.ts:6), [orcamento.service.ts:28](../src/modulos/orcamentos/orcamento.service.ts:28): array cresce sem teto/expiração e é alimentado publicamente. | Ausência de limite observada no código; consumo/exaustão de memória não provocado. Backend 2: persistência, limites e rate limit do formulário. A exposição da leitura pública (S-01) foi corrigida, sem resolver este risco de acúmulo. |

## Pontos não verificados

- Produção, HTTPS/proxy, valores efetivos de CORS/NODE_ENV/credenciais, configuração de cookies no navegador,
  proteções no gateway e permissões reais do banco. Não foi feito pentest, varredura externa ou teste destrutivo.
- Frontend/XSS, política de conteúdo, cadeia de dependências do frontend, gestão operacional de contas admin,
  segredos, backups e auditoria de acessos. Estão fora da implementação desta rodada.
- A vulnerabilidade do pacote foi confirmada por audit/versão/aviso; o crash não foi reproduzido. Apenas a
  rejeição antecipada de corpos codificados foi testada como mitigação.
- Testes passando verificam cenários definidos, não provam segurança global. O PDF propõe erro `{ erro: codigo,
  mensagem }`; o catálogo preserva o padrão local, sem dados internos. A divergência de estoque PDF × D-16/D-21
  continua pendente para os dois responsáveis, sem implementação de vendas nesta tarefa.

## Verificações e encaminhamento

| Comando | Resultado |
|---|---|
| `npm run typecheck` | Passou |
| `npm test` | 471 testes passaram; nenhum ignorado |
| `TEST_DATABASE_URL=… npm run test:integration` | 215 testes passaram; nenhum ignorado |
| `npm run build` | Passou |
| `git diff --check` | Passou; whitespace dos quatro arquivos novos também conferido |
| `npm audit --json --cache /tmp/aquarilandia-audit-cache` | Código 1: um alerta alto no body-parser; não corrigido no lockfile |

- A integração usa schemas exclusivos em PostgreSQL 17 descartável e limpa fixtures, inclusive os triggers/locks
  que sincronizam concorrência. Inclui todas as suítes anteriores de categorias, consultas e POST de produtos/peixes.
- `npm audit --json --cache /tmp/aquarilandia-audit-cache`: a tentativa no sandbox falhou por DNS; a execução
  autorizada com rede completou com código **1** e um alerta alto. Nada foi atualizado.
- Sondagem anterior à mudança: processo HTTP isolado, memória própria, orçamento sintético, sem cookie,
  sem ler dados de produção; confirmou S-01, S-04, S-05 e a ausência de Origin em auth. Esse processo foi encerrado.
- Ordem sugerida à equipe após a correção de S-01: ambos homologarem atualização de S-02; Backend 2 tratar
  S-03/S-04/R-01; infraestrutura confirmar R-02/R-03 e observabilidade R-04. O PATCH não depende de reimplementar
  autenticação para manter suas proteções.

## Arquivos deste incremento

Criados: `src/modulos/catalogo/produto.atualizacao.ts`, `testes/produto-edicao.test.mjs`,
`testes/integracao/produto-edicao.test.mjs` e este relatório.

Alterados: `src/modulos/catalogo/produto.controller.ts`, `produto.service.ts`, `produto.repository.ts`,
`produto.types.ts`, `ficha.repository.ts`, `src/routes/catalogo.routes.ts`, `src/app.ts`,
`src/middlewares/errorHandler.ts`, `api.md`, `docs/decisoes.md`, `testes/README.md` e `README.md` da raiz.
Nenhum arquivo de implementação de auth/clientes/orçamentos/vendas, SQL fonte, package/lockfile ou frontend
foi alterado. O helper transacional e as guardas existentes foram reutilizados sem edição. Sem commit.
