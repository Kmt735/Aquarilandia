// Ambiente local exclusivo: banco fictício, credenciais geradas fora do Git, sem fluxo financeiro.
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile, lstat } from 'node:fs/promises'
import { tmpdir, userInfo } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'

const executar = promisify(execFile)
const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const raiz = resolve(backend, '..'), uid = userInfo().uid
const pasta = join(tmpdir(), `aquarilandia-demo-admin-${uid}`)
const container = `aquarilandia-demo-admin-${uid}`, marcador = 'catalogo-admin-v1'
const configArquivo = join(pasta, 'config.json'), acessoArquivo = join(pasta, 'acesso-admin.json')
const { Client } = createRequire(join(backend, 'package.json'))('pg')
class DemoError extends Error {}
const falhar = texto => { throw new DemoError(texto) }
const docker = async (...args) => (await executar('docker', args)).stdout.trim()
async function lerJson(arquivo) { try { return JSON.parse(await readFile(arquivo, 'utf8')) } catch (e) { if (e.code === 'ENOENT') return null; throw e } }
async function gravar(arquivo, dados) { await writeFile(arquivo, JSON.stringify(dados,null,2)+'\n', {mode:0o600}) }
async function conferirContainer() {
  const info = JSON.parse(await docker('inspect',container))[0]
  if (info.Config.Labels?.['aquarilandia.demo'] !== marcador) falhar('Já existe um container com esse nome que não pertence a esta demo. Nada foi alterado.')
  return info
}
function ambiente(config) {
  return { ...process.env, NODE_ENV:'test', DATABASE_URL:config.databaseUrl,
    EMAIL_API_KEY:'', EMAIL_REMETENTE:'', GATEWAY_ACCESS_TOKEN:'', GATEWAY_WEBHOOK_SECRET:'',
    PERMITIR_SIMULACAO_PIX:'false', VITE_CATALOGO_MOCK:'false', IMAGENS_DIR:'', FRONTEND_DIST:'' }
}
async function configurarPasta() {
  await mkdir(pasta,{recursive:true,mode:0o700})
  const info=await lstat(pasta)
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== uid || (info.mode & 0o077)) falhar('A pasta privada da demo tem proprietário ou permissões incompatíveis.')
}
async function lerConfig() {
  const c=await lerJson(configArquivo)
  if (!c || c.marcador!==marcador || c.container!==container) falhar('Prepare primeiro: node backend/scripts/demo-local.mjs preparar')
  const url=new URL(c.databaseUrl)
  if(url.hostname!=='127.0.0.1'||url.pathname!=='/aquarilandia_demo'||url.username!=='demo') falhar('Configuração não pertence ao banco local exclusivo da demo.')
  return c
}
async function ativarBanco(config) {
  await conferirContainer();await docker('start',container)
  const info=await conferirContainer(), bind=info.NetworkSettings.Ports['5432/tcp']?.[0]
  if(bind?.HostIp!=='127.0.0.1') falhar('A porta do banco precisa estar restrita ao loopback.')
  // A porta é a do container identificado, nunca uma DATABASE_URL herdada ou apontada a outro banco.
  const url=new URL(config.databaseUrl);url.port=bind.HostPort;config.databaseUrl=url.toString()
  await gravar(configArquivo,config)
  return config
}
async function preparar() {
  await configurarPasta()
  const contexto=JSON.parse(await docker('context','inspect'))[0]
  if(process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith('unix:')) falhar('Esta demo aceita apenas Docker local.')
  if(!contexto.Endpoints?.docker?.Host?.startsWith('unix:')) falhar('Selecione um contexto Docker local para esta demo.')
  let config=await lerJson(configArquivo)
  if(!config) {
    let existente=false
    try { await docker('inspect',container);existente=true } catch { /* ausência esperada */ }
    if(existente) falhar('Existe container sem configuração privada da demo. Não será adotado ou apagado automaticamente.')
    const senhaDb=randomBytes(24).toString('hex')
    await executar('docker',['run','--name',container,'--label',`aquarilandia.demo=${marcador}`,
      '--env','POSTGRES_PASSWORD','--env','POSTGRES_USER=demo','--env','POSTGRES_DB=aquarilandia_demo',
      '-p','127.0.0.1::5432','-d','postgres:17-alpine'],{env:{...process.env,POSTGRES_PASSWORD:senhaDb}})
    const info=await conferirContainer(), bind=info.NetworkSettings.Ports['5432/tcp']?.[0]
    if(bind?.HostIp!=='127.0.0.1') falhar('A porta do banco não está restrita ao loopback.')
    config={marcador,container,databaseUrl:`postgres://demo:${senhaDb}@127.0.0.1:${bind.HostPort}/aquarilandia_demo`}
    await gravar(configArquivo,config)
  } else {
    config=await ativarBanco(await lerConfig())
  }
  let pronto=false
  for(let i=0;i<30;i++){try{await docker('exec',container,'pg_isready','-U','demo','-d','aquarilandia_demo');pronto=true;break}catch{await new Promise(r=>setTimeout(r,500))}}
  if(!pronto) falhar('O PostgreSQL exclusivo não ficou pronto.')
  const client=new Client({connectionString:config.databaseUrl})
  await client.connect()
  try {
    const temMarca=(await client.query("SELECT to_regclass('public.aquarilandia_demo_meta') IS NOT NULL AS sim")).rows[0].sim
    if(!temMarca){
      const n=(await client.query("SELECT count(*)::int n FROM pg_tables WHERE schemaname='public'")).rows[0].n
      if(n) falhar('Banco não vazio sem identificação de demo. Nada será reinicializado.')
      await client.query('BEGIN')
      try {
        for(const sql of ['01_catalogo.sql','10_clientes.sql','15_orcamentos.sql','20_vendas.sql','21_vendas_idempotencia.sql','22_pagamentos_estorno.sql','30_estoque.sql','31_estoque_vendas.sql','32_produto_imagem.sql','33_estoque_consultas.sql'])
          await client.query(await readFile(join(backend,'db/init',sql),'utf8'))
        await client.query('CREATE TABLE aquarilandia_demo_meta (finalidade TEXT PRIMARY KEY)')
        await client.query('INSERT INTO aquarilandia_demo_meta VALUES ($1)',[marcador])
        await client.query('COMMIT')
      } catch(e) { await client.query('ROLLBACK');throw e }
    } else if((await client.query('SELECT finalidade FROM aquarilandia_demo_meta')).rows[0]?.finalidade!==marcador) falhar('Identificação do banco de demonstração incompatível.')
    let acesso=await lerJson(acessoArquivo)
    if(!acesso){
      acesso={email:process.env.EMAIL_ADMIN ?? 'admin.demo@example.invalid',senha:process.env.SENHA_ADMIN ?? randomBytes(20).toString('base64url')}
      await gravar(acessoArquivo,acesso)
    }
    const conta=(await client.query('SELECT id,papel,ativo FROM clientes WHERE email=$1',[acesso.email])).rows[0]
    if(conta && (conta.papel!=='admin'||!conta.ativo)) falhar('A conta existente não é admin ativa. Não será promovida automaticamente.')
    if(!conta) await executar(process.execPath,['--import','tsx','scripts/criar-admin.ts','--nome','Admin Demo Fictício','--email',acesso.email],
      {cwd:backend,env:{...ambiente(config),SENHA_ADMIN:acesso.senha}})
    console.log('Banco exclusivo e admin preparados; nenhuma venda ou movimentação foi criada por SQL.')
    console.log(`Acesso privado (não versionar nem compartilhar): ${acessoArquivo}`)
  } finally { await client.end() }
}
async function compilar(config) {
  for(const parte of ['backend','frontend']) await new Promise((resolve,reject)=>{
    const p=spawn('npm',['run','build'],{cwd:join(raiz,parte),env:ambiente(config),stdio:'inherit'})
    p.once('error',reject);p.once('exit',n=>n===0?resolve():reject(new DemoError('Falha no build da demo.')))
  })
}
async function servir(config) {
  const porta=Number(process.env.PORTA_DEMO ?? 4173)
  if(!Number.isInteger(porta)||porta<1024||porta>65535) falhar('PORTA_DEMO deve ser um inteiro entre1024 e65535.')
  const origem=`http://127.0.0.1:${porta}`
  Object.assign(process.env,ambiente(config),{PORT:String(porta),CORS_ORIGIN:origem,FRONTEND_URL:origem,FRONTEND_DIST:join(raiz,'frontend/dist')})
  const {app}=await import('../dist/app.js'), {db}=await import('../dist/config/db.js')
  const servidor=createServer((req,res)=>{
    const caminho=new URL(req.url,origem).pathname, leitura=['GET','HEAD'].includes(req.method)
    const permitida=leitura && /^\/api\/(auth\/sessao|health|categorias|produtos|peixes|midias\/produtos|estoque|vendas)(\/|$)/.test(caminho)
      || req.method==='POST' && ['/api/auth/login','/api/auth/logout','/api/produtos','/api/estoque/movimentacoes'].includes(caminho)
      || ['PATCH','DELETE','POST'].includes(req.method) && /^\/api\/produtos\/\d+(\/reativar)?$/.test(caminho)
    if(caminho.startsWith('/api/')&&!permitida){
      res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'})
      return res.end(JSON.stringify({erro:'Esta demonstração termina no carrinho. Operação desabilitada.'}))
    }
    app(req,res)
  })
  servidor.on('error',()=>{console.error('Não foi possível abrir a porta local. Escolha outra PORTA_DEMO.');process.exitCode=1;db.end()})
  servidor.listen(porta,'127.0.0.1',()=>{console.log(`Demo local: ${origem}/entrar`);console.log(`Abra o acesso privado no editor: ${acessoArquivo}`);console.log('Vendas, cobranças, e-mail e workers desabilitados neste launcher. Ctrl+C encerra o site.')})
  const fechar=()=>servidor.close(()=>db.end().then(()=>process.exit()))
  process.on('SIGINT',fechar);process.on('SIGTERM',fechar)
}
try {
  const acao=process.argv[2]
  if(acao==='preparar') await preparar()
  else if(acao==='iniciar'){await configurarPasta();const c=await ativarBanco(await lerConfig());await compilar(c);await servir(c)}
  else if(acao==='parar'){await configurarPasta();await lerConfig();await conferirContainer();await docker('stop',container);console.log('Somente o banco exclusivo da demo foi parado. Dados preservados.')}
  else falhar('Uso: node backend/scripts/demo-local.mjs preparar|iniciar|parar')
} catch(e) {
  console.error(e instanceof DemoError ? e.message : 'Não foi possível preparar/iniciar a demo. Confira Docker, dependências instaladas e as instruções do relatório; nenhum segredo foi impresso.')
  process.exitCode=1
}
