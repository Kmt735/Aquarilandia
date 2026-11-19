import assert from 'node:assert/strict'
import { it } from 'node:test'
import { calcularTransportes, lerTabelaTransporte } from '../src/modulos/vendas/frete.transporte.ts'
import { hashDoPedido, validarPedido } from '../src/modulos/vendas/venda.validacao.ts'
import { montarAviso } from '../src/modulos/vendas/vendaNotificacoes.ts'
import { unidadesRetirada } from '../src/modulos/vendas/unidades.ts'
import { resolverEntrega } from '../src/modulos/vendas/frete.service.ts'
import { env } from '../src/config/env.ts'

// Tarifas/limites sintéticos; não são a tabela da loja e nunca são usados fora do teste.
export const nacionalFixture = { id:'servico-fixture',nome:'Serviço fictício',transportadora:'Transportadora fictícia',tipoEntrega:'correios',
  cepInicio:'01000000',cepFim:'99999999',rastreioCorreios:false,prazoTransporteDias:4,
  fatorCubagemCm3PorKg:6000,maxPesoG:30000,maxComprimentoCm:100,maxLarguraCm:100,maxAlturaCm:100,maxSomaDimensoesCm:200,
  faixasPeso:[{ateGramas:1000,valorCentavos:1500},{ateGramas:30000,valorCentavos:2500}] }
const tabela = lerTabelaTransporte(JSON.stringify({servicos:[nacionalFixture]}))
const destino = {cep:'01001000',municipioIbge:'3550308'}
const item = {produtoId:1,categoria:'acessorios',quantidade:1,logistica:{produtoId:1,pesoG:500,comprimentoCm:20,larguraCm:20,alturaCm:20,prazoPreparacaoDias:2,envioConvencional:true}}

it('peso cubado determina faixa; quantidade multiplica volumes e preparação integra prazo', () => {
  const [o] = calcularTransportes(destino,[{...item,quantidade:3}],tabela)
  assert.equal(o.frete,7500)
  assert.equal(o.prazoDias,6)
  assert.equal(o.servicoFrete.transportadora,nacionalFixture.transportadora)
  assert.equal(calcularTransportes(destino,[{...item,logistica:{...item.logistica,alturaCm:5}}],tabela)[0].frete,1500)
})
it('embalagem ausente/restrita, excesso de peso/dimensão/soma não gera opção fictícia', () => {
  for (const logistica of [undefined,{...item.logistica,envioConvencional:false},{...item.logistica,pesoG:40000},
    {...item.logistica,comprimentoCm:101},{...item.logistica,comprimentoCm:90,larguraCm:90,alturaCm:90}]) {
    assert.deepEqual(calcularTransportes(destino,[{...item,logistica}],tabela),[])
  }
})
it('CEP fora da cobertura não gera modalidade; peixe não entra em transporte convencional', () => {
  const t = lerTabelaTransporte(JSON.stringify({servicos:[{...nacionalFixture,cepFim:'09999999'}]}))
  assert.deepEqual(calcularTransportes({cep:'30100000',municipioIbge:'3106200'},[item],t),[])
  assert.throws(() => calcularTransportes(destino,[{...item,categoria:'peixes'}],tabela),e=>e.statusCode===422)
})
it('entrega própria só no município; cobra tarifa por pedido e exige preparação cadastrada', () => {
  const t = lerTabelaTransporte(JSON.stringify({servicos:[{id:'local',nome:'Local',transportadora:'Loja',tipoEntrega:'propria',valorCentavos:1000,prazoTransporteDias:1}]}))
  assert.deepEqual(calcularTransportes(destino,[item],t),[])
  const local={cep:'36307000',municipioIbge:'3162500'}
  assert.equal(calcularTransportes(local,[{...item,categoria:'peixes',quantidade:8}],t)[0].frete,1000)
  assert.equal(calcularTransportes(local,[item],t)[0].prazoDias,3)
  assert.deepEqual(calcularTransportes(local,[{...item,logistica:undefined}],t),[])
})
it('configuração inválida falha sem repetir conteúdo ou permitir tarifas negativas', () => {
  for (const s of [{...nacionalFixture,faixasPeso:[{ateGramas:30000,valorCentavos:-1}]},{...nacionalFixture,fatorCubagemCm3PorKg:0},
    {...nacionalFixture,prazoTransporteDias:1.5},{...nacionalFixture,cepInicio:'https://segredo.example'}]) {
    assert.throws(()=>lerTabelaTransporte(JSON.stringify({servicos:[s]})),e=>e.message.includes('FRETE_TRANSPORTE_JSON') && !e.message.includes('segredo.example'))
  }
  assert.throws(()=>lerTabelaTransporte(JSON.stringify({servicos:[nacionalFixture,nacionalFixture]})))
})
it('unidade é obrigatória, validada e participa da idempotência', () => {
  const pedido={itens:[{produtoId:1,quantidade:1}],retirada:true,totalEsperado:1000}
  for (const unidadeRetirada of [undefined,'outra','__proto__',null]) assert.throws(()=>validarPedido({...pedido,unidadeRetirada},'endereco'),e=>e.statusCode===422)
  const a=validarPedido({...pedido,unidadeRetirada:'centro'},'endereco'), b=validarPedido({...pedido,unidadeRetirada:'matosinhos'},'endereco')
  assert.notEqual(hashDoPedido(a),hashDoPedido(b))
  assert.notEqual(hashDoPedido(validarPedido({itens:pedido.itens,enderecoId:1,totalEsperado:1000,servicoFreteId:'a'},'endereco')),
    hashDoPedido(validarPedido({itens:pedido.itens,enderecoId:1,totalEsperado:1000,servicoFreteId:'b'},'endereco')))
})
it('aviso usa endereço da unidade escolhida, sem enviar cliente do Centro a Matosinhos', () => {
  const a=montarAviso('pronta_retirada',{vendaId:1,nome:'Fixture',codigoRastreio:null,pagamentoDevolvido:false,unidadeRetirada:unidadesRetirada.centro})
  assert.match(a.texto,/Aquarilândia Centro/)
  assert.match(a.texto,/Antônio Rocha, 27/)
  assert.doesNotMatch(a.texto,/Josué de Queiroz/)
})
it('produção sem contrato configurado não usa preços ilustrativos e mantém retirada', () => {
  const anterior=env.nodeEnv
  try {
    env.nodeEnv='production'
    assert.throws(()=>resolverEntrega({retirada:false,cep:destino.cep,municipioIbge:destino.municipioIbge,itens:[item],subtotal:1000}),e=>e.statusCode===503)
    assert.equal(resolverEntrega({retirada:true,itens:[item],subtotal:1000}).frete,0)
  } finally {env.nodeEnv=anterior}
})
it('pedido legado não recebe unidade presumida; envio identifica transportadora configurada', () => {
  const dados={vendaId:1,nome:'Fixture',codigoRastreio:'FIXTURE-12345',pagamentoDevolvido:false}
  const retirada=montarAviso('pronta_retirada',dados)
  assert.match(retirada.texto,/Confirme com o atendimento/)
  assert.doesNotMatch(retirada.texto,/Matosinhos|Centro/)
  assert.match(montarAviso('enviada',{...dados,servicoFrete:{id:'fixture',nome:'Fixture',transportadora:'Empresa fixture',rastreioCorreios:false}}).texto,/Empresa fixture/)
})
