# Convenções da API — Aquarilândia

Documento de referência para os dois devs do backend. **Leia antes de abrir um PR.**
Se precisar fugir de alguma regra, combine antes e atualize este arquivo no mesmo PR.

| Domínio | Dono | Pasta | Prefixo de rota | Tabelas |
|---|---|---|---|---|
| Autenticação | Celio | `src/modulos/auth/` | `/api/auth` | `sessoes` |
| Clientes | Celio | `src/modulos/clientes/` | `/api/clientes` | `clientes` (inclui admins), `enderecos_cliente` |
| Vendas | Celio | `src/modulos/vendas/` | `/api/vendas` | `vendas`, `itens_venda`, `historico_status_venda` |
| Pagamentos | Celio | `src/modulos/pagamentos/` | `/api/pagamentos`, `/api/vendas/:id/pagamentos` | `pagamentos`, `eventos_webhook` |
| Orçamentos *(já existe)* | Celio | `src/modulos/orcamentos/` | `/api/orcamentos` | `orcamentos` |
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
| Buscar por outro campo | `buscarPorCpf(cpf)`, `buscarPorSlug(slug)` | idem |
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

Não usamos `PUT`. Atualização é sempre `PATCH`.

### Mapa de rotas reservadas

Antes de criar uma rota fora desta lista, adicione-a aqui para o outro saber.

**Celio — auth / clientes / vendas / pagamentos / orçamentos**
```
POST   /api/auth/cadastro
POST   /api/auth/login               (cria sessão, cookie "sid")
POST   /api/auth/logout
GET    /api/auth/sessao              (usuário logado)

GET    /api/clientes                 ?busca=&papel=&pagina=&limite=   (admin)
GET    /api/clientes/:id
PATCH  /api/clientes/:id
DELETE /api/clientes/:id             (anonimiza — LGPD)
GET    /api/clientes/:id/vendas
GET    /api/clientes/:id/enderecos
POST   /api/clientes/:id/enderecos
PATCH  /api/clientes/:id/enderecos/:enderecoId
DELETE /api/clientes/:id/enderecos/:enderecoId

GET    /api/vendas                   ?clienteId=&status=&tipoEntrega=&de=&ate=&pagina=&limite=
GET    /api/vendas/:id               (inclui itens)
GET    /api/vendas/:id/historico
POST   /api/vendas                   (cria venda + itens + baixa estoque, numa transação)
POST   /api/vendas/:id/status        (admin avança o status: { status, observacao, codigoRastreio? })
POST   /api/vendas/:id/solicitar-cancelamento   (cliente, depois de paga)
POST   /api/vendas/:id/cancelar      (estorna estoque)

POST   /api/vendas/:id/pagamentos    (cria a preferência do Checkout Pro)
POST   /api/pagamentos/webhook       (notificações do Mercado Pago)

GET    /api/orcamentos
POST   /api/orcamentos
```

**Dev 2 — catálogo / estoque**
```
GET    /api/categorias
GET    /api/produtos                 ?categoria=&busca=&emEstoque=&pagina=&limite=
GET    /api/produtos/:id
POST   /api/produtos
PATCH  /api/produtos/:id
DELETE /api/produtos/:id
GET    /api/peixes                   ?tipoAgua=&temperamento=&dificuldade=&temperatura=
GET    /api/peixes/:id
GET    /api/servicos

GET    /api/estoque                  ?abaixoDe=   (saldo por produto)
GET    /api/estoque/:produtoId
GET    /api/estoque/movimentacoes    ?produtoId=&tipo=&de=&ate=
POST   /api/estoque/movimentacoes    (entrada / ajuste manual)
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
| `400` | Requisição malformada (id não numérico, query inválida) |
| `404` | Recurso não existe (ou está `ativo = false`) |
| `409` | Conflito de regra: CPF já cadastrado, estoque insuficiente, venda já cancelada |
| `422` | Validação de campos do body — `detalhes` com uma mensagem por campo |
| `500` | Erro inesperado (o handler já trata, não lance manualmente) |

- Mensagens em português, para o usuário final, terminando com ponto em `detalhes`.
- Chaves de `detalhes` = nome do campo no body (camelCase). Em itens de lista: `"itens.0.quantidade"`.
- O Express 5 já repassa erros de funções `async` para o `errorHandler` — **não precisa de `try/catch` no controller**.

---

## 6. Validação

- Fica no **service**, numa função `validar<Algo>` privada do arquivo (ver `orcamento.service.ts`).
- Junta **todos** os erros em `Record<string, string>` e lança um único `AppError(…, 422, erros)`.
- Normaliza antes de salvar: `trim()`, telefone/CPF só dígitos, e-mail em minúsculo.
- Conversão de `req.params`/`req.query` (string → number etc.) fica no controller, usando helpers de `utils/validacao.ts` (ex.: `idParam(req.params.id)` que lança `400` se não for inteiro positivo).

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
| `10_clientes.sql` | Celio | clientes, enderecos_cliente, sessoes |
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
// ProdutoVenda = { id: number; nome: string; preco: number; ativo: boolean }
// Retorna só os encontrados; quem chama decide o erro para id faltando.

// modulos/estoque/estoque.service.ts
estoqueService.baixarParaVenda(vendaId: number, itens: ItemMovimento[], client: PoolClient): Promise<void>
estoqueService.estornarVenda(vendaId: number, client: PoolClient): Promise<void>
// ItemMovimento = { produtoId: number; quantidade: number }
// baixarParaVenda lança AppError 409 'Estoque insuficiente'
//   com detalhes { "itens.<indice>.quantidade": "Só restam N unidades." }
```

`ProdutoVenda` e `ItemMovimento` ficam em `types/index.ts` (compartilhado), porque os dois módulos usam.

### Fluxo de `POST /api/vendas`
1. `vendaService.criar` valida o body.
2. Chama `produtoService.buscarParaVenda` → confere se todos existem e estão ativos.
3. Abre `comTransacao`: insere `vendas` e `itens_venda` (guardando `preco_unitario` do momento da venda) → chama `estoqueService.baixarParaVenda(vendaId, itens, client)`.
4. Se qualquer passo lançar erro, tudo é desfeito.

---

## 9. Arquivos compartilhados

`app.ts`, `server.ts`, `config/*`, `middlewares/*`, `utils/*`, `types/index.ts`, `routes/index.ts`, `package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`, este `api.md`.

- Mudança neles = **PR separado e pequeno**, com aviso no grupo antes.
- Nova dependência no `package.json`: combinar antes (evita dois instalarem libs diferentes para a mesma coisa).
- Nova variável de ambiente: adicionar em `config/env.ts` **e** em `.env.example` no mesmo PR.

O `routes/index.ts` já deve ficar com todos os módulos montados, uma linha cada, para ninguém precisar editar depois:

```ts
routes.use('/', catalogoRoutes)              // Dev 2: /categorias, /produtos, /peixes, /servicos
routes.use('/estoque', estoqueRoutes)        // Dev 2
routes.use('/auth', authRoutes)              // Celio
routes.use('/clientes', clienteRoutes)       // Celio
routes.use('/vendas', vendaRoutes)           // Celio (inclui /vendas/:id/pagamentos)
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

## 11. Git

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
