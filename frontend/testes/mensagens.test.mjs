import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calcularFrete } from '../src/services/frete.js'
import { dividirMensagem, MENSAGENS, regras } from '../src/utils/validacao.js'

test('item 9: CEP inválido vem primeiro, com a ajuda depois', async () => {
  assert.equal(regras.cep('123'), 'CEP inválido. Digite os 8 números, como 36300-000.')
  await assert.rejects(calcularFrete('123', []), (e) => e.erro === 'CEP inválido.' && dividirMensagem(e.detalhes.cep).erro === 'CEP inválido')
})

test('toda mensagem de validação segue "erro curto. como corrigir."', () => {
  for (const [campo, texto] of Object.entries(MENSAGENS)) {
    const { erro, ajuda } = dividirMensagem(texto)
    assert.ok(erro.length <= 30, `${campo}: erro curto demais? "${erro}"`)
    assert.ok(ajuda.length > 0, `${campo}: falta dizer como corrigir`)
  }
  assert.deepEqual(dividirMensagem('Mensagem da API sem ajuda'), { erro: 'Mensagem da API sem ajuda', ajuda: '' })
})
