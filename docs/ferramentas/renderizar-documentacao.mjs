import { chromium } from '../../frontend/node_modules/playwright/index.mjs';
import { existsSync, readdirSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const temporary=join(tmpdir(),'aquarilandia-documentacao');
mkdirSync(temporary,{recursive:true});
function python(script,...args){
 const result=spawnSync(process.env.PYTHON||'python',[join(root,'docs/ferramentas',script),...args],{cwd:root,encoding:'utf8'});
 if(result.error || result.status!==0) throw new Error(result.error?.message||result.stderr||result.stdout);
 console.log(result.stdout.trim());
 return result.stdout;
}
let executablePath=process.env.CHROMIUM_EXECUTABLE;
if(!executablePath && existsSync(chromium.executablePath())) executablePath=chromium.executablePath();
if(!executablePath){
 const cache=join(homedir(),'.cache/ms-playwright');
 if(existsSync(cache)) for(const folder of readdirSync(cache).filter(v=>/^chromium-\d+$/.test(v)).sort().reverse()){
  const candidate=join(cache,folder,'chrome-linux64/chrome');
  if(existsSync(candidate)){executablePath=candidate;break;}
 }
}
if(!executablePath) throw new Error('Defina CHROMIUM_EXECUTABLE para um Chromium instalado.');
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1100,height:1240},deviceScaleFactor:2});
 await page.route('**/*',route=> /^https?:/.test(route.request().url())?route.abort():route.continue());
 if(process.argv.includes('--assets')){
  mkdirSync(join(root,'docs/visuais'),{recursive:true});
  for(const name of ['wireframe-baixo','wireframe-medio','wireframe-alto','mapa-empatia-juliana']){
   const height=name.startsWith('mapa')?1030:1240;
   await page.setViewportSize({width:1100,height});
   await page.goto(pathToFileURL(join(root,`docs/visuais/${name}.svg`)).href,{waitUntil:'load'});
   await page.screenshot({path:join(root,`docs/visuais/${name}.png`)});
   console.log(`Imagem renderizada: ${name}.png`);
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(pathToFileURL(join(root,'docs/prototipo-v4.html')).href,{waitUntil:'load'});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('.screen.active')).opacity==='1');
  await page.screenshot({path:join(root,'docs/visuais/prototipo-historico.png')});
  console.log('Imagem histórica renderizada a partir do arquivo local.');
 }
 if(process.argv.includes('--pdf')){
   const name='DOCUMENTACAO_COMPLETA_AQUARILANDIA';
   const target=join(temporary,`${name}.html`);
   const mapFile=join(temporary,'paginacao.json');
   if(existsSync(mapFile)) unlinkSync(mapFile);
   const pdfPath=join(temporary,'rascunho-abnt.pdf');
   let previousMap;let stable=false;
   for(let pass=0;pass<4;pass++){
    python('gerar-documentacao.py');
    await page.goto(pathToFileURL(target).href,{waitUntil:'load'});
    await page.evaluate(async()=>{
     await document.fonts.ready;
     await Promise.all([...document.images].map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.onload=resolve;image.onerror=resolve;})));
    });
    const broken=await page.locator('img').evaluateAll(images=>images.filter(image=>!image.complete||image.naturalWidth===0).map(image=>image.src));
    if(broken.length) throw new Error(`Imagens ausentes: ${broken.join(', ')}`);
    const content=(await page.locator('body').innerText()).toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');
    for(const expected of ['escrita de admin sem origin','não imprima o token','apêndice a — documentação técnica de código','a.11 colaboração com git']){
     if(!content.includes(expected)) throw new Error(`Conteúdo ausente: ${expected}`);
    }
    const typography=await page.evaluate(()=>({
     arial:document.fonts.check('12pt ArialRelatorio'),
     colored:[...document.querySelectorAll('h1,h2,h3,p,a,li,td,th,code,dt,dd,span')].filter(node=>getComputedStyle(node).color!=='rgb(0, 0, 0)').map(node=>node.textContent.slice(0,60))
    }));
    if(!typography.arial||typography.colored.length) throw new Error(`Tipografia inválida: ${JSON.stringify(typography)}`);
    await page.pdf({path:pdfPath,format:'A4',printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false,margin:{top:'30mm',bottom:'20mm',left:'30mm',right:'20mm'}});
    python('finalizar-pdf.py','map',pdfPath);
    const currentMap=readFileSync(mapFile,'utf8');
    if(currentMap===previousMap){stable=true;break;}
    previousMap=currentMap;
   }
   if(!stable) throw new Error('A paginação do sumário não estabilizou em quatro passagens.');
   const finishedPath=join(temporary,'pronto-abnt.pdf');
   if(existsSync(finishedPath)) unlinkSync(finishedPath);
   python('finalizar-pdf.py','finish',pdfPath,'--output',finishedPath);
   const bytes=readFileSync(finishedPath);
   if(bytes.subarray(0,5).toString()!=='%PDF-' || !bytes.subarray(-100).includes(Buffer.from('%%EOF'))) throw new Error('Estrutura PDF incompleta.');
  await page.setViewportSize({width:1280,height:1000});
  await page.screenshot({path:join(temporary,'previa-relatorio.png')});
  await page.setViewportSize({width:390,height:844});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow) throw new Error('A composição móvel apresentou rolagem horizontal.');
  const destination=join(root,`docs/${name}.pdf`);
  const pending=destination+'.tmp';
  writeFileSync(pending,bytes);
  renameSync(pending,destination);
  unlinkSync(pdfPath);
  console.log(`PDF único atualizado: ${name}.pdf`);
  console.log('Arial preta, sumário, listas, paginação acadêmica, imagens e apêndice conferidos.');
 }
}finally{await browser.close();}
