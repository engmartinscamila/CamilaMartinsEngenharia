import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.SITE_BASE||'http://127.0.0.1:4184';
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const record={id:'service',linked_contract_id:'contract',linked_client_id:'client',contract_number:'CT-QA',prospect_name:'Cliente QA',record_kind:'contrato',services:[{code:'o',name:'Vistoria',included:true}],status:'contrato_gerado'};
  window.__calls=[];window.supabaseClient={from(table){const q=new Proxy({}, {get(_,key){if(key==='then')return resolve=>resolve({data:table==='commercial_records'?[record]:table==='contract_scope_items'?[{service_code:'o',service_name:'Vistoria',included:true}]:[],error:null});return()=>q;}});return q;},async rpc(name,args){window.__calls.push({name,args});if(name==='admin_preview_contract_document')return{data:{client_name:'Cliente QA',contract_number:'CT-QA',next_version:'1.0',scope_items:[{code:'o',name:'Vistoria'}]}};if(name==='admin_prepare_contract_document')return{data:'document'};return{data:[]};}};
 });
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(route.request().resourceType()==='script'&&!['/js/contract-documents-web.js','/js/document-options-web.js'].includes(url.pathname))return route.fulfill({contentType:'application/javascript',body:''});if(url.origin!==new URL(base).origin)return route.abort();return route.continue();});
 await page.goto(base+'/orcamentos-contratos.html#anexo_i',{waitUntil:'domcontentloaded'});
 await page.locator('#contractProject option[value="commercial:service"]').waitFor({state:'attached'});
 // The unified page hides inactive sections; activate the contractual panel for this isolated flow test.
 await page.evaluate(()=>{document.getElementById('loading')?.remove();for(const el of document.querySelectorAll('[hidden],.doc-hidden')){if(el.id!=='documentOptionsModal'){el.hidden=false;el.classList.remove('doc-hidden');}}});
 await page.locator('#contractProject').selectOption('commercial:service');
 await page.waitForFunction(()=>!document.querySelector('[data-prepare="anexo_i"]').disabled);
 await page.locator('[data-prepare="anexo_i"]').click();
 await page.getByText('Confirmar e preparar documento',{exact:true}).click();
 await page.waitForFunction(()=>window.__calls.some(c=>c.name==='admin_prepare_contract_document'));
 const calls=await page.evaluate(()=>window.__calls);
 for(const name of ['admin_preview_contract_document','admin_prepare_contract_document']){const c=calls.find(c=>c.name===name);assert.equal(c.args.p_project_id,null);assert.equal(c.args.p_extra_data.contract_id,'contract');}
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS: Anexo I sem projeto — prévia e preparação ${width}px.`);
}}finally{await browser.close();}
