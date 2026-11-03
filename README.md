# Aquarilândia

Site da Aquarilândia — peixes, plantas e projetos de aquários.

```
Aquarilandia/
├── frontend/   React + JavaScript + Tailwind CSS (Vite) — Atomic Design
├── backend/    Node.js + TypeScript (Express)
└── docs/       protótipo HTML original (prototipo-v4.html)
```

## Frontend

```bash
cd frontend
npm ci
npm run dev      # http://localhost:5173
```

### Dados de demonstração (sem backend com produtos)

O seed do banco cria só as categorias, então a loja, a vitrine e o **Monte seu Aquário** ficam vazios sem
produtos cadastrados. Para ver o site com um catálogo de exemplo, ligue o mock **só na sua máquina**:

```bash
cd frontend
echo "VITE_CATALOGO_MOCK=true" > .env.local   # .env.local está no .gitignore
npm run dev                                   # reinicie o dev server depois de mudar o .env.local
```

- A chave é **desligada por padrão** (`frontend/.env.example`). Sem ela, o site usa a API real.
- Com ela ligada, aparece o selo **"Dados de demonstração"** no canto da tela.
- Os dados ficam em `frontend/src/mocks/catalogo-api.js`, no mesmo formato da API (`backend/api.md`).
  Para voltar à API, apague a linha do `.env.local` (ou use `false`) e reinicie o `npm run dev`.

Estrutura (Atomic Design) em `frontend/src/`:

| Pasta | Conteúdo |
| --- | --- |
| `components/atoms/` | Peças indivisíveis: Button, Chip, Tag, Tip, Input, Logo… |
| `components/molecules/` | Combinações de átomos: ProductCard, PeixeCard, FormField, NavDropdown… |
| `components/organisms/` | Seções completas: SiteNav, Hero, CartDrawer, SearchBox, QuoteModal… |
| `components/templates/` | Esqueletos de página: MainLayout, PageTemplate |
| `pages/` | Telas: Home, Loja, Peixes, Primeiro Aquário, Serviços |
| `context/` · `hooks/` | Estado global (carrinho, toasts, painéis) e hooks de acesso |
| `data/` | Conteúdo editorial, filtros e arquivos legados; o catálogo exibido consulta a API |
| `utils/` | Formatação, máscara de telefone, rotas, busca |

As cores, fontes e gradientes da marca ficam no `@theme` de `src/index.css` (Tailwind v4).

## Backend

```bash
cd backend
npm ci
cp .env.example .env
npm run db:up    # sobe o PostgreSQL no Docker (porta 5432)
npm run dev      # http://localhost:3333/api
```

### Banco de dados (PostgreSQL + Docker)

O `backend/docker-compose.yml` sobe um PostgreSQL 17. Na primeira subida (volume vazio) o Postgres executa os scripts de `backend/db/init/` — o `01_catalogo.sql` cria as tabelas do catálogo e as categorias iniciais; os scripts seguintes criam clientes, orçamentos e vendas.

| Script | O que faz |
| --- | --- |
| `npm run db:up` | Sobe o banco e espera ficar saudável |
| `npm run db:down` | Para o banco (os dados ficam no volume) |
| `npm run db:reset` | Apaga o volume e recria o banco do zero (roda o schema de novo) |
| `npm run db:psql` | Abre o `psql` dentro do container |

A conexão vem de `DATABASE_URL` no `.env`; o pool fica em `src/config/db.ts`. O `/api/health` também confere o banco.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/health` | Status da API |
| GET | `/api/categorias?pagina=1&limite=20` | Categorias do PostgreSQL, resposta `{ itens, total }` |
| GET | `/api/categorias/:id` | Categoria por ID numérico, `{ id, nome, slug }` ou `404` |
| POST | `/api/categorias` | Admin: cria `{ nome, slug }`, retorna `201` |
| PATCH | `/api/categorias/:id` | Admin: altera nome/slug permitidos, retorna `200` |
| DELETE | `/api/categorias/:id` | Admin: exclui sem produtos vinculados, `204`; conflito `409` |
| GET | `/api/produtos?categoria=&busca=&preco_min=&preco_max=&ordem=&pagina=1&limite=20` | Produtos ativos, filtros gerais e técnicos por ficha; resposta `{ itens, total }` e centavos |
| GET | `/api/produtos/:id` | Produto ativo do PostgreSQL, ID numérico, centavos e ficha técnica da categoria |
| POST | `/api/produtos` | Admin: cria produto e ficha na mesma transação, estoque inicial zero, retorna `201` |
| PATCH | `/api/produtos/:id` | Admin: edita parcialmente produto/ficha; categoria, estoque e ativo protegidos; retorna `200` |
| GET | `/api/peixes?temperatura=&ph=&tamanho_max=&aquario_litros=&dificuldade=&temperamento=&tipo_agua=&busca=&pagina=1&limite=20` | Produtos ativos da categoria peixes com ficha, resposta `{ itens, total }` |
| GET | `/api/peixes/:id` | Mesmo ID e detalhe do produto, restrito a peixes com ficha |
| GET | `/api/servicos` | Serviços |
| POST | `/api/orcamentos` | Cria pedido de orçamento (`nome`, `telefone`, `servico`, `mensagem?`) |
| GET | `/api/orcamentos` | Somente admin com sessão `sid`; dados de atendimento, sem cache |

As rotas de categorias, a listagem e o detalhe de produtos e os atalhos de peixes já consultam o PostgreSQL.
Escritas de categorias exigem o cookie `sid` de admin e `Origin` igual a `CORS_ORIGIN`.
O cadastro de produtos usa as mesmas proteções e exige a ficha da categoria especializada.
Serviços ainda leem os dados em memória (`src/data/`). O detalhe de produto inclui `ficha: { tipo, dados }` ou `null` quando
não existe ficha. O frontend consulta o catálogo público com IDs numéricos e preços em centavos. O seed cria
categorias, mas não produtos. Com os dois rodando, o Vite encaminha
`/api` para o backend. Contrato de categorias: [`backend/api.md`](backend/api.md#categorias--contrato-implementado-em-25102026).
Administração de categorias: [`backend/api.md`](backend/api.md#categorias--detalhe-e-administração-implementados-em-25102026).
Contrato da listagem de produtos: [`backend/api.md`](backend/api.md#produtos--listagem-pública-implementada-em-25102026).
Filtros técnicos e ambiguidades do modelo: [`backend/api.md`](backend/api.md#produtos--filtros-técnicos-implementados-em-25102026).
Contrato do detalhe: [`backend/api.md`](backend/api.md#produtos--detalhe-público-implementado-em-25102026).
Contrato do cadastro: [`backend/api.md`](backend/api.md#produtos--cadastro-administrativo-implementado-em-25102026).
Contrato da edição: [`backend/api.md`](backend/api.md#produtos--edição-parcial-implementada-em-26102026).
Revisão de segurança: [`backend/docs/seguranca-backend-2026-10-26.md`](backend/docs/seguranca-backend-2026-10-26.md).
Contrato dos atalhos de peixes: [`backend/api.md`](backend/api.md#peixes--atalhos-públicos-implementados-em-25102026).
Verificações dos incrementos: [`backend/testes/README.md`](backend/testes/README.md).

### Desenvolvimento e diagnóstico da vitrine

Mantenha **dois terminais abertos**: `npm run dev` em `backend/` (3333), depois `npm run dev` em
`frontend/` (5173). O banco precisa estar ativo (`npm run db:up` em `backend/`); iniciar somente o Vite
não inicia a API ou o PostgreSQL. Não use `db:reset` para corrigir carregamento: esse comando apaga dados.

```bash
curl -i http://localhost:3333/api/health
curl -i 'http://localhost:3333/api/peixes?em_estoque=true&pagina=1&limite=3'
curl -i 'http://localhost:5173/api/peixes?em_estoque=true&pagina=1&limite=3'
```

Saúde deve retornar `200 {"status":"ok","banco":"ok"}`. A consulta direta e a consulta pelo proxy devem
retornar `200 {"itens":[...],"total":N}`. Conexão recusada/502 aponta para API/porta indisponível; saúde 503
aponta para conexão do banco. Confira `DATABASE_URL` e o proxy de `frontend/vite.config.js` se usar outras portas.
Se mudar a origem do frontend, ajuste também `CORS_ORIGIN` no backend para preservar cookies e escritas autenticadas.

`200 {"itens":[],"total":0}` é catálogo vazio válido: os destaques exigem produto ativo da categoria
`peixes`, ficha de peixe e saldo positivo. Seed sem produtos, inativos, ausência de ficha e saldo zero não
devem ser mascarados por mocks nem por criação artificial de estoque. Falha da API mostra erro e permite retry;
falha dos metadados de categorias não deve bloquear a consulta de peixes.
