# Atualização controlada de body-parser — 29/10/2026

## 1. Estado inicial e causa do alerta

- Repositório real: `/home/mateus/Projetos/Aquarilandia`; o caminho antigo com outro nível `Aquarilandia/`
  não existe. Nenhum `AGENTS.md` encontrado no projeto ou nos diretórios ancestrais examinados.
- `branch-backend`, HEAD e `origin/branch-backend` em `785f107302090b6bab9c7981f3364b9b4eea431e`;
  árvore e índice limpos, sem operação de merge/rebase aberta ou entradas não resolvidas.
  Não havia alterações locais de nenhum responsável a combinar nesta rodada.
- Node `22.23.3`, npm `10.9.9`, Express `5.2.1`. `body-parser` é **transitivo**, fornecido por Express;
  não consta nas dependências diretas de [package.json](../package.json:18).
  `npm ls body-parser` confirmou `express@5.2.1 → body-parser@2.3.0` instalado e no lockfile.
- O único parser de aplicação é [express.json em app.ts](../src/app.ts:13), antes de cookie/sessão/rotas,
  com limite `100kb` (102400 bytes) e `inflate: false`. Não há parser urlencoded, raw ou multipart instalado
  na cadeia da aplicação. Ter o pacote instalado não significa que todos os parsers dele sejam usados.
- O [aviso oficial GHSA-27r3-jxmh-p828](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
  afeta `>=2.0.0 <2.4.0` e recomenda `2.4.0` nesta linha. A falha de DoS envolve bytes posteriores a um
  corpo comprimido e pode ocorrer antes da autorização. A mitigação `inflate: false` já existia, mas não
  removia a versão vulnerável do lockfile.
- O audit atual anterior à atualização encontrou **2 alertas**: alto em body-parser e moderado em qs.
  Isso atualiza a informação do relatório de 26/10, que registrava somente um alerta naquela consulta.

## 2. Alterações e compatibilidade

| Pacote | Antes | Depois | Motivo |
|---|---|---|---|
| body-parser | 2.3.0 | 2.4.0 | Versão corrigida do aviso oficial |
| qs | 6.16.0 | 6.17.1 | body-parser 2.4.0 exige `^6.16.1`; resolução compatível com main |
| Express / Node | 5.2.1 / 22.23.3 | Preservados | Nenhum upgrade de framework/runtime necessário |

O requisito de Node do body-parser 2.4.0 é `>=18`; Express instalado também exige `>=18` e aceita
body-parser `^2.2.1`. Node 22 satisfaz ambos. O registro npm foi consultado para versão, engines,
dependências e integridade. A comparação estrutural do lockfile confirma que **somente os dois pacotes
acima mudaram**. As demais exigências de content-type/iconv-lite já estavam satisfeitas por versões
instaladas; não exigiram outra atualização. `package.json` permanece byte a byte igual ao inicial,
sem dependência direta artificial ou override.

`npm update body-parser --package-lock-only` gerou a resolução. Foram removidos apenas dois novos campos
opcionais de metadados `license`, adicionados pelo npm aos blocos atualizados, para manter o formato
existente e os blocos exatamente iguais aos de `origin/main`. Isso eliminou o conflito textual de lockfile
observado na primeira simulação, sem mudar resolução/integridade. `npm ci` passou novamente com esse
lockfile final, que permaneceu inalterado durante a instalação.

| Arquivo alterado/criado | Alteração |
|---|---|
| [package-lock.json](../package-lock.json:920) | Duas resoluções transitivas, URLs, integridades e requisitos do parser |
| [src/app.ts](../src/app.ts:12) | Apenas comentário atualizado; opções e ordem dos middlewares preservadas |
| [testes/parser-json.test.mjs](../testes/parser-json.test.mjs:1) | 20 regressões HTTP adicionais |
| [testes/README.md](../testes/README.md:36) | Cobertura nova e limite do teste simulado de login |
| [api.md](../api.md:631) | Registro da correção sem mudar o contrato de corpos/erros |
| [seguranca-backend-2026-10-26.md](seguranca-backend-2026-10-26.md:58) | S-02 encerrado, preservando o histórico da auditoria |
| Este relatório | Evidências, comparação remota e limitações |

## 3. Impacto nos módulos

- **Backend 1:** 484 testes HTTP anteriores continuaram passando após a atualização. A suíte final tem
  504 testes aprovados, incluindo categorias, listagem/detalhes/filtros de produtos e peixes, POST e PATCH,
  permissões, Origin, transações simuladas e respostas de erro. Não houve alteração de DTO/rota/SQL/schema.
- **Parser compartilhado:** exatamente 102400 bytes são aceitos e 102401 são rejeitados com `413`, inclusive
  quando caracteres UTF-8 ocupam mais de um byte. JSON com gzip/deflate/Brotli retorna `415`; identity sem
  compressão continua aceito. JSON malformado mantém `400`. Respostas preservam `{ erro: mensagem }`, sem
  corpo interno nem logs nos erros tratados, antes de sessão/banco. O [errorHandler](../src/middlewares/errorHandler.ts:8)
  não precisou mudar. Erros do parser podem preceder `401`, como já documentado.
- **Backend 2:** POST público de orçamento continua `201`; leitura administrativa mantém `401`/`403`,
  projeção e no-store conforme os testes existentes. Login mantém corpo/DTO/cookie HttpOnly/SameSite/Path
  e Secure conforme NODE_ENV no teste HTTP com service simulado. Cookies, CORS com credenciais, autorização
  e Origin não foram alterados. Não se substituiu autorização/CSRF por CORS.
- **Tipos de corpo:** JSON UTF-8 segue o fluxo atual. `text/plain` e `application/x-www-form-urlencoded`
  não passaram a ser interpretados como JSON; no POST de orçamento retornam a validação existente `422`.
  Não foi criado um `415` global para todos os tipos de conteúdo nem suporte a uploads.
- **Frontend:** nenhuma mudança de contrato ou de arquivos. Nesta branch, o código examinado ainda usa dados
  locais; os services da `origin/main` usam mocks e documentam a futura integração. Não foi feita homologação
  de navegador nem build do frontend. Preflight CORS e cabeçalhos de credenciais foram testados via HTTP.
- Routers de vendas/frete/pagamentos desta branch ainda estão vazios. Não se inventa um fluxo de venda testado.
  Autenticação/sessões e catálogo com PostgreSQL real permanecem sem revalidação nesta rodada, pela limitação abaixo.

## 4. Comparação das branches e conflitos

`git fetch origin` foi executado antes e depois, sem merge, rebase ou push. Referências verificadas:

| Referência | Commit | Resultado da simulação de conteúdo final |
|---|---|---|
| origin/branch-backend | 785f107 | Nenhum conflito; mesma base da branch local |
| origin/main | 8f339d0 | Conflito preexistente apenas em `backend/http/clientes-vendas.http` |
| origin/branch-backend-2 | b49ffe5 | Mesmo conflito dos exemplos HTTP |

Antes das alterações, `git merge-tree --write-tree --name-only HEAD <referência>` foi executado com objetos
temporários em `/tmp`, sem tocar no índice/árvore reais. Confirmou o conflito HTTP com main/Backend 2.
Para incluir alterações ainda sem commit, a comparação final usa uma árvore/índice temporários e
`git merge-file -p --diff3` nos arquivos alterados dos dois lados, com a base comum real `76d13d4`.
Nenhum commit, nem temporário, foi criado. Os resultados intermediários estão em
`/tmp/aquarilandia-body-parser-20261029/` (evidência da sessão, não arquivos de projeto).

- **Lockfile:** main/Backend 2 já têm body-parser 2.4.0 e qs 6.17.1, além de express-rate-limit e ip-address.
  Os blocos dos dois pacotes corrigidos agora coincidem exatamente; a simulação preserva as dependências
  adicionais remotas, sem adicioná-las nesta branch. O conflito inicial por metadados foi resolvido aqui.
- **Exemplos HTTP:** [arquivo local](../http/clientes-vendas.http:219) termina junto do exemplo comentado
  `/auth/teste-sessao`; a versão remota acrescenta o bloco de testes de rate limit depois dessa linha
  (`origin/main:backend/http/clientes-vendas.http:213`). Não é um conflito ativo no índice local. Recomendação
  para a integração: manter os exemplos locais de orçamentos com admin, o teste de sessão antigo comentado
  e os exemplos novos de rate limit, somente junto das rotas remotas correspondentes. Arquivo preservado
  nesta tarefa, sem antecipar rate limiting/logout ou sobrescrever o trabalho de auth.
- **Incompatibilidades que um merge automático não comprova:** main adiciona logout/sessão e limitadores
  de 5 requisições em login/cadastro; há novos `429` e estado por IP a considerar na homologação conjunta.
  `origin/main:backend/src/app.ts:10` também configura `trust proxy=1` em produção, dependente da topologia
  real do proxy. Os testes atuais não homologam essas funcionalidades remotas ainda não integradas.
- O diff direto de main mostra parser padrão e ausência das proteções recentes do PATCH/orçamentos,
  porque essas alterações locais ainda não estão integradas lá. Isso **não prova remoção num merge**:
  a simulação em três vias preserva `limit`, `inflate: false`, `413`/`415`, PATCH e guarda de orçamentos,
  junto das adições remotas de autenticação. Evitar escolher um arquivo inteiro com ours/theirs.
- Não houve conflito de schema nem alteração dos middlewares de sessão/admin/Origin nesta correção.
  A simulação é de conteúdo nas referências indicadas, não garantia de merge futuro ou de comportamento
  em produção. Nenhum resultado hipotético foi aplicado ao projeto.

## 5. Comandos e resultados

Executados em `backend/`, salvo Git e diagnóstico Docker:

| Comando | Resultado |
|---|---|
| `git status --short --branch`, `git log`, `git ls-files -u` | Estado inicial limpo; sem conflito ativo |
| `git fetch origin` (antes/depois) | Passou; referências acima confirmadas |
| `npm ls body-parser` / `npm ls body-parser --all` | Antes 2.3.0; final somente body-parser 2.4.0 via Express 5.2.1 |
| `npm view body-parser@2.4.0 version engines dependencies dist.integrity --json` | Confirmados metadados oficiais do registro |
| `npm audit --json` antes | Código 1: 1 alerta alto + 1 moderado |
| `npm update body-parser --package-lock-only --ignore-scripts --no-audit --no-fund` | Apenas body-parser e qs alterados |
| `npm ci --no-audit --no-fund` | Passou, inclusive com o lockfile final; 117 pacotes instalados |
| `npm ls --all --json` | Passou; árvore instalada sem dependência inválida |
| `npm run typecheck` | Passou |
| `npm test` | **504 testes passaram, 10 suítes, zero falhas/ignorados** |
| `npm run test:integration` | Código 0, mas **9 suítes explicitamente SKIP; zero testes reais executados** |
| `docker info --format '{{.ServerVersion}}'` | Código 1: Docker indisponível na distro WSL; integração WSL desativada |
| `npm run build` | Passou |
| `npm audit --json` final | **Código 0: zero vulnerabilidades**, incluindo nenhum alerta alto/crítico |
| `git diff --check` e checagem com índice temporário incluindo novos arquivos | Passaram |

As consultas npm usaram `--fetch-retries=0 --fetch-timeout=15000` e cache de tarefa em `/tmp` quando
necessário. Consultas iniciais ao npm no sandbox falharam por DNS; a sondagem HTTP inicial também falhou,
sem diagnóstico detalhado. A suíte HTTP completa e as consultas de rede foram repetidas fora do sandbox. Não se tratou uma tentativa incompleta como
aprovação. Não houve `npm audit fix`, instalação global, upgrade geral ou alteração de versões para ocultar erros.

## 6. Pendências e riscos restantes

- Reexecutar a integração real com PostgreSQL descartável após habilitar Docker/WSL ou configurar
  `TEST_DATABASE_URL` de testes. Não foi usado o banco do projeto nem instalado outro servidor.
- Resolver o conflito de exemplos HTTP no momento da integração com main e homologar conjuntamente
  auth/rate limit/logout e proxy. Não foram trazidas essas funcionalidades para esta tarefa.
- Os demais achados do relatório de 26/10 continuam com seus respectivos responsáveis; correção de
  dependência não certifica segurança global nem substitui testes no ambiente publicado. O audit expressa
  os avisos conhecidos pelo registro no momento da consulta, sem garantir ausência de falhas desconhecidas.
- Nenhum frontend, CRUD adicional, estoque, imagens ou vendas implementado. Nenhum deploy foi realizado.

**Conclusão limitada às evidências:** instalado e lockfile contêm body-parser 2.4.0, não 2.3.0; o alerta
foi removido da árvore final e as proteções existentes foram mantidas. A integração real não foi aprovada.

## 7. Estado final do Git

HEAD continua `785f107`; índice real sem alterações staged. Nenhum commit ou push foi feito.

```text
## branch-backend...origin/branch-backend
 M backend/api.md
 M backend/docs/seguranca-backend-2026-10-26.md
 M backend/package-lock.json
 M backend/src/app.ts
 M backend/testes/README.md
?? backend/docs/atualizacao-body-parser-2026-10-29.md
?? backend/testes/parser-json.test.mjs
```

## Homologação posterior — 30/10/2026

As limitações acima descrevem a execução de 29/10. Na rodada seguinte, Docker voltou a ficar disponível.
Foi criada uma instância PostgreSQL 17 descartável em tmpfs, sem volumes/dados do projeto, com porta
aleatória restrita a 127.0.0.1. Antes de implementar DELETE, as **9 suítes executaram 228 testes reais:
228 passaram, zero ignorados/falhas**. Body-parser instalado e lockfile continuaram em 2.4.0; audit zerado.
As versões/lockfile desta correção não foram alterados de novo. Houve nova comparação remota, pois as branches
avançaram. Resultados finais e separação dos incrementos no
[relatório de homologação e DELETE](homologacao-delete-produtos-2026-10-30.md).
