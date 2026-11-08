import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {webcrypto,createHash} from 'node:crypto';
import path from 'node:path';
import {generateJobWorkflow} from './build-commercial-document-job.mjs';
const require=createRequire(path.resolve('portal-app/package.json'));
const JSZip=require('jszip');const ts=require('typescript');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const definitions=[['generate-commercial-document','createCommercialCoreHandler','async(req)=>{'],['generate-commercial-document-final','createCommercialFinalHandler','async req => {'],['generate-contract-document','createContractDocumentHandler','async(req)=>{'],['deliver-generated-document','createDeliveryHandler','async (req) => {']];
for(const def of definitions){
 const source=generateJobWorkflow(...def);assert.equal(source,fs.readFileSync(`supabase/functions/process-commercial-document-job/generated/${def[0]}/index.ts`,'utf8'));
 assert.ok(!source.includes('Deno.serve('));assert.ok(source.includes('await authorize(req)'));
 const errors=(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true}).diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 assert.equal(errors.length,0,'Generated handler must remain valid TypeScript');
}
const source=fs.readFileSync('supabase/functions/process-commercial-document-job/index.ts','utf8');
async function fixture(failure){
 const job={id:id(1),record_id:id(2),requested_by:id(3),original_contract_document_id:id(10),status:'processing',phase:'queued',lease_until:new Date(Date.now()+900000).toISOString()};
 const record={id:id(2),contract_document_id:id(10),linked_contract_id:id(4),total_value:1200,payment_terms:[{amount:1200}],commercial_terms:{scope:[{code:'g',deliverables:'Produtos sintéticos'}]},services:[{code:'g',included:true}]};
 const original={id:id(10),versao:'3.0',arquivo:'original.docx',storage_bucket:'documentos',contract_id:id(4),document_kind:'contrato',generated_data:{},snapshot_frozen_at:'2026-01-01'};
 const oldAnnex={id:id(11),versao:'1.0',arquivo:'old-annex.docx',storage_bucket:'documentos',contract_id:id(4),document_kind:'anexo_i',generated_data:{source_contract_document_id:id(9)},snapshot_frozen_at:'2026-01-01'};
 const docs=[original,oldAnnex],snapshots=[{document_id:id(10),snapshot:{old:true},version:'3.0'},{document_id:id(11),snapshot:{old:true},version:'1.0'}];
 const objects=new Map([['original.docx',Buffer.from('Preserved original')],['old-annex.docx',Buffer.from('Preserved annex')]]);
 let commercialCount=0,preparationCount=0,archiveCount=0,failed=false,publicHandler;
 const ok=data=>({data,error:null});
 const fake={from(table){let filters=[],op='read',payload;const rows=()=>table==='commercial_document_jobs'?[job]:table==='commercial_records'?[record]:table==='documentos'?docs:snapshots;
  const q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},update(v){op='update';payload=v;return q},single:()=>execute(true),maybeSingle:()=>execute(true),then:(a,b)=>execute(false).then(a,b)};
  async function execute(single){let data=rows().filter(row=>filters.every(f=>f(row)));if(op==='update'){
    if(failure==='checkpoint'&&!failed&&payload.contract_document_id){failed=true;throw Error('Injected lost checkpoint');}
    for(const row of data)Object.assign(row,payload);
   }return ok(single?data[0]??null:data);
  }return q;
 },storage:{from(){return {download:async name=>objects.has(name)?ok(new Blob([objects.get(name)])):{error:{message:'Missing object'}}}}},
 async rpc(_name,args){
  if(args.p_name==='admin_prepare_contract_document'){
   if(!job.annex_document_id){preparationCount++;job.annex_document_id=id(21);docs.push({id:id(21),versao:'2.0',arquivo:null,contract_id:id(4),document_kind:'anexo_i',generated_data:{...record,maintenance_job_id:job.id,source_contract_document_id:job.contract_document_id}});}
   return ok(job.annex_document_id);
  }
  if(args.p_name==='admin_commercial_closure')return ok({revisionRequired:false,...(failure==='noAnnex'?{annexRequired:false}:{}),annexCurrent:docs.find(d=>d.id===job.annex_document_id)?.generated_data.source_contract_document_id===record.contract_document_id,issues:[],emissionPending:false});
  return {data:null,error:{message:'Denied internal details',code:'42501'}};
 }};
 const word=async(text)=>{const z=new JSZip();z.file('[Content_Types].xml','<Types/>');z.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:body></w:document>');return z.generateAsync({type:'uint8array'});};
 const commercialFactory=(authorize)=>async req=>{
  await authorize(req);commercialCount++;const binary=await word('Contrato sintético versão 4.0');objects.set('new.docx',binary);
  docs.push({id:id(20),versao:'4.0',arquivo:'new.docx',storage_bucket:'documentos',generated_data:{maintenance_job_id:job.id,commercial_record_snapshot:structuredClone(record),commercial_finalization_state:'complete',word_content_sha256:sha(binary)},snapshot_frozen_at:'2026-01-02'});
  snapshots.push({document_id:id(20),snapshot:{new:true},version:'4.0'});record.contract_document_id=id(20);
  return new Response(JSON.stringify({documentId:id(20)}));
 };
 const annexFactory=authorize=>async req=>{await authorize(req);if(failure==='annex'&&!failed){failed=true;throw Error('Injected annex failure');}
  const d=docs.find(x=>x.id===job.annex_document_id);d.arquivo='new-annex.docx';d.generated_at='2026-01-02';d.snapshot_frozen_at='2026-01-02';snapshots.push({document_id:d.id,snapshot:{new:true},version:d.versao});objects.set(d.arquivo,await word('Anexo I sintético'));
  if(failure==='scope')d.generated_data.commercial_terms={wrong:true};
  if(failure==='original')objects.set('original.docx',Buffer.from('tampered'));
  return new Response(JSON.stringify({generated:true}));};
 const deliverFactory=authorize=>async req=>{await authorize(req);const d=docs.find(x=>x.id===job.annex_document_id);if(!d.archived_explicitly){archiveCount++;d.archived_explicitly=true;}if(failure==='archive'&&!failed){failed=true;throw Error('Injected delivery response loss');}return new Response('{}');};
 const ctx={exports:{},createClient:()=>fake,JSZip,createCommercialCoreHandler:()=>()=>{},createCommercialFinalHandler:commercialFactory,createContractDocumentHandler:annexFactory,createDeliveryHandler:deliverFactory,
  Deno:{serve:h=>publicHandler=h,env:{get:name=>({SUPABASE_URL:'https://qa.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-private',SUPABASE_ANON_KEY:'synthetic-public'})[name]}},
  Response,Request,TextEncoder,Uint8Array,Date,Array,Set,crypto:webcrypto,encodeBase64:bytes=>Buffer.from(bytes).toString('base64')};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;\n/gm,'').replace('export async function runDocumentJob','async function runDocumentJob')+'\nexports.run=runDocumentJob;',{mode:'strip'}),ctx);
 return {run:()=>ctx.exports.run(fake,job,'ab'.repeat(32),{url:'https://qa.invalid',anonKey:'synthetic'}),job,counts:()=>({commercialCount,preparationCount,archiveCount}),publicHandler};
}
for(const failure of [null,'checkpoint','annex','archive']){
 const f=await fixture(failure);if(failure)await assert.rejects(()=>f.run(),/Injected/);
 const result=await f.run();assert.equal(f.job.status,'completed');assert.equal(result.contract.version,'4.0');assert.equal(result.annex.version,'2.0');assert.equal(result.originalVersionsPreserved,true);
 assert.deepEqual(f.counts(),{commercialCount:1,preparationCount:1,archiveCount:1});
 console.log('PASS protected workflow: '+(failure||'success')+' preserves one contract/revision, one annex and unchanged originals.');
}
{const f=await fixture('noAnnex');const result=await f.run();assert.equal(f.job.status,'completed');assert.equal(result.annex,null);assert.equal(result.annexRequired,false);
 assert.deepEqual(f.counts(),{commercialCount:1,preparationCount:0,archiveCount:0});
 console.log('PASS protected workflow: without additional service the job completes with the main contract only (no Anexo I).');}
for(const failure of ['scope','original']){const f=await fixture(failure);await assert.rejects(()=>f.run(),/divergentes|anterior foi alterada/);assert.notEqual(f.job.status,'completed');}
const f=await fixture(null);
assert.equal((await f.publicHandler(new Request('https://qa.invalid',{method:'GET'}))).status,405);
assert.equal((await f.publicHandler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({jobId:id(1),token:'wrong'})}))).status,401);
const denied=await f.publicHandler(new Request('https://qa.invalid',{method:'POST',body:JSON.stringify({jobId:id(1),token:'ab'.repeat(32)})}));assert.equal(denied.status,403);assert.ok(!(await denied.text()).includes('internal details'));
console.log('PASS protected workflow: scope/content divergence stops completion; public route rejects invalid tokens and hides internal errors.');
