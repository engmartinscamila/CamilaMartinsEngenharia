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
const selected=(v:unknown,key:string)=>Array.isArray(v)?v.map(String).includes(key):String(v??'')===key;
const list=(v:unknown)=>Array.isArray(v)?v.map(String).filter(Boolean):v? [String(v)]:[];
const text=(v:unknown)=>String(v??'').trim();
const xmlEsc=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const mark=(xml:string,label:string,on:boolean)=>on?xml.replaceAll(`☐ ${label}`,`☒ ${label}`):xml;
function validate(kind:string,o:Obj){
 if(kind==='autorizacao_imagem'){
  if(!list(o.materials).length)return 'Selecione ao menos um material autorizado.';
  if(!list(o.channels).length)return 'Selecione ao menos um canal autorizado.';
  if(text(o.wait_months)&&(!Number.isFinite(Number(o.wait_months))||Number(o.wait_months)<=0))return 'Informe um prazo de espera em meses maior que zero.';
 }
 if(kind==='termo_aceite'){
  if(!text(o.acceptance))return 'Selecione a forma de aceite.';
  if(selected(o.acceptance,'accepted_with_notes')&&!text(o.acceptance_notes))return 'Descreva as ressalvas antes de gerar o documento.';
 }
 if(kind==='servico_adicional'){
  if(!list(o.reasons).length)return 'Selecione a origem da solicitação adicional.';
  if(selected(o.reasons,'other')&&!text(o.other_reason))return 'Descreva o motivo em “Outro”.';
  if(!text(o.pricing))return 'Selecione um único critério comercial.';
  if(!text(o.additional_service_description))return 'Descreva o serviço adicional.';
 }
 if(kind==='quitacao_encerramento'){
  if(!text(o.closing_reason))return 'Selecione um único motivo do encerramento.';
  if(selected(o.closing_reason,'other')&&!text(o.closing_other))return 'Descreva o outro motivo do encerramento.';
  if(!text(o.financial))return 'Selecione a situação financeira.';
  if(selected(o.financial,'balance')&&(!text(o.balance_value)||!text(o.balance_due)))return 'Para saldo pendente, informe valor e vencimento.';
 }
 return '';
}
async function personalize(bytes:Uint8Array,kind:string,o:Obj){
 if(!o||!Object.keys(o).length)return bytes;
 const zip=await JSZip.loadAsync(bytes);const file=zip.file('word/document.xml');if(!file)return bytes;let xml=await file.async('string');
 if(kind==='autorizacao_imagem'){
  const materials=list(o.materials),channels=list(o.channels),privacy=list(o.privacy);
  [['facade','Fotografias externas / fachada.'],['interiors','Fotografias de interiores.'],['renders','Renders 3D e imagens de apresentação.'],['plans','Plantas e pranchas sem dados pessoais sensíveis.'],['videos','Vídeos e tour virtual 360°.'],['work_records','Registros de obra sem identificação de pessoas.']].forEach(([k,l])=>xml=mark(xml,l,materials.includes(k)));
  [['portfolio','Portfólio profissional e site.'],['social','Redes sociais.'],['commercial','Apresentações comerciais.'],['technical','Publicações técnicas, concursos e premiações.'],['print','Material impresso institucional.']].forEach(([k,l])=>xml=mark(xml,l,channels.includes(k)));
  [['hide_address','Não divulgar endereço exato.'],['hide_client','Não divulgar nome do(a) cliente.'],['no_people','Não utilizar imagens com pessoas identificáveis sem autorização específica.']].forEach(([k,l])=>xml=mark(xml,l,privacy.includes(k)));
  if(text(o.wait_months))xml=xml.replace('☐ Aguardar ______ meses após a conclusão para a primeira divulgação.',`☒ Aguardar ${xmlEsc(o.wait_months)} meses após a conclusão para a primeira divulgação.`);
  if(text(o.other_restrictions))xml=xml.replace('☐ Outras restrições: _______________________________________________',`☒ Outras restrições: ${xmlEsc(o.other_restrictions)}`);
 }
 if(kind==='termo_aceite'){
  xml=mark(xml,'Aceito sem ressalvas.',selected(o.acceptance,'accepted'));
  xml=mark(xml,'Aceito com ressalvas descritas abaixo:',selected(o.acceptance,'accepted_with_notes'));
  if(text(o.acceptance_notes))xml=xml.replace('_______________________________________________________________________________',`Ressalvas: ${xmlEsc(o.acceptance_notes)}`);
 }
 if(kind==='servico_adicional'){
  const reasons=list(o.reasons),approval=list(o.approval);
  [['extra_revisions','Revisão além das rodadas incluídas.'],['scope_change','Alteração de escopo, premissas, programa, metragem ou layout já aprovado.'],['level_upgrade','Migração para nível de prestação superior ao contratado.'],['survey','Vistoria ou levantamento não incluído no escopo original.'],['editable_file','Arquivo editável ou formato não previsto.']].forEach(([k,l])=>xml=mark(xml,l,reasons.includes(k)));
  if(reasons.includes('other'))xml=xml.replace('☐ Outro: _______________________________________________',`☒ Outro: ${xmlEsc(o.other_reason)}`);
  xml=mark(xml,'hora técnica',selected(o.pricing,'hour'));xml=mark(xml,'percentual sobre etapa afetada',selected(o.pricing,'percentage'));xml=mark(xml,'valor fechado aprovado por orçamento específico.',selected(o.pricing,'fixed'));
  xml=mark(xml,'Aprovo a alteração acima e autorizo o início do serviço adicional nos limites deste termo.',approval.includes('approved'));
  if(text(o.additional_service_description))xml=xml.replace('Descrever somente a nova solicitação; o escopo original já está registrado acima.',xmlEsc(o.additional_service_description));
  if(text(o.additional_value))xml=xml.replace('Valor adicional aprovado: _______________________________________________',`Valor adicional aprovado: ${xmlEsc(o.additional_value)}`);
  if(text(o.schedule_impact))xml=xml.replace('Impacto adicional no cronograma: _________________________________________',`Impacto adicional no cronograma: ${xmlEsc(o.schedule_impact)}`);
 }
 if(kind==='quitacao_encerramento'){
  [['completed','Conclusão integral do escopo contratado.'],['client_termination','Rescisão antecipada por iniciativa do(a) CONTRATANTE.'],['contractor_termination','Rescisão antecipada por iniciativa do(a) CONTRATADO(A).'],['mutual','Rescisão por mútuo acordo.']].forEach(([k,l])=>xml=mark(xml,l,selected(o.closing_reason,k)));
  if(selected(o.closing_reason,'other'))xml=xml.replace('☐ Outro: _______________________________________________',`☒ Outro: ${xmlEsc(o.closing_other)}`);
  xml=mark(xml,'Quitação integral.',selected(o.financial,'paid'));
  if(selected(o.financial,'balance'))xml=xml.replace('☐ Existe saldo pendente no valor de __________________ com vencimento em __________.',`☒ Existe saldo pendente no valor de ${xmlEsc(o.balance_value)} com vencimento em ${xmlEsc(o.balance_due)}.`);
  if(text(o.delivered_files))xml=xml.replace('Arquivos e documentos finais entregues: __________________________________________',`Arquivos e documentos finais entregues: ${xmlEsc(o.delivered_files)}`);
  if(text(o.open_items))xml=xml.replace('Pendências técnicas ou administrativas que permanecem abertas: _____________________',`Pendências técnicas ou administrativas que permanecem abertas: ${xmlEsc(o.open_items)}`);
  if(text(o.public_processes))xml=xml.replace('Processos perante órgãos públicos ainda em andamento, quando aplicável: _____________',`Processos perante órgãos públicos ainda em andamento, quando aplicável: ${xmlEsc(o.public_processes)}`);
 }
 if(kind==='levantamento_tecnico'){
  const observed=list(o.observed),conditions=list(o.conditions);
  [['electrical','Pontos elétricos'],['hydraulic','Pontos hidráulicos'],['structure','Estrutura aparente'],['frames','Esquadrias'],['finishes','Revestimentos'],['roof','Cobertura'],['drainage','Drenagem'],['access','Acessos'],['other','Outros']].forEach(([k,l])=>xml=mark(xml,l,observed.includes(k)));
  [['cracks','Fissuras/trincas'],['moisture','Umidade/infiltração'],['levels','Desníveis'],['corrosion','Corrosão aparente'],['document_mismatch','Divergência entre realidade e documentos fornecidos'],['restricted_access','Acesso restrito a algum elemento']].forEach(([k,l])=>xml=mark(xml,l,conditions.includes(k)));
  if(text(o.inspection_datetime))xml=xml.replace('Data e horário da vistoria: _______________________________________________',`Data e horário da vistoria: ${xmlEsc(o.inspection_datetime)}`);
  if(text(o.site_contact))xml=xml.replace('Responsável pelo acompanhamento no local: __________________________________',`Responsável pelo acompanhamento no local: ${xmlEsc(o.site_contact)}`);
  if(text(o.conditions_description))xml=xml.replace('Descrição: _____________________________________________________________________',`Descrição: ${xmlEsc(o.conditions_description)}`);
 }
 zip.file('word/document.xml',xml);return await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
}
async function proxyCore(url:string,anonKey:string,authorization:string,body:unknown){const response=await fetch(`${url}/functions/v1/generate-contract-document`,{method:'POST',headers:{Authorization:authorization,apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify(body)});let data:Obj={};try{data=await response.json()}catch{data={error:'Resposta inválida do gerador principal.'}}return {response,data};}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const {authorization,url,anonKey,service,user}=await requireAdmin(req);const body=await req.json() as Obj;const documentId=text(body.documentId);if(!/^[0-9a-f-]{36}$/i.test(documentId))return json({error:'Documento inválido.'},400);
  const rowBefore=await service.from('documentos').select('id,document_kind,generated_data').eq('id',documentId).maybeSingle();if(rowBefore.error)throw rowBefore.error;if(!rowBefore.data)return json({error:'Documento não encontrado.'},404);
  const source=(rowBefore.data.generated_data&&typeof rowBefore.data.generated_data==='object'?rowBefore.data.generated_data:{}) as Obj;const options=(source.document_options&&typeof source.document_options==='object'?source.document_options:{}) as Obj;
  if(body.action!=='send'){const issue=validate(String(rowBefore.data.document_kind||''),options);if(issue)return json({error:issue},422);}
  const core=await proxyCore(url,anonKey,authorization,body);if(!core.response.ok)return json(core.data,core.response.status);if(body.action==='send')return json(core.data,core.response.status);
  const row=await service.from('documentos').select('id,arquivo,storage_bucket,document_kind,generated_data').eq('id',documentId).single();if(row.error)throw row.error;if(!row.data.arquivo)throw new Error('O gerador principal não produziu o arquivo Word.');
  const bucket=row.data.storage_bucket||'documentos';const downloaded=await service.storage.from(bucket).download(row.data.arquivo);if(downloaded.error||!downloaded.data)throw downloaded.error??new Error('Não foi possível abrir o Word recém-gerado.');let bytes=new Uint8Array(await downloaded.data.arrayBuffer());bytes=await personalize(bytes,String(row.data.document_kind||''),options);
  const uploaded=await service.storage.from(bucket).upload(row.data.arquivo,bytes,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:true});if(uploaded.error)throw uploaded.error;
  const generatedData=(row.data.generated_data&&typeof row.data.generated_data==='object'?row.data.generated_data:{}) as Obj;const updated=await service.from('documentos').update({generated_data:{...generatedData,document_options:options,document_options_applied_at:new Date().toISOString()}}).eq('id',documentId);if(updated.error)throw updated.error;
  await service.from('audit_log').insert({user_id:user.id,action:'finalize_contract_document_options',entity_type:'documentos',entity_id:documentId,details:{document_kind:row.data.document_kind,options_applied:Object.keys(options).length>0}});
  return json({...core.data,optionsApplied:Object.keys(options).length>0},200);
 }catch(error){const message=error instanceof Error?error.message:'Não foi possível finalizar o documento.';return json({error:message},message.includes('Acesso')?403:message.includes('Sessão')?401:500);}
});