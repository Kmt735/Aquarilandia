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
npm install
npm run dev      # http://localhost:5173
```

Estrutura (Atomic Design) em `frontend/src/`:

| Pasta | Conteúdo |
| --- | --- |
| `components/atoms/` | Peças indivisíveis: Button, Chip, Tag, Tip, Input, Logo… |
| `components/molecules/` | Combinações de átomos: ProductCard, PeixeCard, FormField, NavDropdown… |
| `components/organisms/` | Seções completas: SiteNav, Hero, CartDrawer, SearchBox, QuoteModal… |
| `components/templates/` | Esqueletos de página: MainLayout, PageTemplate |
| `pages/` | Telas: Home, Loja, Peixes, Primeiro Aquário, Serviços |
| `context/` · `hooks/` | Estado global (carrinho, toasts, painéis) e hooks de acesso |
| `data/` | Dados mockados (produtos, peixes, serviços, guia, FAQ) |
| `utils/` | Formatação, máscara de telefone, rotas, busca |

As cores, fontes e gradientes da marca ficam no `@theme` de `src/index.css` (Tailwind v4).

## Backend

```bash
cd backend
npm install
cp .env.example .env
npm run db:up    # sobe o PostgreSQL no Docker (porta 5432)
npm run dev      # http://localhost:3333/api
```

### Banco de dados (PostgreSQL + Docker)

O `backend/docker-compose.yml` sobe um PostgreSQL 17. Na primeira subida (volume vazio) o Postgres executa os scripts de `backend/db/init/` — o `01_schema.sql` cria as tabelas do catálogo e as categorias iniciais.

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
| GET | `/api/peixes?temperatura=&ph=&tamanho_max=&aquario_litros=&dificuldade=&temperamento=&tipo_agua=&busca=&pagina=1&limite=20` | Produtos ativos da categoria peixes com ficha, resposta `{ itens, total }` |
| GET | `/api/peixes/:id` | Mesmo ID e detalhe do produto, restrito a peixes com ficha |
| GET | `/api/servicos` | Serviços |
| POST | `/api/orcamentos` | Cria pedido de orçamento (`nome`, `telefone`, `servico`, `mensagem?`) |
| GET | `/api/orcamentos` | Lista orçamentos recebidos |

As rotas de categorias, a listagem e o detalhe de produtos e os atalhos de peixes já consultam o PostgreSQL.
Escritas de categorias exigem o cookie `sid` de admin e `Origin` igual a `CORS_ORIGIN`.
O cadastro de produtos usa as mesmas proteções e exige a ficha da categoria especializada.
Serviços ainda leem os dados em memória (`src/data/`). O detalhe de produto inclui `ficha: { tipo, dados }` ou `null` quando
não existe ficha. O frontend continua usando seus próprios dados locais. O seed cria categorias, mas não
produtos. Com os dois rodando, o Vite encaminha
`/api` para o backend. Contrato de categorias: [`backend/api.md`](backend/api.md#categorias--contrato-implementado-em-25102026).
Administração de categorias: [`backend/api.md`](backend/api.md#categorias--detalhe-e-administração-implementados-em-25102026).
Contrato da listagem de produtos: [`backend/api.md`](backend/api.md#produtos--listagem-pública-implementada-em-25102026).
Filtros técnicos e ambiguidades do modelo: [`backend/api.md`](backend/api.md#produtos--filtros-técnicos-implementados-em-25102026).
Contrato do detalhe: [`backend/api.md`](backend/api.md#produtos--detalhe-público-implementado-em-25102026).
Contrato do cadastro: [`backend/api.md`](backend/api.md#produtos--cadastro-administrativo-implementado-em-25102026).
Contrato dos atalhos de peixes: [`backend/api.md`](backend/api.md#peixes--atalhos-públicos-implementados-em-25102026).
Verificações dos incrementos: [`backend/testes/README.md`](backend/testes/README.md).
