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
async function scenario({cancel=false,fail=false,deliveryFail=false}={}){
 const calls=[],events=[],message={},actions={};let downloads=0;
 const modal={querySelector(selector){return actions[selector]??=( {addEventListener(){},classList:{remove(){}},value:''} );},remove(){}};
 const doc={getElementById:()=>message,createElement(tag){if(tag==='div')return modal;if(tag==='a')return {click(){downloads++},remove(){}};return {};},body:{appendChild(e){if(e===modal)queueMicrotask(()=>actions[cancel?'[data-preview-cancel]':'[data-preview-confirm]'].onclick());}},head:{appendChild(){}},addEventListener(){}};
 const window={supabaseClient:{from:()=>({select:()=>({eq:()=>({single:async()=>({data:{id:'record',prospect_name:'Cliente',contract_number:'CON-TEST',services:[]}})})})}),functions:{invoke:async(name,options)=>{calls.push({name,...options.body});if(name==='generate-commercial-document-final')return fail?{data:{generated:false,error:'Falha de emissão'}}:{data:{generated:true,documentId:'document',version:'1.0'}};return deliveryFail?{error:{message:'Falha de entrega'}}:{data:{delivered:true,contentBase64:'',fileName:'contrato.docx'}};}},rpc:async()=>({data:{contract_id:'contract'}})},dispatchEvent:e=>events.push(e)};
 vm.runInNewContext(source,{window,document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},Blob,Uint8Array,atob,URL:{createObjectURL:()=>'',revokeObjectURL(){}},setTimeout(){},Map,console});
 const a=window.CMEGenerateCommercialDocument('record','contrato',true),b=window.CMEGenerateCommercialDocument('record','contrato',true);assert.equal(a,b,'Clique duplo deve reutilizar a emissão em andamento');
 return {result:await a,calls,events,downloads,message};
}
const success=await scenario();assert.equal(success.result.ok,true);assert.equal(success.downloads,1);assert.deepEqual(success.calls.map(c=>c.name),['generate-commercial-document-final','deliver-generated-document']);assert.equal(success.calls[1].archive,true);assert.ok(success.events.some(e=>e.type==='cme:commercial-generated'));
const cancelled=await scenario({cancel:true});assert.equal(cancelled.result.cancelled,true);assert.equal(cancelled.calls.length,0);
const failed=await scenario({fail:true});assert.equal(failed.result.ok,false);assert.equal(failed.downloads,0);assert.equal(failed.message.className,'doc-status error');
const delivery=await scenario({deliveryFail:true});assert.equal(delivery.result.generated,true);assert.equal(delivery.result.ok,false);assert.ok(delivery.events.some(e=>e.type==='cme:commercial-generated'),'Histórico deve atualizar mesmo se a entrega falhar depois de emitir');
const create=read('js/commercial-documents-web.js');assert.match(create,/await window.CMEGenerateCommercialDocument\(recordId,'contrato',true\)/);assert.match(create,/if\(creating\)return/);assert.ok(!create.includes('Contrato direto criado sem orçamento anterior.'));
const start=create.indexOf('  async function createRecord()'),end=create.indexOf('  async function generate(',start);
const creation=create.slice(start,end);
async function createScenario(emission={ok:true}){
 const sequence=[],messages=[];
 const context={mode:()=> 'contrato',selectedQuoteKeys:()=>[],suggestCatalogService:()=>null,$:()=>({value:''}),form:()=>({prospect_name:'Cliente teste',services:[{code:'x',included:true}]}),sourceMode:()=> 'direct',serviceCatalogMeta:[{code:'x',level_applicable:false}],levelCatalog:[{code:'basic'}],sameQuoteOwner:()=>true,msg:(text,type)=>messages.push({text,type}),client:()=>({rpc:async name=>{sequence.push(name);return {data:'created-contract'};}}),clearForm(){},renderQuoteChoices(){},load:async()=>sequence.push('refresh'),window:{dispatchEvent(){},CMEGenerateCommercialDocument:async(id,kind,archive)=>{sequence.push({id,kind,archive});return emission;}},CustomEvent:class{}};
 await vm.runInNewContext(`(async()=>{${creation};await createRecord();})()`,context);
 assert.equal(sequence[0],'admin_create_independent_contract');assert.deepEqual(JSON.parse(JSON.stringify(sequence[1])),{id:'created-contract',kind:'contrato',archive:true});assert.equal(sequence[2],'refresh');
 return messages;
}
assert.ok(!(await createScenario()).some(m=>m.type==='success'),'Cadastro isolado não deve anunciar emissão');
assert.ok((await createScenario({ok:false,error:'Falha sintética'})).some(m=>m.type==='error'&&m.text.includes('preservado')));
const history=read('js/document-archive-web.js');assert.match(history,/addEventListener\('cme:commercial-generated',loadHistory\)/);assert.match(history,/Contratos aguardando emissão do Word/);
console.log('PASS: emissão confirmada, cancelamento, falhas, arquivo arquivado, clique duplo, histórico e primeira emissão após conversão.');
