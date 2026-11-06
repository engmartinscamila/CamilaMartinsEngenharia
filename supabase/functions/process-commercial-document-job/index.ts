import {createClient} from 'supabase';
import JSZip from 'jszip';
import {encodeBase64} from 'jsr:@std/encoding@1/base64';
import {createCommercialCoreHandler} from './generated/generate-commercial-document/index.ts';
import {createCommercialFinalHandler} from './generated/generate-commercial-document-final/index.ts';
import {createContractDocumentHandler} from './generated/generate-contract-document/index.ts';
import {createDeliveryHandler} from './generated/deliver-generated-document/index.ts';

type Obj=Record<string,any>;
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const hash=async(bytes:Uint8Array)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
const fail=(message:string):never=>{throw new Error(message);};

export async function runDocumentJob(service:any,job:Obj,token:string,settings:Obj){
 const caller={rpc:(name:string,args:Obj)=>service.rpc('service_commercial_document_job_rpc',{p_id:job.id,p_token:token,p_name:name,p_args:args})};
 const jobRpc=async(name:string,args:Obj={})=>{const r=await caller.rpc(name,args);if(r.error)throw r.error;return r.data;};
 const read=async(table:string,id:string,columns='*')=>{const r=await service.from(table).select(columns).eq('id',id).single();if(r.error)throw r.error;return r.data;};
 const checkpoint=async(patch:Obj)=>{const r=await service.from('commercial_document_jobs').update({...patch,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','processing').select('id').single();if(r.error)throw r.error;Object.assign(job,patch);};
 const request=(body:Obj)=>new Request('https://internal.invalid/document-job',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const authorize=(area:string)=>async(req:Request)=>{
  if(Date.now()>=Date.parse(job.lease_until))fail('Execução expirada.');
  const body=await req.clone().json();
  if(area==='commercial'&&(body.recordId!==job.record_id||body.kind!=='contrato'))fail('Cadastro fora da execução autorizada.');
  if(area==='annex'&&(body.documentId!==job.annex_document_id||body.action!=='generate'||body.expectedDocumentKind!=='anexo_i'))fail('Anexo fora da execução autorizada.');
  if(area==='delivery'&&(body.documentId!==job.annex_document_id||body.archive!==true||body.expectedDocumentKind!=='anexo_i'))fail('Entrega fora da execução autorizada.');
  return {caller,service,user:{id:job.requested_by,maintenanceJobId:job.id},authorization:'Bearer internal-job',url:settings.url,anonKey:settings.anonKey};
 };
 const core=createCommercialCoreHandler(authorize('commercial'));
 const commercial=createCommercialFinalHandler(authorize('commercial'),async(_url:string,_key:string,_auth:string,body:Obj)=>{const response=await core(request(body));return {response,data:await response.json()};});
 const annex=createContractDocumentHandler(authorize('annex'));
 const deliver=createDeliveryHandler(authorize('delivery'));
 const call=async(handler:(req:Request)=>Promise<Response>,body:Obj)=>{const response=await handler(request(body));const data=await response.json();if(!response.ok)fail(String(data.error||'Falha na emissão.'));return data;};
 const bytes=async(d:Obj)=>{if(!d.arquivo)fail('Arquivo documental ausente.');const r=await service.storage.from(d.storage_bucket||'documentos').download(d.arquivo);if(r.error||!r.data)throw r.error||new Error('Arquivo indisponível.');return new Uint8Array(await r.data.arrayBuffer());};
 const snapshot=async(id:string)=>{const r=await service.from('document_emission_snapshots').select('snapshot,version,snapshot_hash').eq('document_id',id).maybeSingle();if(r.error)throw r.error;return r.data;};
 const manifest=async(ids:string[])=>{
  const rows=[];
  for(const id of ids){const d=await read('documentos',id);const s=await snapshot(id);const binary=await bytes(d);
   rows.push({id,version:d.versao,path:d.arquivo,binary_sha256:await hash(binary),snapshot_sha256:await hash(new TextEncoder().encode(JSON.stringify(s)))});
  }return rows;
 };
 const inspect=async(id:string)=>{
  const d=await read('documentos',id);const binary=await bytes(d);
  const zip=await JSZip.loadAsync(binary,{checkCRC32:true});
  if(!zip.file('[Content_Types].xml')||!zip.file('word/document.xml'))fail('Pacote Word incompleto.');
  const xml=await zip.file('word/document.xml')!.async('string');
  if(!xml.includes('<w:document')||!xml.includes('</w:document>'))fail('Documento Word estruturalmente inválido.');
  if(xml.includes('Atualização do escopo e sincronização contratual.'))fail('Motivo interno de revisão apareceu no Word.');
  const s=await snapshot(id);if(!s||!d.snapshot_frozen_at)fail('Emissão sem snapshot congelado.');
  return {documentId:id,version:d.versao,sha256:await hash(binary),bytes:binary.length,zipValid:true,path:d.arquivo};
 };

 if(!job.original_manifest){
  const r=await read('commercial_records',job.record_id);
  const old=await service.from('documentos').select('id').eq('contract_id',r.linked_contract_id).eq('document_kind','anexo_i');if(old.error)throw old.error;
  const ids=[...new Set<string>([job.original_contract_document_id,...old.data.map((x:Obj)=>x.id)])];
  await checkpoint({original_manifest:await manifest(ids),phase:'preserved'});
 }
 const r=await read('commercial_records',job.record_id);
 let issued:Obj|null=null;
 if(!job.contract_document_id&&r.contract_document_id!==job.original_contract_document_id){
  const candidate=await read('documentos',r.contract_document_id);
  if(candidate.generated_data?.maintenance_job_id!==job.id)fail('Outra revisão alterou o contrato durante a execução.');
  if(candidate.generated_data?.commercial_finalization_state==='complete'&&await snapshot(candidate.id))issued=candidate;
 }
 if(!job.contract_document_id){
  if(!issued){
   const result=await call(commercial,{recordId:job.record_id,kind:'contrato',versionReason:'Atualização do escopo e sincronização contratual.'});
   issued=await read('documentos',result.documentId);
  }
  if(issued!.generated_data?.maintenance_job_id!==job.id)fail('Revisão não corresponde à execução.');
  await checkpoint({contract_document_id:issued!.id,phase:'contract_done'});
 }
 const current=await read('commercial_records',job.record_id);
 if(current.contract_document_id!==job.contract_document_id)fail('A versão atual do contrato mudou durante a execução.');
 const newContract=await read('documentos',job.contract_document_id);
 const agreed=newContract.generated_data?.commercial_record_snapshot;
 if(!agreed||newContract.generated_data?.commercial_finalization_state!=='complete')fail('Contrato ainda não foi concluído.');
 if(!same(agreed.total_value,current.total_value)||!same(agreed.payment_terms,current.payment_terms))fail('Valor ou parcelamento divergente.');
 const oldContract=await read('documentos',job.original_contract_document_id);
 if(newContract.versao===oldContract.versao)fail('A revisão anterior não foi preservada.');

 if(!job.annex_document_id){
  const id=await jobRpc('admin_prepare_contract_document');
  if(!uuid(id))fail('Preparação do Anexo I não retornou um documento válido.');
  job.annex_document_id=id;
 }
 let annexRow=await read('documentos',job.annex_document_id);
 if(annexRow.generated_data?.source_contract_document_id!==job.contract_document_id)fail('Anexo I vinculado a outra revisão.');
 if(!annexRow.generated_at||!await snapshot(annexRow.id))await call(annex,{documentId:annexRow.id,action:'generate',expectedDocumentKind:'anexo_i'});
 await checkpoint({phase:'annex_generated'});
 await call(deliver,{documentId:annexRow.id,archive:true,expectedDocumentKind:'anexo_i'});
 annexRow=await read('documentos',annexRow.id);
 if(!same(annexRow.generated_data?.commercial_terms,agreed.commercial_terms)||!same(annexRow.generated_data?.services,agreed.services)||!same(annexRow.generated_data?.payment_terms,agreed.payment_terms))fail('Escopo ou condições divergentes entre contrato e Anexo I.');
 const contractCheck=await inspect(job.contract_document_id);const annexCheck=await inspect(annexRow.id);
 if(newContract.generated_data.word_content_sha256!==contractCheck.sha256)fail('Hash do contrato não corresponde ao arquivo armazenado.');
 if(!same(job.original_manifest,await manifest(job.original_manifest.map((m:Obj)=>m.id))))fail('Uma versão anterior foi alterada.');
 const diagnosis=await jobRpc('admin_commercial_closure');
 if(diagnosis.revisionRequired||!diagnosis.annexCurrent||diagnosis.emissionPending||diagnosis.issues?.length)fail('A conferência final apontou pendência documental.');
 const result={contract:contractCheck,annex:annexCheck,originalVersionsPreserved:true,scopeAndPaymentsConsistent:true,revisionRequired:false,annexCurrent:true};
 await checkpoint({phase:'completed',status:'completed',lease_until:null,result});
 return result;
}

Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 let service:any,job:Obj|null=null;
 try{
  const raw=await req.text();if(raw.length>4096)return json({error:'Requisição inválida.'},413);
  const body=JSON.parse(raw);
  if(!uuid(body.jobId)||typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))return json({error:'Execução não autorizada.'},401);
  const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),anonKey=Deno.env.get('SUPABASE_ANON_KEY');
  if(!url||!key||!anonKey)throw new Error('Configuração segura ausente.');
  service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const claimed=await service.rpc('service_claim_commercial_document_job',{p_id:body.jobId,p_token:body.token});
  if(claimed.error)return json({error:'Execução indisponível ou não autorizada.'},claimed.error.code==='55P03'?423:403);
  job=claimed.data;
  if(job!.status==='completed'){
   if(body.action==='review'){
    const files=[];
    for(const id of [job!.contract_document_id,job!.annex_document_id]){
     const d=await service.from('documentos').select('id,arquivo,storage_bucket,versao,document_kind').eq('id',id).single();if(d.error)throw d.error;
     const f=await service.storage.from(d.data.storage_bucket||'documentos').download(d.data.arquivo);if(f.error||!f.data)throw f.error||new Error('Arquivo indisponível.');
     const bytes=new Uint8Array(await f.data.arrayBuffer());if(bytes.length>20*1024*1024)throw new Error('Arquivo acima do limite de revisão.');
     files.push({documentId:id,kind:d.data.document_kind,version:d.data.versao,sha256:await hash(bytes),contentBase64:encodeBase64(bytes)});
    }
    return json({jobId:job!.id,files});
   }
   return json({jobId:job!.id,completed:true,result:job!.result});
  }
  const result=await runDocumentJob(service,job!,body.token,{url,anonKey});
  return json({jobId:job!.id,completed:true,result});
 }catch(error){
  // Do not log raw requests, tokens, SQL errors or customer data.
  const message=String((error as any)?.message||'Falha na execução documental.').slice(0,500);
  if(service&&job)await service.from('commercial_document_jobs').update({status:'failed',lease_until:null,last_error:message,updated_at:new Date().toISOString()}).eq('id',job.id).eq('status','processing');
  return json({error:'Não foi possível concluir a execução documental. Consulte o diagnóstico administrativo.'},500);
 }
});
