import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'
import { instalarCepFixture } from '../fixtures/cep.mjs'

const url=process.env.TEST_DATABASE_URL
describe('Unidade de retirada e transporte por embalagem — PostgreSQL real e tarifas fictícias', {skip:!url && 'Defina TEST_DATABASE_URL descartável.'},()=>{
  const schema=`entrega_${randomUUID().replaceAll('-','')}`
  let c,pool,server,api,origem,admin,cliente,produto,peixe,endereco,estoque
  const nacional={id:'economico',nome:'Econômico fictício',transportadora:'Fixture',tipoEntrega:'correios',cepInicio:'01000000',cepFim:'99999999',
    prazoTransporteDias:4,rastreioCorreios:false,fatorCubagemCm3PorKg:6000,maxPesoG:30000,
    maxComprimentoCm:100,maxLarguraCm:100,maxAlturaCm:100,maxSomaDimensoesCm:200,
    faixasPeso:[{ateGramas:1000,valorCentavos:1500},{ateGramas:30000,valorCentavos:2500}]}
  const embalagem={pesoG:500,comprimentoCm:20,larguraCm:20,alturaCm:20,prazoPreparacaoDias:2,envioConvencional:true}
  before(async()=>{
    c=new pg.Client({connectionString:url});await c.connect();await c.query(`CREATE SCHEMA ${schema}`);await c.query(`SET search_path TO ${schema}`)
    for(const f of ['01_catalogo.sql','10_clientes.sql','20_vendas.sql','21_vendas_idempotencia.sql','22_pagamentos_estorno.sql','30_estoque.sql','31_estoque_vendas.sql','34_pagamentos_reconciliacao.sql','35_entrega_logistica.sql','35_entrega_logistica.sql']) {
      await c.query(await readFile(new URL(`../../db/init/${f}`,import.meta.url),'utf8'))
    }
    const appUrl=new URL(url);appUrl.searchParams.set('options',`-c search_path=${schema}`);process.env.DATABASE_URL=appUrl.toString()
    process.env.FRETE_TRANSPORTE_JSON=JSON.stringify({servicos:[nacional,{...nacional,id:'rapido',nome:'Rápido fictício',prazoTransporteDias:1,faixasPeso:[{ateGramas:30000,valorCentavos:4500}]},
      {id:'local',nome:'Entrega da loja',transportadora:'Loja fixture',tipoEntrega:'propria',valorCentavos:1000,prazoTransporteDias:1}]})
    const {app}=await import('../../src/app.ts');pool=(await import('../../src/config/db.ts')).db
    origem=(await import('../../src/config/env.ts')).env.corsOrigin
    estoque=(await import('../../src/modulos/estoque/estoque.service.ts')).estoqueService
    server=app.listen(0,'127.0.0.1');await once(server,'listening');api=`http://127.0.0.1:${server.address().port}/api`
    admin=await conta('admin');cliente=await conta()
    produto=await criarProduto('acessorios');peixe=await criarProduto('peixes')
    endereco=(await c.query(`INSERT INTO enderecos_cliente(cliente_id,apelido,cep,logradouro,numero,bairro,cidade,uf)
      VALUES($1,'Casa','01001000','Rua Teste','10','Centro','São Paulo','SP') RETURNING id`,[cliente.id])).rows[0].id
  })
  beforeEach(()=>instalarCepFixture(mock));afterEach(()=>mock.restoreAll())
  after(async()=>{try{if(server)await new Promise(r=>server.close(r));if(pool)await pool.end()}finally{if(c){await c.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await c.end()}}})
  async function conta(papel='cliente'){
    const id=(await c.query("INSERT INTO clientes(nome,email,senha_hash,telefone,papel) VALUES('Fixture',$1,'hash','32999990000',$2) RETURNING id",[`${randomUUID()}@fixture.example`,papel])).rows[0].id
    const token=randomUUID();await c.query("INSERT INTO sessoes(token_hash,cliente_id,expira_em) VALUES($1,$2,now()+interval '1 hour')",[hashToken(token),id]);return{id,token}
  }
  async function criarProduto(slug){
    const id=(await c.query('INSERT INTO produtos(nome,categoria_id,preco,ativo) SELECT $1,id,1000,true FROM categorias WHERE slug=$2 RETURNING id',[`Produto ${randomUUID()}`,slug])).rows[0].id
    await estoque.registrarMovimentacao(admin.id,{produtoId:id,tipo:'entrada',quantidade:20,motivo:'Fixture descartável'},randomUUID(),{});return id
  }
  async function pedir(metodo,caminho,body,quem=admin,orig=true,chave){
    const r=await fetch(api+caminho,{method:metodo,headers:{'Content-Type':'application/json',...(orig?{Origin:origem}:{}),...(quem?{Cookie:`sid=${quem.token}`} : {}),...(chave?{'Idempotency-Key':chave}: {})},body:body===undefined?undefined:JSON.stringify(body)})
    const texto=await r.text();return {status:r.status,corpo:texto?JSON.parse(texto):null,replay:r.headers.get('idempotent-replayed'),cache:r.headers.get('cache-control')}
  }
  const itens=(id=produto,q=1)=>[{produtoId:id,quantidade:q}]
  const criar=(body,chave=randomUUID())=>pedir('POST','/vendas',body,cliente,true,chave)
  it('logística exige administrador e Origin nas escritas, sem expor dados em cache',async()=>{
    assert.equal((await pedir('GET',`/produtos/${produto}/logistica`,undefined,null)).status,401)
    assert.equal((await pedir('GET',`/produtos/${produto}/logistica`,undefined,cliente)).status,403)
    assert.equal((await pedir('PUT',`/produtos/${produto}/logistica`,embalagem,admin,false)).status,403)
    const r=await pedir('GET',`/produtos/${produto}/logistica`);assert.deepEqual(r.corpo,{logistica:null});assert.equal(r.cache,'no-store')
    assert.equal((await pedir('GET','/produtos/2147483647/logistica')).status,404)
  })
  it('valida embalagem sem alterar produto/preço/estoque e mantém catálogo público',async()=>{
    for(const corpo of [{...embalagem,pesoG:-1},{...embalagem,alturaCm:1.5},{...embalagem,envioConvencional:'true'},{...embalagem,preco:1}])assert.equal((await pedir('PUT',`/produtos/${produto}/logistica`,corpo)).status,422)
    const antes=(await c.query('SELECT preco,estoque FROM produtos WHERE id=$1',[produto])).rows[0]
    assert.equal((await pedir('PUT',`/produtos/${produto}/logistica`,embalagem)).status,200)
    assert.deepEqual((await c.query('SELECT preco,estoque FROM produtos WHERE id=$1',[produto])).rows[0],antes)
    assert.equal((await pedir('GET',`/produtos/${produto}`,undefined,null)).status,200)
  })
  it('unidade obrigatória, snapshot, replay sem nova baixa; mudar unidade conflita',async()=>{
    const body={itens:itens(),retirada:true,totalEsperado:1000},chave=randomUUID()
    assert.equal((await criar(body)).status,422)
    const r=await criar({...body,unidadeRetirada:'centro'},chave);assert.equal(r.status,201)
    assert.equal(r.corpo.unidadeRetirada.id,'centro');assert.match(r.corpo.unidadeRetirada.endereco,/Antônio Rocha/)
    const saldo=(await c.query('SELECT estoque FROM produtos WHERE id=$1',[produto])).rows[0].estoque
    const repetida=await criar({...body,unidadeRetirada:'centro'},chave);assert.equal(repetida.replay,'true')
    assert.equal((await c.query('SELECT estoque FROM produtos WHERE id=$1',[produto])).rows[0].estoque,saldo)
    assert.equal((await criar({...body,unidadeRetirada:'matosinhos'},chave)).status,409)
    const detalhe=await pedir('GET',`/clientes/me/vendas/${r.corpo.id}`,undefined,cliente)
    assert.deepEqual(detalhe.corpo.unidadeRetirada,r.corpo.unidadeRetirada)
    await assert.rejects(c.query("UPDATE vendas SET unidade_retirada=$2 WHERE id=$1",[r.corpo.id,JSON.stringify({nome:'Fixture',endereco:'Fixture'})]),e=>e.code==='23514')
  })
  it('cotação considera cubagem, quantidades, transportadora e preparação, com escolha de serviço',async()=>{
    const r=await pedir('POST','/frete/calcular',{itens:itens(produto,2),cep:'01001000'},null)
    assert.equal(r.status,200,JSON.stringify(r.corpo));assert.equal(r.corpo.frete,5000);assert.equal(r.corpo.prazoDias,6)
    assert.deepEqual(r.corpo.opcoesFrete.map(o=>o.servicoFrete.id),['economico','rapido'])
    const rapida=await pedir('POST','/frete/calcular',{itens:itens(produto,2),cep:'01001000',servicoFreteId:'rapido'},null)
    assert.equal(rapida.corpo.frete,9000);assert.equal(rapida.corpo.prazoDias,3)
    assert.equal((await pedir('POST','/frete/calcular',{itens:itens(),cep:'01001000',servicoFreteId:'forjado'},null)).status,409)
  })
  it('recálculo final usa dados do banco e não aceita cotação velha ou frete forjado',async()=>{
    await pedir('PUT',`/produtos/${produto}/logistica`,{...embalagem,alturaCm:5})
    const body={itens:itens(produto,2),enderecoId:endereco,totalEsperado:7000,servicoFreteId:'economico',frete:0,pesoG:1}
    const saldo=(await c.query('SELECT estoque FROM produtos WHERE id=$1',[produto])).rows[0].estoque
    assert.equal((await criar(body)).status,409)
    assert.equal((await c.query('SELECT estoque FROM produtos WHERE id=$1',[produto])).rows[0].estoque,saldo)
    await pedir('PUT',`/produtos/${produto}/logistica`,embalagem)
    const r=await criar(body);assert.equal(r.status,201,JSON.stringify(r.corpo));assert.equal(r.corpo.frete,5000)
    assert.equal(r.corpo.servicoFrete.id,'economico');assert.equal(r.corpo.servicoFrete.transportadora,'Fixture')
  })
  it('não envia peixe, embalagem ausente, volume excedente nem produto restrito; retirada continua disponível',async()=>{
    assert.equal((await pedir('POST','/frete/calcular',{itens:itens(peixe),cep:'01001000'},null)).status,422)
    for(const e of [{...embalagem,envioConvencional:false},{...embalagem,comprimentoCm:200}]){
      await pedir('PUT',`/produtos/${produto}/logistica`,e)
      assert.equal((await pedir('POST','/frete/calcular',{itens:itens(),cep:'01001000'},null)).status,422)
    }
    const r=await criar({itens:itens(peixe),retirada:true,unidadeRetirada:'matosinhos',totalEsperado:1000})
    assert.equal(r.status,201);assert.equal(r.corpo.frete,0);assert.equal(r.corpo.unidadeRetirada.id,'matosinhos')
  })
})
