import { createClient } from 'supabase';
import { Packer } from 'docx';
import { quoteDocument, contractDocument, loadProfessionalIdentity, missingProfessionalFields, loadContractMaster, generatedDateIso, type CommercialRecord } from '../_shared/commercial-word-renderer.ts';

const corsHeaders={
 'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')??'*',
 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json; charset=utf-8'}});
async function requireAdmin(req:Request){
 const authorization=req.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))throw new Error('Sessão administrativa ausente.');
 const url=Deno.env.get('SUPABASE_URL'),anonKey=Deno.env.get('SUPABASE_ANON_KEY'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anonKey||!serviceKey)throw new Error('Configuração segura ausente.');
 const caller=createClient(url,anonKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:userData,error:userError}=await caller.auth.getUser();
 if(userError||!userData.user)throw new Error('Sessão administrativa inválida.');
 const {data:isAdmin,error:adminError}=await caller.rpc('is_portal_admin');
 if(adminError||isAdmin!==true)throw new Error('Acesso administrativo necessário.');
 return {caller,service:createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),user:userData.user};
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const {caller,service,user}=await requireAdmin(req);const body=await req.json();const recordId=typeof body.recordId==='string'?body.recordId:'';const kind=body.kind==='contrato'?'contrato':'orcamento';
  if(!/^[0-9a-f-]{36}$/i.test(recordId))return json({error:'Registro comercial inválido.'},400);
  const {error:rateError}=await caller.rpc('consume_admin_rate_limit',{p_action:`commercial-document-${kind}`});if(rateError)return json({error:'Muitas tentativas. Aguarde antes de repetir.'},429);
  const governance=await service.rpc('assert_document_governance_ready');if(governance.error)throw governance.error;
  const firstRead=await service.from('commercial_records').select('*').eq('id',recordId).maybeSingle();if(firstRead.error)throw firstRead.error;if(!firstRead.data)return json({error:'Registro comercial não encontrado.'},404);
  if(kind==='contrato'&&firstRead.data.contract_document_id){
   const previous=await service.from('documentos').select('id').eq('id',firstRead.data.contract_document_id).maybeSingle();
   if(previous.error)throw previous.error;
   if(!previous.data)return json({error:'O documento vinculado não foi encontrado. Confira o cadastro antes de emitir.'},409);
   const frozen=await service.from('document_emission_snapshots').select('id').eq('document_id',firstRead.data.contract_document_id).maybeSingle();
   if(frozen.error)throw frozen.error;
   if(frozen.data)return json({error:'O contrato já foi emitido. Gere uma nova versão para preservar o histórico.'},409);
  }
  if(kind==='contrato'){const assigned=await caller.rpc('admin_assign_commercial_contract_number',{p_record_id:recordId});if(assigned.error)throw assigned.error;}
  const preparedScope=await service.rpc('admin_prepare_commercial_scope_for_generation',{p_record_id:recordId});if(preparedScope.error)throw preparedScope.error;
  const refreshed=await service.from('commercial_records').select('*').eq('id',recordId).single();if(refreshed.error)throw refreshed.error;const record=refreshed.data as CommercialRecord;
  const professionalProfile=await loadProfessionalIdentity(service,kind);
  const missingProfile=missingProfessionalFields(professionalProfile,kind);
  if(missingProfile.length)return json({error:`Complete a identificação profissional sigilosa em Configurações antes de gerar este documento. Campos pendentes: ${missingProfile.join(', ')}.`},422);
  const contractMaster=kind==='contrato'?await loadContractMaster(service,record):null;
  let documentId=kind==='orcamento'?record.quote_document_id:record.contract_document_id;
  if(!documentId){const inserted=await service.from('documentos').insert({cliente_id:record.linked_client_id??null,projeto_id:record.linked_project_id??null,contract_id:record.linked_contract_id??null,nome:kind==='orcamento'?`Orçamento ${record.quote_number} — ${record.prospect_name}`:`Contrato ${record.contract_number} — ${record.prospect_name}`,tipo:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',categoria:'Comercial',document_kind:kind,versao:'1.0',storage_bucket:'documentos',permitir_download:true,protection_mode:'administrative',autoral:false,workflow_status:'rascunho',optional_document:false,generated_data:{commercial_document_kind:kind,commercial_record_id:record.id,quote_number:record.quote_number,contract_number:record.contract_number,prospect_name:record.prospect_name,contract_master_id:record.contract_master_id,contract_master_version:record.contract_master_version,smart_texts:record.smart_texts,coobligors:record.coobligors}}).select('id').single();if(inserted.error)throw inserted.error;documentId=inserted.data.id;const linked=await service.from('commercial_records').update(kind==='orcamento'?{quote_document_id:documentId}:{contract_document_id:documentId}).eq('id',record.id);if(linked.error)throw linked.error;}
  const currentDocument=await service.from('documentos').select('versao,version_reason,workflow_status,generated_at').eq('id',documentId).single();
  if(currentDocument.error)throw currentDocument.error;
  if(currentDocument.data.generated_at||currentDocument.data.workflow_status==='enviado'||currentDocument.data.workflow_status==='assinado')return json({error:'Esta versão já foi emitida e não pode ser reescrita. Crie uma nova revisão.'},409);
  const docVersion=String(currentDocument.data.versao||'1.0');
  if(!/^\d+\\.\d+$/.test(docVersion))return json({error:'Versão documental inválida.'},422);
  const renderRecord={...record,document_version:docVersion,document_version_reason:currentDocument.data.version_reason||null};
  const generatedAt=new Date();
  const generatedAtIso=generatedAt.toISOString();
  const documentDate=generatedDateIso(generatedAt);
  const generatedData={professional_identity_snapshot:professionalProfile,commercial_document_kind:kind,commercial_record_id:record.id,quote_number:record.quote_number,contract_number:record.contract_number,prospect_name:record.prospect_name,contract_master_id:record.contract_master_id,contract_master_version:record.contract_master_version,smart_texts:record.smart_texts,services:record.services,coobligors:record.coobligors,experience_level:record.experience_level,emitted_at:generatedAtIso,document_date:documentDate,document_version:docVersion};
  const word=kind==='orcamento'?quoteDocument(renderRecord,professionalProfile,generatedAt):contractDocument(renderRecord,professionalProfile,contractMaster!.body,generatedAt);const buffer=await Packer.toBuffer(word);const number=kind==='orcamento'?record.quote_number:record.contract_number??'contrato';const path=`comercial/${record.id}/${kind}-${number}-v${docVersion}-${documentId}.docx`;
  const uploaded=await service.storage.from('documentos').upload(path,buffer,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:true});if(uploaded.error)throw uploaded.error;
  const updatedDocument=await service.from('documentos').update({arquivo:path,workflow_status:'gerado',generated_at:generatedAtIso,generated_data:generatedData}).eq('id',documentId);if(updatedDocument.error)throw updatedDocument.error;
  const nextStatus=record.status==='convertido'?'convertido':kind==='contrato'?'contrato_gerado':record.contract_document_id?'contrato_gerado':'orcamento_gerado';const updatedRecord=await service.from('commercial_records').update({status:nextStatus,updated_at:generatedAtIso}).eq('id',record.id);if(updatedRecord.error)throw updatedRecord.error;
  await service.from('audit_log').insert({user_id:user.id,action:`generate_commercial_${kind}_docx`,entity_type:'commercial_records',entity_id:record.id,details:{document_id:documentId,path,quote_number:record.quote_number,contract_number:record.contract_number,contract_master_version:record.contract_master_version,emitted_at:generatedAtIso,document_date:documentDate}});
  return json({generated:true,documentId,path,quoteNumber:record.quote_number,contractNumber:record.contract_number,emittedAt:generatedAtIso,documentDate,version:docVersion});
 }catch(error){const message=error instanceof Error?error.message:String((error as {message?:string})?.message||'Não foi possível gerar o documento comercial.');const status=message.includes('Acesso')?403:message.includes('Sessão')?401:message.includes('Governanca')||message.includes('Governança')?409:500;return json({error:message},status);}
});
