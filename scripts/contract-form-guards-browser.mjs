// Proteções do formulário de contrato: busca por atividade, RG do cadastro no contrato,
// aviso de contrato duplicado e conferência antes de gerar o Word.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true});
const strip=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
const pageHtml=strip(fs.readFileSync('orcamentos-contratos.html','utf8'));
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:pageHtml}):route.abort());
  await page.goto('http://127.0.0.1:45999/orcamentos-contratos.html?clientId=c1&projectId=p1');
  await page.addStyleTag({content:'.doc-hidden{display:none!important}'});
  await page.evaluate(()=>{
   window.__calls=[];window.__confirms=[];window.__confirmAnswer=false;
   window.confirm=text=>{window.__confirms.push(text);return window.__confirmAnswer;};
   const tables={
    clientes:[{id:'c1',nome:'Cliente A',cpf_cnpj:'123.456.789-09',rg:'12.345.678-9',email:'a@example.invalid',endereco:'Rua do Cliente, 10'}],
    projetos:[{id:'p1',cliente_id:'c1',nome:'Obra nova',contract_id:null,endereco_obra:'Rua da Obra',numero_obra:'42',cidade_obra:'São Paulo',estado_obra:'SP',cep_obra:'01000-000'}],
    commercial_records:[{id:'r-old',record_kind:'contrato',status:'ativo',linked_client_id:'c1',contract_number:'CON-2026-01-0001',prospect_name:'Cliente A',services:[]}],
    service_catalog:[
     {code:'q',name:'Consultoria técnica',category:'Técnica',active:true,level_applicable:false,deliverables:[],exclusions:[],keywords:['parecer']},
     {code:'h',name:'Projeto hidrossanitário',category:'Projetos',active:true,level_applicable:false,deliverables:[],exclusions:[],keywords:['água','esgoto']}],
    service_level_catalog:[{code:'bronze',label:'Bronze',features:[],exclusions:[]}]};
   window.supabaseClient={from:table=>{const chain={};for(const m of ['select','eq','neq','not','order','limit','in','update'])chain[m]=()=>chain;chain.then=(ok,ko)=>Promise.resolve({data:tables[table]||[],error:null}).then(ok,ko);return chain;},
    rpc:async(name,args)=>{window.__calls.push({name,args});return {data:'r-new',error:null};}};
   window.CMEEditCommercialTerms=async()=>false;window.CMEGenerateCommercialDocument=async()=>({ok:true});
  });
  for(const helper of ['commercial-search-utils','commercial-quote-utils','commercial-record-view','commercial-legacy-quotes','commercial-download'])
   await page.addScriptTag({content:fs.readFileSync(`js/${helper}.js`,'utf8')});
  await page.addScriptTag({content:fs.readFileSync('js/commercial-documents-web.js','utf8')});
  await page.waitForFunction(()=>document.querySelector('#contractProjectId')?.value==='p1');

  // Busca por atividade: nome, palavra-chave e sem acento; vazio mostra tudo.
  const visible=()=>page.locator('#commercialServices [data-service-card]:visible').count();
  await page.locator('#openCommercialServices').click();
  assert.equal(await visible(),2);
  await page.locator('#commercialServiceSearch').fill('hidro');assert.equal(await visible(),1,'busca pelo nome');
  await page.locator('#commercialServiceSearch').fill('agua');assert.equal(await visible(),1,'busca por palavra-chave sem acento');
  await page.locator('#commercialServiceSearch').fill('inexistente xyz');assert.equal(await visible(),0);
  assert.equal(await page.locator('#commercialServiceSearchEmpty').isVisible(),true,'aviso de busca sem resultado');
  await page.locator('#commercialServiceSearch').fill('');assert.equal(await visible(),2);
  await page.locator('#cancelCommercialServices').click();

  // RG vem do cadastro do cliente.
  assert.equal(await page.locator('#rg').inputValue(),'12.345.678-9');

  await page.locator('[data-service="q"]').evaluate(input=>{input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('#totalValue').fill('12000');

  // Contrato ativo para o cliente: recusar o aviso não cria nada.
  await page.locator('#createCommercial').click();
  await page.waitForFunction(()=>window.__confirms.length===1,null,{timeout:3000}).catch(async()=>{throw new Error('msg: '+await page.locator('#commercialMessage').textContent());});
  assert.ok((await page.evaluate(()=>window.__confirms[0])).includes('CON-2026-01-0001'));
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>window.__calls.filter(c=>c.name==='admin_create_independent_contract').length),0,'sem contrato duplicado ao recusar');

  // Aceitar cria o contrato separado, com o RG.
  await page.evaluate(()=>{window.__confirmAnswer=true;});
  await page.locator('#createCommercial').click();
  await page.waitForFunction(()=>window.__calls.some(c=>c.name==='admin_create_independent_contract'));
  const call=await page.evaluate(()=>window.__calls.find(c=>c.name==='admin_create_independent_contract'));
  assert.equal(call.args.p_data.rg,'12.345.678-9');
  assert.deepEqual(errors,[]);
  await context.close();
 }

 // Conferência antes de gerar (gerador central).
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:'<div id="commercialMessage"></div>'}):route.abort());
 await page.goto('http://127.0.0.1:45999/x.html');
 await page.evaluate(()=>{
  window.__invokes=[];window.__confirms=[];window.confirm=t=>{window.__confirms.push(t);return false;};
  const base={prospect_name:'Cliente',address:'Rua A, 1',property_address:'Obra — Rua B, 2',total_value:'3000.00',
   services:[{code:'q',included:true}],linked_project_id:null};
  window.__records={
   pj:{...base,cpf_cnpj:'12.345.678/0001-95',commercial_terms:{installments:[{amount:'1500.00'},{amount:'1500.00'}],scope:[{code:'q',deliverables:'1 parecer'}]}},
   pf:{...base,cpf_cnpj:'123.456.789-09',rg:'',commercial_terms:{installments:[{amount:'1000.00'},{amount:'1500.00'}],scope:[{code:'q',deliverables:'1 parecer'}]}}};
  window.supabaseClient={from:()=>{let id='';const chain={select:()=>chain,eq:(_c,v)=>{id=v;return chain;},single:async()=>({data:window.__records[id],error:null}),maybeSingle:async()=>({data:null,error:null})};return chain;},
   functions:{invoke:async name=>{window.__invokes.push(name);return {data:null,error:{message:'não deveria chamar'}};}}};
  window.CMEEditCommercialTerms=async()=>true;
 });
 await page.addScriptTag({content:fs.readFileSync('js/commercial-document-preview-web.js','utf8')});
 const pj=await page.evaluate(()=>window.CMEGenerateCommercialDocument('pj','contrato',true));
 assert.equal(pj.ok,false);assert.match(pj.error,/Representante legal/);
 assert.equal(await page.evaluate(()=>window.__confirms.length),0,'bloqueio não pergunta');
 const pf=await page.evaluate(()=>window.CMEGenerateCommercialDocument('pf','contrato',true));
 assert.equal(pf.ok,false);assert.equal(pf.cancelled,true);
 const asked=await page.evaluate(()=>window.__confirms[0]||'');
 assert.match(asked,/RG/);assert.match(asked,/Soma das parcelas/);
 assert.deepEqual(await page.evaluate(()=>window.__invokes),[],'nada é gerado sem confirmação');
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS: busca por atividade, RG do cadastro, aviso de contrato duplicado e conferência antes de gerar (desktop/mobile).');
}finally{await browser.close();}
