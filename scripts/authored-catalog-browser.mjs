// Catálogo de guias autorais e troca dos PDFs protegidos do site (banco simulado).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const U=require('../js/authored-catalog-utils.js');

// Funções puras
assert.equal(U.suggestFromFilename('CM_Guia_09_Estrutura_Formas_Armaduras_Cobrimento.pdf').title,'Guia de Obra 09 — Estrutura Formas Armaduras Cobrimento');
assert.equal(U.suggestFromFilename('10_Guia_de_Banheiros_Cozinhas_Metais_e_Ralos_Camila_Martins.pdf').code,'interiores-10');
assert.equal(U.suggestFromFilename('menu-de-experiencias-camila-martins.pdf').title,'Menu de Experiencias');
assert.match(U.clientCopyPath('c1','p1','Guia de Obra 09 — Estrutura',1),/^c1\/p1\/1-guia-de-obra-09-estrutura\.pdf$/);
assert.match(U.masterPath('m1',2,'Guia X',5),/^autorais\/m1\/v2-5-guia-x\.pdf$/);
const matrix=U.clientMatrix([{id:'m1',current_version:2},{id:'m2',current_version:1}],[{cliente_id:'c1',authored_material_id:'m1',authored_material_version:1}],[{id:'c1',nome:'A'}]);
assert.equal(matrix[0].has[0].outdated,true);assert.deepEqual(matrix[0].missing.map(m=>m.id),['m2']);

const strip=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const pdfBytes=Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const mockSetup=`(() => {
  window.__log=[];window.__confirm=true;window.confirm=()=>window.__confirm;window.open=(u)=>window.__log.push({open:u});
  const T=window.__tables;
  function chain(table){const filters=[];let single=false;const c={};
    for(const m of ['select','order','limit'])c[m]=()=>c;
    c.eq=(k,v)=>{filters.push(r=>String(r[k])===String(v));return c;};
    c.neq=(k,v)=>{filters.push(r=>String(r[k])!==String(v));return c;};
    c.not=(k,_op,_v)=>{filters.push(r=>r[k]!=null);return c;};
    const run=()=>{let rows=(T[table]||[]).filter(r=>filters.every(f=>f(r)));return {data:single?rows[0]||null:rows,error:null};};
    c.single=async()=>{single=true;return run();};c.maybeSingle=c.single;
    c.then=(ok,ko)=>Promise.resolve(run()).then(ok,ko);return c;}
  window.supabaseClient={
    auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null}),signOut:async()=>{}},
    from:chain,
    rpc:async(name,args)=>{window.__log.push({rpc:name,args});return window.__rpc(name,args);},
    storage:{from:(b)=>({
      copy:async(a,z)=>{window.__log.push({copy:[b,a,z]});return {data:{},error:null};},
      upload:async(p,f,o)=>{window.__log.push({upload:[b,p,f.size,o.upsert]});return {data:{},error:null};},
      remove:async(ps)=>{window.__log.push({remove:[b,ps]});return {data:[],error:null};},
      createSignedUrl:async(p)=>({data:{signedUrl:'https://signed/'+p},error:null})})}
  };
})();`;

const browser=await chromium.launch({headless:true});
try{
 for(const width of [1366,390]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const html=strip(fs.readFileSync('materiais-autorais.html','utf8'));
  await ctx.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());
  await page.goto('http://127.0.0.1:45999/materiais-autorais.html');
  await page.addStyleTag({content:fs.readFileSync('css/authored-catalog.css','utf8')});
  await page.evaluate(()=>{
   window.__tables={
    authored_materials:[
     {id:'m1',code:'obra-09',title:'Guia de Obra 09 — Estrutura',category:'Guias de Obra',number:9,current_version:1,storage_path:'c1/p1/1-old.pdf',sha256:null,size_bytes:1000,active:true,updated_at:'2026-11-09T00:00:00Z'},
     {id:'m2',code:'interiores-01',title:'Guia de Interiores 01 — Estilos',category:'Guias de Interiores',number:1,current_version:1,storage_path:'autorais/m2/v1-x.pdf',sha256:'abc',size_bytes:2000,active:true,updated_at:'2026-11-09T00:00:00Z'}],
    authored_material_versions:[{id:'v1',material_id:'m1',version:1,storage_path:'c1/p1/1-old.pdf'},{id:'v2',material_id:'m2',version:1,storage_path:'autorais/m2/v1-x.pdf'}],
    documentos:[{id:'d1',cliente_id:'c1',projeto_id:'p1',arquivo:'c1/p1/1-old.pdf',authored_material_id:'m1',authored_material_version:1},
                {id:'d2',cliente_id:'c2',projeto_id:'p2',arquivo:'c2/p2/1-old.pdf',authored_material_id:'m1',authored_material_version:1}],
    clientes:[{id:'c1',nome:'Cliente Um',status:'ativo'},{id:'c2',nome:'Cliente Dois',status:'ativo'},{id:'c3',nome:'Cliente Três',status:'ativo'}],
    projetos:[{id:'p1',nome:'Obra 1',cliente_id:'c1',status:'ativo'},{id:'p2',nome:'Obra 2',cliente_id:'c2',status:'ativo'},{id:'p3',nome:'Obra 3',cliente_id:'c3',status:'ativo'}]
   };
   window.__rpc=(name,args)=>{const T=window.__tables;
    if(name==='admin_authored_material_set_master'){const m=T.authored_materials.find(x=>x.id===args.p_material);m.storage_path=args.p_path;return {data:null,error:null};}
    if(name==='admin_authored_material_new_version'){const m=T.authored_materials.find(x=>x.id===args.p_material);m.current_version+=1;m.storage_path=args.p_path;m.sha256=args.p_sha;return {data:m.current_version,error:null};}
    if(name==='admin_authored_material_apply'){const old=[];for(const it of args.p_items){const d=T.documentos.find(x=>x.id===it.document_id);if(d.arquivo!==it.arquivo)old.push(d.arquivo);d.arquivo=it.arquivo;d.authored_material_version=T.authored_materials.find(x=>x.id===args.p_material).current_version;}return {data:{updated:args.p_items.length,old_paths:old},error:null};}
    if(name==='admin_authored_material_release'){for(const it of args.p_items)T.documentos.push({id:'n'+it.cliente_id,cliente_id:it.cliente_id,projeto_id:it.projeto_id,arquivo:it.arquivo,authored_material_id:args.p_material,authored_material_version:1});return {data:{created:args.p_items.map(i=>i.cliente_id),skipped_paths:[]},error:null};}
    if(name==='admin_authored_material_save')return {data:'m-new',error:null};
    return {data:null,error:{message:'rpc inesperada '+name}};};
  });
  await page.addScriptTag({content:mockSetup});
  await page.addScriptTag({content:fs.readFileSync('js/authored-catalog-utils.js','utf8')});
  await page.addScriptTag({content:fs.readFileSync('js/authored-catalog.js','utf8')});
  await page.waitForFunction(()=>/guia\(s\) no catálogo/.test(document.getElementById('acStatus').textContent));

  // Original migrado vai para a pasta interna antes de qualquer uso.
  let log=await page.evaluate(()=>window.__log);
  const securing=log.find(e=>e.copy);
  assert.equal(securing.copy[1],'c1/p1/1-old.pdf');assert.match(securing.copy[2],/^autorais\/m1\//);
  assert.ok(log.some(e=>e.rpc==='admin_authored_material_set_master'));

  // Quadro: Cliente Três sem guias; atalho de liberação.
  assert.equal(await page.locator('.ac-client').count(),3);
  assert.equal(await page.locator('.ac-item').count(),2);

  // Substituir: nova versão para todos, sem aviso; cópias antigas removidas; original nunca removido.
  await page.evaluate(()=>{window.__log=[];});
  await page.locator('[data-material="m1"] [data-action="replace"]').click();
  await page.setInputFiles('#acReplaceFile',{name:'Guia09-rev.pdf',mimeType:'application/pdf',buffer:pdfBytes});
  await page.locator('#acReplaceGo').click();
  await page.waitForFunction(()=>/versão 2 no ar/.test(document.getElementById('acStatus').textContent));
  log=await page.evaluate(()=>window.__log);
  assert.ok(log.find(e=>e.upload)?.upload[1].startsWith('autorais/m1/v2-'),'novo original na pasta interna');
  assert.equal(log.filter(e=>e.copy).length,2,'uma cópia por cliente');
  const apply=log.find(e=>e.rpc==='admin_authored_material_apply');
  assert.equal(apply.args.p_notify,false,'sem aviso por padrão');
  const removed=log.filter(e=>e.remove).flatMap(e=>e.remove[1]);
  assert.deepEqual(removed.sort(),['c1/p1/1-old.pdf','c2/p2/1-old.pdf']);
  assert.ok(removed.every(p=>!p.startsWith('autorais/')));
  assert.match(await page.locator('#acStatus').textContent(),/2 cliente\(s\) atualizado\(s\) sem aviso/);

  // Liberar para o Cliente Três (projeto único escolhido sozinho).
  await page.evaluate(()=>{window.__log=[];});
  await page.locator('[data-release-one="m1"][data-client-id="c3"]').first().evaluate(el=>el.closest('details').open=true);
  await page.locator('[data-release-one="m1"][data-client-id="c3"]').click();
  assert.equal(await page.locator('#acModalBody input[data-client="c3"]').isChecked(),true);
  assert.equal(await page.locator('#acModalBody input[data-client="c1"]').isDisabled(),true,'quem já tem não pode receber de novo');
  await page.locator('#acReleaseGo').click();
  await page.waitForFunction(()=>/liberado para 1 cliente/.test(document.getElementById('acStatus').textContent));
  log=await page.evaluate(()=>window.__log);
  const rel=log.find(e=>e.rpc==='admin_authored_material_release');
  assert.deepEqual(rel.args.p_items.map(i=>[i.cliente_id,i.projeto_id]),[['c3','p3']]);
  assert.equal(rel.args.p_notify,false);

  // Envio de guia novo com título sugerido; mesmo código vira nova versão.
  await page.evaluate(()=>{window.__log=[];});
  await page.setInputFiles('#acNewFiles',[{name:'CM_Guia_23_Esquadrias.pdf',mimeType:'application/pdf',buffer:Buffer.concat([pdfBytes,Buffer.from('% guia 23\n')])},{name:'nao-e-pdf.pdf',mimeType:'application/pdf',buffer:Buffer.from('texto')}]);
  await page.waitForSelector('.ac-new-row');
  assert.equal(await page.locator('.ac-new-row [data-field="title"]').first().inputValue(),'Guia de Obra 23 — Esquadrias');
  assert.equal(await page.locator('.ac-new-row.has-error').count(),1,'arquivo inválido é recusado');
  await page.locator('#acSaveNew').click();
  await page.waitForFunction(()=>/1 guia\(s\) salvo/.test(document.getElementById('acStatus').textContent),null,{timeout:4000}).catch(async()=>{throw new Error('status: '+await page.locator('#acStatus').textContent());});
  log=await page.evaluate(()=>window.__log);
  const saved=log.find(e=>e.rpc==='admin_authored_material_save');
  assert.equal(saved.args.p.code,'obra-23');assert.match(saved.args.p.storage_path,/^autorais\//);

  if(process.env.CME_SHOTS){await page.addStyleTag({content:fs.readFileSync('css/admin.css','utf8')});await page.screenshot({path:`${process.env.CME_SHOTS}/catalogo-${width}.png`,fullPage:true});await page.locator('[data-material="m1"] [data-action="release"]').click();await page.screenshot({path:`${process.env.CME_SHOTS}/liberar-${width}.png`});await page.locator('[data-ac-close]').first().click();}
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,`sem rolagem horizontal (${overflow}px) em ${width}px`);
  assert.deepEqual(errors,[]);
  await ctx.close();
 }

 // PDFs do site: troca guarda histórico e permite voltar.
 const ctx=await browser.newContext({viewport:{width:1280,height:900}}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const html=strip(fs.readFileSync('protecao-pdf-admin.html','utf8'));
 await ctx.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await page.goto('http://127.0.0.1:45999/protecao-pdf-admin.html');
 await page.evaluate(()=>{
  window.__tables={pdf_admins:[{user_id:'admin'}],
   protected_site_pdfs:[{slug:'portfolio',title:'Portfólio',original_storage_path:'site-originais/portfolio.pdf',active:true,updated_at:'2026-07-30T20:43:42Z'},{slug:'experiencias',title:'Menu',original_storage_path:'site-originais/experiencias.pdf',active:true,updated_at:'2026-07-30T20:45:11Z'}],
   protected_site_pdf_versions:[{id:'sv1',slug:'portfolio',version:1,storage_path:'site-originais/portfolio.pdf',size_bytes:2921222,created_at:'2026-07-30T20:43:42Z'},{id:'sv2',slug:'experiencias',version:1,storage_path:'site-originais/experiencias.pdf',size_bytes:3496139,created_at:'2026-07-30T20:45:11Z'}]};
  window.__rpc=(name,args)=>{const T=window.__tables;
   if(name==='admin_site_pdf_publish'){const v=Math.max(...T.protected_site_pdf_versions.filter(x=>x.slug===args.p_slug).map(x=>x.version))+1;T.protected_site_pdf_versions.push({id:'sv'+v+args.p_slug,slug:args.p_slug,version:v,storage_path:args.p_path,size_bytes:args.p_size,created_at:new Date().toISOString()});T.protected_site_pdfs.find(x=>x.slug===args.p_slug).original_storage_path=args.p_path;return {data:v,error:null};}
   if(name==='admin_site_pdf_restore'){const old=T.protected_site_pdf_versions.find(x=>x.id===args.p_version);return window.__rpc('admin_site_pdf_publish',{p_slug:old.slug,p_path:old.storage_path,p_size:old.size_bytes});}
   return {data:null,error:{message:'rpc inesperada '+name}};};
 });
 await page.addScriptTag({content:mockSetup});
 await page.addScriptTag({content:fs.readFileSync('js/pdf-site-admin.js','utf8')});
 await page.waitForFunction(()=>/pronta/.test(document.getElementById('pdfAdminStatus').textContent));
 assert.equal(await page.locator('[data-pdf-check="portfolio"]').getAttribute('href'),'pdf-protegido.html?slug=portfolio');
 await page.setInputFiles('#pdfPortfolio',{name:'portfolio-2026.pdf',mimeType:'application/pdf',buffer:pdfBytes});
 await page.locator('form[data-slug="portfolio"] button[type="submit"]').click();
 await page.waitForFunction(()=>/v2 no ar/.test(document.getElementById('pdfAdminStatus').textContent));
 let log=await page.evaluate(()=>window.__log);
 const up=log.find(e=>e.upload);
 assert.match(up.upload[1],/^site-originais\/portfolio\/\d{8}-\d{6}-[0-9a-f]{8}\.pdf$/);assert.equal(up.upload[3],false,'nunca sobrescreve o anterior');
 assert.ok(!log.some(e=>e.remove),'versão anterior preservada');
 await page.locator('[data-pdf-slug="portfolio"] details').evaluate(d=>d.open=true);
 await page.locator('[data-pdf-restore="sv1"]').click();
 await page.waitForFunction(()=>/restaurada/.test(document.getElementById('pdfAdminStatus').textContent));
 log=await page.evaluate(()=>window.__log);
 assert.ok(log.some(e=>e.rpc==='admin_site_pdf_restore'&&e.args.p_version==='sv1'));
 // PDF falso é recusado sem enviar nada.
 await page.evaluate(()=>{window.__log=[];});
 await page.setInputFiles('#pdfExperiencias',{name:'falso.pdf',mimeType:'application/pdf',buffer:Buffer.from('nada')});
 await page.locator('form[data-slug="experiencias"] button[type="submit"]').click();
 await page.waitForFunction(()=>/PDF válido/.test(document.getElementById('pdfAdminStatus').textContent));
 assert.equal((await page.evaluate(()=>window.__log)).filter(e=>e.upload).length,0);
 assert.deepEqual(errors,[]);
 await ctx.close();
 console.log('PASS: catálogo autoral (original protegido, substituir para todos sem aviso, liberar, envio com título sugerido, celular) e PDFs do site (histórico e retorno de versão).');
}finally{await browser.close();}
