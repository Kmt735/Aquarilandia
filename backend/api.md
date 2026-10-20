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

Exceção: endereços do cliente são excluídos de verdade (dado pessoal); a venda guarda cópia do endereço de entrega.

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
GET    /api/categorias                                                        (público)
GET    /api/produtos                 ?categoria=&busca=&emEstoque=&pagina=&limite=   (público)
GET    /api/produtos/:id                                                      (público)
POST   /api/produtos                                                          (admin)
PATCH  /api/produtos/:id                                                      (admin)
DELETE /api/produtos/:id                                                      (admin)
GET    /api/peixes                   ?tipoAgua=&temperamento=&dificuldade=&temperatura=   (público)
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
- **Sucesso** devolve o recurso direto, sem envelope (`{ id, nome, ... }` ou `[...]`).

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
- Listas pequenas e fixas (`/categorias`, `/servicos`) retornam array simples.

---

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
