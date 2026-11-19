import { requisitarApi } from './api.js'
import { ErroApi } from './http.js'

export async function obterSaldo(produtoId) {
  const saldo = await requisitarApi(`/estoque/${encodeURIComponent(produtoId)}`)
  if (saldo?.produtoId !== produtoId || !Number.isSafeInteger(saldo.saldoAtual) || saldo.saldoAtual < 0) {
    throw new ErroApi('Resposta de estoque inválida.', {}, 502)
  }
  return saldo
}

export async function registrarEntrada(dados, chave) {
  const resultado = await requisitarApi('/estoque/movimentacoes', {
    metodo: 'POST', corpo: { ...dados, tipo: 'entrada' }, headers: { 'Idempotency-Key': chave },
  })
  if (resultado?.produtoId !== dados.produtoId || resultado.tipo !== 'entrada'
    || resultado.quantidade !== dados.quantidade || typeof resultado.operacaoId !== 'string'
    || !Number.isSafeInteger(resultado.saldoAnterior) || resultado.saldoAnterior < 0
    || !Number.isSafeInteger(resultado.saldoAtual) || resultado.saldoAtual !== resultado.saldoAnterior + dados.quantidade) {
    throw new ErroApi('Resposta de movimentação inválida. Confirme a mesma entrada novamente.', {}, 502)
  }
  return resultado
}
