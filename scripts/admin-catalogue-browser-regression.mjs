import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.SITE_BASE||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('dialog',dialog=>void dialog.accept());
 await page.addInitScript(()=>{
  window.__records={documentos:[{id:'d1',nome:'PDF autoral',arquivo:'p1/projeto.pdf',cliente_id:'c1',projeto_id:'p1',autoral:true,protection_mode:'authored_pdf',storage_bucket:'documentos',created_at:'2026-10-01'}],fotos:[{id:'f1',nome:'Foto administrativa',arquivo:'p1/foto.jpg',cliente_id:'c1',projeto_id:'p1',protection_mode:'administrative',storage_bucket:'fotos',created_at:'2026-10-02'}],biblioteca:[{id:7,nome:'Guia',arquivo:'p1/guia.pdf',cliente_id:'c1',projeto_id:'p1',autoral:false,storage_bucket:'biblioteca',created_at:'2026-10-03'}]};
  window.__uploads=[];window.__failSecond=true;window.BUCKETS={DOCUMENTOS:'documentos',FOTOS:'fotos',BIBLIOTECA:'biblioteca'};
  window.dbBuscarClientes=async()=>[{id:'c1',nome:'Cliente sintético'}];window.dbBuscarProjetos=async()=>[{id:'p1',cliente_id:'c1',nome:'Projeto sintético'}];
  window.dbGerarUrlArquivo=async()=> 'data:application/pdf;base64,JVBERi0xLjQ=';
  window.dbUploadArquivo=async(bucket,path)=>{window.__uploads.push({bucket,path});};window.dbExcluirArquivoStorage=async()=>{};
  window.dbNotificarAtualizacao=async()=>({agendado:true});window.dbBuscarConfiguracoes=async()=>({});
  window.supabaseClient={from(table){let op='select',payload,filters=[],single=false;const q={select(){return q},order(){return q},range(){return q},eq(k,v){filters.push([k,v]);return q},insert(value){op='insert';payload=value;return q},update(value){op='update';payload=value;return q},delete(){op='delete';return q},maybeSingle(){single=true;return q},then(resolve){
   let data=(window.__records[table]||[]).filter(row=>filters.every(([k,v])=>String(row[k])===String(v)));let error=null;
   if(op==='insert'){
    if(window.__failSecond&&payload.nome==='Segundo arquivo'){window.__failSecond=false;error={message:'Falha sintética na segunda gravação'};data=null;}
    else{const row={...payload,id:crypto.randomUUID(),created_at:new Date().toISOString()};window.__records[table].push(row);data=[row];}
   }else if(op==='update'){data.forEach(row=>Object.assign(row,payload));}
   resolve({data:single?data?.[0]??null:data,error});
  }};return q;}};
 });
 await page.route(/\/js\/(?:supabase|database|auth)\.js/,route=>route.fulfill({contentType:'application/javascript',body:''}));
 await page.route(/cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/,route=>route.abort());
 await page.goto(base+'/documentos.html');await page.locator('[data-id="biblioteca:7"]').first().waitFor({state:'attached'});await page.locator('#listaDocumentos details').evaluateAll(rows=>rows.forEach(row=>row.open=true));
 await page.locator('[data-acao-documento="editar"][data-id="foto:f1"]').first().click();assert.equal(await page.locator('#documentoAutoral').isChecked(),false);
 await page.locator('#documentoAutoral').check();await page.locator('#formDocumento').evaluate(form=>form.requestSubmit());await page.locator('#modalDocumento').waitFor({state:'hidden'});
 await page.locator('#listaDocumentos details').evaluateAll(rows=>rows.forEach(row=>row.open=true));
 await page.locator('[data-acao-documento="editar"][data-id="d1"]').first().click();assert.equal(await page.locator('#documentoAutoral').isChecked(),true,'Second record must load its own authorship');
 await page.locator('#formDocumento').evaluate(form=>form.requestSubmit());await page.locator('#modalDocumento').waitFor({state:'hidden'});
 const records=await page.evaluate(()=>window.__records);assert.equal(records.documentos[0].autoral,true);assert.equal(records.fotos[0].protection_mode,'authored_photo');
 await page.locator('#novoDocumento').click();await page.locator('#documentoCliente').selectOption('c1');await page.locator('#documentoProjeto').selectOption('p1');
 await page.locator('#documentoArquivo').setInputFiles([{name:'Primeiro arquivo.pdf',mimeType:'application/pdf',buffer:Buffer.from('Synthetic one')},{name:'Segundo arquivo.pdf',mimeType:'application/pdf',buffer:Buffer.from('Synthetic two')}]);
 await page.locator('#formDocumento').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
 await page.waitForFunction(()=>window.__records.documentos.length===2&&document.getElementById('salvarDocumento').disabled===false);
 assert.equal(await page.locator('#modalDocumento').isVisible(),true,'Partial failure must preserve form');
 await page.locator('#formDocumento').evaluate(form=>form.requestSubmit());await page.locator('#modalDocumento').waitFor({state:'hidden'});
 assert.equal(await page.evaluate(()=>window.__records.documentos.length),3,'Retry must not duplicate the first confirmed file');
 await page.goto(base+'/biblioteca.html?projectId=p1');await page.waitForURL(url=>url.pathname==='/documentos.html');assert.equal(new URL(page.url()).searchParams.get('projectId'),'p1');assert.equal(new URL(page.url()).searchParams.get('visao'),'biblioteca');
 await page.locator('#novoDocumento').click();assert.equal(await page.locator('#documentoDestino').inputValue(),'biblioteca');
 await page.close();console.log('PASS: catálogo real no navegador móvel, três fontes, autoria por registro, clique duplo, lote parcial e repetição sem duplicação, Biblioteca contextual.');
}finally{await browser.close();}
