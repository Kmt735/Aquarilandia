# Correções antes do primeiro deploy — 17/11/2026

**Atualização posterior:** a escolha da unidade, o cadastro de embalagens e o cálculo de tarifas por peso/cubagem foram implementados. Consulte [o estado atual e a migração 35](entrega-logistica-2026-11-17.md). A loja ainda não tem contrato/tabela, portanto `FRETE_TRANSPORTE_JSON` permanece vazia e entregas em produção continuam bloqueadas.

O sistema ainda não está em produção. As correções abaixo tratam os achados da auditoria e incluem a integração do frontend. Não houve deploy, pagamento real nem alteração do banco de desenvolvimento. O PostgreSQL de validação é descartável, sem volumes do projeto; gateway, CEP e e-mail são substituídos por fixtures explícitas nos testes.

## Achados e resultado

| Achado | Correção |
|---|---|
| A01 — segredos no log do proxy | Caddy remove `X-Webhook-Secret`, `Referer`, cookies, assinatura e query sensível. Helmet envia `Referrer-Policy: no-referrer`; redefinição remove token da URL. Homologação com binário real do Caddy. |
| A02 — sessão, compras e aprovação fictícias no frontend | Login/cadastro, sessão, endereços, orçamento, frete, compra, Pix e painel usam API real. Storage não concede autenticação. Confirmação depende do estado do backend; chave de idempotência persiste nas tentativas da mesma compra. |
| A03 — estorno manual sem prova | Ambas as conclusões manuais exigem consulta autenticada ao gateway com estorno integral, cobrança e valor conferidos. Locks revalidam o estado antes de gravar. |
| A04 — pagamento perdido após cancelamento | Job reconcilia cobranças conhecidas, incluindo canceladas, e reprocessa eventos que falharam independentemente do navegador/webhook. Pagamento tardio pede devolução e nunca reabre compra. |
| A05 — expedição após estorno/disputa | Mudanças logísticas reconsultam gateway fora dos locks e exigem estado financeiro válido sob lock. Estorno externo antes da expedição cancela e repõe estoque atomicamente; após envio/entrega exige devolução física, sem reposição automática. Disputa bloqueia avanço. |
| A06 — município inferido apenas do CEP | ViaCEP consultado no backend; município IBGE `3162500` controla entrega de peixe. Cidade/UF do endereço precisam corresponder à consulta. Falha do provedor bloqueia entrega, sem fallback numérico. |
| A07 — senha antiga aceita em corrida | Login e operações sensíveis revalidam hash/e-mail atual sob lock, na mesma transação da escrita. Teste concorrente com redefinição de senha. |
| A08 — estorno aceito sem conclusão/valor | Adaptador exige `COMPLETE`, `originalId` correto e valor integral. Resposta incompleta/pendente/divergente não encerra estorno. |
| A09 — senha antiga do banco no histórico | Produção recusa senha ausente, curta (<32) e placeholders; a senha antiga curta não passa. Gerar credencial exclusiva no servidor no primeiro deploy. Rotação de banco existente está descrita em `deploy.md`, seção 10. O histórico não foi reescrito e o banco local não foi alterado. |
| A10 — tarifas provisórias | Sem `FRETE_TRANSPORTE_JSON`, produção responde `503` nas entregas. Retirada continua disponível. A loja ainda não aprovou tarifas/prazos/área; não habilitar entrega até isso ocorrer. |
| A11 — cache de respostas privadas | `Cache-Control: no-store` e `Vary: Cookie` nas famílias de rotas privadas, inclusive erros de autenticação. |
| A12 — enumeração no cadastro | Mesmo `202 { mensagem }` para novo/existente, hash calculado em ambos e conflito de unicidade tratado sem expor a conta. Login separado. |

## Alterações de contrato para o grupo

- Cadastro válido retorna **202** e mensagem genérica; não retorna cliente nem autentica. O frontend e `dados-demo.ts` foram atualizados. Validação continua 422.
- Compra exige total mínimo de 100 centavos (mínimo do Pix). CEP/cidade/UF incompatíveis retornam 422 com detalhe `enderecoId`; provedor de CEP indisponível retorna 503.
- Entrega em produção sem tabela aprovada retorna 503; retirada usa frete zero.
- Mudança logística sem pagamento aprovado válido retorna 409. Falha na reconsulta financeira impede avançar a compra.
- Conclusão manual de estorno sem confirmação financeira integral retorna 409; indisponibilidade do gateway retorna 502. Descrição do admin não substitui confirmação.
- Estorno externo pode produzir transições de sistema `paga/em_separacao/pronta_retirada → cancelamento_solicitado → cancelada`.
- Webhooks de disputa/perda consultam a situação atual no gateway, assim como conclusão/estorno. O corpo do aviso nunca prova pagamento.
- Rotas/payloads de criação da venda e geração de Pix permanecem; frontend agora usa os DTOs e centavos do backend.

## Banco e tarefas

Em banco vazio, `db/init` roda em ordem e inclui `34_pagamentos_reconciliacao.sql`. Em banco já criado, aplicar esse arquivo **antes** de subir o novo backend, por conexão administrativa privada. Ele é idempotente, acrescenta timestamps/índices de reconciliação e usa `lock_timeout=5s`; erro exige investigar e repetir, sem apagar volume.

A primeira rodada do job ocorre após 30s e as seguintes a cada 5min. Reserva até 50 eventos e 50 cobranças por rodada, com `SKIP LOCKED` e timestamps; o intervalo efetivo por cobrança cresce com a fila. Reconsulta não mantém locks durante rede. Observar backlog e erros de reconciliação na operação.

Limite: reconciliação por cobrança depende de `gateway_cobranca_id` já conhecido. Se criar cobrança tiver timeout antes de gravar o ID, o retry idempotente da geração ou o webhook autenticado com metadata recupera o vínculo. Falha simultânea permanente de ambos exige conferência do extrato/painel; não alegar garantia de descoberta de cobrança desconhecida.

## Frete comercial pendente

A loja informou que ainda não confirmou a tabela. Deixar `FRETE_TRANSPORTE_JSON=` em produção até a aprovação. Não copiar os exemplos de desenvolvimento.

### Implementação posterior às políticas recebidas

Escolha de Centro/Matosinhos, persistência da unidade, notificações por unidade, cadastro administrativo de embalagens e cotação por peso/cubagem/transportadora foram implementados. O usuário confirmou retirada de peixes por qualquer cliente; entrega permanece restrita ao município. Consulte [o contrato atual, migração 35 e formato das tarifas](entrega-logistica-2026-11-17.md).

A loja ainda não possui contrato ou tabela. Manter `FRETE_TRANSPORTE_JSON` vazia em produção enquanto não houver condições aprovadas. O antigo `FRETE_TABELA_JSON` não habilita entregas em produção. A configuração atual usa tarifas contratadas por volume, sem consulta externa em tempo real, e exige peso/medidas da embalagem pronta e preparação cadastrados pela equipe. Privacidade e termos de uso continuam provisórios.

## Preparação do primeiro deploy

1. Gerar nova senha aleatória de banco no servidor (`openssl rand -hex 32`), alinhar `DB_PASSWORD` e `DATABASE_URL`; manter `.env.producao` privado.
2. Usar banco novo com todos os SQLs, ou aplicar 34 em volume existente; validar `/api/health`.
3. Manter tabela de frete vazia enquanto não aprovada e `VITE_CATALOGO_MOCK=false` no build.
4. Configurar domínio/HTTPS, provedor de e-mail e webhook autêntico. O Docker final contém build estático e dependências de produção do backend, sem Vite/ESLint.
5. Homologar pagamento/estorno no ambiente de **teste** da AbacatePay e entrega de e-mail com o domínio real. Os testes locais usam substitutos e não comprovam essas integrações externas.
6. Manter `PERMITIR_SIMULACAO_PIX=false` para operação comercial. Botão opcional de demonstração exige `VITE_SIMULACAO_PIX=true` no build, autorização admin e API com chave de teste; habilitar só na demonstração.

## Dependências

Atualizações compatíveis do lockfile corrigem alertas de minimatch/Zod; o plugin Tailwind/Vite foi classificado como dependência de desenvolvimento. `npm audit --omit=dev` do frontend retorna zero alertas; a auditoria completa mantém cinco alertas altos na cadeia de ferramentas abaixo. Backend sem alertas na consulta de 17/11/2026. Picomatch ainda não possui versão corrigida segundo o [aviso do mantenedor/GitHub](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), atualizado em 17/11. A cadeia Vite/plugin-react/fdir/tinyglobby mantém alertas em ferramentas de desenvolvimento/build. Não aplicar downgrade automático do Vite com `--force`: isso altera a versão principal sem resolver o desenho da ferramenta.

Mitigação vigente: nenhuma dessas ferramentas roda na imagem final; padrões de build vêm do repositório, sem entrada de clientes, e Vite local não é publicado no deploy. Atualizar quando o upstream corrigir. Esse alerta residual não deve ser descrito como resolvido ou como `npm audit` completo zerado.

## Validação

- Backend: **1.425 testes HTTP/unitários aprovados**, sem falhas ou ignorados; build TypeScript aprovado.
- PostgreSQL: **662 integrações aprovadas** na suíte completa, sem falhas ou ignorados. Após a proteção adicional de “já reembolsada”, os **30 casos de pagamento** foram repetidos e passaram, incluindo um novo caso negativo (663 casos distintos no conjunto final).
- Frontend: quatro arquivos de unitários aprovados, ESLint aprovado e build aprovado. Aviso de bundle >500kB permanece como desempenho, sem impedir build.
- Chromium: **30 casos da suíte completa aprovados**, mais um novo caso administrativo aprovado isoladamente (31 casos distintos). Cadastro/login, sessão forjada, recuperação real com token, compra/Pix, replay da venda sem segunda baixa, confirmação, cancelamento/estorno e avanço administrativo da retirada.
- Caddy real: um caso de homologação aprovado, cobrindo encaminhamento de credenciais fictícias e ausência nos logs em respostas 200/500.
- Scripts operacionais compilados com as mesmas opções TypeScript do Dockerfile.
- Auditoria npm: zero alertas no backend e no frontend sem dependências de desenvolvimento; cinco alertas altos de build permanecem documentados acima.

Gateway/e-mail/CEP nos testes são fictícios; PostgreSQL e navegador são reais. Nenhum teste executa cobranças financeiras reais. Os testes de erro do banco produzem logs sanitizados intencionais e verificam a resposta neutra.

Comandos, com dependências instaladas, Node 22 (como o Dockerfile) e uma URL PostgreSQL **descartável** em `TEST_DATABASE_URL`:

```bash
# Em backend/
npm test
npm run build
NODE_ENV=test DATABASE_URL=postgres://fixture@127.0.0.1:1/fixture node --import tsx --test --test-concurrency=1 testes/integracao/*.test.mjs
CADDY_BIN=/caminho/caddy node --test testes/homologacao/logs-caddy.test.mjs

# Em frontend/ (TEST_DATABASE_URL continua definida)
npm test
npm run lint
npm run build
npm run test:e2e
```

A validação desta sessão usou Node 20.19.2 do host e Chromium compatível instalado em `/tmp`; o build de produção define Node 22. `cn` emite aviso de engine no host por exigir Node >=22. O comando de integração não aceita banco de desenvolvimento como fallback. O harness cria schemas próprios e os remove ao terminar. A homologação real no ambiente de destino continua pendente.
