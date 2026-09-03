import { createClient } from 'supabase';
import JSZip from 'jszip';

const corsHeaders={
 'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')??'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});
type Obj=Record<string,unknown>;
function env(){const url=Deno.env.get('SUPABASE_URL'),anonKey=Deno.env.get('SUPABASE_ANON_KEY'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!anonKey||!serviceKey)throw new Error('Configuração segura ausente.');return {url,anonKey,serviceKey};}
async function requireAdmin(req:Request){const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))throw new Error('Sessão administrativa ausente.');const {url,anonKey,serviceKey}=env();const caller=createClient(url,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});const {data:userData,error:userError}=await caller.auth.getUser();if(userError||!userData.user)throw new Error('Sessão administrativa inválida.');const {data:isAdmin,error:adminError}=await caller.rpc('is_portal_admin');if(adminError||isAdmin!==true)throw new Error('Acesso administrativo necessário.');return {authorization,url,anonKey,service:createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),user:userData.user};}
const text=(v:unknown)=>String(v??'').trim();
const xmlEsc=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
async function proxyCore(url:string,anonKey:string,authorization:string,body:unknown){const response=await fetch(`${url}/functions/v1/generate-commercial-document`,{method:'POST',headers:{Authorization:authorization,apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});let data:Obj={};try{data=await response.json()}catch{data={error:'Resposta inválida do gerador comercial principal.'}}return {response,data};}
async function replaceContractAddress(bytes:Uint8Array,address:string|null,propertyAddress:string){const zip=await JSZip.loadAsync(bytes);const file=zip.file('word/document.xml');if(!file)return bytes;let xml=await file.async('string');const oldAddress=address?.trim()||'Não informado';const oldPhrase=`com endereço em ${xmlEsc(oldAddress)}`;const newPhrase=`com endereço do imóvel/obra em ${xmlEsc(propertyAddress)}`;if(xml.includes(oldPhrase))xml=xml.replace(oldPhrase,newPhrase);else if(xml.includes(xmlEsc(oldAddress)))xml=xml.replace(xmlEsc(oldAddress),xmlEsc(propertyAddress));zip.file('word/document.xml',xml);return await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});}
async function sha256(value:unknown){const raw=new TextEncoder().encode(JSON.stringify(value));const digest=await crypto.subtle.digest('SHA-256',raw);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 let createdRevisionId:string|null=null;let previousDocumentId:string|null=null;let pointerField='';
 try{
  const {authorization,url,anonKey,service,user}=await requireAdmin(req);const body=await req.json() as Obj;const recordId=text(body.recordId);const kind=body.kind==='contrato'?'contrato':'orcamento';if(!/^[0-9a-f-]{36}$/i.test(recordId))return json({error:'Registro comercial inválido.'},400);
  const source=await service.from('commercial_records').select('*').eq('id',recordId).maybeSingle();if(source.error)throw source.error;if(!source.data)return json({error:'Registro comercial não encontrado.'},404);
  if(kind==='contrato'&&!text(source.data.property_address))return json({error:'Informe o endereço do imóvel / obra antes de gerar o contrato.'},422);
  pointerField=kind==='contrato'?'contract_document_id':'quote_document_id';previousDocumentId=text(source.data[pointerField])||null;
  if(previousDocumentId){
   const frozen=await service.from('document_emission_snapshots').select('id').eq('document_id',previousDocumentId).maybeSingle();if(frozen.error)throw frozen.error;
   if(frozen.data){
    const reason=text(body.versionReason);if(!reason)return json({error:'Informe o motivo da nova versão antes de gerar novamente.'},422);
    const old=await service.from('documentos').select('*').eq('id',previousDocumentId).single();if(old.error)throw old.error;
    const oldData=(old.data.generated_data&&typeof old.data.generated_data==='object'?old.data.generated_data:{}) as Obj;
    const inserted=await service.from('documentos').insert({cliente_id:old.data.cliente_id,projeto_id:old.data.projeto_id,contract_id:old.data.contract_id,approval_id:old.data.approval_id,nome:old.data.nome,tipo:old.data.tipo,categoria:old.data.categoria||'Comercial',versao:'1.0',storage_bucket:old.data.storage_bucket||'documentos',permitir_download:old.data.permitir_download!==false,protection_mode:old.data.protection_mode||'administrative',autoral:old.data.autoral===true,document_kind:kind,workflow_status:'rascunho',optional_document:old.data.optional_document===true,generated_data:{...oldData,commercial_document_kind:kind,commercial_record_id:recordId,version_bump:body.versionBump==='major'?'major':'minor',version_reason:reason}}).select('id,versao').single();if(inserted.error)throw inserted.error;createdRevisionId=inserted.data.id;
    const linked=await service.from('commercial_records').update({[pointerField]:createdRevisionId}).eq('id',recordId);if(linked.error)throw linked.error;
   }
  }
  const core=await proxyCore(url,anonKey,authorization,{recordId,kind});
  if(!core.response.ok){if(createdRevisionId&&previousDocumentId){await service.from('commercial_records').update({[pointerField]:previousDocumentId}).eq('id',recordId);await service.from('documentos').delete().eq('id',createdRevisionId)}return json(core.data,core.response.status)};
  const documentId=text(core.data.documentId);if(!/^[0-9a-f-]{36}$/i.test(documentId))throw new Error('Documento comercial gerado sem vínculo documental válido.');
  const doc=await service.from('documentos').select('id,arquivo,storage_bucket,generated_data,versao,version_reason,document_kind').eq('id',documentId).single();if(doc.error)throw doc.error;if(!doc.data.arquivo)throw new Error('O documento foi preparado sem arquivo Word.');const bucket=doc.data.storage_bucket||'documentos';
  if(kind==='contrato'){
   const downloaded=await service.storage.from(bucket).download(doc.data.arquivo);if(downloaded.error||!downloaded.data)throw downloaded.error??new Error('Não foi possível abrir o contrato recém-gerado.');let bytes=new Uint8Array(await downloaded.data.arrayBuffer());bytes=await replaceContractAddress(bytes,source.data.address,source.data.property_address);const upload=await service.storage.from(bucket).upload(doc.data.arquivo,bytes,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:true});if(upload.error)throw upload.error;
  }
  const generatedData=(doc.data.generated_data&&typeof doc.data.generated_data==='object'?doc.data.generated_data:{}) as Obj;const finalData={...generatedData,commercial_record_snapshot:source.data,property_address:source.data.property_address,party_address:source.data.address,address_used_in_contract:kind==='contrato'?'property_address':undefined,version_reason:doc.data.version_reason||text(body.versionReason)||null};
  const updated=await service.from('documentos').update({generated_data:finalData,snapshot_frozen_at:new Date().toISOString()}).eq('id',documentId);if(updated.error)throw updated.error;
  const snapshot={...finalData,document_id:documentId,document_kind:kind,version:doc.data.versao};const snap=await service.from('document_emission_snapshots').insert({document_id:documentId,document_kind:kind,version:doc.data.versao||'1.0',version_reason:doc.data.version_reason||text(body.versionReason)||null,snapshot,snapshot_hash:await sha256(snapshot),emitted_at:new Date().toISOString(),created_by:user.id});if(snap.error&&!String(snap.error.message||'').toLowerCase().includes('duplicate'))throw snap.error;
  await service.from('audit_log').insert({user_id:user.id,action:'finalize_commercial_document_version',entity_type:'commercial_records',entity_id:recordId,details:{document_id:documentId,document_kind:kind,version:doc.data.versao,version_reason:doc.data.version_reason||text(body.versionReason)||null,used_property_address:kind==='contrato',same_as_party_address:text(source.data.address)===text(source.data.property_address)}});
  return json({...core.data,documentId,version:doc.data.versao,addressUsed:kind==='contrato'?'property_address':null,snapshotFrozen:true},200);
 }catch(error){const message=error instanceof Error?error.message:'Não foi possível finalizar o documento comercial.';return json({error:message},message.includes('Acesso')?403:message.includes('Sessão')?401:500);}
});