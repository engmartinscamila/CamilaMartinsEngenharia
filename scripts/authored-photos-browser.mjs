// Imagens autorais (cópia carimbada gravada na imagem), verificação pública de cópia e
// imagem convertida em PDF no catálogo de guias. Banco simulado.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const strip=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const shots=process.env.CME_SHOTS||'';
const pdfLibLocal=[process.env.PDF_LIB_PATH,path.resolve('node_modules/pdf-lib/dist/pdf-lib.min.js')].find(p=>p&&fs.existsSync(p));

const browser=await chromium.launch({headless:true});
try{
 // 1) Painel de Fotos: gera cópia carimbada para quem precisa e troca autoral/comum sem aviso.
 for(const width of [1366,390]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const html=strip(fs.readFileSync('fotos.html','utf8'));
  await ctx.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.goto('http://127.0.0.1:45999/fotos.html');
  await page.addStyleTag({content:fs.readFileSync('css/authored-photos.css','utf8')});
  await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=1600;c.height=1000;const g=c.getContext('2d');g.fillStyle='#4a7';g.fillRect(0,0,1600,1000);g.fillStyle='#fff';g.fillRect(500,300,600,400);
   window.__img=await new Promise(r=>c.toBlob(r,'image/png'));
   window.__log=[];window.__rows=[
    {id:'11111111-2222-3333-4444-555555555555',nome:'Render fachada',storage_bucket:'fotos',arquivo:'c1/p1/fachada.png',protection_mode:'authored_photo',client_name:'Tributino Empreendimentos',contract_number:'Empreendimento Vitalle',protected_copy_path:null,needs_copy:true},
    {id:'66666666-7777-8888-9999-000000000000',nome:'Foto da obra',storage_bucket:'fotos',arquivo:'c1/p1/obra.png',protection_mode:'administrative',client_name:'Tributino Empreendimentos',contract_number:'Empreendimento Vitalle',protected_copy_path:null,needs_copy:false}];
   window.supabaseClient={
    auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})},
    rpc:async(name,args)=>{window.__log.push({rpc:name,args});
     if(name==='is_portal_admin')return {data:true,error:null};
     if(name==='admin_photo_stamp_queue')return {data:JSON.parse(JSON.stringify(window.__rows)),error:null};
     if(name==='admin_photo_set_protected_copy'){const r=window.__rows.find(x=>x.id===args.p_photo);r.protected_copy_path=args.p_path;r.needs_copy=false;return {data:null,error:null};}
     if(name==='admin_photo_set_protection'){for(const id of args.p_ids){const r=window.__rows.find(x=>x.id===id);r.protection_mode=args.p_mode;r.needs_copy=args.p_mode==='authored_photo'&&!r.protected_copy_path;}return {data:args.p_ids.length,error:null};}
     return {data:null,error:{message:'rpc inesperada '+name}};},
    storage:{from:b=>({
     download:async p=>{window.__log.push({download:[b,p]});return {data:window.__img,error:null};},
     upload:async(p,blob,o)=>{window.__log.push({upload:[b,p,blob.type,blob.size,o.upsert]});window.__stamped=blob;return {data:{},error:null};},
     remove:async ps=>{window.__log.push({remove:[b,ps]});return {data:[],error:null};},
     createSignedUrl:async p=>({data:{signedUrl:'https://signed/'+p},error:null})})}
   };
  });
  await page.addScriptTag({content:fs.readFileSync('js/authored-photos.js','utf8')});
  await page.waitForFunction(()=>/cópia\(s\) carimbada\(s\) preparada/.test(document.querySelector('[data-ap-status]')?.textContent||''));
  let log=await page.evaluate(()=>window.__log);
  const up=log.find(e=>e.upload);
  assert.match(up.upload[1],/^protegidas\/11111111-2222-3333-4444-555555555555\/\d+\.jpg$/);
  assert.equal(up.upload[2],'image/jpeg');assert.equal(up.upload[4],false);
  assert.equal(log.filter(e=>e.download).length,1,'só a imagem autoral é processada');
  // O carimbo foi gravado: a área branca do centro deixou de ser branca pura.
  const stamped=await page.evaluate(async()=>{const b=await createImageBitmap(window.__stamped);const c=document.createElement('canvas');c.width=b.width;c.height=b.height;const g=c.getContext('2d');g.drawImage(b,0,0);
   const band=g.getImageData(10,b.height-5,1,1).data;let changed=0;const d=g.getImageData(500,300,600,400).data;for(let i=0;i<d.length;i+=4)if(d[i]<235||d[i+1]<235||d[i+2]<235)changed++;return {w:b.width,h:b.height,band:[band[0],band[1],band[2]],changed};});
  assert.equal(stamped.w,1600);assert.ok(stamped.changed>2000,`carimbo visível sobre a imagem (${stamped.changed} px)`);
  assert.ok(stamped.band.every(v=>v<60),'faixa escura com o texto do rodapé');
  if(shots){await page.evaluate(()=>{const u=URL.createObjectURL(window.__stamped);const i=new Image();i.src=u;i.id='shot';i.style.cssText='position:fixed;inset:0;width:100%;z-index:99;background:#000';document.body.append(i);});await page.waitForTimeout(300);await page.screenshot({path:`${shots}/carimbo-${width}.png`});await page.evaluate(()=>document.getElementById('shot').remove());}
  // Painel: trocar para comum (sem aviso) e de volta para autoral.
  await page.locator('.ap-root').evaluate(d=>d.open=true);
  await page.locator('.ap-group').first().evaluate(d=>d.open=true);
  await page.evaluate(()=>{window.__log=[];});
  await page.selectOption('[data-ap-mode="66666666-7777-8888-9999-000000000000"]','authored_photo');
  await page.waitForFunction(()=>window.__log.some(e=>e.rpc==='admin_photo_set_protected_copy'&&e.args.p_photo.startsWith('6666')));
  log=await page.evaluate(()=>window.__log);
  assert.deepEqual(log.find(e=>e.rpc==='admin_photo_set_protection').args,{p_ids:['66666666-7777-8888-9999-000000000000'],p_mode:'authored_photo'});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,`sem rolagem horizontal (${overflow}px)`);
  if(shots)await page.screenshot({path:`${shots}/painel-${width}.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  await ctx.close();
 }

 // 2) Página pública de verificação.
 {
  const ctx=await browser.newContext({viewport:{width:390,height:800}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const html=fs.readFileSync('verificar.html','utf8').replace(/<script\b[^>]*src=[^>]*><\/script>/gi,'');
  await ctx.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.goto('http://127.0.0.1:45999/verificar.html?c=cme-ab12cd34ef56');
  await page.evaluate(()=>{window.__calls=[];window.supabaseClient={rpc:async(n,a)=>{window.__calls.push(a.p_code);return {data:a.p_code==='CME-AB12CD34EF56'?{valid:true,kind:'PDF do site',title:'Portfólio',licensed_to:'Cliente Teste - c***@x.com',issued_at:'2026-11-10T02:27:34Z'}:{valid:false},error:null};}};});
  await page.addScriptTag({content:fs.readFileSync('js/verify-copy.js','utf8')});
  await page.waitForFunction(()=>/Cópia autêntica/.test(document.getElementById('verifyResult').textContent));
  assert.match(await page.locator('#verifyResult').textContent(),/Cliente Teste/);
  await page.fill('#verifyCode','CME-FALSO999999');await page.click('button[type=submit]');
  await page.waitForFunction(()=>/não reconhecida/.test(document.getElementById('verifyResult').textContent));
  await page.fill('#verifyCode','<script>');await page.click('button[type=submit]');
  await page.waitForFunction(()=>/Código inválido/.test(document.getElementById('verifyResult').textContent));
  assert.equal((await page.evaluate(()=>window.__calls)).length,2,'código inválido nem consulta o banco');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1);assert.deepEqual(errors,[]);
  await ctx.close();
 }

 // 3) Catálogo: imagem vira PDF de uma página antes de entrar no fluxo protegido.
 {
  const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const html=strip(fs.readFileSync('materiais-autorais.html','utf8'));
  await ctx.route('**/*',r=>{
   if(r.request().isNavigationRequest())return r.fulfill({contentType:'text/html',body:html});
   if(r.request().url().includes('pdf-lib'))return pdfLibLocal?r.fulfill({contentType:'application/javascript',body:fs.readFileSync(pdfLibLocal,'utf8')}):r.continue();
   return r.abort();});
  await page.goto('http://127.0.0.1:45999/materiais-autorais.html');
  await page.evaluate(()=>{window.__log=[];
   const chain=()=>{const c={};for(const m of ['select','eq','neq','not','order'])c[m]=()=>c;c.single=async()=>({data:null,error:null});c.then=(ok,ko)=>Promise.resolve({data:[],error:null}).then(ok,ko);return c;};
   window.supabaseClient={auth:{getUser:async()=>({data:{user:{id:'a'}},error:null})},from:chain,
    rpc:async(n,a)=>{window.__log.push({rpc:n,args:a});return {data:'m-new',error:null};},
    storage:{from:()=>({upload:async(p,f,o)=>{window.__log.push({upload:p,type:f.type,head:new TextDecoder().decode(new Uint8Array(await f.slice(0,5).arrayBuffer()))});return {data:{},error:null};},copy:async()=>({error:null}),remove:async()=>({error:null})})}};
  });
  await page.addScriptTag({content:fs.readFileSync('js/authored-catalog-utils.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync('js/authored-catalog.js','utf8')});
  await page.waitForFunction(()=>/no catálogo/.test(document.getElementById('acStatus').textContent));
  const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=800;c.height=500;c.getContext('2d').fillRect(0,0,800,500);const b=await new Promise(r=>c.toBlob(r,'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()));});
  await page.setInputFiles('#acNewFiles',{name:'Render_Fachada_Camila_Martins.png',mimeType:'image/png',buffer:Buffer.from(png)});
  await page.waitForSelector('.ac-new-row');
  assert.equal(await page.locator('.ac-new-row.has-error').count(),0,'imagem aceita');
  assert.match(await page.locator('.ac-new-file').textContent(),/Render_Fachada_Camila_Martins\.pdf/);
  await page.click('#acSaveNew');
  await page.waitForFunction(()=>/1 guia\(s\) salvo/.test(document.getElementById('acStatus').textContent));
  const log=await page.evaluate(()=>window.__log);
  const up=log.find(e=>e.upload);assert.equal(up.type,'application/pdf');assert.equal(up.head,'%PDF-');
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
 console.log('PASS: imagens autorais com carimbo gravado (computador/celular), troca autoral/comum sem aviso, verificação pública de cópia e imagem→PDF no catálogo.');
}finally{await browser.close();}
