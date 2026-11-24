# Deploy: backend no Render, frontend na Vercel

Alternativa ao deploy da VPS (`backend/docs/deploy.md`). Aqui o site (frontend) fica na Vercel, a API (backend) num
Web Service do Render e o banco num Postgres do Render.

Este roteiro é para **demonstração acadêmica nos planos gratuitos**, com pagamentos em Dev mode. Não habilite
pagamentos reais nem contrate serviços pagos para seguir os passos. As URLs mostradas são exemplos até que os
projetos sejam criados nos painéis.

Nos comandos executados no WSL, use Node 22 e instale as dependências com `npm ci` em cada pasta. Ao trocar a
versão principal do Node, reinstale as dependências: não reaproveite um `node_modules` com módulos nativos
compilados para outra versão.

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
   - **Plan:** Free para a demonstração. O Postgres gratuito expira **30 dias após a criação**; depois há 14 dias
     para contratar um plano pago antes da exclusão. Programe a criação para perto da apresentação e mantenha uma
     cópia dos dados de demonstração. [Limites oficiais](https://render.com/docs/free).
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
| `PERMITIR_SIMULACAO_PIX` | `true` | só para a demonstração com a chave de teste (`abc_dev_`). Senão, `false` |
| `FRETE_TRANSPORTE_JSON` | *(vazio)* | sem tabela contratada, só a retirada na loja funciona |
| `PORT` | *(não defina)* | o Render define sozinho e o backend lê `process.env.PORT` |
| `DATABASE_SSL` | `false` | para a URL interna. Nos scripts locais com a URL externa, usar `true`, com validação padrão do certificado |
| `TRUST_PROXY` | *(não defina, padrão 1)* | veja "Limitações" |
| `IMAGENS_DIR` | *(não defina)* | sem disco persistente, o envio de fotos no admin responde 503 (veja "Limitações") |

4. **Deploy Web Service.** Se o log mostrar `Variável de ambiente ... ausente/inválida`, o nome da variável está na
   mensagem. Em produção, o backend exige que a senha da `DATABASE_URL` tenha 32 caracteres ou mais. Se recusar a
   senha gerada pelo Render, configure uma credencial que atenda à regra; não reduza a proteção no código.
5. Teste: `https://aquarilandia-api.onrender.com/api/health` deve responder `{"status":"ok","banco":"ok"}`. Ele só
   faz `SELECT 1`, então responde ok mesmo antes de as tabelas existirem: o catálogo só funciona depois do passo 3.

## 3. Criar as tabelas

Os `backend/db/init/*.sql` criam o esquema, mas **nenhum produto**. Rode do seu computador, na pasta `backend/`, com a
*External Database URL*:

```bash
cd backend
npm ci
IFS= read -r -s DATABASE_URL && export DATABASE_URL # cole a External Database URL e tecle Enter (não aparece)
DATABASE_SSL=true npm run db:schema
```

O script roda os 13 arquivos numa transação só. Se algum falhar, nada fica pela metade. Se as tabelas já existirem,
ele recusa sem mexer em nada.

Esse comando é exclusivo para um banco vazio. Para um banco já inicializado, use as migrações específicas de cada
módulo; não apague tabelas ou volumes para repetir a preparação.

## 4. Carregar produtos (dados de demonstração)

O `scripts/dados-demo.ts` cria pela API um admin, um cliente com endereço e **22 produtos com estoque**, em 11
categorias, sem fotos. Ele é idempotente: rodar duas vezes não duplica. Com a API do passo 2 no ar e o
`DATABASE_URL` do passo 3 ainda exportado:

```bash
IFS= read -r -s SENHA_ADMIN && export SENHA_ADMIN       # senha do admin de demonstração
IFS= read -r -s SENHA_CLIENTE && export SENHA_CLIENTE   # senha do cliente de demonstração
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
| Install Command | `npm ci` |

4. **Environment Variables** (lidas no build: mudou, faça *Redeploy*). Nenhuma é segredo, todas vão para o
   JavaScript público:

| Variável | Valor |
|---|---|
| `VITE_API_URL` | `/api` |
| `VITE_CATALOGO_MOCK` | `false` |
| `VITE_SIMULACAO_PIX` | `true` na demonstração (junto com `PERMITIR_SIMULACAO_PIX=true` no Render). Senão, `false` |

5. **Deploy.** O `vercel.json` também faz o *rewrite* de qualquer rota para o `index.html`, então dar F5 em `/loja`
   ou `/conta` não dá 404.

As rotas `/api` e os arquivos de `/assets` ficam fora do fallback da SPA. O arquivo também aplica `no-referrer`
ao site e impede cache da API na CDN da Vercel. Chamadas autenticadas continuam passando pelo endereço do site;
não substitua `/api` por uma URL absoluta do Render no frontend.

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
- **Eventos de Pix:** `transparent.completed`, `transparent.refunded`, `transparent.disputed`, `transparent.lost`
- **Eventos do checkout de cartão:** `checkout.completed`, `checkout.refunded`, `checkout.disputed`, `checkout.lost`

Use uma chave `abc_dev_` e o webhook do mesmo ambiente Dev. O retorno do navegador não substitui a confirmação
financeira recebida e reconsultada pelo backend.

## Limitações conhecidas desta hospedagem

- **Plano Free do Render:**
  - a API dorme sem acesso, e o primeiro pedido depois disso pode levar perto de 1 min;
  - os planos gratuitos podem ser usados sem adicionar cartão. Quando a cota mensal de banda acaba sem método
    de pagamento, os serviços são suspensos; quando acabam os minutos de build, novos builds são bloqueados.
    [Regras oficiais](https://render.com/docs/free);
  - as tarefas periódicas de vendas (`iniciarTarefasVendas`) só rodam com a API acordada.
- **Fotos dos produtos:** o Web Service não tem disco persistente no plano Free, e sem `IMAGENS_DIR` o envio de foto
  no admin responde 503. O produto continua cadastrado e a interface informa a falha da foto. Para esta demonstração,
  deixe `IMAGENS_DIR` ausente e use o catálogo sem upload de imagens. Não aponte para `/tmp` ou para o diretório do
  código: arquivos enviados seriam perdidos no próximo reinício. Um disco persistente exige plano pago; armazenamento
  externo exigiria uma integração adicional. [Persistência na Render](https://render.com/docs/disks).
- **Avaliações do site, produtos e peixes:** são um protótipo salvo no `localStorage` do navegador. Elas não são
  compartilhadas entre visitantes e não são persistidas no PostgreSQL. A coleta centralizada não faz parte desta
  demonstração.
- **E-mails:** o remetente `onboarding@resend.dev` entrega apenas para a conta autorizada pelo Resend. Para recuperar
  senha em outras caixas de e-mail, será necessário um domínio de envio verificado. Não apresente essa configuração
  de teste como envio liberado para qualquer destinatário.
- **IP do rate limit:**
  - Com o rewrite, os pedidos passam pela Vercel e depois pelo balanceador do Render.
  - Com `TRUST_PROXY=1` (padrão), o limite pode contar o IP da Vercel em vez do IP do visitante. Isso não foi
    verificado.
  - Sinal do problema: em apresentações com muita gente, várias pessoas recebem "Muitas tentativas" no login ao
    mesmo tempo.
  - Mantenha `TRUST_PROXY=1` até verificar a cadeia real de proxies. Não aumente para `2` sem restringir o acesso
    direto à API: confiar em um salto a mais pode aceitar um `X-Forwarded-For` fornecido pelo visitante.
- **Frete:** sem `FRETE_TRANSPORTE_JSON`, a entrega responde 503 e só a retirada funciona (decisão de 17/11).

## 8. Conferência antes da apresentação

1. Confirme que a branch publicada contém a integração e as correções verificadas; alterações apenas locais não
   chegam aos serviços configurados para acompanhar `main`.
2. Abra `/api/health` diretamente na Render e aguarde a resposta, para despertar a API antes de demonstrar o site.
3. No domínio da Vercel, confira `/api/health`, o catálogo e o acesso direto a `/loja` e `/conta` com recarga da página.
4. Entre com as contas de demonstração e confirme restauração de sessão após recarregar, saída da conta e bloqueio
   da área administrativa para clientes.
5. Demonstre consulta, cadastro de produto sem foto, entrada de estoque, carrinho e retirada na unidade selecionada.
6. No pagamento, use apenas Dev mode e a simulação permitida. Confira a mudança do pedido e do estoque sem cobrança
   real. Se usar checkout de cartão, confira a habilitação no ambiente de teste e seus eventos de webhook.
7. Informe ao professor as limitações de fotos, avaliações locais e prazo de expiração do banco gratuito.

O build local e as fixtures de teste não substituem essa conferência no domínio publicado: os endereços, cabeçalhos
do proxy e as credenciais de Dev só podem ser confirmados após a configuração dos projetos.

### Verificação local de 23/11/2026

A base `bc48ff3` de `origin/main` foi integrada à branch `fix/integracao-main-20261119`, preservando o cadastro com
foto e a integração de frete. As correções de preparação foram verificadas com:

- instalação limpa, typecheck, build e 1.458 testes do backend em Node 22.23.5;
- 684 testes de integração em PostgreSQL 17 descartável, incluindo rollback completo do schema;
- 47 testes de navegador no Chromium, com fornecedores externos substituídos por fixtures;
- instalação limpa, testes, lint e build do frontend com `VITE_API_URL=/api` e catálogo real;
- teste HTTP da aplicação compilada em modo de produção, com configuração fictícia: health, login, cookie
  `Secure`/`HttpOnly`/`SameSite=Lax`, sessão, cadastro, recusa de upload sem disco, origem inválida e logout.

Os testes não usaram banco do projeto, gateway ou e-mail reais. O PostgreSQL temporário foi encerrado ao fim da
validação. As URLs dos serviços permanecem como exemplos, pois os projetos ainda não foram criados nas plataformas.
