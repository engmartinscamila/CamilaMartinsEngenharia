import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch({headless:true});
const pageHtml=fs.readFileSync('orcamentos-contratos.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
try{for(const width of [1440,390]){
 const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:pageHtml}):route.abort());
 await page.goto('http://127.0.0.1:45999/orcamentos-contratos.html?clientId=c1&projectId=p1');
 await page.addStyleTag({content:'.doc-hidden{display:none!important}'});
 await page.evaluate(()=>{
  window.__projectCalls=[];
  const clients=[{id:'c1',nome:'Cliente A',cpf_cnpj:'111',email:'a@example.invalid',cidade:'Cidade residencial'},{id:'c2',nome:'Cliente B'}];
  const projects=[{id:'p1',cliente_id:'c1',nome:'Obra sem contrato',contract_id:null,numero_orcamento:null,endereco_obra:'Rua da Obra',numero_obra:'42',cidade_obra:'São Paulo',estado_obra:'SP'},
   {id:'p2',cliente_id:'c2',nome:'Projeto de outro cliente',contract_id:null,endereco_obra:'Rua B'},
   {id:'p3',cliente_id:'c1',nome:'Projeto já contratado',contract_id:'ct1'}];
  const tables={clientes:clients,projetos:projects,commercial_records:[],service_catalog:[{code:'q',name:'Consultoria técnica',category:'Técnica',active:true,level_applicable:false,deliverables:[],exclusions:[]}],service_level_catalog:[{code:'bronze',label:'Bronze',features:[],exclusions:[]}]};
  window.supabaseClient={from:table=>{const chain={};for(const method of ['select','eq','not','order','limit','in'])chain[method]=()=>chain;chain.then=(resolve,reject)=>Promise.resolve({data:tables[table]||[],error:null}).then(resolve,reject);return chain;},rpc:async(name,args)=>{window.__projectCalls.push({name,args});return {data:'synthetic-contract',error:null};}};
  window.CMEEditCommercialTerms=async()=>false;window.CMEGenerateCommercialDocument=async()=>({ok:true});
 });
 for(const helper of ['commercial-search-utils','commercial-quote-utils','commercial-record-view','commercial-legacy-quotes','commercial-download']) {
  await page.addScriptTag({content:fs.readFileSync(`js/${helper}.js`,'utf8')});
 }
 await page.addScriptTag({content:fs.readFileSync('js/commercial-documents-web.js','utf8')});
 await page.waitForFunction(()=>document.querySelector('#contractProjectId')?.value==='p1');
 assert.equal(await page.locator('#contractSourceManual').isChecked(),true);
 assert.equal(await page.locator('#propertyAddress').inputValue(),'Rua da Obra, 42, São Paulo, SP');
 assert.equal(await page.locator('#contractProjectId option').count(),2,'Somente projeto ainda sem contrato deste cliente');
 assert.equal(await page.locator('#contractProjectId').isVisible(),true);
 await page.locator('[data-service="q"]').evaluate(input=>{input.checked=true;input.dispatchEvent(new Event('change',{bubbles:true}));});
 await page.locator('#totalValue').fill('12000');
 await page.locator('#createCommercial').click();
 await page.waitForFunction(()=>window.__projectCalls.some(call=>call.name==='admin_create_independent_contract'));
 const call=await page.evaluate(()=>window.__projectCalls.find(call=>call.name==='admin_create_independent_contract'));
 assert.equal(call.args.p_source_project_id,'p1');assert.equal(call.args.p_data.linked_client_id,'c1');assert.deepEqual(call.args.p_quote_ids,[]);
 assert.equal(call.args.p_data.property_address,'Rua da Obra, 42, São Paulo, SP');assert.deepEqual(errors,[]);
 await context.close();
 const classic=await browser.newContext({viewport:{width,height:950}}),projectPage=await classic.newPage();
 const projectHtml=fs.readFileSync('projetos.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<link\b[^>]*>/gi,'');
 await classic.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:projectHtml}):route.abort());
 await projectPage.goto('http://127.0.0.1:45999/projetos.html');
 await projectPage.evaluate(()=>{
  window.__createdProjects=[];window.ocultarCarregamentoPagina=()=>{};
  window.dbBuscarProjetos=async()=>[];window.dbBuscarClientes=async()=>[{id:'c1',nome:'Cliente ativo',status:'ativo'}];
  window.dbCriarProjeto=async data=>{window.__createdProjects.push(data);return {id:'p-new'};};
  window.alert=()=>{};
 });
 await projectPage.addScriptTag({content:fs.readFileSync('js/projetos.js','utf8')});
 await projectPage.evaluate(()=>document.dispatchEvent(new Event('DOMContentLoaded')));
 await projectPage.waitForFunction(()=>document.querySelector('#projetoCliente option[value="c1"]'));
 await projectPage.locator('#projetoNome').evaluate(input=>input.value='Projeto antes do contrato');
 await projectPage.locator('#projetoCliente').selectOption('c1');
 await projectPage.locator('#projetoEnderecoObra').evaluate(input=>input.value='Rua do projeto novo');
 await projectPage.locator('#projetoCriarCronograma').evaluate(input=>input.checked=false);
 assert.equal(await projectPage.locator('#projetoNumeroContrato').isVisible(),false);
 await projectPage.locator('#formProjeto').evaluate(form=>form.requestSubmit());
 await projectPage.waitForFunction(()=>window.__createdProjects.length===1);
 const saved=await projectPage.evaluate(()=>window.__createdProjects[0]);
 assert.equal(saved.cliente_id,'c1');assert.equal(saved.numero_contrato,null);assert.equal(saved.numero_orcamento,null);assert.equal(saved.endereco_obra,'Rua do projeto novo');
 await classic.close();
}console.log('PASS: desktop/mobile selecionam projeto sem orçamento, preenchem endereço da obra e enviam o mesmo UUID para o contrato, sem projetos de outro cliente ou já contratados.');
}finally{await browser.close();}
