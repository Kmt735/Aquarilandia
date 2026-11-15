import assert from 'node:assert/strict'
import { once } from 'node:events'
import { before, after, afterEach, describe, it, mock } from 'node:test'
import { app } from '../src/app.ts'
import { env } from '../src/config/env.ts'
import { db } from '../src/config/db.ts'
import { sessaoRepository } from '../src/modulos/auth/sessao.repository.ts'
import { imagemRepository } from '../src/modulos/catalogo/imagem/imagem.repository.ts'

describe('Imagem principal — guardas HTTP antes de receber/processar multipart',()=>{
 let server,url
 before(async()=>{server=app.listen(0,'127.0.0.1');await once(server,'listening');url=`http://127.0.0.1:${server.address().port}`})
 afterEach(()=>mock.restoreAll())
 after(async()=>{await new Promise(r=>server.close(r));await db.end()})
 for(const [sessao,papel,origin,status] of [[false,null,undefined,401],[true,null,env.corsOrigin,401],[true,'cliente',env.corsOrigin,403],[true,'admin','http://invalida.example',403],[true,'admin',undefined,403]]){
  it(`sessão=${sessao} papel=${papel} Origin=${origin} → ${status}`,async()=>{
   mock.method(sessaoRepository,'buscarUsuarioPorTokenHash',async()=>papel?{id:1,papel}:null)
   const consulta=mock.method(imagemRepository,'existe',async()=>{throw new Error('Não consultar produto antes de autorizar')})
   for(const method of ['PUT','DELETE']){
    const r=await fetch(url+'/api/produtos/1/imagem',{method,headers:{...(sessao?{Cookie:'sid=fixture'}:{}),...(origin?{Origin:origin}:{}),'Content-Type':'multipart/form-data; boundary=invalido'},body:'isto não é multipart'})
    assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'no-store');assert.doesNotMatch(await r.text(),/SQL|stack|fixture|isto não é/)
   }
   assert.equal(consulta.mock.callCount(),0)
  })
 }
 it('URL inválida não lista diretório nem tenta consultar arquivos',async()=>{
  const q=mock.method(imagemRepository,'publica',async()=>{throw new Error('Não consultar ID inválido')})
  const r=await fetch(url+'/api/midias/produtos/%2e%2e%2f.env');assert.equal(r.status,404);assert.equal(q.mock.callCount(),0)
 })
})
