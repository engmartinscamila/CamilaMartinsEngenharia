// Conteúdo do site: botões de atualização e marca timbrada nas imagens publicadas (Worker simulado).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const strip=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const API='https://cme-public-media.eng-martins-camila.workers.dev';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [1366,390]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const calls=[];
  const manifest={projetos:[{slug:'vitalle',imagens:[
   {src:`${API}/media/portfolio/vitalle/imagem/01.webp`,storagePath:'portfolio/vitalle/imagem/01.webp',watermark:'embedded'},
   {src:`${API}/media/portfolio/vitalle/imagem/02-timbrada.webp`,storagePath:'portfolio/vitalle/imagem/02-timbrada.webp',watermark:'timbrada'},
   {src:'assets/projetos/vitalle/03.webp',watermark:'embedded'}],
   videos:[{src:`${API}/media/portfolio/vitalle/video/v.mp4`,poster:`${API}/media/portfolio/vitalle/video/capa.jpg`}]}]};
  const png=fs.readFileSync('assets/projetos/tiny-house-signature/01.webp');
  await ctx.route('**/*',async r=>{
   const req=r.request(),url=req.url();
   if(req.isNavigationRequest())return r.fulfill({contentType:'text/html',body:strip(fs.readFileSync('protecao-pdf-admin.html','utf8'))});
   if(url.startsWith(API)){
    const u=new URL(url);calls.push({method:req.method(),path:u.pathname,key:u.searchParams.get('key'),body:req.method()==='GET'?null:(req.postDataBuffer()||Buffer.alloc(0))});
    if(u.pathname==='/api/manifest'&&req.method()==='GET')return r.fulfill({contentType:'application/json',body:JSON.stringify(manifest)});
    if(u.pathname.startsWith('/media/'))return r.fulfill({contentType:u.pathname.endsWith('.jpg')?'image/jpeg':'image/webp',body:png});
    if(u.pathname==='/api/upload')return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,key:u.searchParams.get('key')})});
    return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true})});
   }
   return r.abort();
  });
  await page.goto('http://127.0.0.1:45999/protecao-pdf-admin.html');
  await page.addStyleTag({content:fs.readFileSync('css/midias-admin.css','utf8')});
  await page.evaluate(()=>{window.confirm=()=>true;window.__reloaded=0;
   window.supabaseClient={auth:{getSession:async()=>({data:{session:{access_token:'t'}},error:null})},storage:{from:()=>({})}};});
  for(const f of ['portfolio-r2-bridge','portfolio-restamp','site-content-shortcuts'])await page.addScriptTag({content:fs.readFileSync(`js/${f}.js`,'utf8')});

  // Botões claros: cada um leva ao lugar certo.
  assert.equal(await page.locator('[data-quick]').count(),4);
  await page.click('[data-quick="experiencias"]');
  assert.equal(await page.locator('[data-site-panel="pdfs"]').isHidden(),false);
  assert.match(await page.locator('#siteQuickHint').textContent(),/Guia de níveis/);
  assert.match(await page.locator('form[data-slug="experiencias"] h2').textContent(),/Guia de níveis de experiência/);
  await page.click('[data-quick="videos"]');
  assert.equal(await page.locator('[data-site-panel="galeria"]').isHidden(),false);
  assert.equal(await page.locator('[data-site-panel="pdfs"]').isHidden(),true);
  assert.match(await page.locator('#siteQuickHint').textContent(),/Vídeo/);

  // Marca timbrada nas imagens publicadas: só as que ainda não têm; endereço novo; antigas removidas.
  const result=await page.evaluate(()=>window.CMEPortfolioRestamp.restampAll());
  assert.deepEqual([result.total,result.done,result.failed.length],[2,2,0],'01.webp e a capa do vídeo');
  const uploads=calls.filter(c=>c.path==='/api/upload').map(c=>c.key).sort();
  assert.deepEqual(uploads,['portfolio/vitalle/imagem/01-timbrada.webp','portfolio/vitalle/video/capa-timbrada.webp']);
  const put=calls.find(c=>c.path==='/api/manifest'&&c.method==='PUT');
  const saved=JSON.parse(put.body.toString());
  assert.equal(saved.projetos[0].imagens[0].src,`${API}/media/portfolio/vitalle/imagem/01-timbrada.webp`);
  assert.equal(saved.projetos[0].imagens[0].storagePath,'portfolio/vitalle/imagem/01-timbrada.webp');
  assert.equal(saved.projetos[0].imagens[0].watermark,'timbrada');
  assert.equal(saved.projetos[0].imagens[2].src,'assets/projetos/vitalle/03.webp','imagem do próprio site recebe a marca na publicação');
  assert.equal(saved.projetos[0].videos[0].src,`${API}/media/portfolio/vitalle/video/v.mp4`,'vídeo não é alterado');
  const del=JSON.parse(calls.find(c=>c.path==='/api/delete-batch').body.toString());
  assert.deepEqual(del.keys.sort(),['portfolio/vitalle/imagem/01.webp','portfolio/vitalle/video/capa.jpg']);
  // A imagem enviada tem a marca: é diferente da original e é WebP.
  const sent=calls.find(c=>c.key==='portfolio/vitalle/imagem/01-timbrada.webp').body;
  assert.equal(sent.slice(8,12).toString(),'WEBP');assert.notEqual(sent.length,png.length);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,`sem rolagem horizontal (${overflow}px)`);
  if(process.env.CME_SHOTS){await page.click('[data-quick="portfolio"]');await page.waitForTimeout(600);await page.screenshot({path:`${process.env.CME_SHOTS}/conteudo-site-${width}.png`});}
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
 console.log('PASS: botões de atualização (Portfólio, Guia de níveis, imagens, vídeos) e marca timbrada nas imagens publicadas (endereço novo, catálogo atualizado, antigas removidas, vídeo intacto).');
}finally{await browser.close();}
