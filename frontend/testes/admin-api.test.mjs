import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { requisitarApi } from '../src/services/api.js'
import { entrar, sessaoAtual, sair } from '../src/services/conta.js'
import { listarPedidosAdmin } from '../src/services/admin-pedidos.js'
import { obterSaldo, registrarEntrada } from '../src/services/estoque.js'
const original=globalThis.fetch, janela=globalThis.window
afterEach(()=>{globalThis.fetch=original;if(janela===undefined)delete globalThis.window;else globalThis.window=janela})
const responder=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})
test('login e restauração consultam API com cookie, sem transformar papel local em autorização',async()=>{
  const chamadas=[];globalThis.fetch=async(url,opts)=>{chamadas.push([url,opts]);return responder({id:8,nome:'Pessoa fictícia',papel:'admin'})}
  const conta=await entrar({email:'demo@fixture.invalid',senha:'valor-ficticio'});assert.equal(conta.id,8)
  assert.equal((await sessaoAtual()).papel,'admin')
  assert.deepEqual(chamadas.map(([u])=>u),['/api/auth/login','/api/auth/sessao'])
  assert.equal(chamadas[0][1].credentials,'include');assert.equal(chamadas[1][1].cache,'no-store')
  assert.deepEqual(Object.keys(JSON.parse(chamadas[0][1].body)).sort(),['email','senha'])
})
test('sessão ausente é null, falha de rede não é confundida com logout',async()=>{
  globalThis.fetch=async()=>responder({erro:'Faça login'},401);assert.equal(await sessaoAtual(),null)
  globalThis.fetch=async()=>{throw new TypeError('offline')};await assert.rejects(sessaoAtual(),e=>e.status===0)
})
test('papel inesperado ou sessão de exemplo não é aceito como usuário da API',async()=>{
  for(const body of [{id:'admin-exemplo',nome:'Exemplo',papel:'admin'},{id:1,nome:'Pessoa',papel:'superuser'}]){
    globalThis.fetch=async()=>responder(body);await assert.rejects(sessaoAtual(),e=>e.status===502)
  }
})
test('401 de recurso privado informa expiração; 403 exige revalidação; login incorreto não derruba sessão existente',async()=>{
  const eventos=[];globalThis.window={dispatchEvent:e=>eventos.push(e.type)}
  globalThis.fetch=async()=>responder({},401);await assert.rejects(requisitarApi('/vendas'),e=>e.status===401)
  await assert.rejects(entrar({email:'x',senha:'x'}),e=>e.status===401)
  globalThis.fetch=async()=>responder({},403);await assert.rejects(requisitarApi('/vendas'),e=>e.status===403)
  assert.deepEqual(eventos,['aquarilandia:sessao-expirada','aquarilandia:revalidar-sessao'])
})
test('logout usa POST e tolera sessão já expirada',async()=>{
  let opcoes
  globalThis.fetch=async(_url,o)=>{opcoes=o;return responder(null,204)};await sair();assert.equal(opcoes.method,'POST')
  globalThis.fetch=async()=>responder({},401);await sair()
})
test('erros internos e HTML inesperado não vazam detalhes técnicos',async()=>{
  globalThis.fetch=async()=>responder({erro:'SQL e dado interno',detalhes:{sql:'segredo'}},500)
  await assert.rejects(requisitarApi('/vendas'),e=>!e.message.includes('SQL')&&Object.keys(e.detalhes).length===0)
  globalThis.fetch=async()=>new Response('<html>proxy</html>',{status:200});await assert.rejects(requisitarApi('/vendas'),e=>e.status===502)
})
test('pedidos usa paginação e filtro suportados no servidor, sem baixar todas as páginas e sem mock',async()=>{
  let consulta
  globalThis.fetch=async(url)=>{consulta=url;return responder({dados:[{id:3,status:'paga',tipoEntrega:'retirada',total:12345,clienteNome:'Pessoa fictícia',quantidadeItens:2,criadoEm:'2026-11-19T12:00:00Z'}],total:41,pagina:2,limite:20})}
  const p=await listarPedidosAdmin({status:'paga',pagina:2})
  assert.equal(consulta,'/api/vendas?pagina=2&limite=20&status=paga');assert.equal(p.total,41);assert.equal(p.totalPaginas,3);assert.equal(p.itens[0].total,12345)
})
test('lista vazia é distinta de envelope inesperado ou preço inválido',async()=>{
  globalThis.fetch=async()=>responder({dados:[],total:0,pagina:1,limite:20});assert.deepEqual((await listarPedidosAdmin()).itens,[])
  for(const body of [{itens:[],total:0},{dados:[],total:0.5,pagina:1,limite:20},{dados:[{id:1}],total:1,pagina:1,limite:20}]){
    globalThis.fetch=async()=>responder(body);await assert.rejects(listarPedidosAdmin(),e=>e.status===502)
  }
})
test('entrada usa endpoint e chave da intenção, não PATCH nem saldo absoluto',async()=>{
  let consulta,opcoes
  globalThis.fetch=async(url,o)=>{consulta=url;opcoes=o;return responder({produtoId:7,tipo:'entrada',quantidade:5,operacaoId:'operacao-ficticia',saldoAnterior:0,saldoAtual:5})}
  await registrarEntrada({produtoId:7,quantidade:5,motivo:'Conferência fictícia'},'00000000-0000-4000-8000-000000000001')
  assert.equal(consulta,'/api/estoque/movimentacoes');assert.equal(opcoes.method,'POST')
  assert.equal(opcoes.headers['Idempotency-Key'],'00000000-0000-4000-8000-000000000001')
  assert.deepEqual(JSON.parse(opcoes.body),{produtoId:7,tipo:'entrada',quantidade:5,motivo:'Conferência fictícia'})
})
test('saldo administrativo é lido por produto e precisa ser inteiro válido',async()=>{
  globalThis.fetch=async(url)=>{assert.equal(url,'/api/estoque/7');return responder({produtoId:7,saldoAtual:5})};assert.equal((await obterSaldo(7)).saldoAtual,5)
  globalThis.fetch=async()=>responder({produtoId:8,saldoAtual:5});await assert.rejects(obterSaldo(7),e=>e.status===502)
})
