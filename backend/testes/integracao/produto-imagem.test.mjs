import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { readFile, readdir, mkdtemp, rm, stat, writeFile, utimes, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, beforeEach, afterEach, describe, it, mock } from 'node:test'
import sharp from 'sharp'
import { request } from 'node:http'
import pg from 'pg'
import { hashToken } from '../../src/modulos/auth/sessao.ts'

const url=process.env.TEST_DATABASE_URL
const pausa=()=>new Promise(r=>setTimeout(r,10))
describe('Imagem principal — HTTP, PostgreSQL e filesystem reais', {skip:!url && 'Defina TEST_DATABASE_URL descartável.'},()=>{
 const schema=`imagem_${randomUUID().replaceAll('-','')}`
 let c,pool,server,api,pasta,origem,storage,service,limiter,png,env
 before(async()=>{
  pasta=await mkdtemp(join(tmpdir(),'aquarilandia-imagem-'));c=new pg.Client({connectionString:url});await c.connect()
  await c.query(`CREATE SCHEMA ${schema}`);await c.query(`SET search_path TO ${schema}`)
  const sql=new URL('../../db/init/',import.meta.url)
  for(const f of (await readdir(sql)).filter(f=>f.endsWith('.sql')).sort())await c.query(await readFile(new URL(f,sql),'utf8'))
  for(const [id,papel]of[[1,'admin'],[2,'cliente']]){
   await c.query('INSERT INTO clientes(id,nome,email,senha_hash,papel) VALUES($1,$2,$3,$4,$5)',[id,'Fixture',`${papel}@imagem.example`,'hash',papel])
   await c.query("INSERT INTO sessoes(token_hash,cliente_id,expira_em)VALUES($1,$2,now()+interval '1 hour')",[hashToken(papel),id])
  }
  const u=new URL(url);u.searchParams.set('options',`-c search_path=${schema}`);u.searchParams.set('application_name',schema)
  process.env.NODE_ENV='test';process.env.DATABASE_URL=u.toString();process.env.IMAGENS_DIR=pasta
  const {app}=await import('../../src/app.ts');pool=(await import('../../src/config/db.ts')).db
  env=(await import('../../src/config/env.ts')).env;origem=env.corsOrigin
  storage=(await import('../../src/modulos/catalogo/imagem/imagem.armazenamento.ts')).armazenamentoImagem
  service=(await import('../../src/modulos/catalogo/imagem/imagem.service.ts')).imagemService
  limiter=(await import('../../src/modulos/catalogo/imagem/imagem.controller.ts')).limiteUploadImagem
  server=app.listen(0,'127.0.0.1');await once(server,'listening');api=`http://127.0.0.1:${server.address().port}`
  png=await sharp({create:{width:16,height:12,channels:3,background:'#1288ab'}}).png().toBuffer()
 })
 beforeEach(()=>{mock.restoreAll();limiter.resetKey('127.0.0.1')})
 afterEach(async()=>{
  mock.restoreAll()
  assert.deepEqual((await c.query('SELECT p.id FROM produtos p LEFT JOIN movimentacoes_estoque m ON m.produto_id=p.id GROUP BY p.id HAVING p.estoque::bigint<>COALESCE(sum(m.delta),0)')).rows,[])
 })
 after(async()=>{try{if(server)await new Promise(r=>server.close(r));if(pool)await pool.end()}finally{if(c){await c.query(`DROP SCHEMA ${schema} CASCADE`);await c.end()}if(pasta)await rm(pasta,{recursive:true,force:true})}})
 const produto=async(ativo=true,peixe=false,legado=null)=>(await c.query('INSERT INTO produtos(categoria_id,nome,preco,ativo,imagem_url)SELECT id,$1,4999,$2,$3 FROM categorias WHERE slug=$4 RETURNING id',[`Fixture ${randomUUID()}`,ativo,legado,peixe?'peixes':'acessorios'])).rows[0].id
 const form=(buffer=png,mime='image/png',nome='foto.png')=>{const f=new FormData();if(buffer!==null)f.append('imagem',new Blob([buffer],{type:mime}),nome);return f}
 const upload=(id,body=form(),sessao='admin',origin=origem)=>fetch(`${api}/api/produtos/${id}/imagem`,{method:'PUT',headers:{...(sessao?{Cookie:`sid=${sessao}`} :{}),...(origin?{Origin:origin}:{})},body})
 const remover=(id)=>fetch(`${api}/api/produtos/${id}/imagem`,{method:'DELETE',headers:{Cookie:'sid=admin',Origin:origem}})
 const estado=async(id)=>(await c.query('SELECT id,categoria_id,nome,preco,estoque,ativo,descricao,marca FROM produtos WHERE id=$1',[id])).rows[0]
 const imagem=async(id)=>(await c.query('SELECT imagem_url AS url,imagem_arquivo_id AS id FROM produtos WHERE id=$1',[id])).rows[0]
 const arquivo=id=>join(pasta,`${id}.webp`)
 async function salvar(id){const r=await upload(id);assert.equal(r.status,200,await r.clone().text());return r.json()}
 async function esperarLocks(n){for(let i=0;i<300;i++){if((await c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock' AND query LIKE 'SELECT imagem_arquivo_id%'",[schema])).rows[0].n>=n)return;await pausa()}assert.fail('Locks de imagem não observados')}

 for(const [sessao,origin,status]of[[null,null,401],['cliente',origem,403],['admin','http://invalida.example',403],['admin',null,403]]){
  it(`guardas antes de processar arquivo: ${sessao}/${origin} → ${status}`,async()=>{
   const id=await produto();const r=await upload(id,form(Buffer.from('nem imagem')),sessao,origin);assert.equal(r.status,status)
   assert.equal((await imagem(id)).url,null)
   const d=await fetch(`${api}/api/produtos/${id}/imagem`,{method:'DELETE',headers:{...(sessao?{Cookie:`sid=${sessao}`} :{}),...(origin?{Origin:origin}:{})}});assert.equal(d.status,status)
  })
 }
 it('papel revogado com o mesmo cookie impede nova imagem',async()=>{
  const id=await produto();await c.query("UPDATE clientes SET papel='cliente' WHERE id=1")
  try{assert.equal((await upload(id)).status,403)}finally{await c.query("UPDATE clientes SET papel='admin' WHERE id=1")}
 })
 it('IDs inválidos e inexistente não criam arquivo',async()=>{
  for(const id of ['texto','0','-1','2147483648']){assert.equal((await upload(id)).status,400);assert.equal((await remover(id)).status,400)}
  assert.equal((await upload(2147483647)).status,404);assert.equal((await remover(2147483647)).status,404)
 })
 it('upload, substituição, cache, DTO público e remoção repetida preservam os demais dados',async()=>{
  const id=await produto(),antes=await estado(id),a=await salvar(id),primeira=await imagem(id)
  assert.equal(a.ativo,true);assert.equal(a.preco,4999);assert.equal(a.imagemUrl,primeira.url);assert.equal(a.imagem_arquivo_id,undefined)
  let r=await fetch(api+a.imagemUrl);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/webp/);assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.match(r.headers.get('cache-control'),/immutable/)
  const m=await sharp(Buffer.from(await r.arrayBuffer())).metadata();assert.equal(m.format,'webp');assert.equal(m.width,16)
  const b=await salvar(id);assert.notEqual(b.imagemUrl,a.imagemUrl);await assert.rejects(stat(arquivo(primeira.id)),e=>e.code==='ENOENT')
  r=await fetch(`${api}/api/produtos/${id}`);assert.equal((await r.json()).imagemUrl,b.imagemUrl)
  const lista=await(await fetch(`${api}/api/produtos?busca=${encodeURIComponent(antes.nome)}`)).json();assert.equal(lista.itens[0].imagemUrl,b.imagemUrl)
  r=await remover(id);assert.equal(r.status,200);assert.equal((await r.json()).imagemUrl,null)
  const data=(await c.query('SELECT atualizado_em FROM produtos WHERE id=$1',[id])).rows[0].atualizado_em;assert.equal((await remover(id)).status,200);assert.deepEqual((await c.query('SELECT atualizado_em FROM produtos WHERE id=$1',[id])).rows[0].atualizado_em,data);assert.deepEqual(await estado(id),antes);assert.equal((await fetch(api+b.imagemUrl)).status,404)
 })
 it('peixe usa a mesma imagem em produto, detalhe e lista de peixes, sem mudar ficha/saldo',async()=>{
  const id=await produto(true,true)
  await c.query("INSERT INTO peixes(produto_id,nome_cientifico,tipo_agua,tamanho_adulto_cm,temp_min_c,temp_max_c,ph_min,ph_max,aquario_min_litros,temperamento,dificuldade)VALUES($1,$2,'doce',5,24,28,6,7,40,'pacifico','iniciante')",[id,`Species ${id}`])
  const antes=await(await fetch(`${api}/api/produtos/${id}`)).json(),novo=await salvar(id)
  for(const path of [`/api/produtos/${id}`,`/api/peixes/${id}`]){const d=await(await fetch(api+path)).json();assert.equal(d.imagemUrl,novo.imagemUrl);assert.deepEqual(d.ficha,antes.ficha);assert.equal(d.emEstoque,false)}
  const p=await(await fetch(`${api}/api/peixes?busca=${encodeURIComponent(`Species ${id}`)}`)).json();assert.equal(p.itens[0].imagemUrl,novo.imagemUrl)
  await remover(id);assert.equal((await(await fetch(`${api}/api/peixes/${id}`)).json()).imagemUrl,null)
 })
 it('produto inativo é administrável, permanece inativo e fora de consultas/imagem públicas',async()=>{
  const id=await produto(false),antes=await estado(id),d=await salvar(id)
  assert.equal(d.ativo,false);assert.equal((await fetch(`${api}/api/produtos/${id}`)).status,404);assert.equal((await fetch(api+d.imagemUrl)).status,404)
  assert.equal((await remover(id)).status,200);assert.deepEqual(await estado(id),antes)
 })
 it('referências legadas não são apagadas como arquivos locais',async()=>{
  const id=await produto(true,false,'https://legado.example/foto.jpg'),antes=await estado(id)
  await salvar(id);assert.deepEqual(await estado(id),antes);await remover(id)
  const sem=await produto(true,false,'/assets/legado.webp');assert.equal((await remover(sem)).status,200);assert.equal((await imagem(sem)).url,null)
 })
 for(const caso of ['ausente','campo extra','arquivo extra','campo errado','MIME falso','extensão falsa','SVG','GIF','animado','corrompido','nome malicioso','bytes','dimensão','pixels']){
  it(`rejeita ${caso} sem trocar imagem anterior`,async()=>{
   const id=await produto(),a=await salvar(id);let f=form()
   if(caso==='ausente')f=form(null)
   if(caso==='campo extra')f.append('url','https://nao-buscar.example/a.png')
   if(caso==='arquivo extra')f.append('imagem',new Blob([png]),'outra.png')
   if(caso==='campo errado'){f=form(null);f.append('arquivo',new Blob([png]),'foto.png')}
   if(caso==='MIME falso')f=form(png,'image/jpeg')
   if(caso==='extensão falsa')f=form(png,'image/png','a.jpg')
   if(caso==='SVG')f=form(Buffer.from('<svg/>'),'image/svg+xml','a.svg')
   if(caso==='GIF')f=form(Buffer.from('GIF89a'),'image/gif','a.gif')
   if(caso==='animado'){const pixels=Buffer.from([255,0,0,255,0,0,255,0,0,255,0,0,0,0,255,0,0,255,0,0,255,0,0,255]);f=form(await sharp(pixels,{raw:{width:2,height:4,channels:3,pageHeight:2}}).webp({loop:0,delay:[100,100]}).toBuffer(),'image/webp','animado.webp')}
   if(caso==='corrompido')f=form(png.subarray(0,30))
   if(caso==='nome malicioso')f=form(png,'image/png','../../fora.png')
   if(caso==='bytes')f=form(Buffer.alloc(5*1024*1024+1))
   if(caso==='dimensão')f=form(await sharp({create:{width:4097,height:1,channels:3,background:'red'}}).png().toBuffer())
   if(caso==='pixels')f=form(await sharp({create:{width:4000,height:4000,channels:3,background:'red'}}).png().toBuffer())
   const r=await upload(id,f);assert.equal(r.status,caso==='bytes'?413:400,await r.clone().text());assert.equal((await imagem(id)).url,a.imagemUrl)
  })
 }
 it('JSON, multipart incompleto e compressão HTTP são recusados',async()=>{
  const id=await produto()
  for(const [headers,body,status]of[[{'Content-Type':'application/json'},'{}',415],[{'Content-Type':'multipart/form-data; boundary=abc'},'--abc\r\nINVALIDO',400],[{'Content-Type':'multipart/form-data; boundary=abc','Content-Encoding':'gzip'},'x',415]]){
   const r=await fetch(`${api}/api/produtos/${id}/imagem`,{method:'PUT',headers:{Cookie:'sid=admin',Origin:origem,...headers},body});assert.equal(r.status,status)
  }
  const r=await fetch(`${api}/api/produtos/${id}/imagem`,{method:'DELETE',headers:{Cookie:'sid=admin',Origin:origem,'Content-Type':'application/json'},body:'{"url":"/fora"}'});assert.equal(r.status,400)
 })
 it('falha de armazenamento mantém imagem anterior e responde sem caminho interno',async()=>{
  const id=await produto(),a=await salvar(id);mock.method(storage,'gravar',async()=>{throw new Error('/caminho/NAO_EXIBIR')})
  const r=await upload(id);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/caminho|NAO_EXIBIR/);assert.equal((await imagem(id)).url,a.imagemUrl)
 })
 it('falha do banco após gravar arquivo faz rollback e limpa o novo arquivo',async()=>{
  const id=await produto(),a=await salvar(id),arquivos=await readdir(pasta)
  await c.query("CREATE FUNCTION falhar_imagem() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'NAO_EXIBIR_CAMINHO'; END $$")
  await c.query(`CREATE TRIGGER falhar_imagem BEFORE UPDATE ON produtos FOR EACH ROW WHEN(OLD.id=${id}) EXECUTE FUNCTION falhar_imagem()`)
  const log=mock.method(console,'error',()=>{})
  try{const r=await upload(id);assert.equal(r.status,500);assert.equal((await imagem(id)).url,a.imagemUrl);assert.deepEqual(await readdir(pasta),arquivos);assert.doesNotMatch(JSON.stringify(log.mock.calls),/NAO_EXIBIR_CAMINHO/)}
  finally{await c.query('DROP TRIGGER falhar_imagem ON produtos');await c.query('DROP FUNCTION falhar_imagem()')}
 })
 it('falha na limpeza após COMMIT mantém a nova imagem e permite limpeza posterior segura',async()=>{
  const id=await produto();await salvar(id);const velha=await imagem(id)
  mock.method(storage,'remover',async()=>{throw new Error('NAO_EXIBIR_LIMPEZA')});const log=mock.method(console,'error',()=>{})
  const nova=await salvar(id);assert.notEqual(nova.imagemUrl,velha.url);assert.ok(await stat(arquivo(velha.id)));assert.doesNotMatch(JSON.stringify(log.mock.calls),/NAO_EXIBIR_LIMPEZA/)
  mock.restoreAll();const passado=new Date(Date.now()-25*3600000);await utimes(arquivo(velha.id),passado,passado)
  const limpo=await service.limparOrfaos();assert.ok(limpo.removidos>=1);await assert.rejects(stat(arquivo(velha.id)));assert.equal((await fetch(api+nova.imagemUrl)).status,200)
 })
 it('dois uploads concorrentes mantêm o vencedor e removem a versão substituída',async()=>{
  const id=await produto();await salvar(id);const gate=await pool.connect();let a,b
  try{await gate.query('BEGIN');await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE',[id]);a=upload(id);b=upload(id);await esperarLocks(2);await gate.query('COMMIT');assert.equal((await a).status,200);assert.equal((await b).status,200)}
  finally{await gate.query('ROLLBACK');gate.release();if(a&&b)await Promise.allSettled([a,b])}
  const final=await imagem(id);assert.equal((await fetch(api+final.url)).status,200);assert.ok(await stat(arquivo(final.id)))
 })
 for(const primeiro of ['upload','remocao'])it(`${primeiro} e operação oposta concorrentes não apagam o vencedor`,async()=>{
  const id=await produto();await salvar(id);const gate=await pool.connect();let a,b
  try{await gate.query('BEGIN');await gate.query('SELECT id FROM produtos WHERE id=$1 FOR NO KEY UPDATE',[id]);a=primeiro==='upload'?upload(id):remover(id);await esperarLocks(1);b=primeiro==='upload'?remover(id):upload(id);await esperarLocks(2);await gate.query('COMMIT');assert.equal((await a).status,200);assert.equal((await b).status,200)}
  finally{await gate.query('ROLLBACK');gate.release();if(a&&b)await Promise.allSettled([a,b])}
  const final=await imagem(id);if(primeiro==='upload')assert.equal(final.url,null);else assert.equal((await fetch(api+final.url)).status,200)
 })
 it('limpeza não apaga arquivo em processamento, mesmo antigo e ainda sem referência commitada',async()=>{
  const id=await produto();let pronto,liberar;const iniciado=new Promise(r=>pronto=r),fim=new Promise(r=>liberar=r),gravar=storage.gravar.bind(storage)
  mock.method(storage,'gravar',async(chave,b)=>{await gravar(chave,b);const velho=new Date(Date.now()-25*3600000);await utimes(arquivo(chave),velho,velho);pronto();await fim})
  const pedido=upload(id);await iniciado
  try{const r=await service.limparOrfaos();assert.ok(r.preservados>=1)}finally{liberar()}
  assert.equal((await pedido).status,200);assert.equal((await fetch(api+(await imagem(id)).url)).status,200)
 })
 it('limpeza após interrupção remove temporário órfão antigo, preserva recente, desconhecido e symlink',async()=>{
  const antigo=randomUUID(),recente=randomUUID(),fora=join(pasta,'segredo-fixture.txt'),link=randomUUID(),passado=new Date(Date.now()-25*3600000)
  await writeFile(join(pasta,'temporarios',`${antigo}.part`),'fixture');await utimes(join(pasta,'temporarios',`${antigo}.part`),passado,passado)
  await writeFile(arquivo(recente),'recente');await writeFile(fora,'SEGREDO_FICTICIO');await symlink(fora,arquivo(link))
  await service.limparOrfaos();await assert.rejects(stat(join(pasta,'temporarios',`${antigo}.part`)));assert.ok(await stat(arquivo(recente)));assert.equal(await readFile(fora,'utf8'),'SEGREDO_FICTICIO')
  const id=await produto();await c.query('UPDATE produtos SET imagem_arquivo_id=$2,imagem_url=$3 WHERE id=$1',[id,link,`/api/midias/produtos/${link}.webp`])
  const r=await fetch(`${api}/api/midias/produtos/${link}.webp`);assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/SEGREDO_FICTICIO/)
 })
 it('URL não admite traversal nem listagem; somente versão referenciada e ativa',async()=>{
  for(const caminho of ['/api/midias/produtos/%2e%2e%2fpackage.json','/api/midias/produtos/segredo','/api/midias/produtos/.env',`/api/midias/produtos/${randomUUID()}.webp`])assert.equal((await fetch(api+caminho)).status,404)
 })
 it('resposta perdida de COMMIT não faz a limpeza apagar uma imagem já confirmada',async()=>{
  const id=await produto();await salvar(id);const connect=pool.connect.bind(pool);let falhar=true
  mock.method(pool,'connect',async(...args)=>{
   if(args.length)return connect(...args)
   const tx=await connect(),query=tx.query.bind(tx),release=tx.release.bind(tx)
   tx.query=(...args)=>{
    if(args[0]==='COMMIT' && falhar){falhar=false;return query(...args).then(()=>{throw new Error('RESPOSTA_COMMIT_PERDIDA')})}
    return query(...args)
   }
   tx.release=(...args)=>{tx.query=query;tx.release=release;release(...args)}
   return tx
  })
  const log=mock.method(console,'error',()=>{});const r=await upload(id);assert.equal(r.status,500)
  const atual=await imagem(id);assert.equal((await fetch(api+atual.url)).status,200);assert.ok(await stat(arquivo(atual.id)));assert.doesNotMatch(JSON.stringify(log.mock.calls),/RESPOSTA_COMMIT_PERDIDA/)
 })
 it('limite de bytes é inclusivo no multipart e rejeita o byte excedente',async()=>{
  const id=await produto();const jpeg=await sharp({create:{width:1,height:1,channels:3,background:'red'}}).jpeg().toBuffer()
  assert.equal((await upload(id,form(Buffer.concat([jpeg,Buffer.alloc(5*1024*1024-jpeg.length)]),'image/jpeg','exato.jpg'))).status,200)
 })
 it('semaforo limita a dois uploads em processamento e libera após terminar',async()=>{
  const a=await produto(),b=await produto(),d=await produto();let prontos=0,pronto,liberar;const inicio=new Promise(r=>pronto=r),fim=new Promise(r=>liberar=r),gravar=storage.gravar.bind(storage)
  mock.method(storage,'gravar',async(...args)=>{await gravar(...args);if(++prontos===2)pronto();await fim})
  const p=upload(a),q=upload(b);await inicio
  try{assert.equal((await upload(d)).status,503)}finally{liberar()}
  assert.equal((await p).status,200);assert.equal((await q).status,200);mock.restoreAll();assert.equal((await upload(d)).status,200)
 })
 it('recebimento lento tem prazo e requisição declarada excessiva é recusada antes do arquivo',async()=>{
  const id=await produto(),{limitesImagem}=await import('../../src/modulos/catalogo/imagem/imagem.limites.ts'),antes=limitesImagem.recebimentoMs
  limitesImagem.recebimentoMs=40
  async function lento(extra={}){return new Promise((resolve,reject)=>{
   const req=request(`${api}/api/produtos/${id}/imagem`,{method:'PUT',headers:{Cookie:'sid=admin',Origin:origem,'Content-Type':'multipart/form-data; boundary=lento',...extra}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))})
   req.on('error',reject);req.flushHeaders()
  })}
  try{assert.equal(await lento(),408);assert.equal(await lento({'Content-Length':String(6*1024*1024)}),413)}finally{limitesImagem.recebimentoMs=antes}
 })
 it('sem diretório configurado responde503 sem processar bytes ou mudar referência',async()=>{
  const id=await produto(),antes=env.imagensDir;env.imagensDir=undefined
  try{assert.equal((await upload(id,form(Buffer.from('invalido')))).status,503);assert.equal((await imagem(id)).url,null)}finally{env.imagensDir=antes}
 })
 it('queries de URL ou campos protegidos não são aceitos pela administração de imagem',async()=>{
  const id=await produto()
  for(const method of ['PUT','DELETE']){const r=await fetch(`${api}/api/produtos/${id}/imagem?url=https://nao-buscar.example/a.png`,{method,headers:{Cookie:'sid=admin',Origin:origem},...(method==='PUT'?{body:form()}:{})});assert.equal(r.status,400)}
 })
 it('migração repetida preserva legado e referências existentes',async()=>{
  const id=await produto(true,false,'https://externa.example/antiga.png');const antes=await c.query('SELECT * FROM produtos ORDER BY id')
  const sql=await readFile(new URL('../../db/init/32_produto_imagem.sql',import.meta.url),'utf8');await c.query(sql);await c.query(sql)
  assert.deepEqual((await c.query('SELECT * FROM produtos ORDER BY id')).rows,antes.rows);assert.equal((await imagem(id)).url,'https://externa.example/antiga.png')
 })
})
