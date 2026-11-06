import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file,deps={},globals={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,URLSearchParams,...globals,require:name=>{assert.ok(name in deps,`Unexpected dependency ${name}`);return deps[name];}});
 return exports;
}
const {groupDocumentGenerations}=load('src/lib/document-generation-history.ts');
const event=(id,documentId,version,generatedAt='2026-11-01T00:00:00Z')=>({id,documentId,version,generatedAt,storageMode:'download_only'});
const grouped=groupDocumentGenerations([event('a','doc','1.0'),event('b','doc','1.0','2026-11-02T00:00:00Z'),event('c','doc','2.0'),event('d','other','1.0'),event('e',null,'1.0'),event('f',null,'1.0')]);
assert.equal(grouped.length,5);assert.equal(grouped[0].id,'b');assert.equal(grouped[0].generationCount,2);
assert.equal(grouped.filter(item=>item.documentId===null).length,2);
let destination;
const nav=load('src/lib/admin-navigation.ts',{'react-native':{Platform:{OS:'web'}}},{window:{location:{pathname:'/portal/admin/workspace/',assign:url=>destination=url}}});
for(const view of ['entries','accounts','hours','history','fiscal']){nav.openWebsiteAdminSection('financial',{view,projectId:'project-a'});assert.equal(new URL(destination,'https://site.invalid').searchParams.get('view'),view);}
nav.openWebsiteAdminSection('financial',{view:'invalid'});assert.equal(new URL(destination,'https://site.invalid').searchParams.get('view'),'entries');
nav.openWebsiteAdminSection('receipts',{receiptId:'existing-receipt'});assert.match(destination,/receiptId=existing-receipt/);
const areas=JSON.parse(fs.readFileSync('src/lib/admin-areas.json','utf8'));
assert.ok(areas['finance-center'].groups.some(group=>group.views.some(view=>view.key==='fiscal'&&view.subview==='fiscal')));
const safe=load('src/lib/auth-return-path.ts',{'./admin-area-navigation':{adminAreas:areas},'./admin-sections':{adminSections:[{href:'/admin/finance-center'}]}}).safeAdminReturnPath;
assert.equal(safe('/admin/finance-center/?view=receipts&receiptId=existing-receipt'),'/admin/finance-center?view=receipts&receiptId=existing-receipt');
assert.equal(safe('//evil.invalid'),null);
const route=load('src/lib/notification-route.ts').notificationRoute;
for(const name of ['document-center','finance-center','asset-center','construction-schedule-measurements'])assert.equal(route(`/portal/admin/${name}/index.html?projectId=p-1`,'admin').pathname,`/admin/${name}`);
assert.equal(route('/portal/admin/finance-center/?view=receipts&receiptId=receipt-1','admin').params.receiptId,'receipt-1');
assert.equal(route('fotos.html','admin').params.tipo,'photo');
assert.equal(route('https://evil.invalid/admin/document-center','admin'),null);
assert.equal(route('/admin/document-center','client'),null);
const {readAllRows}=load('src/lib/paginated-query.ts');
const records=Array.from({length:605},(_,i)=>({id:String(i),project_id:i<600?'p-a':'p-b',document_id:`doc-${i}`,generated_at:'2026-11-01T00:00:00Z',storage_mode:'download_only'}));
const db={from(){const conditions=[];const q={select(){return q},order(){return q},not(){return q},eq(key,value){conditions.push([key,value]);return q},async range(start,end){const rows=records.filter(row=>conditions.every(([key,value])=>row[key]===value));return {data:rows.slice(start,end+1),error:null}}};return q;}};
const svc=load('src/services/document-archive-service.ts',{'@/lib/paginated-query':{readAllRows},'base64-arraybuffer':{},'@/lib/supabase':{supabase:db}});
assert.equal((await svc.listDocumentGenerationHistory()).data.length,605,'No silent 200-row cap');
const scoped=await svc.listDocumentGenerationHistory('p-b');assert.equal(scoped.data.length,5);assert.ok(scoped.data.every(row=>row.projectId==='p-b'));
const backend=fs.readFileSync('supabase/functions/archive-generated-documents/index.ts','utf8');
const block=backend.slice(backend.indexOf('function applyFilters('),backend.indexOf('\nasync function eligibleDocuments'));
const out={};vm.runInNewContext(ts.transpileModule(block+'\nexports.applyFilters=applyFilters;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{exports:out});
const calls=[],q={eq:(...args)=>{calls.push(args);return q},in:()=>q};
out.applyFilters(q,{projectId:'00000000-0000-4000-8000-000000000001'},{clientIds:null,projectIds:['another-project']});
assert.ok(calls.some(([key])=>key==='projeto_id'));
assert.throws(()=>out.applyFilters(q,{projectId:'invalid'},{clientIds:null,projectIds:null}),/Projeto inválido/);
const bridge=fs.readFileSync('src/components/admin-web-tool.tsx','utf8');
assert.equal((bridge.match(/\['projectId','financialId','receiptId'/g)||[]).length,2);
assert.ok(fs.readFileSync('src/components/admin-area.tsx','utf8').includes("?['financialId','receiptId']:"));
assert.equal((fs.readFileSync('src/app/admin/document-archive.tsx','utf8').match(/batches\.map/g)||[]).length,1,'One batch list instead of duplicated history');
console.log('PASS: receipt identity, finance subviews, notification routes, exact project history, 605-row pagination and repeated-generation grouping.');

// Client documents must remain usable before a project exists, while the
// selected-project list must not absorb documents from another project.
const clientDocuments=[
 {id:'standalone',projeto_id:null,nome:'Contrato sem projeto',created_at:'2026-11-06'},
 {id:'selected',projeto_id:'project-a',nome:'Projeto selecionado',created_at:'2026-11-05'},
 {id:'other',projeto_id:'project-b',nome:'Outro projeto',created_at:'2026-11-04'},
];
let standaloneFailure=false;
const documentDb={from(){let project;const q={select(){return q},eq(_key,value){project=value;return q},is(_key,value){project=value;return q},order(){return q},async limit(){return standaloneFailure&&project===null?{data:null,error:{code:'503'}}:{data:clientDocuments.filter(r=>r.projeto_id===project),error:null}}};return q;}};
const portal=load('src/services/portal-service.ts',{'@/lib/format':{},'@/lib/errors':{},'@/lib/env':{},'@/lib/supabase':{supabase:documentDb},'@/services/push-service':{}});
assert.deepEqual(Array.from((await portal.listClientDocuments(null)).data,r=>r.id),['standalone']);
assert.deepEqual(Array.from((await portal.listClientDocuments('project-a')).data,r=>r.id),['standalone','selected']);
standaloneFailure=true;
assert.ok((await portal.listClientDocuments('project-a')).error,'A failed standalone query must not be reported as a successful complete list');
const htmlPanel={innerHTML:'',querySelectorAll:()=>[]},listeners={},timers=[],rpcCalls=[];
vm.runInNewContext(fs.readFileSync('../js/document-acceptance-client.js','utf8'),{
 window:{supabaseClient:{rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:[{document_id:'standalone',document_name:'Contrato sem projeto',version:'1.0',lifecycle_status:'aguardando_aceite',acceptance_required:true}],error:null}}}},
 document:{readyState:'complete',getElementById:name=>name==='clientDocumentGovernance'?htmlPanel:null,addEventListener:(name,fn)=>listeners[name]=fn},
 location:{search:''},URLSearchParams,setTimeout:fn=>timers.push(fn),console,
});
for(const timer of timers)timer();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(rpcCalls[0].args.p_project_id,null);
assert.match(htmlPanel.innerHTML,/Contrato sem projeto/);
assert.ok(listeners['cm:client-area-ready'],'The acceptance panel refreshes after client authentication and area loading');
console.log('PASS: standalone document listing, selected-project filtering, failure reporting and acceptance panel without project.');
