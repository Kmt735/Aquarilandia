# Convenções da API — Aquarilândia

Documento de referência para os dois devs do backend. **Leia antes de abrir um PR.**
Se precisar fugir de alguma regra, combine antes e atualize este arquivo no mesmo PR.

| Domínio | Dono | Pasta | Prefixo de rota | Tabelas |
|---|---|---|---|---|
| Autenticação | Celio | `src/modulos/auth/` | `/api/auth` | `sessoes`, `tokens_recuperacao_senha` |
| Clientes | Celio | `src/modulos/clientes/` | `/api/clientes` | `clientes` (inclui admins), `enderecos_cliente` |
| Vendas | Celio | `src/modulos/vendas/` | `/api/vendas`, `/api/frete` | `vendas`, `itens_venda`, `historico_status_venda` |
| Pagamentos | Celio | `src/modulos/pagamentos/` | `/api/pagamentos`, `/api/vendas/:id/pagamentos` | `pagamentos`, `eventos_webhook` |
| Orçamentos *(já existe)* | Celio | `src/modulos/orcamentos/` | `/api/orcamentos` | `orcamentos` (a criar — hoje os dados ficam em memória) |
| Catálogo | Dev 2 | `src/modulos/catalogo/` | `/api/categorias`, `/api/produtos`, `/api/peixes`, `/api/servicos` | `categorias`, `produtos` e as tabelas de detalhe (`peixes`, `aquarios`, `filtros`...) |
| Estoque | Dev 2 | `src/modulos/estoque/` | `/api/estoque` | `movimentacoes_estoque` e a coluna `produtos.estoque` |

> Regra de ouro: **cada um só mexe na própria pasta, nas próprias rotas e nas próprias tabelas.**
> Arquivos compartilhados (lista na seção 9) só mudam em PR pequeno e separado, avisando o outro.

---

## 1. Estrutura de pastas

Organizamos **por domínio (módulo)**, não por camada. Assim cada dev trabalha numa pasta diferente e o Git quase nunca dá conflito.

```
backend/src/
├── app.ts                  # compartilhado
├── server.ts               # compartilhado
├── config/                 # compartilhado (env.ts, db.ts)
├── middlewares/            # compartilhado (errorHandler.ts...)
├── utils/                  # compartilhado (AppError.ts, transacao.ts, validacao.ts...)
├── types/index.ts          # compartilhado — só tipos usados por MAIS de um módulo
├── routes/index.ts         # compartilhado — só monta os routers dos módulos
└── modulos/
    ├── clientes/
    │   ├── cliente.routes.ts
    │   ├── cliente.controller.ts
    │   ├── cliente.service.ts
    │   ├── cliente.repository.ts
    │   └── cliente.types.ts
    ├── auth/
    ├── vendas/
    ├── pagamentos/
    ├── orcamentos/
    ├── catalogo/
    └── estoque/
```

**Migração:** hoje `catalogo` e `orcamento` estão em `src/controllers`, `src/services` e `src/routes`.
Cada dono move o seu módulo para `src/modulos/` no primeiro PR que mexer nele. Não mover o módulo do outro.

### Camadas (o que vai em cada arquivo)

| Arquivo | Responsabilidade | Não pode |
|---|---|---|
| `*.routes.ts` | Mapear método + caminho → função do controller | Ter lógica |
| `*.controller.ts` | Ler `req` (params, query, body), chamar o service, escolher o status e responder | Acessar o banco, ter regra de negócio |
| `*.service.ts` | Regras de negócio, validação, orquestrar transações, chamar outros services | Usar `req`/`res` |
| `*.repository.ts` | SQL. Única camada que importa `db` | Ter regra de negócio, lançar erro de validação |
| `*.types.ts` | Interfaces e tipos do módulo | — |

Fluxo: `routes → controller → service → repository → banco`. Nunca pular camada.

---

## 2. Nomes

O código é **em português, sem acento** (igual ao que já existe). Termos técnicos consagrados ficam em inglês (`routes`, `controller`, `service`, `repository`, `id`, `slug`).

### Arquivos
- `<recurso no singular>.<camada>.ts` → `cliente.service.ts`, `venda.repository.ts`, `movimentacao.types.ts`
- Pasta do módulo no **plural**: `modulos/clientes/`, `modulos/vendas/`
- Classes em PascalCase com nome igual ao arquivo: `utils/AppError.ts`

### Exports
Cada camada exporta **um objeto** com o nome `<recurso><Camada>`:

```ts
export const clienteRoutes = Router()
export const clienteController = { ... }
export const clienteService = { ... }
export const clienteRepository = { ... }
```

### Funções — use sempre estes verbos

| Ação | Controller / Service | Repository |
|---|---|---|
| Listar vários | `listar(filtros)` | `listar(filtros)` |
| Buscar um | `buscarPorId(id)` | `buscarPorId(id)` |
| Buscar por outro campo | `buscarPorEmail(email)`, `buscarPorSlug(slug)` | idem |
| Criar | `criar(dados)` | `inserir(dados)` |
| Atualizar | `atualizar(id, dados)` | `atualizar(id, dados)` |
| Remover | `remover(id)` | `desativar(id)` ou `excluir(id)` |
| Ações de negócio | verbo no infinitivo: `cancelar`, `finalizar`, `registrarEntrada`, `baixarParaVenda` | — |

- Funções e variáveis: `camelCase`. Booleans começam com `e`/`tem`/`pode` quando ajudar: `emEstoque`, `temDesconto`, `podeCancelar`.
- Constantes de módulo: `camelCase` também (`opcoesServico`). `UPPER_CASE` só para valores vindos de env.
- Tipos e interfaces: `PascalCase`, singular.

### Tipos — padrão por entidade

```ts
export interface Cliente {               // como sai da API
  id: number
  nome: string
  email: string | null
  criadoEm: string
  atualizadoEm: string
}

export type NovoCliente = Pick<Cliente, 'nome' | 'email'>   // body do POST
export type AtualizacaoCliente = Partial<NovoCliente>        // body do PATCH
export interface FiltrosCliente { busca?: string; pagina: number; limite: number }
```

`Novo<Entidade>`, `Atualizacao<Entidade>`, `Filtros<Entidade>` — sempre esses prefixos.

---

## 3. Rotas (URLs)

- Tudo sob `/api`.
- Recursos no **plural**, minúsculo, sem acento, `kebab-case`: `/clientes`, `/itens-venda`, `/estoque/movimentacoes`.
- Parâmetro de rota sempre `:id` (ou `:slug`). Em sub-recurso, nomeie: `/vendas/:id/itens/:itemId`.
- Query string em `camelCase`: `?categoria=filtros&precoMax=10000&pagina=2`.
- Ações que não são CRUD viram `POST` em sub-caminho com verbo: `POST /vendas/:id/cancelar`.

| Método | Caminho | Uso | Sucesso |
|---|---|---|---|
| `GET` | `/clientes` | Listar (com filtros/paginação) | `200` |
| `GET` | `/clientes/:id` | Buscar um | `200` |
| `POST` | `/clientes` | Criar | `201` + objeto criado |
| `PATCH` | `/clientes/:id` | Atualizar parcialmente | `200` + objeto atualizado |
| `DELETE` | `/clientes/:id` | Remover (soft delete) | `204` sem corpo |

Exceções: endereços do cliente são excluídos de verdade (dado pessoal); a venda guarda cópia do endereço de entrega.
Categorias também são excluídas de verdade, somente quando não há nenhum produto vinculado (ativo ou inativo).

Não usamos `PUT`. Atualização é sempre `PATCH`.

### Mapa de rotas reservadas

Antes de criar uma rota fora desta lista, adicione-a aqui para o outro saber.

Cada rota indica quem pode usá-la: **(público)** qualquer visitante · **(logado)** cliente ou admin ·
**(cliente)** cliente logado · **(cliente, dono)** só se o recurso for do cliente logado ·
**(admin)** equipe da loja · **(gateway)** notificação do gateway de pagamento.
Rotas `/me` são registradas no router **antes** das rotas `/:id`.

**Celio — auth / clientes / vendas / pagamentos / orçamentos**
```
POST   /api/auth/cadastro                       (público, rate limit)
POST   /api/auth/login                          (público, rate limit — cria sessão, cookie "sid")
POST   /api/auth/logout                         (logado)
POST   /api/auth/esqueci-senha                  (público, rate limit — responde 202 sempre)
POST   /api/auth/redefinir-senha                (público, rate limit)
GET    /api/auth/sessao                         (logado — usuário da sessão atual)

GET    /api/clientes/me                         (cliente)
PATCH  /api/clientes/me                         (cliente)
PATCH  /api/clientes/me/senha                   (cliente)
DELETE /api/clientes/me                         (cliente — anonimiza, LGPD)
GET    /api/clientes/me/enderecos               (cliente)
POST   /api/clientes/me/enderecos               (cliente)
PATCH  /api/clientes/me/enderecos/:enderecoId   (cliente, dono)
DELETE /api/clientes/me/enderecos/:enderecoId   (cliente, dono)
GET    /api/clientes/me/vendas                  ?status=&pagina=&limite=   (cliente)
GET    /api/clientes/me/vendas/:id              (cliente, dono — inclui itens e histórico)

GET    /api/clientes                            ?busca=&papel=&pagina=&limite=   (admin)
GET    /api/clientes/:id                        (admin — inclui endereços)
PATCH  /api/clientes/:id                        (admin — ativar/desativar)
DELETE /api/clientes/:id                        (admin — anonimiza, LGPD)
GET    /api/clientes/:id/vendas                 (admin)

POST   /api/frete/calcular                      (público, rate limit)

GET    /api/vendas                              ?clienteId=&status=&tipoEntrega=&de=&ate=&pagina=&limite=   (admin)
GET    /api/vendas/:id                          (admin — inclui itens)
GET    /api/vendas/:id/historico                (admin)
POST   /api/vendas                              (cliente — cria venda + itens + baixa estoque, numa transação)
POST   /api/vendas/:id/status                   (admin — avança o status: { status, observacao, codigoRastreio? })
POST   /api/vendas/:id/cancelar                 (cliente, dono, antes do envio; ou admin — estorna estoque e, se paga, o pagamento)

POST   /api/vendas/:id/pagamentos               (cliente, dono — cria a cobrança no gateway e devolve o link)
POST   /api/pagamentos/webhook                  (gateway — validado por assinatura)

GET    /api/orcamentos                          (admin)
POST   /api/orcamentos                          (público, rate limit)
```

**Dev 2 — catálogo / estoque**
```
GET    /api/categorias               ?pagina=&limite=                         (público)
GET    /api/categorias/:id                                                    (público)
POST   /api/categorias                                                        (admin)
PATCH  /api/categorias/:id                                                    (admin)
DELETE /api/categorias/:id                                                    (admin — somente sem produtos vinculados)
GET    /api/produtos                 ?categoria=&busca=&preco_min=&preco_max=&ordem=&pagina=&limite=   (público)
GET    /api/produtos/:id                                                      (público)
POST   /api/produtos                                                          (admin)
PATCH  /api/produtos/:id                                                      (admin)
DELETE /api/produtos/:id                                                      (admin)
GET    /api/peixes                   ?temperatura=&ph=&tamanho_max=&aquario_litros=&dificuldade=&temperamento=&tipo_agua=&busca=&pagina=&limite=   (público)
GET    /api/peixes/:id                                                        (público)
GET    /api/servicos                                                          (público)

GET    /api/estoque                  ?abaixoDe=   (saldo por produto)        (admin)
GET    /api/estoque/:produtoId                                                (admin)
GET    /api/estoque/movimentacoes    ?produtoId=&tipo=&de=&ate=               (admin)
POST   /api/estoque/movimentacoes    (entrada / ajuste manual)               (admin)
```

---

## 4. Formato do JSON

- Chaves em **camelCase** na API. No banco é **snake_case**. A conversão é feita **no repository**, com alias no SQL:
  ```sql
  SELECT id, nome, criado_em AS "criadoEm", categoria_id AS "categoriaId" FROM produtos
  ```
- **IDs**: `number` (vêm de `SERIAL`). Chave estrangeira na API: `<entidade>Id` → `clienteId`, `produtoId`.
- **Dinheiro**: sempre **inteiro em centavos** (`8990` = R$ 89,90), em todo lugar: banco, API, tipos. Nunca `float`. Quem formata para "R$" é o frontend.
- **Datas**: string ISO 8601 em UTC (`"2026-10-15T14:30:00.000Z"`). Filtro só por dia: `?de=2026-10-01&ate=2026-10-31`.
- **Enums**: string minúscula em `snake_case`, igual ao `CHECK` do banco: `"semi_agressivo"`, `"aguardando_pagamento"`.
- **Campo vazio**: `null` (não omitir, não `""`).
- **Sucesso** devolve o recurso direto, sem envelope (`{ id, nome, ... }` ou `[...]`), exceto nas listagens paginadas.

### Paginação

Toda listagem que pode crescer (clientes, vendas, produtos, movimentações) é paginada:

```
GET /api/clientes?pagina=1&limite=20
```
```json
{
  "dados": [ { "id": 1, "nome": "Ana" } ],
  "total": 57,
  "pagina": 1,
  "limite": 20
}
```
- `pagina` começa em **1**. `limite` padrão **20**, máximo **100**.
- `/servicos` continua retornando array simples nesta implementação.

### Categorias — contrato implementado em 25/10/2026

`GET /api/categorias` consulta o PostgreSQL e segue o envelope de listas do
[`API_Aquarilandia_Rotas.pdf`](../API_Aquarilandia_Rotas.pdf), página 1, e o acesso público da página 2:

```http
GET /api/categorias?pagina=1&limite=1
```
```json
{
  "itens": [{ "id": 1, "nome": "Peixes", "slug": "peixes" }],
  "total": 12
}
```

- Cada item contém somente `id`, `nome` e `slug`. A ordem é `id` crescente.
- `total` conta todas as categorias, independentemente da página. Página além do fim retorna `itens: []`.
- `pagina` e `limite` são parâmetros de query, não campos da resposta. Os padrões são 1 e 20, conforme o PDF.
- Ambos devem ser inteiros positivos em notação decimal, sem zeros à esquerda; `limite` máximo 100,
  preservando o teto local. São recusados valores repetidos, vazios, fracionários, fora do intervalo
  seguro de inteiros (inclusive o deslocamento calculado) e parâmetros não previstos.
- Query inválida retorna `400 { "erro": "Parâmetros inválidos", "detalhes": { ... } }` sem consultar o banco.
- Falha do banco segue o handler existente: `500 { "erro": "Erro interno do servidor" }`, sem detalhes internos.

**Divergências resolvidas neste incremento:** o PDF propõe `{ itens, total }` para listas; este documento antes
dispensava paginação para categorias e usava `{ dados, total, pagina, limite }` nas demais listas. A instrução
do incremento prioriza o PDF para categorias. Essa escolha não migra as outras rotas. O PDF também propõe
erros com código em `erro` e texto em `mensagem`; a rota mantém `AppError`/`errorHandler` e o formato atual
da API, conforme solicitado, sem introduzir uma mudança global nos erros.

**Consumidores:** não há chamada HTTP à rota no frontend atual; navegação, filtros e busca importam
`frontend/src/data/categorias.js`. Esses dados têm `icone`/`dica` e filtram produtos mockados pelo nome.
Uma futura integração deve ler `itens`, percorrer as páginas quando necessário e definir a apresentação
de ícones/dicas. Não tratar a resposta como array nem enviar `slug` aos filtros legados sem adaptá-los.
A listagem de produtos segue o incremento abaixo. As demais rotas permanecem no formato atual.
Testes e execução: [`testes/README.md`](testes/README.md).

### Categorias — detalhe e administração implementados em 25/10/2026

As quatro rotas complementam a listagem existente, conforme a página 2 do
[`API_Aquarilandia_Rotas.pdf`](../API_Aquarilandia_Rotas.pdf). O DTO de leitura, criação e edição é sempre
`{ id, nome, slug }`, com ID numérico do PostgreSQL. A listagem mantém `{ itens, total }`, paginação e ordem por ID.

| Método e caminho | Acesso | Corpo | Sucesso |
|---|---|---|---|
| `GET /api/categorias/:id` | Público | — | `200` com a categoria |
| `POST /api/categorias` | Admin | `{ nome, slug }` | `201` com a categoria criada |
| `PATCH /api/categorias/:id` | Admin | `{ nome?, slug? }`, ao menos um campo | `200` com a categoria atualizada |
| `DELETE /api/categorias/:id` | Admin | — | `204` sem corpo |

```http
POST /api/categorias
Origin: http://localhost:5173
Cookie: sid=<token da sessão admin>
Content-Type: application/json

{ "nome": "Acessórios de manutenção", "slug": "acessorios-manutencao" }
```
```json
{ "id": 13, "nome": "Acessórios de manutenção", "slug": "acessorios-manutencao" }
```

**Autorização:** as três escritas passam por `autenticar`, pelo novo `exigirAdmin` e por `exigirOrigem`, nessa
ordem. A sessão é o cookie `sid` existente, cujo hash é consultado em `sessoes` junto ao papel atual em `clientes`.
Sem sessão válida, vencida, revogada ou com cliente inativo: `401`. Cliente autenticado sem papel `admin`: `403`.
Admin com `Origin` ausente ou diferente de `CORS_ORIGIN`: `403`, aplicando a proteção CSRF já prevista na seção 11.
Não há papel vindo do corpo, query ou header, nem novo login/cadastro. Os middlewares novos são usados somente
nas escritas de categorias neste incremento; não se afirma que as demais rotas já apliquem toda a convenção.

**Validação e edição:**

- IDs: inteiros de 1 a 2147483647, em decimal sem zeros à esquerda, como em produtos/peixes. ID malformado: `400`;
  categoria inexistente: `404` em GET/PATCH/DELETE.
- `nome`: string com 2–80 caracteres Unicode após remover espaços nas pontas, sem caracteres de controle.
- `slug`: string com 1–80 caracteres após remover espaços nas pontas, letras minúsculas ASCII/números,
  com hífens simples entre grupos. Não é gerado automaticamente nem convertido para minúsculas.
- Somente `nome` e `slug` são aceitos. Campos desconhecidos, `null`, tipos inválidos, POST incompleto e PATCH
  vazio retornam `400 { erro: "Dados inválidos", detalhes: { ... } }`. Campos omitidos no PATCH são preservados.
- `categorias_nome_key` e `categorias_slug_key` são a autoridade de unicidade: violação `23505` retorna `409`
  com detalhe do campo. Não há consulta prévia sujeita a corrida. Nomes seguem a comparação do banco,
  sem normalização de caixa ou acentos; o mesmo valor do próprio registro pode ser reenviado na edição.
- Os slugs estruturais `peixes`, `aquarios`, `filtros`, `bombas`, `iluminacao`, `termostatos`, `racoes`,
  `condicionadores`, `substratos`, `plantas` e `decoracoes` não podem ser renomeados: `409` com detalhe de `slug`.
  Seus nomes continuam editáveis. A condição faz parte do próprio UPDATE para preservar os discriminadores
  de fichas/filtros e os atalhos de peixes, que já dependem desses valores. Outras categorias permitem editar
  ambos os campos. O PDF não define essa regra; mudar esses identificadores exige uma evolução conjunta dos
  mapeamentos, fora deste incremento. A exclusão continua seguindo somente a regra de vínculos abaixo.

**Exclusão e concorrência:** `categorias` não possui coluna de desativação. O DELETE é físico, parametrizado e
feito diretamente no banco. `produtos_categoria_id_fkey` impede excluir uma categoria com qualquer produto,
inclusive inativo; a violação `23503` é traduzida para `409`, sem detalhes internos. A mesma garantia vale se uma
inserção concorrente confirmar um vínculo enquanto o DELETE aguarda. Não há cascata, exclusão de produtos ou
checagem prévia como única proteção. Sem registro, retorna `404`.

**Diferenças de contrato:** o PDF não detalha corpos, regras de slug ou limites dos campos; esses foram definidos
acima a partir do schema e das consultas existentes. O prefixo local permanece `/api`. A regra genérica local
de soft delete não se aplica a categorias, pois o PDF e este incremento exigem exclusão sem produtos e o schema
não oferece desativação. A validação de corpo usa `400` conforme o PDF, como exceção ao `422` genérico local.
O erro permanece `{ erro: "mensagem", detalhes?: { ... } }`, em vez de `{ erro: "codigo", mensagem: "texto" }`
do PDF. Falhas inesperadas continuam `500 { erro: "Erro interno do servidor" }`.

Testes HTTP e com sessões/PostgreSQL reais verificam o ciclo completo e sua reflexão na listagem,
unicidade concorrente, FK com produtos ativos/inativos e inserção concorrente, além das regressões de produtos
e peixes. Não há mudança de schema/seed nem de consumidores do frontend.

### Produtos — listagem pública implementada em 25/10/2026

`GET /api/produtos` consulta `produtos` e `categorias` no PostgreSQL, sempre com `produtos.ativo = true`.
Segue o envelope e os filtros gerais do [`API_Aquarilandia_Rotas.pdf`](../API_Aquarilandia_Rotas.pdf), páginas 1–3.
O seed atual cria categorias, mas não produtos: sem cadastro no banco, a resposta é `{ "itens": [], "total": 0 }`.

Exemplo ilustrativo para um banco com três produtos ativos correspondentes ao filtro:

```http
GET /api/produtos?categoria=filtros&ordem=preco&pagina=1&limite=1
```
```json
{
  "itens": [{
    "id": 42,
    "categoriaId": 3,
    "categoria": "filtros",
    "nome": "Filtro externo",
    "descricao": "Compacto silencioso",
    "marca": "Aqua",
    "preco": 8990,
    "imagemUrl": null,
    "emEstoque": true
  }],
  "total": 3
}
```

**DTO adotado:** somente os campos do exemplo. IDs são numéricos; `categoria` é o slug obtido pelo relacionamento
com `categorias`; preço é o `INTEGER` do banco, sem conversão de unidade (`8990` = R$ 89,90).
`descricao`, `marca` e `imagemUrl` preservam `null`. `emEstoque` deriva de `estoque > 0`; não expõe a quantidade
nem implementa operações de estoque. Ler `imagem_url` não adiciona gerenciamento de imagens.
Não há `icone`, ficha técnica, `ativo` ou datas neste DTO público.

| Parâmetro | Regra |
|---|---|
| `pagina`, `limite` | Mesmo padrão de categorias: 1/20, inteiros positivos, limite máximo 100 e deslocamento seguro. |
| `categoria` | Slug com 1–80 caracteres, letras minúsculas ASCII/números separados por hífens; nunca o nome de exibição. Slug válido inexistente retorna lista vazia. |
| `busca` | Texto após `trim`, de 1–150 caracteres; trecho do nome, descrição ou marca, sem diferenciar caixa. Não remove acentos. `%`, `_` e `!` são literais. |
| `preco_min`, `preco_max` | Limites inclusivos, em centavos inteiros de 0 a 2147483647 (tipo `INTEGER` do schema). Mínimo não pode superar máximo. |
| `ordem` | `nome` (padrão), `preco` (crescente) ou `-preco` (decrescente); todas desempatam por `id` crescente. |
| `incluir_inativos` | Ausente ou `false`: consulta pública. `true`: `400` com detalhe explícito de funcionalidade administrativa indisponível. Outros valores também são inválidos. |

- Valores numéricos usam notação decimal sem zeros à esquerda; valores repetidos, vazios, fora dos limites,
  parâmetros desconhecidos ou inválidos retornam `400`, antes de consultar o banco. Os filtros técnicos estão descritos abaixo.
- `total` é a quantidade de produtos **ativos que atendem a todos os filtros**, antes da paginação; página além
  do fim mantém esse total e retorna `itens: []`. Página e contagem compartilham o snapshot de uma consulta SQL.
- Os filtros usam parâmetros SQL; a ordenação vem de uma lista fechada de fragmentos, nunca do texto livre recebido.
- Erros mantêm o contrato de categorias e o handler existente: `400 { erro, detalhes }` para parâmetros inválidos
  e `500 { "erro": "Erro interno do servidor" }` para falha do banco, sem informação interna na resposta.

**Pendências frente ao PDF:** os filtros técnicos previstos para a listagem estão implementados na seção abaixo.
`incluir_inativos=true` depende de `autenticar`/`exigirAdmin`; não basta enviar cookie ou indicar um papel na query.
Não há consulta administrativa de inativos, nem alteração global para erros `{ erro: codigo, mensagem }`.
`GET /api/produtos/:id` agora usa os mesmos IDs e campos básicos, conforme o incremento de detalhe abaixo.

**Consumidores:** não há consumidor HTTP atual da listagem no frontend; loja, busca, destaque e carrinho usam
`frontend/src/data/produtos.js`. Uma futura integração deve ler `itens`, paginar, formatar centavos dividindo por
100, usar categoria por slug e tratar o novo DTO. `disponibilidade`/`emEstoque` não são filtros gerais do PDF e
agora retornam `400` nessa rota; os filtros locais do frontend continuam funcionando com seus próprios mocks.
Os dados fixos de produtos do backend foram removidos no incremento de detalhe abaixo.

### Produtos — filtros técnicos implementados em 25/10/2026

Os filtros da página 3 do [`API_Aquarilandia_Rotas.pdf`](../API_Aquarilandia_Rotas.pdf) usam as colunas existentes
das fichas, sem mudar schema ou DTO. Exemplo:

```http
GET /api/produtos?categoria=aquarios&tipo_agua=doce&volume_min=60&volume_max=100&ordem=preco
```

| Filtro | Categorias e regra implementada |
|---|---|
| `tipo_agua` | `doce`, `salobra` ou `marinho`. Peixes usam igualdade de `peixes.tipo_agua`. Aquários, rações e condicionadores usam `tipo_agua` exato ou `ambos` para consultas doce/marinho; não há representação de salobra nessas tabelas. Decorações seguem a convenção abaixo. |
| `volume_min`, `volume_max` | Somente aquários com `aquarios.volume_litros >= volume_min` e/ou `<= volume_max`. Limites inclusivos, em litros. |
| `vazao_min` | Somente filtros ou bombas com `vazao_lh >= vazao_min`. Limite inclusivo, em L/h. |
| `indicado_plantado` | Somente substratos. `true` exige `substratos.tipo = 'fertil'`; `false` exige tipo diferente de `fertil`. |
| `precisa_co2` | Somente plantas com `plantas.precisa_co2` igual ao booleano recebido. |
| `iluminacao` | Somente plantas com `plantas.iluminacao_exigida` igual a `baixa`, `media` ou `alta`. Não filtra a categoria de equipamentos de iluminação. |

**Ambiguidades do contrato e regras escolhidas:**

- O PDF não explica `ambos`, valor do schema para aquários, rações e condicionadores. Interpretamos como
  compatibilidade com água doce **e** marinha. Não inferimos compatibilidade com salobra. A query recebe um
  tipo de água concreto; `tipo_agua=ambos` retorna `400`, assim como valores fora dos enums.
- Decorações não têm coluna `tipo_agua`, apenas `seguro_marinho`. A convenção de consulta considera água doce
  como padrão para fichas de decoração existentes; marinho exige `seguro_marinho = true`; salobra não inclui
  decorações por ausência de informação no modelo. A flag verdadeira também não exclui a decoração da busca doce.
- Não existe coluna `indicado_plantado`. Usamos o tipo explícito `fertil` como classificação para esse filtro.
  `false` inclui os demais tipos cadastrados (areia, cascalho, argila e coral), sem usar `altera_ph` como substituto.
  Essa classificação não expressa todas as possibilidades de uso de um substrato com plantas. Uma regra mais
  detalhada depende de definição da equipe e eventual evolução do modelo, não incluída neste incremento.

**Combinações e integridade:** todos os filtros são combinados por **E** com categoria, busca, preço e entre si.
Filtro técnico sempre exige uma ficha da categoria aplicável. Produto de outra categoria não passa por possuir
uma ficha indevidamente vinculada em outra tabela. Produtos sem ficha continuam disponíveis sem filtro técnico,
mas são excluídos quando não há a ficha necessária para avaliar o filtro. Booleano `false` não significa ausência
de filtro e também restringe a categoria. As consultas usam `EXISTS`, evitando duplicar itens na listagem.

Combinações válidas com interseção vazia retornam `200 { "itens": [], "total": 0 }`, por exemplo
`categoria=plantas&volume_min=60` ou `tipo_agua=doce&vazao_min=400`. Nenhum filtro é ignorado silenciosamente.
Combinar água e volume em aquários ou CO2 e iluminação em plantas aplica todas as condições.

**Validação:** volumes e vazão são inteiros de 1 a 2147483647, coerentes com os tipos/limites positivos do schema.
Volume mínimo maior que máximo retorna `400` com detalhe em `volume_max`. Booleanos aceitam somente `true` e
`false`; iluminação e tipo de água usam os valores exatos acima. Valores repetidos, vazios, notação exponencial,
decimais nesses campos inteiros e parâmetros malformados retornam `400` antes de acessar o banco. Os erros
mantêm o formato local `{ erro, detalhes? }`, sem mudança global para o formato proposto no PDF.

**Paginação e acesso:** envelope `{ itens, total }`, DTO público, preço em centavos, ordenações nome/preço e
desempate por ID permanecem iguais. `total` considera todos os filtros e apenas ativos antes de paginar;
página vazia preserva a contagem filtrada. Todos os valores usam parâmetros SQL e a ordenação continua fechada.
`incluir_inativos=true` segue recusado com `400` enquanto não houver autorização administrativa implementada.
Os detalhes de produto e os dois atalhos de peixes não mudam neste incremento. Não há alteração de frontend.

### Produtos — cadastro administrativo implementado em 25/10/2026

`POST /api/produtos` usa os mesmos `autenticar`, `exigirAdmin` e `exigirOrigem` das escritas de categorias.
Exige cookie `sid` válido, papel atual `admin` e `Origin = CORS_ORIGIN`. Responde `401` sem sessão válida e
`403` para cliente ou Origin ausente/incorreto. Não há novo login nem cadastro separado de peixes.

**Entrada adotada** (o PDF, página 2, define produto + ficha, mas não especifica os campos do corpo):

```json
{
  "categoriaId": 1,
  "nome": "Betta ornamental",
  "descricao": null,
  "marca": null,
  "preco": 2500,
  "estoque": 0,
  "ficha": {
    "tipo": "peixes",
    "dados": {
      "nomeCientifico": "Betta splendens",
      "tipoAgua": "doce",
      "tamanhoAdultoCm": 6.5,
      "tempMinC": 24.5,
      "tempMaxC": 28.5,
      "phMin": 6,
      "phMax": 7.5,
      "aquarioMinLitros": 20,
      "temperamento": "semi_agressivo",
      "dificuldade": "iniciante"
    }
  }
}
```

O ID do exemplo pressupõe o seed; consulte categorias para obter o ID real. `categoriaId`, `nome` e `preco`
são obrigatórios. `categoriaId` deve ser número inteiro de 1 a 2147483647. Nome é texto não vazio de até 150
caracteres Unicode. `preco` é número inteiro de 0 a 2147483647 **centavos**, sem conversão de reais.
`descricao` e `marca` são opcionais/nulos; marca tem até 80 caracteres. Textos são aparados nas pontas;
vazios e caractere nulo são recusados. TEXT não recebe teto adicional além do parser JSON existente.

`estoque` é opcional e aceita exclusivamente o número `0`. O INSERT fixa zero independentemente do corpo;
qualquer outro valor retorna `400` com explicação da futura movimentação. O produto nasce ativo pelo default
do schema, sem imagem (`imagemUrl: null`), e `emEstoque: false`. Não são aceitos `id`, `ativo`, `imagemUrl`,
`emEstoque`, datas, slug no lugar de `categoriaId` ou campos desconhecidos, inclusive dentro de ficha/dados.

**Ficha por categoria:** `ficha.tipo` é o slug da categoria consultada **no banco**. Nas 11 categorias abaixo,
ficha é obrigatória; incompatibilidade, ausência ou `null` retornam `400`. Acessórios e categorias novas sem
discriminador especializado aceitam ficha omitida/`null` e recusam fichas de outras categorias.

| Tipo | Campos obrigatórios em `ficha.dados` | Padrões quando omitidos |
|---|---|---|
| `peixes` | `nomeCientifico`, `tipoAgua`, `tamanhoAdultoCm`, `tempMinC`, `tempMaxC`, `phMin`, `phMax`, `aquarioMinLitros`, `temperamento`, `dificuldade` | `cardumeMinimo: 1` |
| `aquarios` | `volumeLitros`, `comprimentoCm`, `larguraCm`, `alturaCm`, `material`, `tipoAgua` | — |
| `filtros` | `tipo`, `vazaoLh` | — |
| `bombas` | `tipo`, `vazaoLh` | — |
| `iluminacao` | `tecnologia`, `potenciaW` | — |
| `termostatos` | `potenciaW` | `ajustavel: true` |
| `racoes` | `formato`, `pesoG`, `tipoAgua` | — |
| `condicionadores` | `tipo`, `tipoAgua` | — |
| `substratos` | `tipo`, `pesoKg` | `alteraPh: false` |
| `plantas` | `nome`, `posicao`, `iluminacaoExigida`, `dificuldade` | `precisaCo2: false` |
| `decoracoes` | `material` | `materialNatural: false`, `seguroMarinho: false` |

Os demais campos públicos de cada ficha constam na tabela de detalhe abaixo; são opcionais e normalizados
para `null`. Campos com default não aceitam `null`. Booleanos exigem `true`/`false` JSON; números exigem tipo
numérico, sem coerção de strings. Enums exigem os valores exatos dos CHECKs do schema (sem tradução de rótulos).
As definições completas de colunas, enums, nulabilidade e defaults estão em `src/modulos/catalogo/ficha.definicoes.ts`,
verificadas por tipos contra `FichaTecnica` e por testes com PostgreSQL.

Limites respeitam `INTEGER`, `VARCHAR` e `NUMERIC(p,s)` do banco:

- Contagens, litros, ml, g, vazão, saídas e temperatura de cor: inteiros positivos até 2147483647.
- Dimensões e potências `NUMERIC(6,1)`: até 99999.9, com uma casa decimal; dimensões e potência obrigatória
  são positivas. Potência opcional de filtros/bombas aceita zero.
- Tamanho adulto: 0.1–9999.9 cm; temperaturas: -999.9–999.9 °C; pH: 0–14, com uma casa decimal.
- Altura manométrica: 0.01–99.99 m; peso de substrato: 0.01–999.99 kg, com duas casas decimais.
- `nomeCientifico`, `origem` e nome de planta: até 120 caracteres; granulometria: 20; cor: 40.
- Não há arredondamento silencioso: casas excedentes, valores não finitos, máximos menores que mínimos
  (temperatura, pH e volume do termostato) ou outros dados inválidos retornam `400 { erro, detalhes }`.
  Quando um limite opcional é nulo, o par segue a semântica do CHECK SQL e não exige o outro limite.

**Transação e resposta:** o service usa o helper compartilhado `comTransacao`, previsto neste documento e
agora implementado. Consulta a categoria com `FOR SHARE`, impedindo alteração/exclusão até concluir a gravação.
Produto, ficha e leitura do DTO usam a **mesma conexão**. Só retorna `201` após COMMIT, com o mesmo objeto
de `GET /api/produtos/:id`, incluindo a ficha completa/defaults/nulos. Falha de ficha ou leitura provoca rollback;
uma conexão cujo rollback falhou é descartada. O produto confirmado aparece na lista e, sendo peixe, nos atalhos.

Categoria inexistente é `400` com detalhe de `categoriaId`, consistente com os status de POST no PDF.
`peixes.nome_cientifico` é único: violação da constraint retorna `409`, inclusive para criações concorrentes,
e o produto intermediário é desfeito. Não se inventa unicidade de nome para produtos comuns. Falhas inesperadas
mantêm `500` genérico. O formato de erro local continua diferente de `{ erro: codigo, mensagem }` do PDF;
`400` de validação é uma exceção ao `422` genérico local, como nos incrementos anteriores do catálogo.

**Estoque futuro, ainda não implementado:** entradas devem passar por `POST /api/estoque/movimentacoes`,
com quantidade, motivo e responsável da sessão, gravando movimento e saldo na mesma transação. Este cadastro
apenas inicia o saldo em zero; não oferece entrada positiva nem cria o módulo de estoque. A divergência entre
PDF (baixa no pagamento) e decisões locais (baixa na criação da venda) permanece para decisão conjunta,
sem afetar este cadastro. Revisão do último pull: [`docs/revisao-pull-cadastro-produtos.md`](docs/revisao-pull-cadastro-produtos.md).

### Produtos — edição parcial implementada em 26/10/2026

`PATCH /api/produtos/:id` exige `autenticar`, `exigirAdmin` e `exigirOrigem`, como o POST. Sessão válida vem
do cookie `sid` e o papel atual vem do banco. Sem sessão válida: `401`; cliente: `403`; admin sem Origin
igual a `CORS_ORIGIN`: `403`. IDs seguem o mesmo inteiro positivo das consultas. Inexistentes e inativos
retornam o mesmo `404 { erro: "Produto não encontrado" }`, inclusive com sessão admin.

**Corpo de entrada** (exemplo de peixe; o tipo não é enviado):

```json
{
  "nome": "Betta ornamental",
  "preco": 3500,
  "descricao": null,
  "ficha": {
    "dados": {
      "origem": "Brasil",
      "phMin": 6.5
    }
  }
}
```

Somente `nome`, `descricao`, `marca`, `preco` e `ficha` são aceitos. É obrigatório enviar pelo menos um
campo. `ficha` aceita somente `dados`, um objeto não vazio com campos da ficha correspondente à categoria
existente. Não reenvie o DTO inteiro de GET como PATCH: `id`, `categoriaId`, `categoria`, `ativo`, `estoque`,
`imagemUrl`, `emEstoque`, datas e `ficha.tipo` são recusados com `400`, **mesmo se o valor não mudar**.
Campos desconhecidos também são recusados, em todos os níveis. Não há alteração de categoria, remoção da
ficha, imagem, desativação nem saldo por esta rota; `estoque: 0` também é proibido no PATCH.

| Entrada | Semântica |
|---|---|
| Campo omitido | Mantém o valor atual do banco; não recebe default nem substitui o restante da ficha. |
| `descricao: null`, `marca: null` | Limpa o campo. Texto não nulo segue os limites e normalização do POST. |
| `nome: null`, `preco: null` | `400`; são obrigatórios no estado final. Preço é inteiro em centavos, 0–2147483647. |
| `ficha` omitida | Mantém a ficha; não executa UPDATE na tabela de ficha. |
| `ficha: null`, `dados: null` ou `{}` | `400`; não removem a ficha nem representam uma edição. |
| Campo anulável de `ficha.dados` com `null` | Limpa somente esse campo, conforme o schema. |
| Campo obrigatório/default de ficha com `null` | `400`; defaults são de criação, não comandos para restaurar valores. |
| `ficha.dados` parcial | Combina com os valores atuais e valida o estado final; UPDATE grava só os campos enviados. |

Os enums, tipos, precisão e intervalos são os mesmos do POST e das colunas SQL. Por exemplo, editar somente
`tempMaxC`/`phMax` exige que o valor seja maior ou igual ao mínimo **atual**, inclusive após uma edição concorrente.
Um acessório/categoria sem tabela não aceita `ficha`. Produto especializado legado sem ficha pode ser reparado
enviando em `ficha.dados` todos os campos obrigatórios da categoria; edição apenas dos básicos nesse estado
retorna `400`, sem alterações parciais. As consultas públicas de dados legados sem ficha continuam iguais.

**Atomicidade e concorrência:** o helper `comTransacao` abre uma única conexão para lock, leitura, validação,
edição e composição do DTO. `FOR NO KEY UPDATE` serializa as edições do produto sem impedir leituras de FK;
a categoria recebe `FOR SHARE`. O estado é lido novamente **depois** de obter o lock. Atualizações gravam
apenas campos enviados, com colunas/tabelas de listas fechadas e valores parametrizados. A ficha usa sua tabela
existente; somente o reparo de legado sem ficha faz INSERT. `produtos.atualizado_em` é atualizado também numa
edição só da ficha. Falha em qualquer parte provoca rollback, inclusive do timestamp.

Edições simultâneas de campos distintos preservam ambos; num mesmo campo vence a última edição serializada.
Não há versionamento otimista/`If-Match` neste incremento. A garantia de lock pressupõe os escritores usando
o protocolo de transação do módulo; SQL externo não é uma interface suportada para editar fichas.

Após COMMIT, retorna `200` com o DTO de `GET /api/produtos/:id`, sem quantidade de estoque ou campos internos.
As alterações aparecem em lista/detalhe e, para peixes com ficha, nos dois atalhos. Duplicidade de nome científico
é `409` e desfaz toda a edição. Dados inválidos são `400`; falhas inesperadas continuam `500` genérico.
Mantém o erro local `{ erro: "mensagem", detalhes?: { ... } }`, diferente de `{ erro: codigo, mensagem }` no PDF.
O PDF cita estoque no PATCH; este incremento o exclui por instrução expressa: saldo exige movimentação futura.

**Parser compartilhado:** limite explícito de 100 KiB de JSON (`413` acima do limite). Corpos comprimidos
são recusados com `415`. Em 29/10/2026, o lockfile foi atualizado para `body-parser@2.4.0`, corrigindo
GHSA-27r3-jxmh-p828; `inflate: false` e o limite continuam como defesa adicional, sem mudança do contrato.
Essa restrição vale também para as demais rotas que usam o parser global. JSON malformado mantém `400`.
O parser atua antes de sessão/rotas; portanto esses erros de corpo podem ocorrer antes do `401`.
Revisão de segurança e pendências de outros módulos: [`docs/seguranca-backend-2026-10-26.md`](docs/seguranca-backend-2026-10-26.md).

### Produtos — desativação administrativa implementada em 30/10/2026

`DELETE /api/produtos/:id` segue o PDF (páginas 1–2) e D-13: desativa, sem exclusão física.
Reutiliza `autenticar → exigirAdmin → exigirOrigem`, nessa ordem, e o mesmo `lerIdCatalogo` do PATCH.
O papel atual vem da sessão consultada no PostgreSQL, não de body/query/header. Origin deve ser exatamente
`CORS_ORIGIN`, incluindo em chamadas administrativas fora do navegador.

| Situação | Resposta |
|---|---|
| Produto ativo desativado por admin | `204`, corpo vazio e sem JSON |
| Produto inexistente, previamente inativo ou DELETE repetido | `404 { "erro": "Produto não encontrado" }` |
| ID inválido, com sessão/admin/Origin válidos | `400 { erro, detalhes: { id: ... } }` |
| Sem sessão válida, expirada/revogada ou conta inativa | `401` |
| Cliente autenticado, Origin ausente/null/diferente | `403` |
| Falha inesperada do banco | `500 { "erro": "Erro interno do servidor" }` |

Exemplo de requisição (sem corpo):

```http
DELETE /api/produtos/42
Origin: http://localhost:5173
Cookie: sid=<sessao-admin>
```

Só o ID numérico do caminho identifica o alvo. Corpo/query não controlam campos; eventual JSON válido é
ignorado pela operação, sujeito ao parser global de 100 KiB/sem compressão. Não envie `ativo`, estoque ou
DTO de produto nesta chamada. ID deve estar entre 1 e 2147483647, sem zeros à esquerda ou notação exponencial.
Erros de parser continuam podendo preceder `401`; a guarda administrativa precede a validação do ID.

A única escrita parametrizada altera `ativo=false` e `atualizado_em`, condicionada a `WHERE id=$1 AND ativo`.
Produto, categoria, preço, imagem, saldo, data de criação, todas as fichas e vínculos históricos permanecem.
Não há baixa/ajuste de estoque, reativação, alteração de venda nem tabela de movimentações criada nesta rota.
Uma falha desfaz a instrução inteira. Não é necessário abrir transação com múltiplas consultas para essa escrita única.

O lock do UPDATE serializa com o `FOR NO KEY UPDATE` do PATCH e com outro DELETE. Se PATCH obtém o lock
primeiro, confirma a edição antes da desativação, que preserva seus novos valores; se DELETE confirma primeiro,
PATCH reavalia o estado e retorna `404`, sem editar a ficha ou reativar o produto. Dois DELETEs concorrentes
produzem um `204` e um `404`. Chamadas repetidas não modificam novamente o timestamp. Leituras que começam
depois do commit excluem o inativo; uma leitura em andamento pode observar seu snapshot anterior.

Após sucesso, o produto sai de listagens/detalhes/totais públicos, inclusive os dois atalhos de peixes. Os DTOs
restantes não mudam. Um cliente HTTP deve tratar `204` sem chamar `response.json()` e atualizar sua lista/contagem.
Repetir pode retornar `404` com o mesmo efeito final de ausência pública. Acesso administrativo a inativos e
reativação seguem pendentes, sem mudar `incluir_inativos=true` nesta rodada. O frontend ainda precisa ligar suas
consultas reais à API; não foi modificado nesta tarefa.

Mantém-se o formato local `{ erro: mensagem, detalhes? }`, diferente de `{ erro: codigo, mensagem }` do PDF.
Os testes HTTP e PostgreSQL cobrem guardas, IDs, 11 fichas, legado sem ficha, dados históricos, visibilidade,
contagens, repetição, falhas reais e as duas ordens de PATCH/DELETE. Decisão D-42 e relatório da rodada em
[`docs/homologacao-delete-produtos-2026-10-30.md`](docs/homologacao-delete-produtos-2026-10-30.md).

### Produtos — detalhe público implementado em 25/10/2026

`GET /api/produtos/:id` consulta o produto ativo e sua ficha técnica no PostgreSQL, conforme a página 2 do
[`API_Aquarilandia_Rotas.pdf`](../API_Aquarilandia_Rotas.pdf). O ID é o mesmo inteiro numérico da listagem,
entre 1 e 2147483647 (`SERIAL`). IDs textuais, zero, negativos, decimais, notação exponencial, espaços e zeros
à esquerda retornam `400 { erro, detalhes: { id: ... } }`, sem consultar o banco. Não há fallback para mocks.

Exemplo ilustrativo de resposta `200` para `GET /api/produtos/42`:

```json
{
  "id": 42,
  "categoriaId": 2,
  "categoria": "aquarios",
  "nome": "Aquário 40 L",
  "descricao": null,
  "marca": null,
  "preco": 24990,
  "imagemUrl": null,
  "emEstoque": true,
  "ficha": {
    "tipo": "aquarios",
    "dados": {
      "volumeLitros": 40,
      "comprimentoCm": 50,
      "larguraCm": 25,
      "alturaCm": 32,
      "material": "vidro",
      "tipoAgua": "doce"
    }
  }
}
```

**Formato:** objeto direto, sem envelope. Os campos básicos são exatamente os de `ProdutoPublico` da listagem,
com preço em centavos e `emEstoque = estoque > 0`. O único campo adicional é `ficha`, que é `null` ou
`{ tipo, dados }`. `tipo` é o slug da categoria; os campos de `dados` são uma seleção explícita da tabela
correspondente, convertidos para camelCase. `NUMERIC`/`INTEGER` são números JSON, booleanos são booleanos e
campos opcionais preservam `null`. Enums mantêm os valores do schema. Não são expostos `produto_id`, saldo
quantitativo, `ativo`, datas ou outras colunas internas, mesmo que uma tabela ganhe novas colunas.

| Categoria / tabela | Campos de `ficha.dados` |
|---|---|
| `peixes` | `nomeCientifico`, `origem`, `tipoAgua`, `tamanhoAdultoCm`, `tempMinC`, `tempMaxC`, `phMin`, `phMax`, `aquarioMinLitros`, `temperamento`, `nivelNatacao`, `cardumeMinimo`, `dieta`, `dificuldade` |
| `aquarios` | `volumeLitros`, `comprimentoCm`, `larguraCm`, `alturaCm`, `material`, `tipoAgua` |
| `filtros` | `tipo`, `vazaoLh`, `aquarioMaxLitros`, `potenciaW`, `voltagem`, `midiasInclusas` |
| `bombas` | `tipo`, `vazaoLh`, `alturaMaxM`, `saidas`, `potenciaW`, `voltagem` |
| `iluminacao` | `tecnologia`, `potenciaW`, `comprimentoCm`, `espectro`, `temperaturaCorK`, `voltagem` |
| `termostatos` | `potenciaW`, `aquarioMinLitros`, `aquarioMaxLitros`, `tempMinC`, `tempMaxC`, `ajustavel`, `voltagem` |
| `racoes` | `formato`, `pesoG`, `tipoAgua`, `indicadaPara` |
| `condicionadores` | `tipo`, `volumeMl`, `dosagem`, `principioAtivo`, `tipoAgua` |
| `substratos` | `tipo`, `pesoKg`, `granulometriaMm`, `cor`, `alteraPh` |
| `plantas` | `nome`, `posicao`, `iluminacaoExigida`, `precisaCo2`, `crescimento`, `dificuldade`, `tempMinC`, `tempMaxC` |
| `decoracoes` | `material`, `materialNatural`, `comprimentoCm`, `larguraCm`, `alturaCm`, `seguroMarinho` |

Unidades seguem os nomes dos campos: cm, L, L/h, m, W, K, g, kg e ml. `granulometriaMm` permanece texto
(por exemplo, `"1-3 mm"`), conforme o schema. `plantas.nome` permanece `ficha.dados.nome`; não é convertido
em nome científico sem definição no modelo. Tipos e nulabilidade: `src/modulos/catalogo/ficha.types.ts`.

**Ausência de ficha:** acessórios não têm tabela própria. O schema também não obriga que um produto de uma
categoria especializada tenha sua linha de detalhe. Nesses casos, ou para uma categoria sem mapeamento,
o produto ativo retorna `200` com `ficha: null`. Não são inventados dados e a ausência de ficha não torna o
produto inexistente. A validação de completude no futuro cadastro continua pendente, sem alterar o schema agora.

**Categoria e acesso:** a seleção da ficha usa o slug da categoria vinculada ao produto, nunca a query.
Uma ficha indevidamente associada em outra tabela é ignorada. Produto inexistente ou inativo retorna o mesmo
`404 { "erro": "Produto não encontrado" }`, mesmo com ficha, cookie ou `incluir_inativos=true` na query.
A leitura usa uma única consulta, `p.id = $1 AND p.ativo`; falha do banco retorna o `500` genérico existente.

**Diferenças frente ao PDF:** o PDF exige ficha, mas não nomeia seu campo ou define ausência; o envelope
`ficha: { tipo, dados } | null` é a decisão deste incremento. O PDF lista `200/404` para detalhe; adotamos também
`400` para ID inválido, coerente com a API local. Os erros continuam com `AppError`/`errorHandler` no formato
`{ erro, detalhes? }`, em vez de `{ erro: codigo, mensagem }`. Nenhuma mudança global de erros foi feita.

**Consumidores e pendências:** não há consumidor HTTP atual do detalhe no frontend. Seus helpers continuam
usando os próprios mocks e IDs textuais, e não foram migrados para esta API. Os testes que consultavam o detalhe
legado foram adaptados. Os atalhos de peixes seguem o incremento abaixo e os filtros técnicos de produtos
estão documentados na seção própria acima. Sem CRUD ou mudança de schema.

### Peixes — atalhos públicos implementados em 25/10/2026

Conforme a página 3 do [`API_Aquarilandia_Rotas.pdf`](../API_Aquarilandia_Rotas.pdf), peixe é produto da categoria
`peixes`; não existe um ID ou cadastro público separado. `GET /api/peixes` e `GET /api/peixes/:id` consultam
`produtos`, `categorias` e `peixes`, exigindo produto ativo, slug `peixes` e ficha existente (`INNER JOIN`).

**DTO das duas rotas:** cada item da lista e o objeto do detalhe são `PeixePublico`: os mesmos campos básicos
de produto mais `ficha: { tipo: "peixes", dados: ... }`, completa e não nula. O detalhe é idêntico ao objeto
obtido por `GET /api/produtos/:id` para esse produto. As projeções SQL de produto/ficha e a validação do ID são
compartilhadas para evitar divergências. `preco` está em centavos e `emEstoque` deriva de `estoque > 0`.
Um produto ativo com saldo zero continua aparecendo com `emEstoque: false`.

Exemplo ilustrativo de objeto retornado por `GET /api/peixes/42`:

```json
{
  "id": 42,
  "categoriaId": 1,
  "categoria": "peixes",
  "nome": "Betta",
  "descricao": null,
  "marca": null,
  "preco": 2000,
  "imagemUrl": null,
  "emEstoque": true,
  "ficha": {
    "tipo": "peixes",
    "dados": {
      "nomeCientifico": "Betta splendens",
      "origem": null,
      "tipoAgua": "doce",
      "tamanhoAdultoCm": 6.5,
      "tempMinC": 24.5,
      "tempMaxC": 28.5,
      "phMin": 6,
      "phMax": 7.5,
      "aquarioMinLitros": 20,
      "temperamento": "semi_agressivo",
      "nivelNatacao": null,
      "cardumeMinimo": 1,
      "dieta": null,
      "dificuldade": "iniciante"
    }
  }
}
```

A lista usa `{ "itens": [ ...objetos com esse mesmo DTO... ], "total": 0 }`; o exemplo acima não descreve
um registro de seed. `total` é o número de peixes públicos com ficha que atendem a **todos** os filtros,
antes da paginação. Ordem fixa por nome crescente e, em caso de empate, ID crescente. Página além do fim
retorna `itens: []` preservando o total filtrado. Página e total usam o mesmo snapshot de uma consulta.

| Parâmetro | Semântica e validação |
|---|---|
| `pagina`, `limite` | Inteiros positivos sem zeros à esquerda, padrões 1/20, máximo 100 itens e deslocamento seguro; mesmo padrão das outras listas. |
| `temperatura` | °C; `temp_min_c <= valor <= temp_max_c`, inclusivo. Decimal finito de -999.9 a 999.9, intervalo representável no schema `NUMERIC(4,1)`. |
| `ph` | `ph_min <= valor <= ph_max`, inclusivo; decimal de 0 a 14. Zero é filtro válido. |
| `tamanho_max` | Adulto com `tamanho_adulto_cm <= valor`, em cm; decimal maior que zero e até 9999.9, conforme `NUMERIC(5,1)`. |
| `aquario_litros` | `aquario_min_litros <= valor`, em litros; inteiro de 1 a 2147483647. Verifica apenas o volume mínimo da ficha. |
| `dificuldade` | `iniciante`, `intermediario` ou `avancado`. |
| `temperamento` | `pacifico`, `semi_agressivo` ou `agressivo`. |
| `tipo_agua` | `doce`, `salobra` ou `marinho`. |
| `busca` | Após `trim`, 1–150 caracteres; trecho do nome popular (`produtos.nome`) **ou** científico (`peixes.nome_cientifico`), sem diferenciar caixa. Não busca descrição/marca nem remove acentos. |

Decimais usam ponto, sem notação exponencial ou vírgula. A consulta não arredonda os filtros à precisão
armazenada: por exemplo, `24.49` não atende a uma faixa iniciada em `24.5`. Temperaturas negativas são
valores de consulta permitidos pelo tipo SQL, não recomendações de manutenção. Curingas `%`, `_` e `!` na
busca são texto literal. Valores repetidos, vazios, inválidos ou parâmetros não previstos retornam `400`
antes de consultar o banco. Não há aliases legados `filtros=doce,disp`, `tipoAgua`, `facil` ou `salgada`.
Todos os valores usam parâmetros SQL; não há seleção de categoria ou ordenação por texto livre.

**Ficha ausente e acesso:** produto da categoria `peixes` sem linha de ficha é omitido da lista/total e retorna
`404 { "erro": "Peixe não encontrado" }` em `/api/peixes/:id`. O detalhe genérico de produto continua retornando
`200` com `ficha: null`; essa diferença é intencional. ID inexistente, produto inativo ou de outra categoria
também retorna `404` no atalho, inclusive se houver uma linha de peixe indevidamente vinculada a esse produto.
Cookie, `categoria` ou `incluir_inativos` na query do detalhe não ampliam acesso. Na listagem, esses parâmetros
não previstos retornam `400`. IDs seguem a mesma validação numérica de produtos (1 a 2147483647).

**Erros e consumidores:** preservados `AppError`/`errorHandler`, `400 { erro, detalhes }`, `404 { erro }` e
`500 { "erro": "Erro interno do servidor" }`. O formato do PDF `{ erro: codigo, mensagem }` continua pendente;
o `400` para ID inválido segue a convenção local, embora o PDF só liste `200/404` para o detalhe. Os mocks de
peixes do backend e seus tipos antigos foram removidos após verificar seus únicos consumidores no catálogo.
O frontend não faz chamadas HTTP a essas rotas e não foi alterado: continua com seus próprios mocks, IDs e
filtros locais. O seed cria categorias, mas nenhum produto/ficha; sem registros reais, os atalhos retornam vazio/404.

---

### Orçamentos — acesso administrativo corrigido em 26/10/2026

Somente `POST /api/orcamentos` é público. O router registra esse POST antes de uma guarda comum
`autenticar, exigirAdmin`; consultas e demais caminhos do módulo passam pela sessão e papel atual do banco.
Sem sessão válida: `401`; cliente autenticado: `403`. Não há papel vindo do body/query/header, nem dependência
de CORS ou de esconder botões no frontend. GET não exige Origin; futuras escritas administrativas deverão
aplicar também a convenção de `exigirOrigem` quando seus handlers forem implementados.

| Rota do PDF (com prefixo local) | Estado após esta correção |
|---|---|
| `POST /api/orcamentos` | Implementado, público, `201`; mantém o formulário e validações atuais. |
| `GET /api/orcamentos` | Implementado, somente admin, `200` com array do DTO abaixo. |
| `GET /api/orcamentos/:id` | Guarda administrativa aplicada; handler ausente, admin recebe `404`. |
| `PATCH /api/orcamentos/:id` | Guarda administrativa aplicada; status/resposta ainda não implementados, admin recebe `404`. |
| `DELETE /api/orcamentos/:id` | Guarda administrativa aplicada; exclusão ausente, admin recebe `404`. |

Os caminhos incompletos também respondem `401`/`403` antes de chegar ao `404`. HEAD da listagem herda a mesma
autorização do GET. Não foram criados cadastro separado, resposta, edição ou exclusão de orçamentos.

```json
[
  {
    "id": "uuid-do-orcamento",
    "criadoEm": "2026-10-26T20:00:00.000Z",
    "nome": "Pessoa de exemplo",
    "telefone": "32999999999",
    "servico": "Manutenção",
    "mensagem": "Quero um orçamento."
  }
]
```

A listagem projeta explicitamente somente `id`, `criadoEm`, `nome`, `telefone`, `servico` e `mensagem`
(opcional, omitida se ausente). São os dados necessários para identificar e atender a solicitação; metadados
internos, sessão e credenciais não fazem parte do DTO. A resposta administrativa envia `Cache-Control: no-store`.
Erros de sessão/permissão contêm apenas a mensagem genérica existente; falhas inesperadas retornam `500` genérico.
Mudanças de papel, conta inativa e revogação de sessão no banco são respeitadas na próxima requisição.

**Limites desta correção:** orçamentos continuam em memória; formato de array legado foi preservado. Persistência,
detalhe, status/resposta, exclusão, filtro `status`, paginação/envelope `{ itens, total }` do PDF e rate limit
continuam pendentes. Não há campos de status/resposta inventados. O POST mantém seu `422` de validação e os
erros mantêm `{ erro: mensagem, detalhes? }`, em vez de `{ erro: codigo, mensagem }` do PDF.
As requisições manuais em `http/clientes-vendas.http` foram ajustadas para refletir o acesso administrativo.

## 5. Erros

Sempre lançar `AppError` (de `utils/AppError.ts`). Nunca responder erro manualmente no controller.

```ts
throw new AppError('Cliente não encontrado', 404)
throw new AppError('Dados inválidos', 422, { email: 'E-mail inválido.' })
```

Formato da resposta (já feito pelo `errorHandler`):
```json
{ "erro": "Dados inválidos", "detalhes": { "email": "E-mail inválido." } }
```

| Status | Quando |
|---|---|
| `400` | Requisição malformada (id não numérico, query inválida, JSON malformado no body) |
| `401` | Sem login, sessão expirada ou credenciais inválidas |
| `403` | Logado, mas sem permissão (cliente em rota de admin) |
| `404` | Recurso não existe (ou está `ativo = false`) |
| `409` | Conflito de regra: e-mail já cadastrado, estoque insuficiente, venda já cancelada |
| `422` | Validação de campos do body — `detalhes` com uma mensagem por campo |
| `429` | Muitas tentativas (rate limit) |
| `500` | Erro inesperado (o handler já trata, não lance manualmente) |
| `502` | Gateway de pagamento indisponível |

Recurso de outro cliente responde **404** (não 403), para não confirmar que ele existe.

- Mensagens em português, para o usuário final, terminando com ponto em `detalhes`.
- Chaves de `detalhes` = nome do campo no body (camelCase). Em itens de lista: `"itens.0.quantidade"`.
- O Express 5 já repassa erros de funções `async` para o `errorHandler` — **não precisa de `try/catch` no controller**.

---

## 6. Validação

- Fica no **service**, numa função `validar<Algo>` privada do arquivo (ver `orcamento.service.ts`).
- Junta **todos** os erros em `Record<string, string>` e lança um único `AppError(…, 422, erros)`.
- Normaliza antes de salvar: `trim()`, telefone só dígitos, e-mail em minúsculo.
- Conversão de `req.params`/`req.query` (string → number etc.) fica no controller, usando helpers de `utils/validacao.ts` (ex.: `idParam(req.params.id)` que lança `400` se não for inteiro positivo).

### Regras do cadastro de cliente

| Campo | Normalização | Regra | Mensagem |
|---|---|---|---|
| `nome` | `trim` | 2 a 120 caracteres | Digite seu nome (pelo menos 2 letras). |
| `email` | `trim` + minúsculas | um `@`, algo antes, domínio com ponto, sem espaços, até 160 caracteres | Digite um e-mail válido. Exemplo: nome@email.com. |
| `senha` | nenhuma (não fazer `trim`) | 8 a 128 caracteres | A senha precisa ter pelo menos 8 caracteres. |
| `telefone` | só dígitos | exatamente 11 dígitos (celular com DDD) | Digite um celular com DDD. Exemplo: (32) 99999-0000. |
| `aceiteTermos` | — | exatamente `true` | Para criar a conta, aceite os termos de uso e a política de privacidade. |

- E-mail já cadastrado → `409` com detalhes `{ email: 'Este e-mail já está cadastrado.' }`.
- A `novaSenha` da redefinição de senha (seção 11) segue a mesma regra de `senha`.

---

## 7. Banco de dados

### Nomes
| Item | Padrão | Exemplo |
|---|---|---|
| Tabela | plural, `snake_case` | `clientes`, `itens_venda`, `movimentacoes_estoque` |
| Coluna | `snake_case` | `nome_cientifico`, `preco_unitario` |
| PK | `id SERIAL` (tabela de detalhe 1:1 usa `produto_id`) | |
| FK | `<entidade no singular>_id` | `cliente_id`, `venda_id` |
| Índice | `idx_<tabela>_<coluna(s)>` | `idx_vendas_cliente` |
| Dinheiro | `INTEGER` em centavos + `CHECK (>= 0)` | `preco`, `total`, `preco_unitario` |
| Datas | `criado_em` / `atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()` | |
| Enum | `TEXT` + `CHECK (col IN (...))`, valores minúsculos `snake_case` | `status IN ('aberta', 'paga', 'cancelada')` |
| Enum usado em mais de uma coluna | `CREATE DOMAIN <nome> AS TEXT CHECK (VALUE IN (...))` — a lista fica num lugar só | `status_venda` (vendas e histórico) |
| Soft delete | `ativo BOOLEAN NOT NULL DEFAULT TRUE` | |

### Arquivos SQL — um por domínio, para não editarmos o mesmo arquivo

O Postgres executa `db/init/*.sql` em ordem alfabética, então a numeração define a ordem das FKs:

| Arquivo | Dono | Conteúdo |
|---|---|---|
| `01_schema.sql` *(já existe — renomear para `01_catalogo.sql`)* | Dev 2 | categorias, produtos, tabelas de detalhe |
| `10_clientes.sql` | Celio | clientes, enderecos_cliente, sessoes, tokens_recuperacao_senha |
| `20_vendas.sql` | Celio | domain status_venda, vendas, itens_venda, historico_status_venda, pagamentos, eventos_webhook |
| `30_estoque.sql` | Dev 2 | movimentacoes_estoque (pode ter FK para vendas) |
| `90_seed.sql` | ambos (só `INSERT`) | dados de exemplo |

Os scripts de init só rodam com o volume vazio: depois de mudar um `.sql`, rode `npm run db:reset`.

### Queries
- Só a camada `repository` importa `db` de `config/db.ts`.
- **Sempre** parâmetros (`$1, $2`). Nunca concatenar valores do usuário na string SQL.
- Listar nunca usa `SELECT *` — liste as colunas com alias camelCase.
- Toda listagem filtra `WHERE ativo` por padrão.
- `UPDATE` sempre seta `atualizado_em = now()`.
- Operações que escrevem em mais de uma tabela usam transação com o helper compartilhado:

```ts
// utils/transacao.ts (compartilhado)
import type { PoolClient } from 'pg'
import { db } from '../config/db.js'

export async function comTransacao<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const resultado = await fn(client)
    await client.query('COMMIT')
    return resultado
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
```

Funções de repository que podem rodar dentro de transação recebem o executor como **último** parâmetro opcional:
```ts
inserir(dados: NovaVenda, executor: Queryable = db) { ... }
```

---

## 8. Comunicação entre módulos (vendas ↔ catálogo/estoque)

Um módulo **nunca** importa o repository do outro nem faz SQL em tabela do outro. Usa apenas as funções públicas do **service**, com os contratos abaixo. Mudou a assinatura? Avise e atualize aqui.

**Regra de estoque:** só o módulo `estoque` escreve em `produtos.estoque`. Toda mudança gera uma linha em `movimentacoes_estoque`.

### Contratos que o Dev 2 expõe (Celio consome em vendas)

```ts
// modulos/catalogo/produto.service.ts
produtoService.buscarParaVenda(ids: number[]): Promise<ProdutoVenda[]>
// ProdutoVenda = { id: number; nome: string; preco: number; ativo: boolean; categoria: string }
// categoria = categorias.slug (vendas precisa saber quais itens são 'peixes' para a regra de entrega)
//   (decidido em 19/10/2026 — implementação: Dev 2)
// Retorna só os encontrados; quem chama decide o erro para id faltando.

// modulos/estoque/estoque.service.ts
estoqueService.baixarParaVenda(vendaId: number, itens: ItemMovimento[], client: PoolClient): Promise<void>
estoqueService.estornarVenda(vendaId: number, client: PoolClient): Promise<void>
// ItemMovimento = { produtoId: number; quantidade: number }
// baixarParaVenda lança AppError 409 'Estoque insuficiente'
//   com detalhes { "itens.<indice>.quantidade": "Só restam N unidades." }
```

`baixarParaVenda` faz `UPDATE produtos SET estoque = estoque - $1 WHERE id = $2 AND estoque >= $1`;
se nenhuma linha for afetada, lança o 409 acima. O `CHECK (estoque >= 0)` do banco é só rede de segurança.
(decidido em 19/10/2026 — implementação: Dev 2)

```ts
// modulos/catalogo/servico.service.ts
servicoService.listarOpcoes(): Promise<string[]>   // valores aceitos no campo servico do orçamento
// (decidido em 19/10/2026 — implementação: Dev 2)
```

(para o módulo `orcamentos` não importar `data/servicos.ts` diretamente)

`ProdutoVenda` e `ItemMovimento` ficam em `types/index.ts` (compartilhado), porque os dois módulos usam.

### Fluxo de `POST /api/vendas`
1. `vendaService.criar` valida o body.
2. Chama `produtoService.buscarParaVenda` → confere se todos existem e estão ativos.
3. Calcula o frete (fora da transação).
4. Abre `comTransacao`: insere `vendas` e `itens_venda` (guardando `preco_unitario` do momento da venda) → chama `estoqueService.baixarParaVenda(vendaId, itens, client)`. A venda nasce como `'aguardando_pagamento'`, com `expira_em` = criação + 30 minutos.
5. Se qualquer passo lançar erro, tudo é desfeito.

### Gateway de pagamento
O gateway de pagamento **ainda não foi escolhido** (prazo: **29/10/2026**). Requisitos:
- página de pagamento hospedada pelo gateway (cartão e PIX) — o backend nunca recebe dados de cartão;
- API de estorno;
- webhooks com assinatura;
- ambiente de testes;
- conta no nome da loja.

Todo o código do gateway fica isolado em `modulos/pagamentos/gateway.ts`, e o banco usa nomes genéricos
(`gateway_*`), para que a escolha afete só esse arquivo. Variáveis: `GATEWAY_ACCESS_TOKEN` e `GATEWAY_WEBHOOK_SECRET`.

### Venda não paga, pagamento e cancelamento
- Uma tarefa agendada do módulo `vendas` cancela vendas `'aguardando_pagamento'` vencidas e chama
  `estoqueService.estornarVenda`.
- O webhook só confirma o pagamento (venda → `'paga'`); não mexe em estoque. Sempre valida a
  assinatura e reconsulta o pagamento na API do gateway antes de confirmar.
- Pagamento aprovado de venda já cancelada ou expirada → o módulo `vendas` solicita o estorno.
- Cancelar venda paga: estorno **automático** do valor total pela API do gateway, com chave de
  idempotência; depois `estornarVenda`. Se o gateway falhar, a venda fica `'cancelamento_solicitado'`
  e o estorno é tentado de novo.
- O estorno é tentado até 5 vezes pela tarefa agendada (contador em `pagamentos.estorno_tentativas`);
  depois disso a venda continua em `'cancelamento_solicitado'` e o admin resolve manualmente.
  A chave de idempotência do estorno é derivada do id da venda (`estorno-venda-<id>`).
- O cliente pode cancelar até antes de a venda ser enviada.

---

## 9. Arquivos compartilhados

`app.ts`, `server.ts`, `config/*`, `middlewares/*`, `utils/*`, `types/index.ts`, `routes/index.ts`, `package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`, este `api.md`.

Middlewares de acesso: `middlewares/autenticar.ts` e `middlewares/exigirAdmin.ts` (dono: Celio).
Envio de e-mail: `utils/email.ts` (dono: Celio) — serviço de envio de e-mail usado por mais de um módulo.

- Mudança neles = **PR separado e pequeno**, com aviso no grupo antes.
- Nova dependência no `package.json`: combinar antes (evita dois instalarem libs diferentes para a mesma coisa).
  Já combinadas: `argon2` (hash de senha) e `express-rate-limit` (rate limit). A combinar antes de instalar:
  SDK do provedor de e-mail (provedor a definir).
- Nova variável de ambiente: adicionar em `config/env.ts` **e** em `.env.example` no mesmo PR.
  Novas: `SESSION_SECRET`, `API_URL`, `FRONTEND_URL`, `GATEWAY_ACCESS_TOKEN`, `GATEWAY_WEBHOOK_SECRET`,
  `EMAIL_API_KEY`, `EMAIL_REMETENTE`.
  - `FRONTEND_URL` = endereço público do frontend, usado **só** para montar links em e-mails.
  - `CORS_ORIGIN` (já existe) = origem aceita no CORS e na checagem do header `Origin` (CSRF).

O `routes/index.ts` já deve ficar com todos os módulos montados, uma linha cada, para ninguém precisar editar depois:

```ts
routes.use('/', catalogoRoutes)              // Dev 2: /categorias, /produtos, /peixes, /servicos
routes.use('/estoque', estoqueRoutes)        // Dev 2
routes.use('/auth', authRoutes)              // Celio
routes.use('/clientes', clienteRoutes)       // Celio
routes.use('/vendas', vendaRoutes)           // Celio (inclui /vendas/:id/pagamentos)
routes.use('/frete', freteRoutes)            // Celio
routes.use('/pagamentos', pagamentoRoutes)   // Celio (webhook)
routes.use('/orcamentos', orcamentoRoutes)   // Celio
```

---

## 10. Estilo de código

Seguir o que já existe no projeto:

- TypeScript `strict`. Proibido `any` — use `unknown` e faça o narrowing.
- **Sem ponto e vírgula**, aspas **simples**, indentação de **2 espaços**, vírgula no final em listas multilinha, linhas até ~120 colunas.
- ES Modules com extensão **`.js`** nos imports relativos (exigência do `NodeNext`): `import { db } from '../../config/db.js'`.
- `import type` para importar só tipos.
- Ordem dos imports: pacotes externos → arquivos do projeto, cada grupo em ordem alfabética.
- Funções de service/repository são `async` e retornam tipos explícitos (`Promise<Cliente>`).
- Comentários em português, só quando o *porquê* não é óbvio.
- Nada de `console.log` esquecido em PR (o `console.error` do `errorHandler` é a exceção).
- Antes do PR: `npm run typecheck` sem erros.

### Exemplo completo de um módulo

```ts
// modulos/clientes/cliente.routes.ts
import { Router } from 'express'
import { clienteController } from './cliente.controller.js'

export const clienteRoutes = Router()

clienteRoutes.get('/', clienteController.listar)
clienteRoutes.get('/:id', clienteController.buscarPorId)
clienteRoutes.post('/', clienteController.criar)
clienteRoutes.patch('/:id', clienteController.atualizar)
clienteRoutes.delete('/:id', clienteController.remover)
```

```ts
// modulos/clientes/cliente.controller.ts
import type { Request, Response } from 'express'
import { idParam, paginacao } from '../../utils/validacao.js'
import { clienteService } from './cliente.service.js'

export const clienteController = {
  async listar(req: Request, res: Response) {
    res.json(await clienteService.listar({ busca: req.query.busca as string | undefined, ...paginacao(req.query) }))
  },

  async buscarPorId(req: Request<{ id: string }>, res: Response) {
    res.json(await clienteService.buscarPorId(idParam(req.params.id)))
  },

  async criar(req: Request, res: Response) {
    res.status(201).json(await clienteService.criar(req.body ?? {}))
  },

  async atualizar(req: Request<{ id: string }>, res: Response) {
    res.json(await clienteService.atualizar(idParam(req.params.id), req.body ?? {}))
  },

  async remover(req: Request<{ id: string }>, res: Response) {
    await clienteService.remover(idParam(req.params.id))
    res.status(204).end()
  },
}
```

```ts
// modulos/clientes/cliente.service.ts
import { AppError } from '../../utils/AppError.js'
import { clienteRepository } from './cliente.repository.js'
import type { Cliente, NovoCliente } from './cliente.types.js'

function validar(dados: Partial<NovoCliente>): NovoCliente {
  const erros: Record<string, string> = {}
  const nome = String(dados.nome ?? '').trim()
  if (nome.length < 2) erros.nome = 'Digite o nome (pelo menos 2 letras).'
  if (Object.keys(erros).length) throw new AppError('Dados inválidos', 422, erros)
  return { nome, email: dados.email?.trim().toLowerCase() || null }
}

export const clienteService = {
  async buscarPorId(id: number): Promise<Cliente> {
    const cliente = await clienteRepository.buscarPorId(id)
    if (!cliente) throw new AppError('Cliente não encontrado', 404)
    return cliente
  },

  async criar(dados: Partial<NovoCliente>): Promise<Cliente> {
    return clienteRepository.inserir(validar(dados))
  },
  // ...
}
```

```ts
// modulos/clientes/cliente.repository.ts
import { db } from '../../config/db.js'
import type { Cliente, NovoCliente } from './cliente.types.js'

const colunas = `id, nome, email, criado_em AS "criadoEm", atualizado_em AS "atualizadoEm"`

export const clienteRepository = {
  async buscarPorId(id: number): Promise<Cliente | null> {
    const { rows } = await db.query<Cliente>(`SELECT ${colunas} FROM clientes WHERE id = $1 AND ativo`, [id])
    return rows[0] ?? null
  },

  async inserir({ nome, email }: NovoCliente): Promise<Cliente> {
    const { rows } = await db.query<Cliente>(
      `INSERT INTO clientes (nome, email) VALUES ($1, $2) RETURNING ${colunas}`,
      [nome, email],
    )
    return rows[0]
  },
  // ...
}
```

---

## 11. Autenticação e acesso

- **Sessão:** login cria uma linha em `sessoes` (o banco guarda só o hash do token) e envia o cookie
  `sid` com `httpOnly`, `secure` em produção e `sameSite=lax`. Sem token em header, sem `localStorage`.
  Logout, troca de senha e cliente desativado apagam as sessões na hora.
- **Frontend:** toda chamada usa `fetch(url, { credentials: 'include' })`. CORS liberado só para
  `CORS_ORIGIN`, com `credentials: true`; nunca `origin: '*'`.

### Níveis de acesso

| Nível | Middlewares na rota |
|---|---|
| público | nenhum |
| logado / cliente | `autenticar` |
| admin | `autenticar, exigirAdmin` |
| gateway | validação de assinatura, sem `autenticar` |

```ts
clienteRoutes.get('/me', autenticar, clienteController.buscarMeusDados)         // cliente
clienteRoutes.get('/', autenticar, exigirAdmin, clienteController.listar)        // admin
```

- `autenticar` preenche `req.usuario: { id: number, papel: 'cliente' | 'admin' }` (tipo em `types/index.ts`).
- Admin só é criado por script (`npm run criar-admin`), nunca por rota.

### Recuperação de senha
- `POST /api/auth/esqueci-senha` recebe `{ email }`. Se o e-mail pertencer a uma conta ativa, **apaga todos os
  tokens anteriores do cliente**, gera um token aleatório, salva só o hash (SHA-256) em `tokens_recuperacao_senha`,
  com `expira_em` = agora + 30 minutos, e envia um e-mail com o link `<FRONTEND_URL>/redefinir-senha?token=<token>`.
  A resposta é **sempre** `202` com a mesma mensagem, exista o e-mail ou não, para não revelar quem tem conta.
- `POST /api/auth/redefinir-senha` recebe `{ token, novaSenha }`. O token é válido se existe e não venceu, e a conta
  precisa estar ativa e não anonimizada; senão `400` com mensagem genérica (`'Link inválido ou expirado.'`).
  A nova senha segue a regra de senha do cadastro (seção 6). Em uma transação: grava o novo `senha_hash`, apaga
  **todos** os tokens de recuperação do cliente e apaga **todas** as sessões dele.
- Não há limpeza periódica de tokens vencidos na entrega de 19/11: eles ficam até o cliente pedir outro link,
  redefinir a senha ou ser anonimizado.
- Rate limit nas duas rotas (por IP e, no `esqueci-senha`, também por e-mail).
- O token nunca é logado nem devolvido em resposta; ele só existe no link do e-mail.

### Regras
- O dono vem do login: rotas `/me` usam `req.usuario.id`; nunca aceitar `clienteId` do body ou da URL
  em rota de cliente. Rotas de cliente com id de venda ou endereço filtram também por
  `cliente_id = req.usuario.id`; não achou → `404`.
- Em rotas de **cliente**, campos controlados pelo sistema são ignorados se vierem no body: `papel`, `ativo`,
  `status`, `preco`, `precoUnitario`, `subtotal`, `frete`, `total`, `clienteId`. Rotas de **admin** aceitam só
  os campos que cada uma documenta (ex.: `POST /api/vendas/:id/status` aceita `status`;
  `PATCH /api/clientes/:id` aceita `ativo`).
- `DELETE /api/clientes/me` (e `DELETE /api/clientes/:id`, do admin) anonimiza o cliente e apaga, na mesma
  transação, os endereços, as sessões e os tokens de recuperação de senha dele.
- Preço e total são sempre calculados a partir de `produtos.preco`.
- Nunca devolver `senha_hash` nem dados de pagamento; nunca logar senha, cookie ou token.
- `POST`/`PATCH`/`DELETE` (exceto o webhook) exigem header `Origin` igual a `CORS_ORIGIN` (proteção CSRF).
- O frontend faz proxy de `/api` para o backend, então o navegador enxerga uma única origem e o cookie
  `sameSite=lax` funciona sem domínio próprio. Com domínio próprio no futuro: frontend e API em subdomínios
  do mesmo domínio.

---

## 12. Git

- Nunca commitar direto na `main`. Uma branch por tarefa, PR revisado pelo outro dev.
- Branch: `<tipo>/<modulo>-<descricao-curta>` → `feat/clientes-crud`, `feat/estoque-movimentacoes`, `fix/vendas-total`.
- Commits no padrão Conventional Commits, em português, com o módulo como escopo:
  - `feat(vendas): cria endpoint de cancelamento`
  - `fix(estoque): impede saldo negativo`
  - `refactor(catalogo): move módulo para src/modulos`
  - `chore(shared): adiciona helper comTransacao`
- Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`.
- Antes de abrir PR: `git pull --rebase origin main` e `npm run typecheck`.
- PR que toca arquivo de outro dono ou arquivo compartilhado: marcar o outro como revisor obrigatório.
