# Imagem principal de produtos — implementação e homologação

**14/11/2026. Incremento funcional concluído em worktree isolada, sem commit, push ou deploy.**
Uma imagem principal por produto: upload, substituição e remoção administrativos; consultas públicas preservadas.
As referências novas usam WebP reencodado e URL versionada. Nenhum fluxo financeiro ou de estoque foi modificado.

## 1. Base utilizada e alterações anteriores preservadas

| Referência | Estado verificado, inclusive após fetch final |
|---|---|
| Repositório original real | `/home/mateus/Projetos/Aquarilandia`; o caminho duplicado do ambiente não existe |
| Original / `origin/branch-backend` | `branch-backend`, `3b8e1b5b02c908f53a2e1242263fcf490fa255f2`, inicialmente limpo |
| Base desta entrega / `origin/main` | `c6617e33892645f5d44ae06b2fddeeca61766df9`, merge PR43; árvore idêntica a `3b8e1b5` |
| `origin/branch-backend-2` | `7e9b6fd22556bd194588dc50b221079bfab15bfa`, ancestral da base; HEAD…B2 = 3/0 |
| Worktree B1 anterior | `/tmp/aquarilandia-backend1-consolidado-20261114`, `integracao/backend1-pos-pulls-20261114`, HEAD `d37d6be`, continua com alterações locais |
| Worktree combinada anterior | `/tmp/aquarilandia-consolidada-20261114`, `integracao/consolidacao-20261114`, HEAD `7e9b6fd`, continua com alterações locais, inclusive pagamentos |

A consolidação B1 de código já entrou na base por `3b8e1b5`. Não reapliquei os trechos de vendas. Preservei nesta
entrega somente os complementos documentais B1 ainda ausentes (`api.md`, decisões, README de testes e relatório
`consolidacao-backend1-2026-11-14.md`). Esse relatório é histórico e seus números não substituem os desta rodada.
A correção financeira existente somente na worktree combinada não foi transportada.

Foram lidos contratos, decisões, schema, catálogo/DTOs, consumidores, sessão/admin/Origin, parsers, CSP,
Dockerfile/compose e testes. Não foi encontrado AGENTS.md aplicável nem implementação prévia de upload.
`imagem_url` já existia, mas era apenas referência lida pelo DTO; não havia armazenamento gerenciado.
O contrato local proibia PUT genericamente: foi registrada a exceção explícita solicitada para imagem.
Não foi possível extrair novamente o PDF com as ferramentas locais disponíveis; as rotas seguem a definição
explícita desta tarefa e o contrato local atualizado, sem atribuir ao PDF um CRUD de imagem não verificado.

Snapshots SHA-256, HEAD e status das três áreas anteriores estão na pasta de evidências da seção 10. Conferência
final aprovada: original455/B1 anterior456/combinada460 arquivos, conjuntos de fontes, HEAD e status intactos.
Não houve edição de seus fontes, merge, rebase, reset, stash ou clean.

## 2. Rotas, entradas, respostas e permissões

| Rota | Entrada/acesso | Resposta |
|---|---|---|
| `PUT /api/produtos/:id/imagem` | Sessão válida, papel atual admin, Origin autorizado; multipart com um arquivo `imagem` e zero campos extras | `200`, detalhe administrativo existente com nova `imagemUrl` |
| `DELETE /api/produtos/:id/imagem` | Mesmas guardas; sem corpo nem query | `200`, mesmo detalhe com `imagemUrl:null` |
| `GET`/`HEAD /api/midias/produtos/<uuid>.webp` | Público, somente arquivo gerenciado atualmente referenciado por produto ativo | `200 image/webp`; inexistente/inativo/não referenciado `404` |

Guardas executam antes do multipart: [`catalogo.routes.ts:38`](../src/routes/catalogo.routes.ts#L38).
Sessão ausente/inválida `401`; cliente/papel revogado `403`; Origin ausente/incorreto `403`.
Produto inativo pode ser administrado, mas continua fora das consultas e da mídia pública. Não há ativação implícita.
Nenhuma URL remota, caminho de disco, nome de destino, saldo ou campo de produto é recebido para escrever a imagem.
Nome original é validado e descartado; somente UUID gerado no servidor vira nome de arquivo.

Exemplo do DTO de sucesso (produto comum; categoria/ID dependem da base):

```json
{"id":42,"categoriaId":12,"categoria":"acessorios","nome":"Rede pequena","descricao":null,"marca":null,"preco":1999,"imagemUrl":"/api/midias/produtos/5b2c9174-799e-4384-a0ce-a55cf4e29e65.webp","emEstoque":false,"ativo":true,"ficha":null}
```

Retorna o mapeamento administrativo já usado pelo catálogo; não cria outro DTO de ficha. DELETE de produto sem
imagem retorna `200`; repetição mantém `imagemUrl:null` e não altera o timestamp novamente. Inexistente `404`,
ID inválido `400`. Todos os resultados administrativos usam `no-store`. DTOs públicos continuam sem `ativo`,
identificador privado do arquivo, caminho de disco, dados de sessão ou histórico.

Erros seguem `{erro,detalhes?}`: arquivo/campos/formato/nome inválidos `400`; tamanho `413`; Content-Type ou
Content-Encoding incompatível `415`; recepção expirada `408`; frequência `429`; capacidade/armazenamento/lock
indisponível `503`; banco inesperado `500` genérico. Não há mensagens livres do decoder, cookies, bytes ou paths
nos erros/logs novos. Erros gerais continuam com o registrador redigido existente.

## 3. Armazenamento escolhido e implantação

Armazenamento local via interface pequena [`ArmazenamentoImagem`](../src/modulos/catalogo/imagem/imagem.armazenamento.ts#L9):
gravar, abrir, remover e listar candidatos à limpeza. Não há provedor externo/credencial de loja. O diretório
configurável `IMAGENS_DIR` fica fora do repositório, build e Git; não é aceito caminho relativo, raiz `/`,
subdiretório das fontes/build, nem `/tmp`/`/var/tmp` em produção. Sem configuração a API existente inicia;
upload retorna `503`. Diretório/symlink não seguro é recusado. Pasta precisa ser privada e gravável pela app.

Cada versão usa `<uuid>.webp`, com estágio privado `temporarios/<uuid>.part`. Criação exclusiva, arquivo `0600`,
diretórios criados `0700`, escrita/sync, hard link exclusivo para o destino e sync do diretório antes do vínculo
no banco. Isso exige filesystem com hard links/fsync no mesmo volume; foi homologado no volume Docker Linux.
Não há caminho derivado de URL antiga/filename. O volume deve pertencer ao usuário do processo, sem escritores
locais não confiáveis. A implementação não oferece replicação de arquivo entre hosts.

O Dockerfile usa Node22, usuário `node` (UID1000) e diretório `/var/lib/aquarilandia/imagens`. Compose de produção
ganhou volume persistente `imagens`, limite de memória 1 GiB e 2 CPUs para a app inteira. São valores iniciais
que exigem homologação de capacidade do monólito; não houve alteração de containers existentes.
Todas as réplicas precisam acessar o mesmo banco **e** armazenamento. Outros provedores exigem implementação
da interface e revalidação de suas garantias, especialmente publicação durável e limpeza.

URLs relativas funcionam no proxy Vite e no site/API do mesmo endereço em produção. CSP existente inclui
`img-src 'self'` e não precisou mudar ([`app.ts`](../src/app.ts#L42)). Não há listagem de diretório.
Resposta de arquivo usa `image/webp`, `nosniff`, tamanho e cache público imutável de um ano; URL muda na troca.
Versões não referenciadas/inativas retornam `404` em nova busca, mas cópias já em cache não são revogadas imediatamente.

## 4. Formatos e limites efetivos

| Medida | Implementação |
|---|---|
| Formatos | JPEG, PNG, WebP estáticos: magic bytes, decoder real e coerência MIME/extensão |
| Arquivo | 5 MiB inclusive, antes e depois do reprocessamento |
| Corpo total | 5 MiB + 64 KiB; Content-Length e contagem do stream |
| Multipart | Um arquivo, campo `imagem`; zero campos textuais; filename até 180 caracteres, sem separadores/controle/`..` |
| Dimensões | 4096 por eixo, até 12 milhões de pixels inclusive; verificado antes de saída |
| Animação | APNG `acTL`, WebP `ANIM`/`ANMF`/flag e páginas adicionais recusadas |
| Processamento | WebP qualidade82/effort4, rotação EXIF aplicada, sRGB; não preserva EXIF/GPS/ICC/comentários |
| Tempo/capacidade | Recepção 20s; sharp timeout5s por etapa, concurrency1/cache16MiB; 2 uploads em curso por processo |
| Frequência | 10/min/IP após sessão/admin/Origin; limiter local ao processo |
| Banco | Lock3s/statement5s nas transações de escrita de imagem |

SVG/GIF não chegam a ser decodificados; conteúdo falso/corrompido não é publicado. A validação lê e reencoda
pixels reais. O limite de bytes do multer usa sentinela de um byte e validação posterior para aceitar exatamente
5 MiB; há testes no limite e acima dele. A recepção é encerrada após rejeição, sem deixar stream indefinido.

Timeout sharp é cooperativo: não equivale a matar processo isolado. Os limites do container reduzem o alcance
do decoder nativo; não representam uma prova de ausência de DoS. O pool compartilhado continua com sua política
atual de conexão; lock/statement_timeout não são deadline absoluto de aquisição da conexão ou I/O do filesystem.
Não foram adicionadas quotas globais de disco nem limiter distribuído; monitorar capacidade do volume.
JSON global 100 KiB, rejeição de compressão e rawBody do webhook não foram editados.

## 5. Falhas, concorrência e órfãos

[`imagem.service.ts`](../src/modulos/catalogo/imagem/imagem.service.ts#L26) reutiliza `comTransacao` e o lock
`FOR NO KEY UPDATE` de produto, serializando imagem com PATCH/desativação/reativação/estoque existentes.
O arquivo novo é persistido antes de atualizar URL/ID no banco; o anterior só entra em limpeza após COMMIT.
Preço, estoque, ficha, categoria e ativação não são escritos por essa operação.

| Situação | Efeito garantido/testado |
|---|---|
| Falha de validação/storage | Vínculo antigo intacto; arquivo incompleto não é servido |
| Falha SQL/rollback | Vínculo anterior preservado; tentar remover novo somente após consultar referências sob lock |
| COMMIT confirmado com resposta perdida | Reconsulta detecta referência e não apaga arquivo vencedor; resposta pode ser `500`, cliente deve reconsultar |
| Banco indisponível durante limpeza | Não pressupor rollback; deixar órfão para job futuro |
| Limpeza pós-commit falha | Sucesso permanece `200`; log fixo de limpeza pendente, sem caminho/mensagem livre |
| Dois PUT / PUT e DELETE | Lock do produto serializa; UUID diferente por versão; checagem de referência impede apagar vencedor |
| Interrupção antes do commit | Rollback do banco; arquivo final/temporário sem vínculo pode ser coletado após idade mínima |
| Processo morto depois do commit | Referência protege arquivo novo; versão antiga pode ser removida pelo job |

Upload e limpeza usam advisory lock transacional por UUID no **mesmo banco**. A limpeza usa try-lock e consulta
referência (ID ou URL canônica, também produto inativo) dentro da transação antes de excluir. Preserva uploads
em curso até quando seu mtime foi envelhecido artificialmente no teste. Nunca apaga por nome/URL de entrada.

`npm run imagens:limpar` considera somente UUIDs gerados regulares com mais de24h, na raiz `.webp` e estágio
`.part`, sem recursão. Preserva arquivo recente, desconhecido, symlink, qualquer referência vigente e lock ocupado.
Repetição converge; cada erro mantém arquivo e sinaliza log/exit1. Não é varredura destrutiva nem reparo do catálogo.
É comando operacional agendável, não worker novo do fluxo comercial. Admin remover imagem de referência legada
desvincula a URL, sem buscar/excluir asset externo. Restos de URL legada não recebem um ID gerenciado presumido.

## 6. Compatibilidade com catálogo e consumidores

Mapeamento existente [`catalogo-mapeamento.js:20`](../../frontend/src/services/catalogo-mapeamento.js#L20)
aceita URL relativa e lê `imagemUrl` em `foto`. [`Imagem.jsx`](../../frontend/src/components/atoms/Imagem.jsx#L1)
já mostra imagem e placeholder; nenhuma edição de produção no frontend foi necessária.
Listagem, detalhe e atalhos de peixes leem a mesma `imagem_url` pelas projeções existentes. Inativos continuam
invisíveis e peixes continuam exigindo a ficha. Identificador privado não foi acrescentado ao DTO público.
IDs numéricos, centavos, `emEstoque`, ficha e disponibilidade mantidos.

O novo E2E cria PNG sintético, envia para o backend real, decodifica/exibe o WebP retornado no detalhe de peixe
e confirma largura natural32. Após DELETE e reload, aparece `Foto em breve`. Screenshots antes/depois conferidos.
O bloco colorido da fixture é uma imagem real gerada para teste, não fotografia da loja ou mock de resposta.
Os E2E anteriores também passam (vitrine desktop/mobile, catálogo, filtros, detalhe, busca, comparação e carrinho).
Não há tela administrativa, galeria, cadastro separado de peixes, auth/checkout novos ou alteração do backend financeiro.

## 7. Dependências, configuração e migração

Adições dirigidas e exatas: `multer@2.5.0`, `sharp@0.35.5` e dev `@types/multer@2.3.0`. Antes não existiam essas
dependências. Nenhum pacote preexistente teve versão alterada no lock;41 entradas novas incluem plataformas
nativas opcionais. Instalação direcionada seguida de **npm ci** confirmou reprodução do lock. Node22 atende ao
sharp>=20.9 e ao multer>=10.16; Express5.2.1/body-parser2.4.0 mantidos.

Foram consultados os mantenedores: [segurança sharp](https://sharp.pixelplumbing.com/security/),
[API de entrada](https://sharp.pixelplumbing.com/api-constructor/) e
[aviso oficial multer](https://github.com/expressjs/multer/security/advisories/GHSA-q7qp-rjg7-q26m).
O aviso afeta multer2.0..<2.5 e informa correção2.5.0; filtro aqui é síncrono. A orientação sharp pede versão
atual e limites de recursos. `npm audit --json` final: **zero vulnerabilidades**, sem audit fix.
Isso não substitui acompanhamento posterior de versões nem auditoria completa do sistema.

Nova migração **32_produto_imagem.sql**, sem editar01/30/31 ou outras aplicadas: coluna nullable
`produtos.imagem_arquivo_id UUID`, vínculo canônico ID/URL em CHECK e índice único parcial para IDs gerenciados.
Legacy URL/null ficam intactos. Não modifica saldo/ativo/timestamp, não cria movimentos retroativos.
Bootstrap vazio inclui32; script `db:migrar-imagens` aplica a mesma SQL em transação e aceita reaplicação.
CLI testada em base anterior à32 com saldo7/inativo/asset legado, duas aplicações e limpeza de órfão.

**Implantação futura, não executada nesta tarefa:**

1. Revisar o diff e aprovar janela/backup da base e do armazenamento. Verificar compatibilidade das referências
   atuais antes de integrar. Não usar reset nem apagar volumes.
2. Preparar volume privado persistente e permissões UID1000; configurar `IMAGENS_DIR` no mesmo caminho montado.
   Em host sem Docker, diretório externo gravável pelo usuário do serviço, fora do frontend/build.
3. Aplicar32 **antes** de habilitar o código: em ambiente autorizado, `npm run db:migrar-imagens` com devdeps;
   ou executar SQL via `psql --set ON_ERROR_STOP=1 --single-transaction -f backend/db/init/32_produto_imagem.sql`
   usando conexão explícita autorizada. No compose, pode alimentar o psql do serviço db com esse arquivo;
   initdb só executa automaticamente quando o volume está vazio. Runner de estoque continua somente30/31.
4. Construir/subir versão revisada com volume preservado; conferir health, DTO, PUT/GET/DELETE com fixture e
   reativação/inativo, sem depender do modo demo. Não remover proteção JSON/rawBody ou CSP para fazer funcionar.
5. Agendar limpeza horária, por exemplo em backend/: `docker compose --env-file .env.producao -f docker-compose.prod.yml
   exec -T app node dist-scripts/scripts/limpar-imagens.js` (uma linha). Fora do container: `npm run imagens:limpar`.
   Não há scheduler instalado por esta tarefa. Monitorar exit code, contagens, log fixo e espaço em disco.
6. Fazer backup/restauração coordenados do PostgreSQL e de **todo o volume de imagens**, idealmente com escritas
   pausadas para snapshot consistente. Banco sozinho não guarda bytes; arquivo sozinho não restaura vínculo.
   Após restore, conferir arquivos referenciados antes de liberar vitrine ou executar limpeza; nunca inferir URLs.

Rollback de app não deve excluir32 nem os arquivos/volume; o código antigo ainda consegue ler `imagem_url`.
Não execute rollback destrutivo ou remoção de coluna sem plano específico. O container final inclui CLI de
limpeza compilada (sem tsx); a migração usa SQL operacional, não instalação de devdeps no container de produção.

## 8. Arquivos e verificações

| Grupo | Arquivos alterados/adicionados nesta área |
|---|---|
| Rotas/config | `backend/src/routes/{catalogo.routes,index}.ts`, `backend/src/config/env.ts` |
| Implementação (7 novos) | `backend/src/modulos/catalogo/imagem/imagem.{limites,processamento,upload,armazenamento,repository,service,controller}.ts` |
| Banco/operação | `backend/db/init/32_produto_imagem.sql`, `backend/scripts/{migrar-imagens,limpar-imagens}.ts` |
| Dependências | `backend/package.json`, `backend/package-lock.json` |
| Implantação | `backend/.env.example`, `backend/.env.producao.example`, `backend/Dockerfile`, `backend/docker-compose.prod.yml` |
| Novos testes | `backend/testes/{imagem-config,imagem-processamento,produto-imagem-http}.test.mjs`, `backend/testes/integracao/{imagem-migracao,produto-imagem}.test.mjs`, `frontend/testes/e2e/imagem.spec.mjs` |
| Contrato/docs | `README.md`, `backend/api.md`, `backend/docs/decisoes.md`, `backend/testes/README.md`, `backend/http/produto-imagem.http`, este relatório |
| Preservação anterior | `backend/docs/consolidacao-backend1-2026-11-14.md` e complementos documentais B1 já descritos na seção1 |

Instância exclusiva `aquarilandia-imagens-pg-20261114`, PostgreSQL17-alpine/tmpfs, usuário/banco fictícios teste,
porta62967. Schemas únicos por suíte, removidos ao terminar. O `aquarilandia-db` existente não foi acessado nem
alterado. Chromium oficial Playwright1.64.1 em container próprio; screenshots/logs fora das fontes.

| Comando/verificação | Resultado obtido |
|---|---|
| `npm ci` backend | Passou; lock reproduzível, sem alteração de versões preexistentes |
| `npm ls body-parser sharp multer @types/multer --depth=2` | Express5.2.1→body-parser2.4.0; multer2.5.0/sharp0.35.5/types2.3.0 instalados |
| `npm run typecheck` / `npm run build` backend | Passaram, repetidos após último ajuste de configuração |
| `npm test` backend | **1.216 passaram**,0 falhas/ignorados (17 casos novos) |
| `TEST_DATABASE_URL=... npm run test:integration` | **614 passaram**,0 falhas/ignorados (42 casos novos de imagem/migração) |
| `npm audit --json` backend | **0** vulnerabilidades em todas as gravidades |
| Frontend `npm test` / `npm run lint` | **89 passaram**,0 ignorados; lint passou |
| `NODE_ENV=test TEST_DATABASE_URL=... npm run test:e2e -- --config=<config isolada>` | **27 passaram**,0 ignorados; PG/API/arquivo reais, inclusive vitrine desktop/mobile |
| `docker build --tag aquarilandia-imagens-homologacao:20261114 --file backend/Dockerfile .` | Passou: builds frontend/backend/scripts e npm ci produção; warning de chunk>500kB do frontend |
| Smoke da imagem Docker nova | Usuário1000, sharp nativo, health, PUT/GET com PG, bytes idênticos após restart com volume persistente, CLI compilada de limpeza passaram |
| `docker compose ... config --quiet` com exemplo de produção | Passou; nenhuma subida/alteração do compose existente |
| Concorrência/falhas | Duas conexões/locks observáveis; PUT×PUT, PUT×DELETE em ambas as ordens, cleanup×upload, resposta de COMMIT perdida, trigger SQL e storage falhando passaram |
| `db:migrar-imagens` / `imagens:limpar` | Executados pelas suítes em schema anterior à32; reaplicação, legado e erro redigido passaram |
| `git diff --check` + whitespace novos | Passaram na conferência final; 19 arquivos novos sem whitespace inválido |

O teste de falha intencional de banco produz SQLSTATE redigido em alguns E2E; não indica falha da suíte.
Tentativas iniciais com fixture animada otimizada pelo encoder, mock de Pool.connect sem callback e remoção de
tabela fixture com dependências foram corrigidas nos **testes**; contam somente as execuções finais acima.
Primeiro smoke precisou atualizar a porta efêmera depois de restart Docker; a repetição passou.
Nenhum resultado de execução restrita que só contou arquivos foi usado como aprovação de casos individuais.

## 9. Conflitos, limites e pendências

Fetch final confirmou mesmas referências. HEAD é origin/main; branch-backend e B2 são ancestrais, sem mudança
remota concorrente nos arquivos novos. `git ls-files -u` vazio, sem marcadores. Simulação `git merge-tree --write-tree`
das **referências commitadas** com main/B1/B2 retornou a mesma árvore sem conflito; essa simulação não inclui
automaticamente o diff não commitado. O diff de imagem foi construído sobre a main exata e não tem contraparte
remota nova neste snapshot. Não é garantia de merge futuro, nem examina trabalho privado de terceiros.

Sobreposição esperada: package/lock, configuração/env, Docker/compose, roteadores e docs compartilhados.
Revisão conjunta antes de integrar; manter middleware/JSON/rawBody e volume; não refazer auth ou checkout.
Conflito funcional local resolvido: proibição genérica de PUT ganhou exceção explícita de imagem. Não existia
rota concorrente de upload no código remoto. Preservados os complementos B1, sem importar correção financeira.

**Pendência preexistente B2:** refund confirmado por webhook/reconsulta e cancelamento/estoque atomicamente,
registrado na consolidação B1; não foi corrigido nem novamente homologado contra gateway nesta tarefa.
Política de uma hora/expiração/estoque não foi alterada. Resultados verdes das suítes não declaram essa pendência resolvida.

Não executados: deploy, migração em base compartilhada, gateway/e-mail/credenciais reais, carga prolongada,
backup/restauração operacional, replicação entre hosts, TLS/Caddy em domínio público ou browsers além do Chromium.
Backend não tem script de lint; typecheck/build/testes foram as verificações disponíveis. PDF não foi reextraído.
Relatórios anteriores preservam suas limitações históricas, não constituem novas homologações desta task.

## 10. Entrega revisável e evidências

- **Worktree:** `/tmp/aquarilandia-imagem-principal-20261114`.
- **Branch:** `feat/catalogo-imagem-principal-20261114`; HEAD continua `c6617e3`; alterações locais sem staging/commit.
- **Git final:**13 arquivos rastreados modificados +19 novos, zero unmerged; original e duas áreas anteriores intactos.
- **Relatório:** `backend/docs/imagem-principal-2026-11-14.md`; contrato em `backend/api.md`, seção13.
- **Logs/snapshots/scripts temporários:** `/tmp/aquarilandia-imagens-20261114-evidencias/`.
- **Screenshots:** `browser-resultados/imagem-imagem-real-do-peix-f4b62-om-HTTP-PG-filesystem-reais/peixe-com-imagem.png`
  e `peixe-sem-imagem.png` dentro da pasta de evidências. Foram inspecionados, além das assertivas do navegador.

Nenhum commit/push/merge/deploy foi feito. Não remover esta worktree ou sua pasta temporária antes de revisar
e transportar as alterações: entrega e evidências ainda dependem da retenção de `/tmp`.
Containers PostgreSQL/Chromium próprios encerrados/removidos; app, rede e volume do smoke também removidos.
O `aquarilandia-db` preexistente permanece em execução. A imagem Docker de homologação e os logs foram mantidos.
