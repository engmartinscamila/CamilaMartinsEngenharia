import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const core=read('supabase/functions/generate-commercial-document/index.ts');
const guard=core.slice(core.indexOf("  if(kind==='contrato'&&firstRead.data.contract_document_id)"),core.indexOf("  if(kind==='contrato'){const assigned="));
async function checkGuard(record,previous,frozen=null){return vm.runInNewContext(`(async()=>{${guard};return {status:200};})()`,{kind:'contrato',firstRead:{data:record},service:{from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:table==='documentos'?previous:frozen})})})})},json:(_body,status)=>({status})});}
assert.equal((await checkGuard({status:'convertido',contract_document_id:null})).status,200,'Primeira emissão após conversão deve funcionar');
assert.equal((await checkGuard({contract_document_id:'draft'},{workflow_status:'rascunho'})).status,200,'Revisão em rascunho deve funcionar');
assert.equal((await checkGuard({contract_document_id:'issued'},{id:'issued'},{id:'snapshot'})).status,409,'Documento emitido deve permanecer imutável');
assert.equal((await checkGuard({status:'convertido',contract_document_id:'partial'},{id:'partial',workflow_status:'gerado',generated_at:'2026-10-31'})).status,200,'Falha parcial antes do snapshot deve permitir nova tentativa');
const source=read('js/commercial-document-preview-web.js');
const checkStart=source.indexOf('function validateContractScopeForPreview(');
const checkEnd=source.indexOf('async function preview(',checkStart);
assert.ok(checkStart>=0&&checkEnd>checkStart,'Prévia precisa conferir serviços antes de gerar revisão.');
const checkPreview=vm.runInNewContext(source.slice(checkStart,checkEnd)+';validateContractScopeForPreview;');
const incompatible={services:[{code:'u',name:'Levantamento Técnico',included:true},{code:'am',name:'Projeto Hidráulico',included:true}],commercial_terms:{scope:[{code:'u',deliverables:'Elaboração de projeto arquitetônico para projeto executivo e maquete tridimensional'},{code:'am',deliverables:'Prancha de projeto hidráulico executivo'}]}};
const pending=checkPreview(incompatible);
assert.equal(pending.length,1,'Prévia deve identificar a única classificação incompatível, sem bloquear atividade hidráulica correta.');
assert.equal(pending[0].code,'u');
assert.equal(pending[0].kind,'classification');
const waterAndSewage={services:[{code:'am',name:'Projeto Hidráulico',included:true}],commercial_terms:{scope:[{code:'am',deliverables:'Prancha hidráulica de água e esgoto sanitário'}]}};
assert.equal(checkPreview(waterAndSewage)[0].code,'am','Água e esgoto não podem ser emitidos como somente hidráulico');
const corrected={services:[{code:'g',name:'Projeto Hidrossanitário',included:true}],commercial_terms:{scope:[{code:'g',deliverables:'Prancha hidráulica de água e esgoto sanitário'}]}};
assert.equal(checkPreview(corrected).length,0,'Classificação corrigida deve permitir a prévia');
const finalizer=read('supabase/functions/generate-commercial-document-final/index.ts');
const backendBlock=finalizer.slice(finalizer.indexOf('      for (const item of selected) {'),finalizer.indexOf('    pointerField ='));
const backendValidation=record=>vm.runInNewContext('(function(){if(true){'+backendBlock+';return json({ok:true},200)})()',{
 selected:record.services,scope:record.commercial_terms.scope,text:v=>String(v??'').trim(),json:(body,status)=>({body,status})
});
assert.equal(backendValidation(waterAndSewage).status,422,'Servidor deve bloquear antes de criar qualquer revisão');
assert.equal(backendValidation(corrected).status,200);
const waterOnlyWithExclusion={services:[{code:'am',name:'Projeto Hidráulico',included:true}],commercial_terms:{scope:[{code:'am',deliverables:'Projeto de água fria; não inclui projeto de esgoto sanitário'}]}};
assert.equal(checkPreview(waterOnlyWithExclusion).length,0,'Exclusão explícita de esgoto não equivale à contratação de esgoto');
assert.equal(backendValidation(waterOnlyWithExclusion).status,200);

assert.equal(backendValidation({services:[{code:'am',name:'Projeto Hidráulico'}],commercial_terms:{scope:[{code:'am',deliverables:'Projeto de abastecimento de água fria'}]}}).status,200);

assert.ok(source.includes('data-preview-correct')&&source.includes('CMECorrectCommercialServiceClassification'),'O bloqueio deve oferecer correção direta.');
assert.ok(source.includes("disabled title="),'Confirmação deve ficar desabilitada enquanto houver inconsistências.');
async function scenario({cancel=false,fail=false,deliveryFail=false,pending=false}={}){
 const calls=[],events=[],message={},actions={};let downloads=0;
 const modal={querySelector(selector){return actions[selector]??=( {addEventListener(){},classList:{remove(){}},value:''} );},querySelectorAll(){return[];},remove(){}};
 const doc={getElementById:()=>message,createElement(tag){if(tag==='div')return modal;if(tag==='a')return {click(){downloads++},remove(){}};return {};},body:{appendChild(e){if(e===modal)queueMicrotask(()=>actions[cancel?'[data-preview-cancel]':'[data-preview-confirm]'].onclick());}},head:{appendChild(){}},addEventListener(){}};
 const recordInfo={id:'record',prospect_name:'Cliente',contract_number:'CON-TEST',services:[],contract_document_id:pending?'document':null,commercial_terms:{installments:[{amount:'1.00',due_event:'na assinatura'}]}};
 const documentInfo={id:'document',versao:'2.0',generated_at:'2026-01-01T00:00:00Z',generated_data:{commercial_record_snapshot:{...recordInfo,prospect_name:'Cliente congelado',property_address:'Rua congelada'},commercial_finalization_state:'pending'}};
 const window={supabaseClient:{from:table=>({select:()=>({eq:()=>({single:async()=>({data:recordInfo}),maybeSingle:async()=>({data:table==='documentos'?documentInfo:{id:'snapshot'}})})})}),functions:{invoke:async(name,options)=>{calls.push({name,...options.body});if(name==='generate-commercial-document-final')return fail?{data:{generated:false,error:'Falha de emissão'}}:{data:{generated:true,documentId:'document',version:pending?'2.0':'1.0',resumed:pending}};return deliveryFail?{error:{message:'Falha de entrega'}}:{data:{delivered:true,contentBase64:'',fileName:'contrato.docx'}};}},rpc:async()=>({data:{contract_id:'contract'}})},dispatchEvent:e=>events.push(e)};
 vm.runInNewContext(source,{window,document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Blob,Uint8Array,atob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},setTimeout(){},Map,console});
 const a=window.CMEGenerateCommercialDocument('record','contrato',true),b=window.CMEGenerateCommercialDocument('record','contrato',true);assert.equal(a,b,'Clique duplo deve reutilizar a emissão em andamento');
 return {result:await a,calls,events,downloads,message,previewHtml:modal.innerHTML};
}
const success=await scenario();assert.equal(success.result.ok,true);assert.equal(success.downloads,1);assert.deepEqual(success.calls.map(c=>c.name),['generate-commercial-document-final','deliver-generated-document']);assert.equal(success.calls[1].archive,true);assert.ok(success.events.some(e=>e.type==='cme:commercial-generated'));
const resumed=await scenario({pending:true});assert.equal(resumed.result.ok,true);assert.equal(resumed.calls[0].versionReason,'','Retomada não pode exigir motivo de uma revisão inexistente');assert.ok(resumed.message.textContent.includes('Emissão pendente concluída'));assert.ok(resumed.previewHtml.includes('Cliente congelado')&&resumed.previewHtml.includes('Rua congelada'),'Prévia da retomada precisa reproduzir os dados congelados, não os atuais');
const cancelled=await scenario({cancel:true});assert.equal(cancelled.result.cancelled,true);assert.equal(cancelled.calls.length,0);
const failed=await scenario({fail:true});assert.equal(failed.result.ok,false);assert.equal(failed.downloads,0);assert.equal(failed.message.className,'doc-status error');
const delivery=await scenario({deliveryFail:true});assert.equal(delivery.result.generated,true);assert.equal(delivery.result.ok,false);assert.ok(delivery.events.some(e=>e.type==='cme:commercial-generated'),'Histórico deve atualizar mesmo se a entrega falhar depois de emitir');
const create=read('js/commercial-documents-web.js');assert.match(create,/await window.CMEGenerateCommercialDocument\(recordId,'contrato',true\)/);assert.match(create,/if\(creating\)return/);assert.ok(!create.includes('Contrato direto criado sem orçamento anterior.'));
const start=create.indexOf('  async function createRecord()'),end=create.indexOf('  async function generate(',start);
const creation=create.slice(start,end);
async function createScenario(emission={ok:true}){
 const sequence=[],messages=[];
 const context={mode:()=> 'contrato',selectedQuoteKeys:()=>[],suggestCatalogService:()=>null,$:()=>({value:''}),form:()=>({prospect_name:'Cliente teste',services:[{code:'x',included:true}]}),sourceMode:()=> 'direct',serviceCatalogMeta:[{code:'x',level_applicable:false}],levelCatalog:[{code:'basic'}],sameQuoteOwner:()=>true,msg:(text,type)=>messages.push({text,type}),client:()=>({rpc:async name=>{sequence.push(name);return {data:'created-contract'};}}),clearForm(){},renderQuoteChoices(){},load:async()=>sequence.push('refresh'),window:{dispatchEvent(){},CMEEditCommercialTerms:async()=>{sequence.push('terms-saved');return true;},CMEGenerateCommercialDocument:async(id,kind,archive)=>{sequence.push({id,kind,archive});return emission;}},CustomEvent:class{}};
 await vm.runInNewContext(`(async()=>{${creation};await createRecord();})()`,context);
 assert.equal(sequence[0],'admin_create_independent_contract');assert.equal(sequence[1],'terms-saved','O editor deve ser concluído antes da emissão');assert.deepEqual(JSON.parse(JSON.stringify(sequence[2])),{id:'created-contract',kind:'contrato',archive:true});assert.equal(sequence[3],'refresh');
 return messages;
}
assert.ok(!(await createScenario()).some(m=>m.type==='success'),'Cadastro isolado não deve anunciar emissão');
assert.ok((await createScenario({ok:false,error:'Falha sintética'})).some(m=>m.type==='error'&&m.text.includes('preservado')));
const history=read('js/document-archive-web.js');assert.match(history,/addEventListener\('cme:commercial-generated',loadHistory\)/);assert.match(history,/Contratos aguardando emissão do Word/);
console.log('PASS: emissão confirmada, cancelamento, falhas, arquivo arquivado, clique duplo, histórico e primeira emissão após conversão.');
