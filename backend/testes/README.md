# Testes do catálogo

As suítes incluem também a proteção administrativa de orçamentos.

Execute em `backend/`, com Node.js 22 e as dependências do lockfile:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

`npm test` verifica o contrato HTTP na aplicação Express completa, usando a porta local efêmera e simulando
`db.query` (e a consulta de sessão nos testes administrativos). Cobre paginação, validação antes de acessar o banco, erro genérico e preservação das
outras consultas do catálogo. Não precisa de PostgreSQL e não instala bibliotecas adicionais de testes.
A suíte de produtos também cobre os filtros gerais combinados, centavos, ordenação e rejeição explícita
da consulta administrativa de inativos e de parâmetros não previstos.
A suíte de detalhe cobre ID numérico parametrizado, produto com/sem ficha, paridade com a listagem,
IDs inválidos (incluindo os antigos textuais), `404` e falha do banco sem fallback.
A suíte de peixes cobre os dois atalhos, filtros do PDF, valores inválidos e paginação, usando o mesmo
formato de produto/ficha. Nenhuma suíte depende dos arrays antigos de peixes do backend.
A suíte de filtros técnicos cobre tipos de água, volume/vazão, booleanos e iluminação, incluindo erros de
enum, faixa invertida e parametrização combinada com os filtros gerais.
A suíte de administração de categorias cobre detalhe público, POST/PATCH/DELETE, sessão/admin/Origin,
validação dos campos/IDs, PATCH parcial, unicidade, FK e falhas sem detalhes internos. Confirma que o
DELETE consulta diretamente o banco, sem depender de uma checagem prévia de produtos.
A suíte de cadastro de produtos também simula o client retornado por `db.connect`, para verificar BEGIN,
COMMIT, ROLLBACK, liberação/descarte da conexão, uso de parâmetros e ausência de queries fora da transação.
Cobre as 11 fichas, obrigatoriedade, enums, limites e casas decimais, defaults, campos desconhecidos, estoque
zero, associação de categoria, sessão/admin/Origin e erros sem detalhes internos.
A suíte de edição verifica whitelist em todos os níveis (incluindo chaves de protótipo), campos protegidos,
PATCH parcial, `null`, preservação de omitidos, faixas do estado final, 404 de inativos, duplicidade e rollback.
Verifica também 413 de payload acima de 100 KiB e 415 de corpo comprimido antes de sessão/banco, sem logar
conteúdo do corpo, em PATCH/POST/login. Os testes não exploram o DoS do body-parser para derrubar processos.
A suíte `parser-json.test.mjs` acrescenta limites exatos de 102400/102401 bytes (ASCII e UTF-8),
gzip/deflate/Brotli, JSON malformado, tipos de corpo, criação pública de orçamentos, login/cookie e
preflight CORS. O login é simulado no service: esse teste não substitui a integração real de sessões no PostgreSQL.

## Integração com PostgreSQL

```bash
TEST_DATABASE_URL=postgres://postgres:senha@localhost:5432/banco_de_testes npm run test:integration
```

### Instância descartável para integração

Não use `DATABASE_URL` de desenvolvimento/produção como banco descartável. Para obter uma instância isolada
com PostgreSQL 17, sem montar diretórios ou volumes do projeto:

```bash
docker run --detach --rm --name aquarilandia-testes --tmpfs /var/lib/postgresql/data --env POSTGRES_PASSWORD=senha_de_teste --env POSTGRES_DB=aquarilandia_testes --publish 127.0.0.1::5432 postgres:17-alpine
docker exec aquarilandia-testes pg_isready -U postgres -d aquarilandia_testes
docker port aquarilandia-testes 5432/tcp
```

Espere `accepting connections`. Substitua `PORTA` pela porta retornada, mantendo `127.0.0.1`:

```bash
TEST_DATABASE_URL=postgres://postgres:senha_de_teste@127.0.0.1:PORTA/aquarilandia_testes npm run test:integration
docker exec aquarilandia-testes psql -U postgres -d aquarilandia_testes -c "SELECT nspname FROM pg_namespace WHERE nspname LIKE 'teste_%';"
docker stop aquarilandia-testes
```

A consulta deve retornar zero schemas de testes ao final. O container usa tmpfs e `--rm`; nenhum volume
persistente do projeto é removido. Se Docker não estiver disponível, `TEST_DATABASE_URL` pode apontar para
um PostgreSQL local **dedicado a testes**, cujo usuário possa criar/remover schemas. A instalação/administração
de PostgreSQL local não tem procedimento próprio definido neste repositório; não substitua isso por usar o banco
normal do projeto. Sem instância pronta/URL de testes, registre a integração como não executada.

Use um banco de testes. O usuário precisa poder criar schemas. Cada suíte cria um schema exclusivo, executa nele
`db/init/01_catalogo.sql` e configura a aplicação para consultar somente esse schema. Ao terminar, remove o
schema, inclusive em caso de falha. A suíte administrativa também executa `10_clientes.sql` para criar
usuários e sessões reais. Não use o banco de produção.

Os testes verificam a consulta real, os campos e a ordenação, o seed com `peixes`, todas as páginas, página
além do fim, leitura de uma nova categoria, parâmetros inválidos, tabela indisponível e catálogo vazio.
Sem `TEST_DATABASE_URL`, a suíte fica explicitamente **ignorada**, não aprovada.

A suíte de produtos insere suas próprias fixtures no PostgreSQL (o seed só contém categorias). Cobre produtos
ativos/inativos, combinação de filtros e total, centavos e limites inclusivos, nome/preço repetidos entre páginas,
busca literal com caracteres especiais, lista vazia e falha real de consulta. Todos os produtos inseridos são
removidos junto com o schema exclusivo ao final, inclusive se um teste falhar. As suítes de categorias e produtos
podem rodar em paralelo porque usam schemas separados.

A suíte de detalhe cria produtos e fichas para todas as 11 categorias especializadas, além de acessórios,
produto sem ficha, categoria sem tabela e produto inativo com ficha. Compara todos os campos das fichas,
incluindo decimais, booleanos e nulos, e os campos básicos com a listagem. Verifica que fichas de outra categoria
e uma coluna interna adicional não aparecem na resposta. Essas alterações existem somente no schema descartável
dos testes e são removidas junto com ele. O schema SQL do projeto não foi alterado.

A suíte de peixes insere produtos com fichas de água doce, salobra e marinha, nomes repetidos e disponibilidade
distinta, além de inativos, produto sem ficha e ficha vinculada à categoria errada. Verifica filtros isolados e
combinados, temperatura/pH exatamente nos limites e imediatamente fora deles (sem arredondamento), limites
de tamanho/volume, busca popular/científica literal, paginação e total. Compara as duas rotas de peixes com
produtos e testa falha real da consulta. Algumas fichas têm valores sintéticos de fronteira e não representam
orientação biológica. Todo dado fica em schema exclusivo e é removido ao final.

A integração de filtros técnicos cria fichas para todas as categorias aplicáveis, produtos sem ficha,
inativos e um acessório com fichas incompatíveis. Verifica `ambos`, a convenção de decorações e de substrato
fértil, booleanos `false`, limites exatos, categorias/interseções incompatíveis, contagem e paginação com
empates. Também confirma que detalhes e atalhos de peixes mantêm o comportamento atual. Fixtures ficam
em schema exclusivo, removido ao final mesmo com falhas; não alteram o schema nem o seed do projeto.

A integração administrativa usa cookies com tokens cujos hashes estão em `sessoes`, e verifica ausência,
expiração, revogação, usuário inativo e mudança de papel no banco. Cobre criação/edição/exclusão refletidas
na listagem, limites dos campos, slugs estruturais preservados e nomes editáveis, duplicidades e duas criações
simultâneas. Categorias com produtos ativos ou inativos não podem ser excluídas. Para a corrida de exclusão,
insere um produto em uma transação aberta, confirma em `pg_stat_activity` que o DELETE aguarda o lock e então
confirma a inserção: a API deve retornar `409` e preservar a categoria. O banco de testes precisa permitir
consultar suas próprias sessões em `pg_stat_activity`. Também verifica falha real de categorias/sessões e
regressão das consultas de produtos/peixes. Todos os dados e tabelas ficam no schema exclusivo e são removidos.

A integração de cadastro aplica os três scripts `01_catalogo.sql`, `10_clientes.sql` e `20_vendas.sql`, sem
alterá-los. Insere via HTTP fichas mínimas/completas das 11 categorias e compara POST/lista/detalhe/peixes,
inclusive estoque zero persistido. Valida obrigatórios, enums, limites e precisão no PostgreSQL, além de
duplicidade científica concorrente e rollback real tanto na ficha quanto na leitura final do DTO. Usa
constraints/tabelas temporariamente alteradas somente no schema descartável para provocar falhas reais.
Confirma a espera de lock ao cadastrar em uma categoria com exclusão concorrente. Também exercita as rotas
de cadastro/login trazidas pelo último pull, cookie/sessão, promoção de papel exclusivamente na fixture SQL,
revogação, health e regressões de consultas/filtros. Valores extremos de teste não são recomendações biológicas.

A integração de edição cria outro schema exclusivo com os três scripts. Cobre todas as 11 fichas, campos
anuláveis, centavos e limites, estoque preservado, timestamp, reparo de ficha legada, duplicidade e rollback
real do produto/ficha/timestamp. Duas requisições PATCH concorrentes são sincronizadas com locks observados
em `pg_stat_activity`, comprovando que campos diferentes são preservados. Outro caso altera uma faixa numa
transação concorrente e exige validação contra o novo estado. Também verifica a compatibilidade do lock com
a FK ao excluir categoria concorrente, além das leituras de produtos/peixes/categorias. Os locks auxiliares,
triggers e fixtures existem somente no schema de testes e são removidos junto com ele.

A resposta das listas de categorias, produtos e peixes é `{ itens, total }`; `pagina` e `limite` são parâmetros da requisição. A escolha do
contrato, suas divergências e os consumidores legados estão registrados em `../api.md` e `../docs/decisoes.md`.

## Controle de acesso a orçamentos

`orcamentos-acesso.test.mjs` exercita a aplicação HTTP com a consulta de sessão simulada. Cria fixtures
públicas e verifica `401`/`403` sem dados pessoais, admin, projeção explícita de campos, `no-store`, tentativa
de reutilizar ETag, HEAD, rebaixamento/revogação e erros genéricos. Confere que somente POST é público e que
detalhe/PATCH de resposta/DELETE continuam sem handler para admin, atrás da guarda.

`integracao/orcamentos-acesso.test.mjs` cria schema exclusivo com `10_clientes.sql`, contas e sessões reais.
Orçamentos permanecem no array do processo de teste; não se inventa tabela. Altera papel/ativo e remove sessões
no PostgreSQL para confirmar bloqueio imediato com o mesmo cookie. Verifica sessão inválida/vencida e falha
real da tabela de sessões; o POST público continua funcionando mesmo sem essa tabela. Schema e processo são
descartados ao final, sem alterar dados do projeto. As demais suítes preservam catálogo, PATCH de produtos e login.

## Desativação de produtos

`produto-remocao.test.mjs` verifica DELETE administrativo: sessão/admin/Origin, ID numérico, 204 sem JSON,
404 de inexistentes/inativos/repetição, campos de corpo/query sem poder de edição, papel/revogação,
falhas genéricas e preservação dos erros 413/415 globais.

`integracao/produto-remocao.test.mjs` usa os três scripts SQL em schema exclusivo, cookies/sessões reais,
produtos criados via POST e fixtures SQL com saldo/imagem/datas anteriores. Verifica preservação das 11
fichas, legado sem ficha, preço/saldo/colunas internas e histórico de uma venda com FK. Compara visibilidade,
filtros, total e paginação de produtos/peixes após desativar; outros DTOs e categorias permanecem iguais.
Falhas reais de tabela/trigger não deixam edição parcial. Três disputas HTTP usam advisory locks e
`pg_stat_activity` para observar a espera: PATCH primeiro, DELETE primeiro e dois DELETEs. Não usam espera
fixa para pressupor a ordem. Locks, triggers e schemas são limpos ao final, inclusive se houver falha.

As fixtures válidas de auth/orçamentos enviam Origin explicitamente, compatíveis com o contrato e com as
guardas presentes nas branches remotas. Isso não integra essas guardas nem comprova rate limit/proxy remoto.
