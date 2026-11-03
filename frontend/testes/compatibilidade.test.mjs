import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  analisarMontagem, filtroAtende, LITROS_POR_CM_DE_PEIXE, medidasAquario, precisaAquecedor, sugerirSubstrato, termostatoAtende,
} from '../src/lib/compatibilidade.js'
import { analisarCompatibilidade } from '../src/utils/compatibilidade.js'

const peixe = (id, extra = {}) => ({
  id, nome: `Peixe ${id}`, qtd: 1, tipoAgua: 'doce', tempMinC: 24, tempMaxC: 28, aquarioMinLitros: 20,
  temperamento: 'pacifico', tamanhoAdultoCm: 3, cardumeMinimo: 1, incompativelCom: [], ...extra,
})
const aquario = (litros = 60, tipoAgua = 'ambos') => ({ nome: 'Aquário', litros, tipoAgua })
const filtroOk = { id: 90, nome: 'Filtro', aquarioMaxLitros: 100 }
const termOk = { id: 91, nome: 'Termostato', aquarioMinLitros: 30, aquarioMaxLitros: 100 }
const ids = (avisos) => avisos.map((a) => a.id)
const base = (extra) => analisarMontagem({ aquario: aquario(), filtros: [filtroOk], termostatos: [termOk], ...extra })

test('montagem coerente não gera avisos', () => {
  assert.deepEqual(base({ peixes: [peixe(1), peixe(2)] }), [])
})

test('peixe com aquário mínimo maior que o escolhido é incompatível', () => {
  const [a] = base({ peixes: [peixe(1, { aquarioMinLitros: 150 })] })
  assert.equal(a.id, 'minimo-1'); assert.equal(a.nivel, 'incompativel'); assert.deepEqual(a.itens, [1])
  assert.match(a.motivo, /150 L/); assert.ok(a.solucao)
})

test('lotação: atenção acima do limite e incompatível acima do fator crítico', () => {
  const cm = 60 / LITROS_POR_CM_DE_PEIXE // exatamente no limite
  assert.deepEqual(ids(base({ peixes: [peixe(1, { qtd: cm / 3 })] })), [])
  assert.equal(base({ peixes: [peixe(1, { qtd: cm / 3 + 1 })] }).find((a) => a.id === 'lotacao').nivel, 'atencao')
  assert.equal(base({ peixes: [peixe(1, { qtd: cm })] }).find((a) => a.id === 'lotacao').nivel, 'incompativel')
})

test('temperamento: agressivo × pacífico é incompatível; semiagressivo × pacífico é atenção', () => {
  assert.equal(base({ peixes: [peixe(1, { temperamento: 'agressivo' }), peixe(2)] })[0].nivel, 'incompativel')
  assert.equal(base({ peixes: [peixe(1, { temperamento: 'semi_agressivo' }), peixe(2)] })[0].nivel, 'atencao')
  assert.deepEqual(base({ peixes: [peixe(1, { temperamento: 'agressivo' }), peixe(2, { temperamento: 'agressivo' })] }), [])
})

test('espécies marcadas como incompatíveis geram um único aviso do par', () => {
  const avisos = base({ peixes: [peixe(1, { temperamento: 'semi_agressivo', incompativelCom: [2] }), peixe(2)] })
  assert.deepEqual(ids(avisos), ['par-1-2'])
  assert.equal(avisos[0].nivel, 'incompativel')
})

test('tipo de água: aquário × peixe, doce × salgada, salobra, plantas e decoração', () => {
  const marinho = peixe(2, { tipoAgua: 'marinho' })
  assert.ok(ids(base({ peixes: [peixe(1), marinho] })).includes('agua-peixes'))
  const tanqueDoce = analisarMontagem({ aquario: aquario(60, 'doce'), filtros: [filtroOk], termostatos: [termOk], peixes: [marinho] })
  assert.deepEqual(ids(tanqueDoce), ['agua-aquario'])
  assert.equal(base({ peixes: [peixe(1), peixe(3, { tipoAgua: 'salobra' })] }).find((a) => a.id === 'agua-salobra').nivel, 'atencao')
  const marinhoComPlanta = analisarMontagem({ aquario: aquario(60, 'marinho'), plantas: [{ id: 5, nome: 'Planta', tempMinC: 20, tempMaxC: 28 }], decoracoes: [{ id: 6, nome: 'Tronco', seguroMarinho: false }] })
  assert.deepEqual(ids(marinhoComPlanta).sort(), ['agua-decoracao', 'agua-plantas'])
})

test('temperaturas que não se sobrepõem são incompatíveis', () => {
  const avisos = base({ peixes: [peixe(1, { tempMinC: 18, tempMaxC: 22 }), peixe(2, { tempMinC: 26, tempMaxC: 30 })] })
  assert.ok(avisos.some((a) => a.id === 'temperatura-1-2' && a.nivel === 'incompativel'))
  // faixas que se tocam (22 = 22) convivem
  assert.ok(!ids(base({ peixes: [peixe(1, { tempMinC: 18, tempMaxC: 22 }), peixe(2, { tempMinC: 22, tempMaxC: 30 })] })).includes('temperatura-1-2'))
})

test('filtro e aquecedor: falta, pequeno ou fora da faixa', () => {
  const semNada = analisarMontagem({ aquario: aquario(), peixes: [peixe(1)] })
  assert.deepEqual(ids(semNada).sort(), ['sem-aquecedor', 'sem-filtro'])
  // peixe de água fria não pede aquecedor
  assert.deepEqual(ids(analisarMontagem({ aquario: aquario(), filtros: [filtroOk], peixes: [peixe(1, { tempMinC: 18, tempMaxC: 22 })] })), [])
  const pequenos = analisarMontagem({ aquario: aquario(200), filtros: [filtroOk], termostatos: [termOk] })
  assert.deepEqual(ids(pequenos), ['filtro-90', 'termostato-91'])
  assert.equal(pequenos[0].nivel, 'incompativel')
  // basta um filtro adequado entre os escolhidos
  assert.deepEqual(ids(analisarMontagem({ aquario: aquario(200), filtros: [filtroOk, { id: 92, nome: 'Grande', aquarioMaxLitros: 300 }] })), [])
})

test('cardume menor que o mínimo pede atenção', () => {
  assert.equal(base({ peixes: [peixe(1, { cardumeMinimo: 6, qtd: 2 })] })[0].id, 'cardume-1')
})

test('incompatíveis vêm antes dos avisos de atenção', () => {
  const avisos = analisarMontagem({ aquario: aquario(), peixes: [peixe(1, { aquarioMinLitros: 500 })] })
  assert.equal(avisos[0].nivel, 'incompativel')
  assert.ok(avisos.slice(1).every((a) => a.nivel === 'atencao'))
})

test('auxiliares: limites, aquecedor, medidas estimadas e substrato', () => {
  assert.equal(filtroAtende({ aquarioMaxLitros: 60 }, 60), true)
  assert.equal(filtroAtende({ aquarioMaxLitros: 60 }, 61), false)
  assert.equal(filtroAtende({ aquarioMaxLitros: null }, 61), null)
  assert.equal(termostatoAtende({ aquarioMinLitros: 30, aquarioMaxLitros: 60 }, 20), false)
  assert.equal(precisaAquecedor({ tempMinC: 22 }), true)
  assert.equal(precisaAquecedor({ tempMinC: 21.5 }), false)
  const m = medidasAquario({ litros: 54 }) // 2x · x · x = 54000 → x = 30
  assert.deepEqual(m, { comprimentoCm: 60, larguraCm: 30, alturaCm: 30, estimadas: true })
  assert.deepEqual(sugerirSubstrato({ comprimentoCm: 60, larguraCm: 30 }, 5), { kg: 14, pacotes: 3, areaDm2: 18 })
})

test('carrinho continua usando a mesma regra do filtro', () => {
  const filtro = { nome: 'Filtro X', capacidadeMaxLitros: 100 }
  assert.equal(analisarCompatibilidade([{ item: filtro }, { item: { nome: 'Aquário 100', volumeLitros: 100 } }]).tipo, 'sucesso')
  assert.equal(analisarCompatibilidade([{ item: filtro }, { item: { nome: 'Aquário 150', volumeLitros: 150 } }]).tipo, 'aviso')
  assert.equal(analisarCompatibilidade([{ item: filtro }]).tipo, 'info')
  assert.equal(analisarCompatibilidade([{ item: { nome: 'Ração' } }]), null)
})
