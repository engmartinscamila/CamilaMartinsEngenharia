import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';

// Execute both complete HTTP handlers. Only network, SQL/storage and Word packing
// are deterministic adapters; OOXML itself is covered by the real-file suite.
const read=p=>fs.readFileSync(p,'utf8');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const clone=v=>structuredClone(v);
const ok=data=>({data:clone(data),error:null});
async function fixture(failure,{kind='contrato',issued=true,admin=true,status='convertido',hold=false}={}){
 const record={id:id(1),record_kind:kind,contract_number:'CON-QA',quote_number:'ORC-QA',prospect_name:'Cliente sintético',
  total_value:9000,property_address:'Endereço de teste',address:'Endereço cadastral de teste',experience_level:'prata',
  services:[{code:'d',name:'Executivo',included:true}],commercial_terms:{scope:[{code:'d',deliverables:'Uma prancha executiva'}]},
  contract_document_id:kind==='contrato'&&issued?id(2):null,quote_document_id:kind==='orcamento'&&issued?id(2):null,status};
 const tables={commercial_records:[record],documentos:[],document_emission_snapshots:[],document_generation_history:[],audit_log:[],contract_master_versions:[{id:'master-qa',version:8,active:true}]};
 const objects=new Map();let sequence=10,failed=false,packed=0,backgroundCore;
 let releaseCore,markCoreStarted;
 const coreGate=new Promise(resolve=>releaseCore=resolve);
 const coreStarted=new Promise(resolve=>markCoreStarted=resolve);
 if(issued){tables.documentos.push({id:id(2),categoria:'Comercial',document_kind:kind,versao:'1.0',workflow_status:'gerado',generated_at:'2026-01-01T00:00:00Z',snapshot_frozen_at:'2026-01-01T00:00:00Z',arquivo:'_issued_word/original.docx',storage_bucket:'documentos',generated_data:{commercial_record_id:record.id,commercial_record_snapshot:clone(record),commercial_finalization_state:'complete'}});tables.document_emission_snapshots.push({id:id(3),document_id:id(2),snapshot:{original:true},version:'1.0'});objects.set('_issued_word/original.docx',new Uint8Array([1,2,3]));}
 const before=issued?clone(tables.documentos[0]):null;
 function fail(stage){if(stage===failure&&!failed){failed=true;return {error:{message:'Injected '+stage,status:503},data:null};}}
 function query(table){let operation='select',payload,filters=[];let executed;
  const q={select(){return q;},eq(k,v){filters.push(row=>row[k]===v);return q;},is(k,v){filters.push(row=>row[k]===v);return q;},neq(k,v){filters.push(row=>row[k]!==v);return q;},not(k,_op,_v){filters.push(row=>row[k]!=null);return q;},order(){return q;},limit(){return q;},
   insert(v){operation='insert';payload=v;return q;},update(v){operation='update';payload=v;return q;},delete(){operation='delete';return q;},
   single(){return execute(true);},maybeSingle(){return execute(true);},then(resolve,reject){return execute(false).then(resolve,reject);}};
  async function execute(single){if(executed)return executed;
   executed=(async()=>{
    if(table==='commercial_records'&&operation==='update'&&!payload.status&&(payload.contract_document_id||payload.quote_document_id)){const error=fail('link-update');if(error)return error;}
    if(table==='commercial_records'&&operation==='update'&&payload.status){const error=fail(tables.document_emission_snapshots.some(s=>s.document_id!==id(2))?'final-status':'core-status');if(error)return error;}
    if(table==='document_emission_snapshots'&&operation==='insert'){const error=fail('snapshot');if(error)return error;}
    if(table==='document_generation_history'&&operation==='insert'){const error=fail('history');if(error)return error;}
    if(table==='documentos'&&operation==='update'&&payload.generated_data?.commercial_finalization_state==='complete'){const error=fail('completion');if(error)return error;}
    let rows=tables[table].filter(row=>filters.every(f=>f(row)));
    if(operation==='insert'){
     const row=clone(payload);row.id??=id(sequence++);
     if(table==='documentos'){
      const previous=tables.documentos.at(-1);row.versao=previous?`${Number(previous.versao.split('.')[0])+1}.0`:'1.0';
      row.version_reason=row.generated_data?.version_reason||null;row.revision_of=previous?.id||null;
     }
     if(table==='document_emission_snapshots'&&tables[table].some(r=>r.document_id===row.document_id))return {error:{message:'duplicate key',code:'23505'},data:null};
     tables[table].push(row);rows=[row];
    }else if(operation==='update'){for(const row of rows)Object.assign(row,clone(payload));}
    else if(operation==='delete'){tables[table]=tables[table].filter(row=>!rows.includes(row));}
    return ok(single?(rows[0]??null):rows);
   })();return executed;
  }return q;
 }
 const storage={from(){return {
  async upload(path,bytes,options){
   if(path.startsWith('_issued_word/')&&path!=='_issued_word/original.docx'){const error=fail('archive');if(error)return error;}
   if(objects.has(path)&&!options?.upsert)return {error:{message:'The resource already exists',statusCode:'409'},data:null};
   objects.set(path,new Uint8Array(bytes));return ok({path});
  },async download(path){const bytes=objects.get(path);return bytes?{data:new Blob([bytes]),error:null}:{data:null,error:{message:'Object not found',statusCode:'404'}};}
 };}};
 const caller={auth:{getUser:async()=>ok({user:{id:id(90)}})},rpc:async name=>ok(name==='is_portal_admin'?admin:null)};
 const leases=new Map();
 const service={from:query,storage,rpc:async(name,args={})=>{
  const key=[args.p_record_id,args.p_kind,args.p_lane].join(':');
  const parent=[args.p_record_id,args.p_kind,'finalizer'].join(':');
  const coreKey=[args.p_record_id,args.p_kind,'core'].join(':');
  if(name==='service_acquire_commercial_emission'){
   if(args.p_lane==='finalizer'&&leases.has(coreKey))return ok(false);
   if(args.p_lane==='core'&&leases.get(parent)!==args.p_parent_token)return ok(false);
   if(leases.has(key))return ok(false);leases.set(key,args.p_token);return ok(true);
  }
  if(name==='service_release_commercial_emission'){
   if(leases.get(key)!==args.p_token)return ok(false);leases.delete(key);return ok(true);
  }
  return ok(true);
 }};
 let core,finalizer;
 const helpers={
  loadProfessionalIdentity:async()=>({full_name:'Profissional sintético'}),missingProfessionalFields:()=>[],loadContractMaster:async()=>({body:'Contrato mestre sintético'}),
  generatedDateIso:date=>date.toISOString().slice(0,10),quoteDocument:r=>r,contractDocument:r=>r,
  Packer:{toBuffer:async r=>{packed++;if((failure==='core-transport'&&!failed)||hold){markCoreStarted();await coreGate;}return Buffer.from(`word:${r.total_value}:${r.document_version}`);}},
  selectedServices:services=>services.filter(s=>s.included!==false),
  enhanceQuoteDocument:async bytes=>{const error=fail('enhancement');if(error)throw Error(error.error.message);return bytes;},enhanceContractDocument:async bytes=>{const error=fail('enhancement');if(error)throw Error(error.error.message);return bytes;}
 };
 function load(file,setHandler){
  const source=read(file).replace(/^import .*;\n/gm,'');
  vm.runInNewContext(stripTypeScriptTypes(source,{mode:'strip'}),{
   ...helpers,Deno:{env:{get:k=>({SUPABASE_URL:'https://qa.invalid',SUPABASE_ANON_KEY:'qa-public',SUPABASE_SERVICE_ROLE_KEY:'qa-private-adapter'})[k]},serve:setHandler},
   createClient:(_url,key)=>key==='qa-public'?caller:service,Response,Request,Blob,TextEncoder,Uint8Array,Date,Array,crypto:webcrypto,
   fetch:async(_url,options)=>{const request=core(new Request('https://qa.invalid/core',options));if(failure==='core-transport'&&!failed){backgroundCore=request;await coreStarted;failed=true;throw Error('Injected core transport failure');}return request;}
  });
 }
 load('supabase/functions/generate-commercial-document/index.ts',h=>core=h);
 load('supabase/functions/generate-commercial-document-final/index.ts',h=>finalizer=h);
 async function emit(){const response=await finalizer(new Request('https://qa.invalid/final',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({recordId:record.id,kind,versionReason:'Motivo interno QA'})}));return {status:response.status,body:await response.json()};}
 async function emitCore(){const response=await core(new Request('https://qa.invalid/core',{method:'POST',headers:{Authorization:'Bearer synthetic','Content-Type':'application/json'},body:JSON.stringify({recordId:record.id,kind})}));return {status:response.status,body:await response.json()};}
 return {emit,emitCore,tables,objects,record,before,packed:()=>packed,failed:()=>failed,waitCoreStarted:()=>coreStarted,settleCore:async()=>{releaseCore();if(backgroundCore)await backgroundCore;}};
}

const stages=process.env.RECOVERY_STAGE?[process.env.RECOVERY_STAGE]:['core-status','core-transport','enhancement','snapshot','archive','history','completion','final-status'];
for(const kind of ['contrato','orcamento'])for(const stage of stages){
 const f=await fixture(stage,{kind,status:stage==='final-status'?'novo':'convertido'});const first=await f.emit();await f.settleCore();
 assert.ok(first.status>=400,`${kind}/${stage}: fault must reach the caller`);assert.equal(f.failed(),true,'Fault adapter must actually run');
 const pointer=kind==='contrato'?'contract_document_id':'quote_document_id';const pending=f.record[pointer];
 assert.notEqual(pending,id(2),`${stage}: generated version must stay available for resumption`);
 assert.ok(f.tables.documentos.some(d=>d.id===pending),`${stage}: do not delete the generated Word`);
 const retry=await f.emit();assert.equal(retry.status,200,`${kind}/${stage}: ${JSON.stringify(retry.body)}`);
 assert.equal(retry.body.documentId,pending,`${stage}: retry must finish the same document`);
 assert.equal(retry.body.version,'2.0');assert.equal(f.packed(),1,'A retry resumes persisted bytes instead of rendering a new document');assert.equal(f.tables.documentos.length,2,'Retry must not create an extra revision');
 assert.equal(f.tables.document_emission_snapshots.length,2,'One immutable snapshot per version');
 assert.equal(f.tables.document_generation_history.length,1,'One successful emission in operational history');
 assert.deepEqual(f.tables.documentos[0],f.before,'Previously issued metadata stays unchanged');
 assert.deepEqual([...f.objects.get('_issued_word/original.docx')],[1,2,3],'Previously issued bytes stay unchanged');
 console.log(`PASS ${kind}: resume ${stage}, same document/version and preserved original.`);
}
for(const kind of ['contrato','orcamento']){
 const f=await fixture('archive',{kind,issued:false});assert.ok((await f.emit()).status>=400);const retry=await f.emit();
 assert.equal(retry.status,200);assert.equal(retry.body.version,'1.0');assert.equal(f.tables.documentos.length,1);assert.equal(f.tables.document_generation_history.length,1);
}
const unauthorized=await fixture(null,{admin:false});assert.equal((await unauthorized.emit()).status,403);assert.equal(unauthorized.packed(),0);
console.log('PASS: full core/finalizer recovery for first emissions, revisions and denied administrative access.');

const changed=await fixture('history');await changed.emit();changed.record.total_value=9999;const resumed=await changed.emit();
assert.equal(resumed.status,200);assert.equal(resumed.body.resumed,true);
const frozen=changed.tables.document_emission_snapshots.find(s=>s.document_id===resumed.body.documentId);
assert.equal(frozen.snapshot.commercial_record_snapshot.total_value,9000,'A resumed emission must keep its original commercial input');
const conflict=await fixture('history');await conflict.emit();const pending=conflict.record.contract_document_id;
conflict.objects.set('_issued_word/'+pending+'.docx',new Uint8Array([9,9,9]));
assert.equal((await conflict.emit()).status,500,'Never replace a conflicting immutable archive');
assert.deepEqual([...conflict.objects.get('_issued_word/'+pending+'.docx')],[9,9,9]);
console.log('PASS: resume uses saved commercial input and refuses an archive content conflict.');

for(const kind of ['contrato','orcamento']){
 const f=await fixture('core-status',{kind,issued:false,status:'novo'});assert.ok((await f.emit()).status>=400);assert.equal((await f.emit()).status,200);
 assert.equal(f.record.status,kind==='contrato'?'contrato_gerado':'orcamento_gerado','Successful resumption must finish commercial status too');
}
console.log('PASS: a resumed first emission also completes the commercial record status.');

for(const kind of ['contrato','orcamento']){
 const f=await fixture('link-update',{kind});assert.ok((await f.emit()).status>=400);
 assert.equal(f.packed(),0);assert.equal(f.tables.documentos.length,1,'Falha antes de acionar o gerador deve remover somente o rascunho não utilizado');
 assert.equal(f.record[kind==='contrato'?'contract_document_id':'quote_document_id'],id(2));
}
console.log('PASS: rollback is limited to an unused draft before the core request starts.');

for(const kind of ['contrato','orcamento']){
 const f=await fixture(null,{kind,hold:true});const first=f.emit();const second=f.emit();await f.waitCoreStarted();
 await new Promise(resolve=>setTimeout(resolve,10));await f.settleCore();
 const results=await Promise.all([first,second]);
 assert.equal(f.tables.documentos.length,2,'Requisições simultâneas não podem criar duas revisões');
 assert.deepEqual(results.map(r=>r.status).sort(),[200,423]);
 assert.equal(f.packed(),1,'Somente um núcleo pode renderizar por cadastro e tipo');
 console.log(`PASS ${kind}: simultaneous finalizers share one protected emission.`);
}

for(const kind of ['contrato','orcamento']){
 const f=await fixture('core-transport',{kind});assert.ok((await f.emit()).status>=400);
 assert.equal((await f.emit()).status,423,'Uma nova chamada não pode disputar o Word ainda em geração');
 assert.equal((await f.emitCore()).status,423,'A chamada direta ao núcleo também deve respeitar a emissão em andamento');
 assert.equal(f.packed(),1);await f.settleCore();
 const resumed=await f.emit();assert.equal(resumed.status,200);assert.equal(resumed.body.version,'2.0');assert.equal(f.tables.documentos.length,2);
 assert.equal((await f.emitCore()).status,409,'Uma versão emitida continua imutável');
 assert.equal((await f.emit()).status,200,'A recusa de reescrita precisa liberar seu controle para uma revisão legítima');
 console.log(`PASS ${kind}: immediate retry and direct core are blocked while the disconnected worker finishes; recovery and later revision succeed.`);
}
