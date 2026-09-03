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

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const {authorization,url,anonKey,service,user}=await requireAdmin(req);const body=await req.json() as Obj;const recordId=text(body.recordId);const kind=body.kind==='contrato'?'contrato':'orcamento';if(!/^[0-9a-f-]{36}$/i.test(recordId))return json({error:'Registro comercial inválido.'},400);
  const source=await service.from('commercial_records').select('id,address,property_address,record_kind').eq('id',recordId).maybeSingle();if(source.error)throw source.error;if(!source.data)return json({error:'Registro comercial não encontrado.'},404);
  if(kind==='contrato'&&!text(source.data.property_address))return json({error:'Informe o endereço do imóvel / obra antes de gerar o contrato.'},422);
  const core=await proxyCore(url,anonKey,authorization,body);if(!core.response.ok)return json(core.data,core.response.status);if(kind!=='contrato')return json(core.data,core.response.status);
  const documentId=text(core.data.documentId);if(!/^[0-9a-f-]{36}$/i.test(documentId))throw new Error('Contrato gerado sem vínculo documental válido.');
  const doc=await service.from('documentos').select('id,arquivo,storage_bucket,generated_data').eq('id',documentId).single();if(doc.error)throw doc.error;if(!doc.data.arquivo)throw new Error('O contrato foi preparado sem arquivo Word.');const bucket=doc.data.storage_bucket||'documentos';const downloaded=await service.storage.from(bucket).download(doc.data.arquivo);if(downloaded.error||!downloaded.data)throw downloaded.error??new Error('Não foi possível abrir o contrato recém-gerado.');let bytes=new Uint8Array(await downloaded.data.arrayBuffer());bytes=await replaceContractAddress(bytes,source.data.address,source.data.property_address);
  const upload=await service.storage.from(bucket).upload(doc.data.arquivo,bytes,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:true});if(upload.error)throw upload.error;
  const generatedData=(doc.data.generated_data&&typeof doc.data.generated_data==='object'?doc.data.generated_data:{}) as Obj;const updated=await service.from('documentos').update({generated_data:{...generatedData,property_address:source.data.property_address,party_address:source.data.address,address_used_in_contract:'property_address'}}).eq('id',documentId);if(updated.error)throw updated.error;
  await service.from('audit_log').insert({user_id:user.id,action:'finalize_commercial_contract_property_address',entity_type:'commercial_records',entity_id:recordId,details:{document_id:documentId,used_property_address:true,same_as_party_address:text(source.data.address)===text(source.data.property_address)}});
  return json({...core.data,addressUsed:'property_address'},200);
 }catch(error){const message=error instanceof Error?error.message:'Não foi possível finalizar o documento comercial.';return json({error:message},message.includes('Acesso')?403:message.includes('Sessão')?401:500);}
});