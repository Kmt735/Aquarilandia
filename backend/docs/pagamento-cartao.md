# Cartão de crédito e débito — AbacatePay v2

O checkout da loja oferece Pix e **Cartão de crédito ou débito**. Cartão abre a página hospedada da AbacatePay com `methods: ["CARD"]`, à vista, sem repasse de taxas. A escolha entre crédito, débito e carteiras disponíveis é feita nessa página. A conta precisa ter cartão liberado pela AbacatePay; não há método de API separado chamado `DEBIT`.

## Instalação

1. Aplicar a migração aditiva, sem reset: `cd backend && npm run db:migrar-pagamentos-cartao`. Bancos novos recebem `db/init/36_pagamentos_cartao.sql` automaticamente. Em produção, aplicar o mesmo SQL antes de subir o backend atualizado.
2. Usar a chave v2 do ambiente correto em `GATEWAY_ACCESS_TOKEN`, com permissões para criar/consultar produtos e criar/consultar/reembolsar checkouts. Manter as permissões do Pix. Não copiar a chave para o frontend.
3. No webhook já configurado em `/api/pagamentos/webhook`, adicionar `checkout.completed`, `checkout.refunded`, `checkout.disputed` e `checkout.lost`, mantendo os eventos `transparent.*` do Pix. Manter o segredo e a assinatura HMAC. As URLs de retorno são geradas a partir de `FRONTEND_URL` (ou `CORS_ORIGIN` no desenvolvimento).
4. Confirmar a liberação de cartão na conta AbacatePay antes de usar pagamentos reais. Os testes locais substituem o gateway e não comprovam essa habilitação.

## Contrato

`POST /api/vendas/:id/pagamentos` mantém Pix como padrão, sem body ou com `{ "metodo": "pix" }`. Com `{ "metodo": "cartao" }`, retorna `{ pagamentoId, metodo: "cartao", url, expiraEm }`. Valor e dono vêm exclusivamente do pedido no banco. O cliente pode retomar em **Minhas compras → Continuar pagamento**, inclusive com carrinho vazio ou produto esgotado.

O servidor cria um produto de valor fixo por tentativa (total dos itens mais frete) e um checkout de pagamento único. A URL retornada é validada para `https://app.abacatepay.com/pay/bill_…`. Número, validade, CVV e tokens de cartão não passam pela loja nem são persistidos.

O retorno do navegador nunca aprova uma venda. Webhooks autenticados e reconsultas confirmam id e valor pelo `GET /checkouts/get`. Cancelamento e pagamento duplicado usam `POST /checkouts/refund`, com as mesmas regras de estoque, confirmação de estorno e reconciliação usadas para Pix.

## Repetições e prazo

Há uma tentativa pendente por modalidade. `pagamentos_checkout` mantém uma referência UUID própria e registra o início do envio **antes** do POST de criação. Chamadas concorrentes e recarregamentos recuperam o checkout pela referência. Rejeição explícita permite nova tentativa; timeout ou resposta inválida exigem reconsulta, sem repetir o POST e arriscar cobrança dupla. Se a consulta nunca encontrar uma cobrança após envio incerto, a tentativa permanece bloqueada para investigação no painel/suporte; não limpar o marcador sem confirmar que a cobrança não existe.

`expiraEm` é o prazo de reserva do pedido na loja. O checkout hospedado de cartão não documenta um vencimento configurável; não enviamos `expiresIn` nem vencimento de boleto nessa rota. Pagamento recebido após cancelamento é devolvido, sem reabrir o pedido. A expiração consulta as cobranças das duas modalidades antes de repor o estoque.

## Referências oficiais

- [Criar checkout](https://docs.abacatepay.com/pages/payment/create)
- [Buscar checkout](https://docs.abacatepay.com/pages/payment/one)
- [Reembolsar checkout](https://docs.abacatepay.com/pages/payment/refund)
- [Eventos do checkout](https://docs.abacatepay.com/pages/webhooks/events/checkout)
- [Crédito e débito e liberação da conta](https://www.abacatepay.com/cartao)
