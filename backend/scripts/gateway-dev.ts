// Prova do gateway em Dev mode da AbacatePay (#43), com a chave do .env. Só para a conta de teste do dev.
// Uso: npx tsx --env-file-if-exists=.env scripts/gateway-dev.ts
// Nunca imprime o token, o código Pix nem respostas inteiras: só ids, status, datas e tamanhos.
// Para rodar de novo, troque os pagamentoId: a criação é idempotente pelo externalId, e a cobrança 999001 já foi
// paga e estornada (criar de novo devolve a mesma, que não nasce mais pendente).
import { env } from '../src/config/env.js'
import {
  consultarCobranca,
  consultarStatusCobranca,
  criarCobrancaPix,
  estornar,
  simularPagamentoPix,
} from '../src/modulos/pagamentos/gateway.js'
import type { StatusCobranca } from '../src/modulos/pagamentos/gateway.js'

if (env.nodeEnv === 'production') {
  console.error('Recusado: este script só roda fora de produção (Dev mode da AbacatePay).')
  process.exit(1)
}

const pagamentoId = 999001
const vendaId = 999001
// O estorno sai do SALDO DISPONÍVEL da conta (D-22): o Pix de R$ 1,00 entra líquido da taxa e não cobre o próprio
// estorno. Esta segunda cobrança, paga por simulação, junta o saldo antes de estornar a primeira.
const pagamentoIdSaldo = 999002

async function etapa<T>(nome: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    // As mensagens de erro do gateway não têm dados nem segredos (só o texto do 502 ou da validação)
    console.error(`✗ ${nome}: ${err instanceof Error ? err.message : 'erro inesperado'}`)
    process.exit(1)
  }
}

function conferir(condicao: boolean, mensagem: string): void {
  console.log(`${condicao ? '✓' : '✗'} ${mensagem}`)
  if (!condicao) process.exit(1)
}

// Compara a listagem (usada pelo consultarCobranca) com o check; se divergirem, para (combinado no Lote 7)
async function compararConsultas(momento: string, esperado: StatusCobranca, cobrancaId: string): Promise<void> {
  const pelaLista = await etapa(`consultar (list) ${momento}`, () => consultarCobranca(cobrancaId))
  const peloCheck = await etapa(`consultar (check) ${momento}`, () => consultarStatusCobranca(cobrancaId))
  console.log(`  ${momento}: list=${pelaLista.status} check=${peloCheck} valor=${pelaLista.valor} ` +
    `externalId=${pelaLista.externalId ?? 'null'} vendaId=${pelaLista.vendaId ?? 'null'} ` +
    `pagamentoId=${pelaLista.pagamentoId ?? 'null'}`)
  if (pelaLista.status !== peloCheck) {
    console.error(`✗ PARE: list e check divergem ${momento} (list=${pelaLista.status}, check=${peloCheck})`)
    process.exit(2)
  }
  conferir(pelaLista.status === esperado, `${momento}: status ${esperado} nas duas consultas`)
}

const expiraEm = new Date(Date.now() + 10 * 60_000)

console.log('1. Criar cobrança Pix de 100 centavos')
const primeira = await etapa('criar', () => criarCobrancaPix({ pagamentoId, vendaId, valor: 100, expiraEm }))
console.log(`  cobrancaId=${primeira.cobrancaId} status=${primeira.status} ` +
  `expiraEm=${primeira.expiraEm.toISOString()} tamanho do codigoPix=${primeira.codigoPix.length} ` +
  `tamanho da imagem=${primeira.qrCodeImagem.length}`)
conferir(primeira.status === 'pendente', 'cobrança nasce pendente')

console.log('2. Criar de novo com o mesmo pagamentoId (mesmo externalId)')
const segunda = await etapa('criar de novo', () => criarCobrancaPix({ pagamentoId, vendaId, valor: 100, expiraEm }))
console.log(`  cobrancaId=${segunda.cobrancaId} → ${segunda.cobrancaId === primeira.cobrancaId
  ? 'a MESMA cobrança (a AbacatePay é idempotente pelo externalId)'
  : 'uma cobrança NOVA (o externalId não impede duplicar)'}`)

console.log('3. Antes de pagar')
await compararConsultas('antes de pagar', 'pendente', primeira.cobrancaId)

console.log('4. Simular o pagamento')
await etapa('simular', () => simularPagamentoPix(primeira.cobrancaId))
await compararConsultas('depois de pagar', 'aprovado', primeira.cobrancaId)

console.log('5. Juntar saldo: cobrança de R$ 10,00, paga por simulação')
const saldo = await etapa('criar saldo', () => criarCobrancaPix({
  pagamentoId: pagamentoIdSaldo,
  vendaId: pagamentoIdSaldo,
  valor: 1000,
  expiraEm,
}))
await etapa('simular saldo', () => simularPagamentoPix(saldo.cobrancaId))
await compararConsultas('saldo depois de pagar', 'aprovado', saldo.cobrancaId)

console.log('6. Estornar a cobrança de R$ 1,00')
const estorno = await estornar(primeira.cobrancaId, 'Teste do gateway em Dev mode')
console.log(`  aprovado=${estorno.aprovado} jaEstornado=${estorno.jaEstornado} erro=${estorno.erro ?? '-'}`)
conferir(estorno.aprovado && !estorno.jaEstornado, 'estorno aprovado')
await compararConsultas('depois do estorno', 'estornado', primeira.cobrancaId)

console.log('7. Estornar de novo')
const repetido = await estornar(primeira.cobrancaId)
console.log(`  aprovado=${repetido.aprovado} jaEstornado=${repetido.jaEstornado} erro=${repetido.erro ?? '-'}`)
conferir(repetido.aprovado && repetido.jaEstornado, 'o segundo estorno conta como já estornado')

console.log('Fim: tudo conferido.')
