# Banco e AbacatePay para vendas reais

Este roteiro complementa [o deploy com Docker e Caddy](deploy.md). Publicar a aplicação com
`NODE_ENV=production` não transforma uma chave de teste em uma integração financeira real.

## Informações necessárias

- Domínio definitivo e servidor de produção, ou serviço gerenciado escolhido.
- Banco novo ou banco existente; se existente, identificar dados e migrações antes de alterar qualquer coisa.
- Conta recebedora da AbacatePay: confirmar no painel a empresa/titular e a conta de recebimento.
- Conta verificada, modo de produção liberado e chave da API v2 dessa conta.
- Configuração do Resend: a aplicação também exige remetente e chave de e-mail em produção.

Nunca colocar tokens, senhas ou o arquivo `.env.producao` no Git. Preencher os segredos diretamente
no servidor ou no gerenciador de segredos da hospedagem.

## PostgreSQL

No Compose de produção, o PostgreSQL usa o serviço `db`, volume persistente `pgdata` e rede interna,
sem publicar uma porta. Para banco novo nesse ambiente:

1. Copiar `backend/.env.producao.example` para `backend/.env.producao` no servidor e aplicar permissão `600`.
2. Gerar uma senha própria desse ambiente (`openssl rand -hex 32`).
3. Preencher `DB_USER`, `DB_NAME`, `DB_PASSWORD` e a `DATABASE_URL` correspondente, com host `db`.
4. Usar volume novo: os scripts de `db/init/` são executados apenas na primeira inicialização.

O `src/config/db.ts` já lê a URL validada de `src/config/env.ts`; não precisa receber uma senha no código.
Banco externo exige adaptar o Compose e conferir os requisitos de conexão/TLS do provedor antes do deploy.

Para banco existente, fazer backup e conferir as migrações, inclusive pagamentos por cartão e logística.
Alterar `DB_PASSWORD` no arquivo não troca a senha de um usuário PostgreSQL já criado. Não remover volumes
para aplicar configuração. Não copiar cobranças de teste para o banco de vendas reais.

## Conta e API da AbacatePay

1. Entrar na conta recebedora confirmada e selecionar o modo de produção.
2. Criar uma chave v2 de produção (`abc_prod_`), com as permissões necessárias à integração.
3. Preencher `GATEWAY_ACCESS_TOKEN` no ambiente do backend. A chave nunca vai para variáveis `VITE_*`.
4. Manter `PERMITIR_SIMULACAO_PIX=false`.
5. Gerar `GATEWAY_WEBHOOK_SECRET` exclusivo, com pelo menos 32 caracteres.

A API do projeto usa `https://api.abacatepay.com/v2` tanto para teste quanto para produção.
As operações usadas estão em `src/modulos/pagamentos/gateway.ts`: criação/consulta/estorno de Pix,
criação/consulta de produtos e criação/consulta/estorno de checkout de cartão. Conferir essas permissões
no painel. Confirmar com a AbacatePay a habilitação de cartão antes de oferecer esse método em vendas reais.

Não trocar a chave por uma de outra conta sobre um banco com pagamentos em andamento: o backend reconsulta
e estorna cobranças com a credencial configurada. Planejar a transição e resolver as pendências da conta anterior.

## Domínio e webhook

Preencher `DOMINIO` com o domínio sem protocolo. `CORS_ORIGIN`, `FRONTEND_URL` e `API_URL` devem usar
o mesmo endereço público com HTTPS, conforme o Compose existente.

Cadastrar um webhook **no modo de produção da conta correta**, mesmo que já exista um no modo de teste:

- Endpoint: `https://SEU_DOMINIO/api/pagamentos/webhook`.
- Secret: o mesmo valor privado de `GATEWAY_WEBHOOK_SECRET`.
- Eventos de Pix: `transparent.completed`, `transparent.refunded`, `transparent.disputed`, `transparent.lost`.
- Eventos de cartão: `checkout.completed`, `checkout.refunded`, `checkout.disputed`, `checkout.lost`.

O backend verifica o secret recebido na query e a assinatura do corpo e reconsulta a cobrança na API.
Configurar o secret no campo próprio do painel; não publicar URLs contendo o valor em documentação ou logs.

## Aplicação e validação

Após preencher o ambiente e preparar o banco, executar no servidor, dentro de `backend/`:

```bash
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml up -d --build
sudo docker compose --env-file .env.producao -f docker-compose.prod.yml ps
```

Criar o administrador real pelo script `criar-admin`; não executar a etapa de dados de demonstração no banco real.
Conferir HTTPS, saúde da aplicação e conexão com o banco antes de liberar compras. Validar uma compra real
de baixo valor combinada com o responsável pela conta, verificando recebimento no painel correto, processamento
do webhook, atualização do pedido e e-mail. Validar o fluxo de cartão se habilitado e combinar previamente
qualquer teste de estorno, pois essas operações movimentam dinheiro real.

Preparar e testar restauração de backup do PostgreSQL e preservar também o volume de imagens.

Referências oficiais: [integração e passagem para produção](https://www.abacatepay.com/duvidas/como-integrar-a-abacatepay)
e [webhooks](https://www.abacatepay.com/api/webhooks).
