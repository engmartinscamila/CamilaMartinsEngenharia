import { createClient } from 'supabase';
import { Packer } from 'docx';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { quoteDocument, contractDocument, loadProfessionalIdentity, loadContractMaster, type CommercialRecord } from '../_shared/commercial-word-renderer.ts';
import { enhanceContractDocument, enhanceQuoteDocument } from '../_shared/commercial-word-enhancements.ts';
const cors={'Access-Control-Allow-Origin':Deno.env.get('ALLOWED_ORIGIN')??'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown)=>String(v??'').trim();
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const authorization=req.headers.get('Authorization'),url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!authorization?.startsWith('Bearer '))return json({error:'Entre novamente na administração.'},401);
  if(!url||!anon||!key)throw new Error('Configuração segura ausente.');
  const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const user=await caller.auth.getUser();if(user.error||!user.data.user)return json({error:'Sessão administrativa inválida.'},401);
  const admin=await caller.rpc('is_portal_admin');if(admin.error||admin.data!==true)return json({error:'Acesso administrativo necessário.'},403);
  const rate=await caller.rpc('consume_admin_rate_limit',{p_action:'commercial-word-existing-download'});if(rate.error)return json({error:'Aguarde alguns instantes antes de repetir o download.'},429);
  const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json();if(!uuid(body.documentId))return json({error:'Documento inválido.'},400);
  const doc=await service.from('documentos').select('id,nome,arquivo,storage_bucket,document_kind,generated_data,versao,generated_at').eq('id',body.documentId).single();if(doc.error)throw doc.error;
  const row=doc.data,gd=row.generated_data||{},kind=gd.commercial_document_kind||row.document_kind;
  if(!['contrato','orcamento'].includes(kind))return json({error:'Selecione um contrato ou orçamento comercial emitido.'},400);
  const snapshot=await service.from('document_emission_snapshots').select('snapshot,version,emitted_at').eq('document_id',row.id).maybeSingle();if(snapshot.error)throw snapshot.error;
  if(!snapshot.data)return json({error:'Este documento ainda não possui uma emissão concluída.'},409);
  const bucket=row.storage_bucket||'documentos';let bytes:Uint8Array|null=null,path=row.arquivo||'',reconstituted=path.includes('/reconstituted/');
  for(const candidate of [...new Set([path,`_issued_word/${row.id}.docx`].filter(Boolean))]){
   const file=await service.storage.from(bucket).download(candidate);
   if(!file.error&&file.data){bytes=new Uint8Array(await file.data.arrayBuffer());path=candidate;break;}
   if(file.error&&!['404','400'].includes(String(file.error.statusCode||file.error.status||''))&&!/not found|does not exist/i.test(file.error.message||''))throw file.error;
  }
  if(!bytes){
   if(body.recover!==true)return json({code:'ORIGINAL_WORD_MISSING',error:'O arquivo original foi removido pelo fluxo antigo de download. É possível reconstituir uma cópia pelos dados congelados da emissão, sem criar revisão. Caso não exista identificação profissional congelada, ela será obtida da configuração atual. A cópia será identificada como reconstituída e deve ser conferida antes de usar.'},410);
   const frozen=snapshot.data.snapshot||{},record=frozen.commercial_record_snapshot as CommercialRecord;
   if(!record?.id||!record.contract_master_id&&!record.contract_master_version)return json({error:'Dados históricos insuficientes para reconstituir com segurança. Envie o Word originalmente baixado para preservar a versão exata.'},409);
   const date=new Date(frozen.emitted_at||snapshot.data.emitted_at);if(!Number.isFinite(date.getTime()))throw new Error('Data histórica da emissão ausente.');
   const profile=frozen.professional_identity_snapshot||await loadProfessionalIdentity(service,kind);
   const master=kind==='contrato'?await loadContractMaster(service,record):null;
   const original=new Uint8Array(await Packer.toBuffer(kind==='contrato'?contractDocument(record,profile,master!.body,date):quoteDocument(record,profile,date)));
   bytes=kind==='contrato'?await enhanceContractDocument(original,record.property_address||'',record.services,record.custom_service,record.experience_level):await enhanceQuoteDocument(original,record.services,record.custom_service);
   path=`_issued_word/reconstituted/${row.id}.docx`;
   const saved=await service.storage.from(bucket).upload(path,bytes,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:false});if(saved.error&&!/already exists|duplicate/i.test(saved.error.message||''))throw saved.error;
   const linked=await service.from('documentos').update({arquivo:path,storage_bucket:bucket,archived_explicitly:true,archived_storage_size:bytes.byteLength,purged_at:null}).eq('id',row.id);if(linked.error)throw linked.error;
   const audit=await service.from('audit_log').insert({user_id:user.data.user.id,action:'reconstitute_commercial_word_from_emission_snapshot',entity_type:'documentos',entity_id:row.id,details:{snapshot_version:snapshot.data.version,path,professional_identity_source:frozen.professional_identity_snapshot?'emission_snapshot':'current_configuration',original_binary_available:false,creates_revision:false}});if(audit.error)throw audit.error;
   reconstituted=true;
  }
  if(bytes.byteLength>20*1024*1024)return json({error:'Arquivo acima do limite de download direto.'},413);
  await service.from('audit_log').insert({user_id:user.data.user.id,action:'download_existing_commercial_word',entity_type:'documentos',entity_id:row.id,details:{version:snapshot.data.version,reconstituted,creates_revision:false}});
  const number=text(gd.contract_number||gd.quote_number||row.id).replace(/[^\p{L}\p{N}._-]/gu,'-');
  return json({delivered:true,documentId:row.id,version:snapshot.data.version,reconstituted,fileName:`${kind==='contrato'?'Contrato':'Orcamento'}-${number}-v${snapshot.data.version}${reconstituted?'-copia-reconstituida':''}.docx`,contentBase64:encodeBase64(bytes)});
 }catch(error){return json({error:error instanceof Error?error.message:String((error as {message?:string})?.message||'Não foi possível baixar a versão emitida.')},500);}
});
