# Estoque — primeiro incremento administrativo

**Evolução posterior:** este relatório registra o primeiro incremento. As leituras administrativas e a execução
da versão combinada com Backend 2 foram acrescentadas depois, conforme [relatório de consultas e integração](estoque-leituras-integracao-2026-11-03.md).
As contagens e a limitação de `git apply --check` abaixo descrevem a validação original, não a homologação posterior.

Implementado em 03/11/2026. Este incremento permite somente entrada, ajuste positivo/negativo e saída administrativa. Reserva, alocação, venda, pagamento e expiração continuam propostas do [Ciclo 3](ciclo-3-estoque-proposta-2026-11-03.md), sem implementação ou aprovação implícita.

## Contrato HTTP efetivo

`POST /api/estoque/movimentacoes` exige `sid` válido, papel atual `admin` e `Origin` igual a `CORS_ORIGIN`. Reutiliza `autenticar`, `exigirAdmin` e `exigirOrigem`; a autoria vem de `req.usuario.id`. Respostas e erros usam `Cache-Control: no-store` e `Vary: Cookie`.

Header obrigatório: `Idempotency-Key`, UUID canônico em minúsculas, versões 1–8 e variante RFC. Ausente, nil, maiúsculas, duplicado/concatenado ou fora do formato: `400`. O ID da operação também é UUID; essa é uma exceção explícita ao padrão de IDs numéricos de produtos/categorias.

```json
{"produtoId":42,"tipo":"entrada","quantidade":10,"motivo":"Reposição conferida"}
```

- Somente esses quatro campos. Nenhuma query é aceita. Recusa saldo absoluto, estoque, ativo, preço, vendaId, autor/ator/origem/papel e qualquer campo adicional.
- `produtoId` e `quantidade`: números JSON inteiros de 1 a 2147483647, sem coerção de strings/booleanos.
- `tipo`: `entrada`, `ajuste_positivo`, `ajuste_negativo`, `saida`. Quantidade sempre positiva; somente os dois primeiros aumentam o saldo.
- `motivo`: string com trim e normalização NFC, de 1 a 300 pontos de código Unicode, com pelo menos uma letra ou número, sem caracteres da categoria Unicode C (controles/formatação/surrogates etc.). Espaços internos permanecem significativos.
- Produto deve existir. Produto inativo aceita movimento e permanece inativo; nenhuma ficha, categoria, imagem, nome ou preço é alterado.

Primeira execução e replay: `201` com somente os campos abaixo. Data é ISO 8601 UTC.

```json
{
  "operacaoId":"332a00b2-8fab-4860-8b9c-a764667a6923",
  "produtoId":42,
  "tipo":"entrada",
  "quantidade":10,
  "saldoAnterior":0,
  "saldoAtual":10,
  "criadoEm":"2026-11-03T12:00:00.000Z"
}
```

`saldoAtual` é o saldo **após aquela operação**, não uma leitura do saldo presente. Depois de outro movimento, o replay continua devolvendo o snapshot original. Não expõe motivo, hash, chave, sessão ou dados pessoais.

| Status | Comportamento |
|---|---|
| 400 | Body/header/query inválidos. O parser global pode devolver `JSON inválido` para null/primitivos; corpo grande/comprimido mantém 413/415 globais. |
| 401 | Sem sessão, sessão revogada/vencida ou conta inativa. |
| 403 | Cliente autenticado ou Origin ausente/incorreto. |
| 404 | Produto inexistente; não persiste reivindicação da chave. |
| 409 | Saldo insuficiente, saldo resultante acima do limite INTEGER ou mesma chave/admin com intenção diferente. |
| 500 | Falha inesperada; `{ "erro": "Erro interno do servidor" }`, sem mensagens SQL. |

Preserva `{ erro, detalhes? }`; não migra para o formato de erros do PDF. GET de saldo/histórico permanece ausente: a implementação não publica as leituras que constam no mapa futuro de rotas.

## Saldo, histórico e idempotência

O service valida antes de abrir transação. `comTransacao` fornece um único client obrigatório para todos os métodos do repository:

1. Gera UUID da operação e tenta inserir a intenção, com unicidade `(autor_id,chave_idempotencia)`.
2. Em conflito, o INSERT espera a transação concorrente terminar. Nova instrução lê resultado e hash persistidos. Mesmo hash: replay; hash diferente: 409. Não consulta nem atualiza o saldo nesse caminho.
3. Para operação nova, `SELECT ... FOR NO KEY UPDATE` no produto, sem filtro ativo.
4. Calcula saldo com sinal do tipo e verifica 0..2147483647 antes da escrita. Atualiza apenas estoque/timestamp, com condição sobre o saldo lido.
5. Insere movimento com delta, antes/depois, motivo e referência da operação; COMMIT. Qualquer falha desfaz também a chave.

O hash SHA-256 considera a sequência fechada `[produtoId,tipo,quantidade,motivo_normalizado]`; ordem das propriedades do JSON e trim/NFC equivalentes não mudam a intenção. Outro admin pode usar o mesmo UUID independentemente. Mudança de qualquer campo da intenção gera 409 para a mesma chave/admin. Não há expiração automática dessas chaves.

O replay passa pelas mesmas guardas; perda de papel retorna 403, sessão revogada retorna 401, mesmo após sucesso anterior. UNIQUE e transação protegem requisições simultâneas. Lock de produto serializa movimentos com outros movimentos, PATCH, DELETE e reativação. A resposta preserva o histórico, não reinterpreta o resultado conforme o estado atual do produto.

## Schema mínimo

`backend/db/init/30_estoque.sql` cria:

- `migracoes_estoque`: registro da versão `001_movimentos_admin`.
- `operacoes_estoque`: UUID, origem (`admin`/`abertura`), autor FK clientes, chave UUID, hash e timestamp; CHECK distingue a autoria de abertura da administrativa; UNIQUE por admin/chave.
- `movimentacoes_estoque`: ID BIGSERIAL interno (não exposto no DTO), operação/produto com FKs sem cascata, tipo, quantidade, delta, saldo anterior/atual, motivo e timestamp; UNIQUE(operação,produto), CHECK de aritmética/sinal e índice por produto/data/ID.
- Abertura tem índice único por produto. Quantidade zero é permitida somente nesse tipo interno; a API não aceita `abertura`.
- Triggers rejeitam UPDATE, DELETE e TRUNCATE do histórico e das operações. Correção é outro movimento, não edição/apagamento. Usuário privilegiado capaz de alterar DDL ainda exige controle operacional; triggers não substituem permissões adequadas no deploy.

Não cria alocações, reserva, FK de movimento para venda ou novos estados comerciais. A referência por operação/produto pode ser evoluída posteriormente por migração, depois de aprovado o contrato com B2.

## Bancos novos e existentes

O compose já monta `db/init/` e o entrypoint executa `.sql` em ordem alfabética **somente em volume vazio**. Agora inclui 30 depois de catálogo/clientes/vendas. O arquivo contém um único DO, que é atômico inclusive no bootstrap sem transação externa.

Para base existente, foi acrescentado:

```bash
cd backend
npm run db:migrar-estoque
```

O script lê `.env` como os outros comandos e usa o mesmo SQL dentro de `comTransacao`. Não chama Docker, não reseta banco e não imprime URL, SQL, parâmetros ou erro livre. Sucesso: mensagem fixa de aplicação/verificação; falha: exit 1 com mensagem genérica. A versão só é registrada após todos os passos.

Procedimento de implantação:

1. Revisar `DATABASE_URL` no ambiente correto e obter backup verificável. A base precisa ter catálogo e clientes inicializados. Não imprimir credenciais nem usar `db:reset`.
2. Pausar escritas do catálogo/rotinas SQL durante a atualização. A migração adquire `SHARE ROW EXCLUSIVE` em produtos; consultas continuam possíveis. Se não obtiver o lock em 5 s, aborta integralmente: verificar requisições em andamento e repetir depois, sem forçar/destruir dados.
3. Executar `npm run db:migrar-estoque` **antes de habilitar a nova rota**. Não há migração automática no startup da API nem fallback em memória se tabelas estiverem ausentes.
4. Conferir a versão, saldos, aberturas e reconciliação abaixo. Depois publicar/iniciar o backend atualizado.
5. Repetir o comando é seguro: verifica estrutura mínima e reconciliação, sem adicionar novas aberturas ou alterar saldos. Não editar o SQL de uma versão aplicada; evolução futura requer nova migração.

```sql
SELECT * FROM migracoes_estoque ORDER BY versao;
SELECT tipo, count(*) FROM movimentacoes_estoque GROUP BY tipo;

-- Deve retornar zero linhas, inclusive depois das operações administrativas:
SELECT p.id, p.estoque, COALESCE(sum(m.delta),0) AS saldo_historico
FROM produtos p
LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id
GROUP BY p.id, p.estoque
HAVING p.estoque::bigint <> COALESCE(sum(m.delta),0);
```

Na primeira aplicação, cada produto preexistente, inclusive zero/inativo, recebe operação/movimento de abertura com antes=0, delta=quantidade=saldo existente e depois=saldo existente. **Não há UPDATE de produtos**: não soma unidades, não muda ativo/preço/timestamp. Uma abertura de sete unidades apenas documenta as sete que já existiam. Cadastro posterior continua zero e não precisa de abertura retroativa.

Reaplicação com divergência causada por SQL externo falha em vez de legitimar outro saldo como abertura. É preciso investigar/reconciliar operacionalmente. Vendas antigas não são interpretadas como reserva nem recebem movimentação inferida. Não foi executada a migração na base compartilhada de desenvolvimento; a aplicação foi validada em bancos descartáveis novos e com saldo legado.

## Compatibilidade e limites

API pública continua expondo somente `emEstoque`, derivado do saldo, sem quantidade/histórico. A consulta da vitrine `/api/peixes?em_estoque=true&pagina=1&limite=3` reflete entrada/saída e mantém exigências de ativo, categoria e ficha. `POST /produtos` continua zero; PATCH não aceita unidades; desativação/reativação preservam saldo e histórico.

Auth, sessão, Origin, rawBody do webhook, helper de transação e código do Backend 2 não foram reescritos. O corpo livre do motivo fica apenas no histórico privado, nunca nos logs de falha. Hash/chave/ator também não aparecem no resultado HTTP. Não há liberação de reserva, endpoint para cliente movimentar unidades nem sincronização com checkout nesta entrega.

## Verificação e integração

Novas suítes: `testes/estoque.test.mjs`, `testes/integracao/estoque.test.mjs`, `testes/integracao/estoque-migracao.test.mjs`. Cobrem guardas/revogação, sinais/limites, intenção normalizada, replay com saldo histórico, mesma chave concorrente e após rollback, última unidade, serialização com catálogo, falha no histórico, bootstrap/legado/reaplicação/script incremental/imutabilidade e disponibilidade pública.

Executar com as dependências já declaradas e `TEST_DATABASE_URL` apontando somente para PostgreSQL descartável:

```bash
npm run typecheck
npm test
npm run test:integration
npm run build
npm audit
git diff --check
```

Nenhuma dependência ou lockfile foi atualizado. A política de vendas do Ciclo 3 continua pendente: D como saldo disponível, prazo de reserva, preço esperado, cobrança efetiva e estorno/retorno físico não foram aprovados nem implementados por esta tarefa.

### Resultados deste incremento

| Verificação | Resultado |
|---|---|
| Backend `npm run typecheck` | Passou. |
| Backend `npm test` | 886 testes passaram, nenhum ignorado; 68 testes novos da rota. |
| `TEST_DATABASE_URL=... npm run test:integration` | 369 testes passaram, nenhum ignorado; 28 novos de estoque/migração, PostgreSQL 17 real descartável. |
| Backend `npm run build` | Passou. |
| Backend `npm audit --json` | Zero vulnerabilidades reportadas. Nenhum audit fix ou alteração de versões. |
| Frontend `npm test` | 89 testes passaram, nenhum ignorado. |
| `git diff --check` e whitespace dos novos arquivos | Passaram. |

As suítes completas foram executadas na cópia isolada do HEAD com estes arquivos, usando dependências existentes.
A consulta real usada pela vitrine foi verificada em HTTP/PostgreSQL; E2E de navegador não foi reexecutado nesta
rodada e não foi contado como aprovado. Nenhuma migração foi aplicada em banco compartilhado.

Estado inicial: branch-backend em `afa0d35`, 27 commits à frente de origin/branch-backend; somente a proposta
do Ciclo 3 estava não versionada. Esse arquivo foi preservado sem alterações. `origin/main=afa0d35`,
`origin/branch-backend=856e733` e `origin/branch-backend-2=821e8c5` foram confirmados novamente no encerramento.
Os sete commits novos do Backend 2 continuam apenas no remoto; não houve merge, rebase, reset, commit ou push.

A verificação `git apply --check` do diff HEAD→branch-backend-2 sobre uma cópia com as mudanças de estoque
passou sem conflitos textuais. Não houve aplicação do patch. A sobreposição é documental (`api.md` e
`decisoes.md`); preservar a correção remota do estorno e D-47 ao integrar. Schema de catálogo/clientes/vendas,
sessão/admin/Origin, tipos compartilhados, transação, package.json e rotas agregadoras não recebem mudanças
nesses sete commits que concorram com este módulo. D-48 estava livre nas referências verificadas.

A compatibilidade funcional foi examinada: o ID/FK de clientes, a assinatura de sessão, os middlewares e o
helper usados aqui continuam iguais no remoto; a nova rota não altera login/recuperação/gateway. Os testes
novos de recuperação de senha do remoto não foram executados neste incremento, nem se garante ausência
de conflitos depois de novos commits. A próxima integração deverá homologar a árvore combinada.

Arquivos: módulo `src/modulos/estoque/` (types, validacao, repository, service, controller, routes),
`db/init/30_estoque.sql`, `scripts/migrar-estoque.ts`, `src/routes/index.ts`, script em package.json,
três suítes de estoque/migração, este documento, D-48 em decisoes.md, api.md, README principal e README de testes.
Sem alteração de fonte do frontend, comTransacao, schema de vendas ou código do Backend 2.
