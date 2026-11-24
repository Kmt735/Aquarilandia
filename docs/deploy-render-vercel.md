# Deploy: backend no Render, frontend na Vercel

Alternativa ao deploy da VPS (`backend/docs/deploy.md`). Aqui o site (frontend) fica na Vercel, a API (backend) num
Web Service do Render e o banco num Postgres do Render.

## Como as peças conversam

```
navegador ──► https://aquarilandia.vercel.app            (site, Vercel)
                 └─ /api/*  ──rewrite──►  https://aquarilandia-api.onrender.com/api/*   (API, Render)
                                                └─► Postgres do Render (URL interna)
```

O site chama sempre `/api/...` no **próprio endereço** (`VITE_API_URL=/api`), e o `frontend/vercel.json` repassa
essas chamadas para o Render. Isso importa por três motivos:

1. **Cookie de sessão.** O login usa o cookie `sid` com `SameSite=Lax`. Se o site chamasse
   `https://...onrender.com` direto, seria um cookie de outro site: o Safari bloqueia e o login não funciona.
2. **Fotos dos produtos.** A API devolve caminhos relativos (`/api/midias/produtos/...`), que só funcionam no mesmo
   endereço.
3. **Origem.** As rotas que gravam dados conferem o header `Origin` contra o `CORS_ORIGIN`. Com o rewrite, o Origin é
   o endereço da Vercel, então ele é o que vai no `CORS_ORIGIN` do Render.

> Os endereços `aquarilandia.vercel.app` e `aquarilandia-api.onrender.com` são exemplos. Os reais dependem do nome que
> estiver livre na hora de criar. Troque em todos os lugares abaixo, **inclusive no `frontend/vercel.json`**.

---

## 1. Render: banco (Postgres)

1. **New → Postgres.**
2. Preencha:
   - **Name:** `aquarilandia-db`
   - **Database:** `aquarilandia`
   - **User:** `aquarilandia`
   - **Region:** a mesma que você vai usar no Web Service (ex.: Ohio). Banco e API na mesma região conversam pela rede
     interna.
   - **PostgreSQL Version:** 17 (a versão dos scripts de `backend/db/init/`)
   - **Plan:** Free para a demonstração. No Render, o banco Free expira depois de um tempo: confira o prazo no painel.
3. **Create Database.** Quando ficar *Available*, abra **Connections** e copie:
   - **Internal Database URL**: vai no `DATABASE_URL` do Web Service.
   - **External Database URL**: só para os scripts rodados do seu computador (passos 3 e 4). Não vai para o Git
     nem para o chat.

## 2. Render: API (Web Service)

1. **New → Web Service** e conecte o repositório do GitHub.
2. Preencha:

| Campo | Valor |
|---|---|
| Name | `aquarilandia-api` (vira `https://aquarilandia-api.onrender.com`) |
| Language | Node |
| Branch | `main` |
| Region | a mesma do banco |
| Root Directory | `backend` |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start` |
| Instance Type | Free (dorme após ~15 min sem acesso; o primeiro acesso depois disso leva perto de 1 min) |
| Health Check Path (em Advanced) | `/api/health` |

O `--include=dev` é necessário: com `NODE_ENV=production`, o `npm ci` pularia o TypeScript, que o build usa.
A versão do Node vem do `engines` do `backend/package.json` (22.x).

3. **Environment Variables** (valores de exemplo; os marcados como segredo nunca vão para o Git):

| Variável | Exemplo | Observação |
|---|---|---|
| `NODE_ENV` | `production` | obrigatória |
| `DATABASE_URL` | `postgresql://aquarilandia:...@dpg-xxxx-a/aquarilandia` | **segredo**, a *Internal Database URL* |
| `CORS_ORIGIN` | `https://aquarilandia.vercel.app` | endereço da Vercel, sem barra no fim. Várias: separe por vírgula. Antes de ter a URL real, use o nome que você vai pedir na Vercel e corrija no passo 6 |
| `FRONTEND_URL` | `https://aquarilandia.vercel.app` | usado nos links dos e-mails (recuperação de senha) |
| `API_URL` | `https://aquarilandia-api.onrender.com` | endereço público do Web Service |
| `GATEWAY_ACCESS_TOKEN` | `abc_dev_...` | **segredo**, a chave da AbacatePay em Dev mode |
| `GATEWAY_WEBHOOK_SECRET` | resultado de `openssl rand -hex 32` | **segredo**, no mínimo 32 caracteres. O mesmo valor vai no webhook da AbacatePay |
| `EMAIL_API_KEY` | `re_...` | **segredo**, chave do Resend. Obrigatória em produção |
| `EMAIL_REMETENTE` | `Aquarilândia <onboarding@resend.dev>` | sem domínio verificado no Resend, o `onboarding@resend.dev` só entrega para o e-mail da própria conta do Resend |
| `AVALIACOES_PUBLICAR_DIRETO` | `false` | `false` (padrão): avaliação nova espera a loja aprovar no painel. `true`: publica na hora |
| `PERMITIR_SIMULACAO_PIX` | `true` | só para a demonstração com a chave de teste (`abc_dev_`). Senão, `false` |
| `FRETE_TRANSPORTE_JSON` | *(vazio)* | sem tabela contratada, só a retirada na loja funciona |
| `PORT` | *(não defina)* | o Render define sozinho e o backend lê `process.env.PORT` |
| `DATABASE_SSL` | *(não defina)* | a URL interna não precisa de TLS |
| `TRUST_PROXY` | *(não defina, padrão 1)* | veja "Limitações" |
| `IMAGENS_DIR` | *(não defina)* | sem disco persistente, o envio de fotos no admin responde 503 (veja "Limitações") |

4. **Deploy Web Service.** Se o log mostrar `Variável de ambiente ... ausente/inválida`, o nome da variável está na
   mensagem. Em produção, o backend exige que a senha da `DATABASE_URL` tenha 32 caracteres ou mais. Se recusar a
   senha gerada pelo Render, é essa regra.
5. Teste: `https://aquarilandia-api.onrender.com/api/health` deve responder `{"status":"ok","banco":"ok"}`. Ele só
   faz `SELECT 1`, então responde ok mesmo antes de as tabelas existirem: o catálogo só funciona depois do passo 3.

## 3. Criar as tabelas

Os `backend/db/init/*.sql` criam o esquema, mas **nenhum produto**. Rode do seu computador, na pasta `backend/`, com a
*External Database URL*:

```bash
cd backend
npm ci
read -s DATABASE_URL && export DATABASE_URL     # cole a External Database URL e tecle Enter (não aparece)
DATABASE_SSL=true npm run db:schema
```

O script roda os arquivos de `db/init/` numa transação só (inclusive o `36_avaliacoes.sql`, das avaliações). Se algum falhar, nada fica pela metade. Se as tabelas já existirem,
ele recusa sem mexer em nada.

**Banco que já existia antes das avaliações?** O `db:schema` recusa banco com tabelas. Crie só as tabelas novas
(o script é idempotente e não apaga nada):

```bash
read -s DATABASE_URL && export DATABASE_URL     # External Database URL
NODE_ENV=development DATABASE_SSL=true npm run db:migrar-avaliacoes
unset DATABASE_URL
```

Alternativa com o `psql` instalado:
`for f in db/init/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" || break; done`.

## 4. Carregar produtos (dados de demonstração)

O `scripts/dados-demo.ts` cria pela API um admin, um cliente com endereço e **22 produtos com estoque**, em 11
categorias, sem fotos. Ele é idempotente: rodar duas vezes não duplica. Com a API do passo 2 no ar e o
`DATABASE_URL` do passo 3 ainda exportado:

```bash
read -s SENHA_ADMIN && export SENHA_ADMIN       # senha do admin de demonstração
read -s SENHA_CLIENTE && export SENHA_CLIENTE   # senha do cliente de demonstração
NODE_ENV=development DATABASE_SSL=true \
  DEMO_API_URL=https://aquarilandia-api.onrender.com \
  ORIGEM=https://aquarilandia.vercel.app \
  npx tsx scripts/dados-demo.ts
unset DATABASE_URL SENHA_ADMIN SENHA_CLIENTE
```

- `ORIGEM` precisa ser uma das origens do `CORS_ORIGIN` do Render.
- O admin é criado direto no banco (por isso o `DATABASE_URL`). O resto vai pela API pública.
- Contas criadas: `admin.demo@exemplo.com` e `cliente.demo@exemplo.com`. Para outros e-mails, use `DEMO_ADMIN_EMAIL` e
  `DEMO_CLIENTE_EMAIL`.

Para um admin de verdade, sem dados de demonstração:
`SENHA_ADMIN="$SENHA_ADMIN" NODE_ENV=development DATABASE_SSL=true npm run criar-admin -- --nome "..." --email ...`

### E o `VITE_CATALOGO_MOCK`?

Deixe `false`. Com `true`, a loja e o admin mostram o catálogo de `src/mocks/catalogo-api.js`, só no navegador. Os
produtos não existem no banco, então carrinho, checkout e pedidos falham ou ficam incoerentes. Use `true` só se a
API não estiver no ar e você precisar mostrar apenas as telas do catálogo, com o selo "Dados de demonstração".

## 5. Vercel: site

1. Antes de importar, confira o `frontend/vercel.json`: o `destination` do `/api/:path*` precisa ser o endereço **real**
   do Web Service do Render. Commit e push dessa alteração.
2. **Add New → Project** e importe o repositório.
3. Preencha:

| Campo | Valor |
|---|---|
| Project Name | `aquarilandia` (vira `https://aquarilandia.vercel.app`, se estiver livre) |
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | padrão (`npm install`) ou `npm ci` |

4. **Environment Variables** (lidas no build: mudou, faça *Redeploy*). Nenhuma é segredo, todas vão para o
   JavaScript público:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | `/api` |
| `VITE_CATALOGO_MOCK` | `false` |
| `VITE_SIMULACAO_PIX` | `true` na demonstração (junto com `PERMITIR_SIMULACAO_PIX=true` no Render). Senão, `false` |

5. **Deploy.** O `vercel.json` também faz o *rewrite* de qualquer rota para o `index.html`, então dar F5 em `/loja`
   ou `/conta` não dá 404.

## 6. Passo final: CORS

1. Copie o endereço de produção que a Vercel deu (Project → Domains), ex.: `https://aquarilandia.vercel.app`.
2. No Render → `aquarilandia-api` → **Environment**: ajuste `CORS_ORIGIN` e `FRONTEND_URL` para esse endereço, sem
   barra no fim. Para aceitar também uma prévia da Vercel, separe por vírgula:
   `https://aquarilandia.vercel.app,https://aquarilandia-git-main-SEUTIME.vercel.app`.
3. **Save, rebuild, and deploy.**
4. Teste no site: crie uma conta ou entre, adicione ao carrinho e vá até o pagamento. Se aparecer
   `Origem da requisição não permitida.` (403), o `CORS_ORIGIN` não bate com o endereço que está no navegador.

## 7. AbacatePay (webhook)

No painel da AbacatePay, em **Dev mode**:

- **URL:** `https://aquarilandia-api.onrender.com/api/pagamentos/webhook`
- **Secret:** o mesmo `GATEWAY_WEBHOOK_SECRET` do Render
- **Eventos:** `transparent.completed` e `transparent.refunded`

## Limitações conhecidas desta hospedagem

- **Plano Free do Render:**
  - a API dorme sem acesso, e o primeiro pedido depois disso pode levar perto de 1 min;
  - as tarefas periódicas de vendas (`iniciarTarefasVendas`) só rodam com a API acordada.
- **Fotos dos produtos:** o Web Service não tem disco persistente no plano Free, e sem `IMAGENS_DIR` o envio de foto
  no admin responde 503. Com plano pago, crie um Disk (ex.: montado em `/var/data`) e defina
  `IMAGENS_DIR=/var/data/imagens`.
- **IP do rate limit:**
  - Com o rewrite, os pedidos passam pela Vercel e depois pelo balanceador do Render.
  - Com `TRUST_PROXY=1` (padrão), o limite pode contar o IP da Vercel em vez do IP do visitante. Isso não foi
    verificado.
  - Sinal do problema: em apresentações com muita gente, várias pessoas recebem "Muitas tentativas" no login ao
    mesmo tempo.
  - Nesse caso, teste `TRUST_PROXY=2`.
- **Frete:** sem `FRETE_TRANSPORTE_JSON`, a entrega responde 503 e só a retirada funciona (decisão de 17/11).
