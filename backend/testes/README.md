# Testes do catálogo

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

## Integração com PostgreSQL

```bash
TEST_DATABASE_URL=postgres://postgres:senha@localhost:5432/banco_de_testes npm run test:integration
```

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

A resposta das listas de categorias, produtos e peixes é `{ itens, total }`; `pagina` e `limite` são parâmetros da requisição. A escolha do
contrato, suas divergências e os consumidores legados estão registrados em `../api.md` e `../docs/decisoes.md`.
