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
| GET | `/api/categorias` | Categorias da loja |
| GET | `/api/produtos?categoria=&disponibilidade=in\|out` | Produtos (com filtros) |
| GET | `/api/produtos/:id` | Um produto |
| GET | `/api/peixes?filtros=doce,facil,disp` | Peixes (com filtros) |
| GET | `/api/peixes/:id` | Um peixe |
| GET | `/api/servicos` | Serviços |
| POST | `/api/orcamentos` | Cria pedido de orçamento (`nome`, `telefone`, `servico`, `mensagem?`) |
| GET | `/api/orcamentos` | Lista orçamentos recebidos |

As rotas do catálogo ainda leem os dados em memória (`src/data/`); o banco já está pronto para recebê-las. Com os dois rodando, o Vite já encaminha `/api` para o backend.
