import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=new URL(process.env.SITE_BASE||'http://127.0.0.1:4173');
assert.ok(['127.0.0.1','localhost'].includes(base.hostname),'Synthetic test must stay local');
const browser=await chromium.launch({headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
 await page.addInitScript(()=>{
  window.closureCalls=[];window.closureEmissions=0;
  const plan={recordId:'record-qa',projectId:'p-qa',number:'CON-QA',clientId:'client-qa',clientName:'Cliente sintético',token:'token-qa',version:'3.0',total:12000,emitted:true,contractReady:true,annexCurrent:false,accessReady:false,revisionRequired:true,
   issues:[{code:'am',name:'Hidráulico',kind:'classification',current:'Água e esgoto',targetCode:'g',targetName:'Projeto Hidrossanitário',targetIncluded:false,message:'Conferir enquadramento'},
    {code:'u',name:'Levantamento',kind:'scope',current:'Projeto executivo e maquete',suggestion:'Planta cadastral cotada dos ambientes medidos',canRemove:true,message:'Conferir entregáveis'}]};
  window.closureMarkIssued=()=>{plan.revisionRequired=false;plan.emitted=true;};
  window.closureMarkPending=()=>{plan.revisionRequired=false;plan.emitted=false;};
  let pending=[{id:'p-qa',name:'Projeto existente',clientName:'Cliente sintético',number:'CON-QA',address:'Rua original',token:'project-token',candidates:[{id:'contract-qa',number:'CON-QA',numberMatch:true,service:'Projeto contratado',address:'Endereço comercial diferente'}]}];
  window.CMEGenerateCommercialDocument=()=>window.closureEmissions++;
  window.supabaseClient={rpc:async(name,args)=>{
   window.closureCalls.push({name,args});
   if(name==='admin_commercial_closure')return {data:JSON.parse(JSON.stringify(plan)),error:null};
   if(name==='admin_resolve_commercial_closure'){plan.issues=plan.issues.filter(i=>i.code!==args.p_code);return {data:JSON.parse(JSON.stringify(plan)),error:null};}
   if(name==='admin_project_contract_closure')return {data:JSON.parse(JSON.stringify(pending)),error:null};
   if(name==='admin_link_existing_project_contract'){pending=[];return {data:{linked:true},error:null};}
   return {data:null,error:{message:'Chamada não prevista no fixture'}};
  }};
  document.addEventListener('DOMContentLoaded',()=>{document.getElementById('loading')?.remove();const b=document.createElement('button');b.dataset.closureRecord='record-qa';b.textContent='Resolver contrato sintético';document.querySelector('.doc-shell').prepend(b);});
 });
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==base.origin)return route.abort();if(route.request().resourceType()==='script'&&url.pathname!=='/js/management-closure-web.js')return route.fulfill({contentType:'application/javascript',body:''});return route.continue();});
 await page.goto(new URL('/orcamentos-contratos.html',base).href);
 await page.getByRole('button',{name:'Resolver contrato sintético',exact:true}).click();
 await page.getByRole('button',{name:'Reclassificar como Projeto Hidrossanitário',exact:true}).click();
 await page.getByRole('button',{name:'Usar esses entregáveis no levantamento',exact:true}).click();
 await page.getByRole('button',{name:'Preparar nova revisão do contrato',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Preparar Anexo I deste contrato',exact:true}).isDisabled(),true,'Escopo corrigido precisa de nova emissão antes do Anexo I');
 await page.getByRole('button',{name:'Atualizar diagnóstico',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Preparar Anexo I deste contrato',exact:true}).isDisabled(),true,'Finalizar ação não pode reabilitar avanço bloqueado');

 await page.evaluate(()=>window.closureMarkPending());
 await page.getByRole('button',{name:'Atualizar diagnóstico',exact:true}).click();
 await page.getByRole('button',{name:'Preparar contrato Word',exact:true}).waitFor();
 assert.equal(await page.locator('[data-annex]').count(),0,'Finalização pendente não permite preparar Anexo I');
 await page.evaluate(()=>window.closureMarkIssued());
 await page.getByRole('button',{name:'Atualizar diagnóstico',exact:true}).click();
 await page.locator('[data-annex]:not([disabled])').waitFor();
 assert.equal(await page.getByRole('button',{name:'Preparar Anexo I deste contrato',exact:true}).isEnabled(),true,'Emissão atual permite preparar o Anexo I');

 assert.equal(await page.evaluate(()=>window.closureEmissions),0,'Repairs never emit or sign a new contract automatically');
 const resolutions=await page.evaluate(()=>window.closureCalls.filter(c=>c.name==='admin_resolve_commercial_closure'));
 assert.equal(resolutions.length,2);assert.equal(resolutions[0].args.p_target_code,'g');assert.equal(resolutions[1].args.p_action,'use_approved_deliverables');
 const box=await page.locator('.closure-dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1,'Modal fits desktop and mobile');
 await page.getByRole('button',{name:'Resolver vínculos de projetos',exact:true}).click();
 await page.locator('.closure-dialog').getByRole('combobox').selectOption('contract-qa');
 await page.getByRole('button',{name:'Vincular este projeto',exact:true}).click();
 await page.getByText('Selecione o contrato e confirme a conferência da abrangência e dos endereços.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.closureCalls.filter(c=>c.name==='admin_link_existing_project_contract').length),0);
 await page.locator('.closure-dialog').getByRole('checkbox').check();await page.getByRole('button',{name:'Vincular este projeto',exact:true}).click();
 await page.getByText('✓ Todos os projetos possuem vínculo contratual.',{exact:true}).waitFor();
 const links=await page.evaluate(()=>window.closureCalls.filter(c=>c.name==='admin_link_existing_project_contract'));assert.equal(links.length,1);assert.equal(links[0].args.p_expected_token,'project-token');
 assert.deepEqual(errors,[]);await page.close();console.log(`PASS: assisted contract repair and explicit project linking at ${width}px, without unsolicited emission or duplicate projects.`);
}}finally{await browser.close();}
