# Unidade de retirada e cálculo de transporte — 17/11/2026

Implementação local, sem deploy. A loja informou que ainda não há conta, contrato ou tabela de frete. O cálculo está implementado para **tarifas contratadas configuráveis**, sem depender de uma API externa. Não existe cotação online de Correios/transportadora nesta implementação. Não há preços comerciais inventados: até receber/configurar a tabela aprovada, entregas em produção respondem 503 e retirada continua disponível.

## Retirada

O checkout exige Centro ou Matosinhos. `POST /api/vendas` com `retirada:true` exige `unidadeRetirada:"centro"|"matosinhos"`; ausência ou unidade desconhecida retorna 422. Frete é zero. Peixes e pedidos mistos podem ser retirados por clientes de qualquer cidade.

A unidade escolhida participa do hash de idempotência. Repetir a chave com outra unidade retorna 409, sem nova reserva de estoque. Nome/endereço são copiados pelo servidor para o pedido; não são aceitos do navegador. Cliente, administração e e-mail de retirada mostram a unidade/endereço. A equipe confirma a disponibilidade naquela unidade antes de marcar pronta para retirada. O estoque continua global: não foi criado estoque por filial.

Pedidos antigos não são atribuídos a uma unidade presumida. A interface/e-mail orientam confirmar com atendimento quando não há unidade gravada. Não apagar pedidos nem recriar volumes para migrar.

## Cadastro de embalagem

Na edição de produto, a administração tem o formulário separado **Embalagem e envio**. Em produto novo, cadastrar primeiro e abrir edição. As operações de catálogo e imagem permanecem separadas desse formulário.

- `GET /api/produtos/:id/logistica` (admin) retorna `{logistica:null}` se ainda não cadastrada ou `{logistica:{produtoId,pesoG,comprimentoCm,larguraCm,alturaCm,prazoPreparacaoDias,envioConvencional}}`.
- `PUT /api/produtos/:id/logistica` (admin + Origin) recebe todos os seis campos, substituindo o registro de logística. Não aceita preço, estoque, identificador nem campos desconhecidos.
- Peso é o da unidade **já embalada**, em gramas inteiras (1–1.000.000). Medidas da embalagem em centímetros inteiros (1–300). Preparação em dias inteiros (0–60). `envioConvencional` é booleano, inicialmente desmarcado na tela.
- A equipe só deve permitir envio convencional se produto/embalagem forem aceitos pela modalidade contratada. Peixe permanece bloqueado pelo backend mesmo com esse campo marcado.
- Esses dados são privados, sem cache; não alteram saldo, preço nem ficha técnica pública.

Cada unidade é cotada como **um volume separado**. Não há consolidação automática de vários itens em uma caixa; cadastrar medidas reais da embalagem unitária e configurar contrato compatível com a cobrança por volume. Não usar embalagem do produto sem proteção ou dimensões técnicas do aquário como se fossem as do volume pronto.

## Cálculo e seleção

`POST /api/frete/calcular` mantém itens e CEP/retirada. Para entrega, devolve também `opcoesFrete` com preço, prazo e `servicoFrete:{id,nome,transportadora,rastreioCorreios}`. Sem escolha explícita, seleciona menor preço, depois menor prazo e ID estável. `servicoFreteId` seleciona uma opção específica; desconhecida/incompatível retorna 409.

O checkout lista modalidade/transportadora, preço e prazo. A venda envia o ID escolhido e `totalEsperado`. No backend, a compra consulta o município pelo CEP, confere o endereço salvo e **recalcula preço/prazo com os dados atuais do banco**, sob a mesma trava dos produtos usada na edição logística. Nenhum preço, peso ou medida enviado pelo cliente define a cotação. Cotação antiga retorna 409 se o total mudou, sem venda nem baixa. Serviço escolhido e unidade participam da idempotência.

Para envio convencional, por volume:

```text
peso_cubado_em_gramas = teto(comprimento_cm × largura_cm × altura_cm × 1000 / fator_cubagem_cm³_por_kg)
peso_tarifável = maior(peso_real, peso_cubado)
preço = tarifa_da_faixa_de_peso × quantidade
frete_do_pedido = soma_dos_preços_de_todos_os_volumes
prazo_total = maior_prazo_de_preparação_dos_produtos + prazo_de_transporte
```

O fator de cubagem, cobertura e limites vêm do contrato; não há fator comercial padrão assumido. Peso e medidas excedentes, embalagem ausente ou restrição de envio eliminam a opção para o pedido inteiro. Os eixos da embalagem são comparados como cadastrados; não se presume rotação/encaixe. Uma modalidade não pode enviar parte do carrinho deixando o restante sem transporte.

São João del-Rei (IBGE 3162500) usa entrega própria; demais municípios usam serviços convencionais elegíveis. Pedido com peixe fora do município é bloqueado para entrega, inclusive misto. Entrega própria cobra tarifa por pedido e soma preparação ao prazo configurado; exige preparação cadastrada. Retirada não exige dados de embalagem.

O pedido guarda a identificação do serviço e os valores/prazo finais. Código de rastreio continua obrigatório no envio convencional; formato Correios quando `rastreioCorreios:true`, ou identificador alfanumérico de 5–60 caracteres (incluindo `_`/`-`) para outras transportadoras. E-mail identifica a transportadora efetiva.

## Configuração comercial

Em `.env.producao`, **somente após obter aprovação dos valores e condições**, preencher `FRETE_TRANSPORTE_JSON` com JSON em uma única linha entre aspas simples e reiniciar a app. Arquivo privado do servidor, nunca Git. Até lá, manter vazio. `FRETE_TABELA_JSON` é legado de desenvolvimento e **não habilita entregas em produção**.

Estrutura com metavariáveis, não executável e sem preços fictícios:

```text
{
 "servicos": [
   {
     "id": "<identificador estável, letras minúsculas/números/_/->",
     "nome": "<serviço contratado>", "transportadora": "<nome>",
     "tipoEntrega": "correios",
     "cepInicio": "<8 dígitos>", "cepFim": "<8 dígitos>",
     "prazoTransporteDias": <dias inteiros, 0–120>,
     "rastreioCorreios": <true para formato Correios; false para outro rastreio>,
     "fatorCubagemCm3PorKg": <inteiro do contrato>,
     "maxPesoG": <limite por volume em gramas>,
     "maxComprimentoCm": <limite em cm>, "maxLarguraCm": <limite em cm>,
     "maxAlturaCm": <limite em cm>, "maxSomaDimensoesCm": <limite em cm>,
     "faixasPeso": [
       {"ateGramas": <limite superior inclusivo>, "valorCentavos": <tarifa por volume>}
     ]
   },
   {
     "id": "<identificador de entrega local>", "nome": "<nome>", "transportadora": "Aquarilândia",
     "tipoEntrega": "propria", "valorCentavos": <preço local por pedido>,
     "prazoTransporteDias": <dias inteiros, 0–120>
   }
 ]
}
```

Até 30 serviços; IDs únicos de até 60 caracteres. Cada serviço nacional tem uma faixa de CEP e até 100 faixas de peso crescentes, sem lacuna de peso: a faixa seguinte inicia após a anterior e a última termina em `maxPesoG`. Limites máximos suportados: 1.000.000g, 300cm por eixo, 900cm na soma. Zero centavos é permitido apenas se explicitamente configurado/aprovado. Serviços inexistentes ou malformados impedem inicialização, sem imprimir o JSON. Não carregar tabelas de teste em produção.

A disponibilidade é calculada por cobertura, dimensões, peso e autorização de envio do produto. A configuração comercial também deve refletir restrições contratuais específicas (vidro, líquidos, químicos etc.) antes de permitir o produto. Não há contratação de etiqueta, coleta ou rastreamento online automático; a equipe usa o serviço contratado e informa o código após postar.

## Banco e deploy

Aplicar `db/init/35_entrega_logistica.sql` em banco existente **antes** do novo backend, após as migrações anteriores. No primeiro banco vazio os arquivos rodam em ordem alfabética. A migração é idempotente, usa lock timeout de 5s, acrescenta snapshots em vendas e a tabela de logística de produto; não modifica saldos nem credenciais.

A resposta de venda ganha `unidadeRetirada` em retiradas novas e `servicoFrete` em entregas cotadas por serviço. Sem snapshot legado, os campos são omitidos. Clientes antigos que criam retirada sem unidade precisam se adaptar ao novo 422. API/frontend foram atualizados juntos.

## Verificação

Testes usam PostgreSQL/Chromium reais e tabelas explicitamente fictícias. Nenhum contrato, pagamento ou transporte real é acionado.

- 1.434 testes HTTP/unitários do backend aprovados, executando arquivos em sequência.
- 669 integrações PostgreSQL aprovadas na suíte completa; os seis testes novos de entrega/logística foram repetidos após a última revisão da constraint e passaram.
- 32 testes Chromium aprovados na suíte completa, incluindo escolha de Centro, replay sem nova baixa, edição de embalagem no painel, seleção do serviço e persistência do preço/transportadora.
- Quatro arquivos de unitários do frontend aprovados, ESLint aprovado e builds backend/frontend aprovados. O aviso de bundle >500kB permanece como desempenho.
- A migração 35 aplica e reaplica no schema descartável. A constraint rejeita snapshot de unidade incompleto.

A rodada geral inicialmente sobrecarregou o host ao executar muitos processos de validação de ambiente junto ao navegador. Houve timeouts; a repetição com arquivos do backend em sequência e o navegador em rodada separada passou sem alterar os limites de timeout. Os logs 42P01/42703 em casos de falha intencional do banco pertencem aos testes de resposta neutra.

Comandos a partir de `backend/`, com `TEST_DATABASE_URL` apontando somente para PostgreSQL descartável:

```bash
NODE_ENV=test DATABASE_URL=postgres://fixture@127.0.0.1:1/fixture node --import tsx --test --test-concurrency=1 testes/*.test.mjs
NODE_ENV=test DATABASE_URL=postgres://fixture@127.0.0.1:1/fixture node --import tsx --test --test-concurrency=1 testes/integracao/*.test.mjs
npm run build
```

Em `frontend/`, após concluir as suítes pesadas do backend e mantendo `TEST_DATABASE_URL` definido:

```bash
npm test
npm run lint
npm run build
NODE_ENV=test npm run test:e2e
```

O PostgreSQL desta rodada foi criado em container descartável com tmpfs, sem volumes do projeto, e encerrado ao terminar. Não se aplicou a migração no banco compartilhado de desenvolvimento. Aplicá-la antes de usar a nova app nesse banco ou no deploy.
