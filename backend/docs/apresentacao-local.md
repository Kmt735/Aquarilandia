# Apresentação local

Preparação de 18/11/2026. Banco da apresentação: `aquarilandia`, PostgreSQL local na porta 5432. Todas as migrações de `db/init`, incluindo 34 e 35, foram aplicadas. O banco técnico `postgres` foi preservado. Antes do reset, foi salvo um backup privado em `/home/celio/.local/share/aquarilandia/backups/`.

## Abrir e entrar

- Site: http://localhost:5173
- Painel: http://localhost:5173/admin
- API: http://localhost:3333/api/health
- Admin: `admin.demo@exemplo.com`.
- Cliente principal: endereço definido em `DEMO_CLIENTE_EMAIL` no arquivo privado abaixo.
- Senhas e e-mails de acesso: `backend/.env.demo-acessos`, arquivo local ignorado pelo Git. Não copiar seu conteúdo para relatórios, commits ou mensagens.

Use `http://localhost:5173` para manter a origem esperada pela API. O Vite redireciona a abertura por `127.0.0.1:5173` para esse endereço; as escritas da API continuam exigindo a origem configurada.

Abra uma janela anônima para não reaproveitar sessão ou carrinho do banco anterior. A conta administrativa entra pelo mesmo formulário de login; o papel retornado pela API direciona ao painel.

Para iniciar, em terminais separados:

```bash
cd backend
npm run dev
```

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --open http://localhost:5173
```

Não inicie outra cópia se esses serviços já estiverem rodando nas mesmas portas.

## Dados e roteiro

O preparo inicial deixou 23 produtos nas 12 categorias, 4 contas, 6 pedidos e 3 solicitações de orçamento. Um produto está esgotado, outro foi cadastrado e movimentado pelo próprio painel. Há fichas técnicas e embalagens. O catálogo recebeu fotografias reais ilustrativas em 22 produtos, com autoria, fonte e licença em `/creditos-imagens`, acessível pelo rodapé. O termômetro permanece com a imagem anterior por falta de fotografia adequada com licença confirmada. Modelos, embalagens e capacidades fotografados podem diferir dos itens fictícios da demonstração. Os saldos foram reconciliados com o histórico de movimentações.

1. Na loja, pesquisar, filtrar, comparar peixes e montar um aquário com produtos compatíveis. Mostrar o item esgotado.
2. Entrar como cliente, escolher itens, retirada no Centro ou Matosinhos e gerar Pix.
3. Na própria tela do Pix, clicar em **Simular pagamento de teste**. O botão aparece somente quando o backend permite simulação e usa chave Dev. A AbacatePay simula o recebimento e o servidor consulta a confirmação; não precisa entrar como admin nem transferir dinheiro real. A ação também existe ao retomar o pagamento em **Minhas compras**.
4. A tela mostra **Pagamento aprovado!** e conclui a compra após consultar o status real. No painel, avançar para preparação, pronta para retirada e entrega; ou cancelar antes da entrega e acompanhar o estorno Dev.
5. Em **Produtos**, cadastrar/editar um produto. Abrir sua edição para enviar/remover foto e cadastrar embalagem. Desativar e reativar para conferir a visibilidade na loja.
6. Em **Estoque**, buscar um produto, usar **Dar entrada** para reposição ou **Saídas e ajustes** para baixas/correções com motivo e verificar saldo e histórico. Uma saída acima do saldo deve ser recusada.
7. Solicitar um serviço pela loja e acompanhar a solicitação em **Orçamentos**, abrindo **Ver e editar** para atualizar os dados e o andamento do atendimento.
8. Em **Clientes**, consultar cadastros e bloquear/reativar a conta fictícia Bruno Demonstração. O bloqueio revoga suas sessões. Não bloquear o cliente principal durante a compra demonstrada.

Pedidos aguardando pagamento vencem após 30 minutos. Isso é comportamento normal: crie uma compra nova durante a apresentação para mostrar um Pix válido. Pedidos já pagos/em preparação, entregues e cancelados permanecem disponíveis como histórico.

## Limites da demonstração

- Usa API e banco reais, com chave da AbacatePay **Dev**. Os pagamentos são simulados, sem dinheiro real.
- E-mails da compra principal chegam ao destinatário autorizado. Ana e Bruno são cadastros fictícios, sem pedidos ou disparos de e-mail preparados.
- `FRETE_TRANSPORTE_JSON` contém tarifas **fictícias** identificadas como demonstração. Pesos e medidas semeados são ilustrativos. Não copiar essas condições para produção.
- `VITE_CATALOGO_MOCK=false`: catálogo e painel consultam o backend. `VITE_SIMULACAO_PIX=true` e `PERMITIR_SIMULACAO_PIX=true` são configurações exclusivas desta apresentação com chave Dev.
- Imagens ficam em `/home/celio/.local/share/aquarilandia/imagens`, fora do repositório e preservadas ao reiniciar a aplicação.
- O painel usa os endpoints reais de catálogo, pedidos, estoque, orçamentos e clientes. Não permite aprovar pagamento manualmente; a confirmação financeira depende do gateway.

Para repetir somente o catálogo sem duplicar os dados, com a API local disponível:

```bash
cd backend
DEMO_LOGISTICA=true node --env-file=.env --env-file=.env.demo-acessos --import tsx scripts/dados-demo.ts
```

Esse comando não recria os pedidos e não reseta o banco. Para testes automáticos, usar outro PostgreSQL com `TEST_DATABASE_URL` exclusivo e descartável.
