import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.SITE_BASE||'http://127.0.0.1:4195';
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.CMEProjectFiles={image:()=>false};
  window.dbBuscarDocumentos=async()=>[{id:'commercial',nome:'Contrato de validação',categoria:'Comercial',cliente_id:null,projeto_id:null}];
  window.dbBuscarClientes=async()=>[];window.dbBuscarProjetos=async()=>[];
  window.supabaseClient={from(){const q={select:()=>q,order:()=>q,range:async()=>({data:[{id:'receipt',receipt_number:2,client_id:'client',project_id:null,description:'Serviço',created_at:'2026-10-31T15:00:00Z',snapshot:{payer_name:'Cliente de validação'}}]})};return q;}};
 });
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(route.request().resourceType()==='script'&&!['/js/documentos.js','/js/receipt-identity.js'].includes(url.pathname))return route.fulfill({contentType:'application/javascript',body:''});if(url.origin!==new URL(base).origin)return route.abort();return route.continue();});
 await page.goto(base+'/documentos.html',{waitUntil:'domcontentloaded'});
 const receipts=page.locator('#listaDocumentos details').filter({has:page.locator('summary', {hasText:'Recibos emitidos'})});
 await receipts.locator('summary').click();assert.match(await receipts.innerText(),/Recibo-Cliente-de-validacao-REC-000002-2026/);
 assert.equal(await receipts.locator('a').getAttribute('href'),'recibos.html?receiptId=receipt');assert.equal(await receipts.locator('[data-acao-documento="editar"],[data-acao-documento="excluir"]').count(),0);
 assert.equal(await page.locator('#listaDocumentos summary').filter({hasText:'Contratos e orçamentos'}).count(),1);
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS: pastas comerciais e recibos separadas; recibo preservado abre para download ${width}px.`);
}}finally{await browser.close();}
