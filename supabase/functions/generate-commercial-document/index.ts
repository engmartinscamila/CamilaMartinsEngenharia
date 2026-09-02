import { createClient } from 'supabase';
import { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';

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

type CommercialRecord={id:string;quote_number:string;contract_number:string|null;status:string;prospect_name:string;cpf_cnpj:string|null;email:string|null;phone:string|null;address:string|null;city:string|null;state:string|null;property_address:string|null;property_type:string|null;area_terreno_m2:number|null;area_construida_m2:number|null;construction_standard:string|null;experience_level:string|null;services:unknown;custom_service:string|null;total_value:number|null;payment_terms:unknown;valid_until:string|null;notes:string|null;quote_document_id:string|null;contract_document_id:string|null;contract_master_id:string|null;contract_master_version:number|null;smart_texts:unknown};
type ServiceItem=Record<string,unknown>;
type ProfessionalIdentity=Record<string,string|undefined>;

const profileValue=(profile:ProfessionalIdentity,key:string)=>String(profile[key]??'').trim();
const creaLabel=(profile:ProfessionalIdentity)=>{
 const parts:string[]=[];
 const rj=profileValue(profile,'crea_rj');
 const sp=profileValue(profile,'crea_sp');
 if(rj)parts.push(`CREA-RJ nº ${rj}`);
 if(sp)parts.push(`CREA-SP nº ${sp}`);
 return parts.join(' • ');
};
const professionalLabel=(profile:ProfessionalIdentity)=>{
 const parts=[profileValue(profile,'full_name'),profileValue(profile,'professional_title')||'Engenheira Civil',creaLabel(profile)].filter(Boolean);
 return parts.join(' — ');
};
const professionalQualification=(profile:ProfessionalIdentity)=>{
 const fullName=profileValue(profile,'full_name');
 const nationality=profileValue(profile,'nationality');
 const maritalStatus=profileValue(profile,'marital_status');
 const title=profileValue(profile,'professional_title')||'Engenheira Civil';
 const cpf=profileValue(profile,'cpf');
 const rg=profileValue(profile,'rg');
 const issuer=profileValue(profile,'rg_issuer');
 const address=profileValue(profile,'professional_address');
 const email=profileValue(profile,'email_professional');
 const phone=profileValue(profile,'phone_professional');
 const parts=[fullName,nationality,maritalStatus,title].filter(Boolean);
 let result=parts.join(', ');
 if(cpf)result+=`, inscrita no CPF nº ${cpf}`;
 if(rg)result+=`, portadora do RG nº ${rg}${issuer?` — ${issuer}`:''}`;
 const crea=creaLabel(profile);
 if(crea)result+=`, ${crea}`;
 if(address)result+=`, com endereço profissional em ${address}`;
 if(email)result+=`, e-mail ${email}`;
 if(phone)result+=` e telefone/WhatsApp ${phone}`;
 return result;
};
const missingProfessionalFields=(profile:ProfessionalIdentity,kind:'orcamento'|'contrato')=>{
 const missing:string[]=[];
 if(!profileValue(profile,'full_name'))missing.push('nome civil completo');
 if(!creaLabel(profile))missing.push('CREA');
 if(kind==='contrato'){
   if(!profileValue(profile,'cpf'))missing.push('CPF');
   if(!profileValue(profile,'professional_address'))missing.push('endereço profissional');
   if(!profileValue(profile,'email_professional'))missing.push('e-mail profissional');
 }
 return missing;
};
async function loadProfessionalIdentity(service:any,kind:'orcamento'|'contrato'):Promise<ProfessionalIdentity>{
 const rpcName=kind==='contrato'?'service_get_professional_identity':'service_get_professional_signature';
 const {data,error}=await service.rpc(rpcName);
 if(error)throw error;
 return (data&&typeof data==='object'?data:{}) as ProfessionalIdentity;
}


const NAVY='0B1726';
const GOLD='B89A63';
const TEXT='26313D';
const MUTED='667281';
const SOFT='F3F5F7';

const p=(text:string,bold=false,color=TEXT)=>new Paragraph({
 spacing:{after:120,line:300},
 children:[new TextRun({text,bold,font:'Century Gothic',size:20,color})]
});
const small=(text:string)=>new Paragraph({
 spacing:{after:90,line:260},
 children:[new TextRun({text,font:'Century Gothic',size:16,color:MUTED})]
});
const bullet=(text:string)=>new Paragraph({
 bullet:{level:0},
 spacing:{after:70,line:280},
 children:[new TextRun({text,font:'Century Gothic',size:19,color:TEXT})]
});
const h=(text:string)=>new Paragraph({
 heading:HeadingLevel.HEADING_2,
 spacing:{before:300,after:130},
 border:{bottom:{color:GOLD,style:BorderStyle.SINGLE,size:8,space:5}},
 children:[new TextRun({text,bold:true,font:'Century Gothic',size:23,color:NAVY})]
});
const serviceHeading=(text:string)=>new Paragraph({
 spacing:{before:180,after:80},
 children:[new TextRun({text,bold:true,font:'Century Gothic',size:21,color:GOLD})]
});
const title=(text:string,subtitle?:string)=>[
 new Paragraph({
   alignment:AlignmentType.CENTER,
   spacing:{before:180,after:100},
   children:[new TextRun({text:'CAMILA MARTINS',bold:true,font:'Century Gothic',size:22,color:GOLD,characterSpacing:40})]
 }),
 new Paragraph({
   alignment:AlignmentType.CENTER,
   spacing:{after:340},
   children:[new TextRun({text:'ENGENHARIA CIVIL',font:'Century Gothic',size:14,color:MUTED,characterSpacing:55})]
 }),
 new Paragraph({
   alignment:AlignmentType.CENTER,
   spacing:{after:90},
   children:[new TextRun({text,bold:true,font:'Century Gothic',size:31,color:NAVY})]
 }),
 ...(subtitle?[new Paragraph({
   alignment:AlignmentType.CENTER,
   spacing:{after:260},
   children:[new TextRun({text:subtitle,font:'Century Gothic',size:18,color:MUTED})]
 })]:[])
];
const brandHeader=(profile:ProfessionalIdentity)=>new Header({children:[
 new Paragraph({
   border:{bottom:{color:GOLD,style:BorderStyle.SINGLE,size:6,space:4}},
   spacing:{after:70},
   children:[
     new TextRun({text:'Camila Martins',bold:true,font:'Century Gothic',size:18,color:GOLD}),
     new TextRun({text:'  •  Engenharia Civil',font:'Century Gothic',size:14,color:NAVY})
   ]
 })
]});
const brandFooter=(profile:ProfessionalIdentity,documentCode:string)=>new Footer({children:[
 new Paragraph({
   alignment:AlignmentType.CENTER,
   border:{top:{color:GOLD,style:BorderStyle.SINGLE,size:4,space:4}},
   spacing:{before:70},
   children:[new TextRun({
     text:`${professionalLabel(profile)}  •  ${documentCode}`,
     font:'Century Gothic',size:13,color:MUTED
   })]
 })
]});
const makeDoc=(children:Paragraph[],profile:ProfessionalIdentity,documentCode:string)=>new Document({
 styles:{
   default:{
     document:{
       run:{font:'Century Gothic',size:20,color:TEXT},
       paragraph:{spacing:{line:300,after:100}}
     }
   }
 },
 sections:[{
   properties:{page:{margin:{top:900,right:1050,bottom:900,left:1050}}},
   headers:{default:brandHeader(profile)},
   footers:{default:brandFooter(profile,documentCode)},
   children
 }]
});
const text=(value:unknown,fallback='Não informado')=>typeof value==='string'&&value.trim()?value.trim():fallback;
const money=(value:number|null)=>value===null?'A definir':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
const datePt=(raw:string|null)=>raw?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${raw}T12:00:00-03:00`)):'A definir';
const selectedServices=(record:CommercialRecord)=>Array.isArray(record.services)?record.services.filter((item):item is ServiceItem=>Boolean(item&&typeof item==='object'&&(item as ServiceItem).included!==false)):[];
const arrStrings=(value:unknown)=>Array.isArray(value)?value.map(x=>String(x??'').trim()).filter(Boolean):[];
const unique=(items:string[])=>[...new Set(items.filter(Boolean))];
const levelName=(value:string|null)=> {
 const code=String(value||'').trim().toLowerCase();
 if(code==='bronze')return 'BRONZE — Essencial';
 if(code==='prata')return 'PRATA — Visual';
 if(code==='ouro')return 'OURO — Imersivo';
 if(code)return code.toUpperCase();
 return 'Não aplicável / não selecionado';
};
const levelFromServices=(items:ServiceItem[])=>{
 for(const item of items){
   const level=item.level;
   if(level&&typeof level==='object')return level as Record<string,unknown>;
 }
 return null;
};
const serviceDescription=(item:ServiceItem)=>String(item.description??'Serviço técnico conforme escopo descrito no orçamento e no Anexo I.');
const serviceRevisions=(item:ServiceItem)=>{
 const value=item.revisions;
 return typeof value==='number'?String(value):'conforme condição específica do Anexo I';
};

const smartRule=(record:CommercialRecord,code:string,fallback:string)=>{
 const all=record.smart_texts&&typeof record.smart_texts==='object'?record.smart_texts as Record<string,unknown>:{};
 const item=all[code];
 if(item&&typeof item==='object'){
   const body=(item as Record<string,unknown>).body;
   if(typeof body==='string'&&body.trim())return body.trim();
 }
 return fallback;
};
async function loadContractMaster(service:any,record:CommercialRecord){
 let query=service.from('contract_master_versions').select('id,version,label,body');
 if(record.contract_master_id)query=query.eq('id',record.contract_master_id);
 else if(record.contract_master_version)query=query.eq('version',record.contract_master_version);
 else query=query.eq('active',true);
 const {data,error}=await query.order('version',{ascending:false}).limit(1).maybeSingle();
 if(error)throw error;
 if(!data?.body)throw new Error('Contrato Mestre versionado não encontrado para este registro.');
 return data as {id:string;version:number;label:string;body:string};
}

const paymentLines=(record:CommercialRecord)=>{
 const terms=Array.isArray(record.payment_terms)?record.payment_terms as Array<Record<string,unknown>>:[];
 if(!terms.length)return [p('Condição de pagamento: conforme condição comercial registrada no orçamento/contrato.')];
 return terms.map((term,index)=>p(`${index+1}. ${String(term.label??term.description??'Parcela')} — ${String(term.value??term.amount??'valor conforme registro')} — ${String(term.due??term.dueDate??'vencimento conforme registro')}`));
};
function quoteDocument(record:CommercialRecord,profile:ProfessionalIdentity){
 const selected=selectedServices(record);
 const level=levelFromServices(selected);
 const levelFeatures=arrStrings(level?.features);
 const levelExclusions=arrStrings(level?.exclusions);
 const eligibleServices=selected.filter(item=>item.levelApplicable===true).map(item=>String(item.name??'Serviço'));
 const consolidatedExclusions=unique(selected.flatMap(item=>arrStrings(item.exclusions)));
 const today=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo'}).format(new Date());

 const serviceBlocks:Paragraph[]=[];
 selected.forEach((item,index)=>{
   serviceBlocks.push(serviceHeading(`${index+1}. ${String(item.name??'Serviço')}`));
   serviceBlocks.push(p(serviceDescription(item)));
   const deliverables=arrStrings(item.deliverables);
   if(deliverables.length){
     serviceBlocks.push(small('Entregáveis previstos no escopo padrão deste serviço:'));
     deliverables.forEach(value=>serviceBlocks.push(bullet(value)));
   }
   const inputs=arrStrings(item.clientInputs);
   if(inputs.length){
     serviceBlocks.push(small('Informações e insumos normalmente necessários do cliente:'));
     inputs.forEach(value=>serviceBlocks.push(bullet(value)));
   }
   serviceBlocks.push(small(`Revisões incluídas: ${serviceRevisions(item)} • Formatos: ${arrStrings(item.deliveryFormats).join(', ')||'PDF'} • Prazo: ${String(item.planningReference??'integrado ao cronograma geral')}`));
 });

 if(record.custom_service){
   serviceBlocks.push(serviceHeading('Serviço adicional descrito no orçamento'));
   serviceBlocks.push(p(record.custom_service));
   serviceBlocks.push(small('Este item somente integra o escopo nos limites expressamente descritos nesta proposta e no Anexo I.'));
 }

 return makeDoc([
  ...title(`PROPOSTA COMERCIAL — ${record.quote_number}`,'Serviços técnicos de engenharia • escopo inteligente e rastreável'),
  p(professionalLabel(profile),true,GOLD),
  p(`Preparada para: ${record.prospect_name}`,true),
  p(`Imóvel / obra: ${text(record.property_address)}`),
  small(`Emissão: ${today} • Validade: ${datePt(record.valid_until)} • Documento vinculado ao ORC ${record.quote_number}`),

  h('1. VISÃO GERAL DA PROPOSTA'),
  p(smartRule(record,'proposal_scope_governance','Esta proposta organiza o escopo e as condições comerciais sem ampliar, por si só, as obrigações contratuais. Após a formalização, o Contrato e o Anexo I passam a reger definitivamente a relação entre as partes.')),
  p(`Cliente / prospect: ${record.prospect_name}`),
  p(`CPF/CNPJ: ${text(record.cpf_cnpj)} • E-mail: ${text(record.email)} • Telefone: ${text(record.phone)}`),
  p(`Tipo de imóvel: ${text(record.property_type)} • Padrão construtivo: ${text(record.construction_standard)}`),
  p(`Área do terreno: ${record.area_terreno_m2??'não informada'} m² • Área construída prevista: ${record.area_construida_m2??'não informada'} m²`),

  h('2. NÍVEL DE PRESTAÇÃO DE SERVIÇO'),
  p(`Nível selecionado: ${levelName(record.experience_level)}`,true,GOLD),
  ...(level?[p(String(level.description??''))]:[p('O nível de experiência não foi selecionado. Quando aplicável, ele deverá ser definido antes da formalização definitiva.')]),
  ...(eligibleServices.length?[small(`O nível selecionado aplica-se somente aos serviços de projeto elegíveis nesta proposta: ${eligibleServices.join(', ')}.`)]:[small('Nenhum serviço selecionado nesta proposta recebe ampliação automática por nível de experiência.')]),
  ...levelFeatures.map(value=>bullet(value)),
  ...levelExclusions.map(value=>bullet(`Não incluído neste nível: ${value}`)),
  small('Regra de consistência: BRONZE, PRATA e OURO não acrescentam projetos complementares, execução, gerenciamento, visitas, levantamentos, taxas ou aprovações que não tenham sido contratados expressamente.'),

  h('3. ESCOPO INTELIGENTE DE SERVIÇOS'),
  ...(selected.length?serviceBlocks:[p('Nenhum serviço foi selecionado. Revise o orçamento antes da emissão definitiva.')]),

  h('4. LIMITES E EXCLUSÕES CONSOLIDADAS'),
  p('Somente os itens expressamente incluídos nesta proposta e posteriormente confirmados no Anexo I integram o escopo. Solicitações posteriores ou itens não previstos serão tratados como serviço adicional, mediante aprovação prévia.'),
  ...consolidatedExclusions.map(value=>bullet(value)),
  bullet('Taxas, emolumentos e despesas de órgãos públicos, cartórios, concessionárias ou entidades de classe não integram os honorários, salvo previsão expressa em contrário.'),
  bullet('ART/RRT e demais despesas vinculadas a registros profissionais somente integram o valor quando expressamente discriminadas.'),

  h('5. PROCESSO DE DESENVOLVIMENTO E REVISÕES'),
  p(smartRule(record,'proposal_revision_rule','Na ausência de indicação específica no Anexo I, aplicam-se até 2 (duas) rodadas de revisão por etapa para ajustes dentro do escopo original. Alterações de programa, metragem, layout, partido ou premissas já aprovadas podem caracterizar alteração de escopo.')),
  p('O cliente deverá fornecer documentos, respostas de briefing, medidas, aprovações e demais definições necessárias. A falta desses insumos pode suspender ou repercutir no cronograma, nos termos do Contrato.'),

  h('6. PRAZO E CRONOGRAMA'),
  p(smartRule(record,'proposal_timeline_rule','O prazo geral de referência é de 45 (quarenta e cinco) dias úteis, contado conforme as condições previstas no Contrato, podendo ser ajustado no Anexo I em função do escopo efetivamente contratado. Prazos de análise de órgãos públicos e terceiros não se confundem com o prazo técnico de elaboração.')),

  h('7. INVESTIMENTO'),
  p(`Valor total dos honorários: ${money(record.total_value)}`,true,GOLD),
  ...paymentLines(record),
  ...(record.notes?[p(`Condições / observações comerciais registradas: ${record.notes}`)]:[]),

  h('8. PRÓXIMOS PASSOS'),
  bullet('Aprovação desta proposta pelo cliente, por escrito.'),
  bullet('Formalização do Contrato de Prestação de Serviços e do Anexo I com o escopo definitivo.'),
  bullet('Pagamento da condição inicial pactuada, quando aplicável.'),
  bullet('Entrega dos documentos, briefings e informações necessários ao início dos trabalhos.'),
  bullet('Agendamento de levantamento ou vistoria somente quando esse serviço estiver incluído.'),

  h('9. VALIDADE E ACEITE'),
  p(`Esta proposta permanece válida até ${datePt(record.valid_until)}. Após essa data, valores, disponibilidade e condições poderão ser revistos antes da formalização.`),
  p('O aceite desta proposta não substitui o Contrato e o Anexo I definitivos quando esses instrumentos forem aplicáveis à contratação.'),
  p('Local e data: _______________________________, _____/_____/________'),
  p('_______________________________________________'),
  p(`${professionalLabel(profile)} — proponente`),
  p('_______________________________________________'),
  p('Aceite do(a) cliente')
 ],profile,`ORC ${record.quote_number}`);
}


function contractDocument(record:CommercialRecord,profile:ProfessionalIdentity,contractMasterBody:string){
 const body=contractMasterBody.split('\n').filter(Boolean).map(line=>line.startsWith('CLÁUSULA')?h(line):p(line));
 const level=levelFromServices(selectedServices(record));
 const levelDisplay=level
   ? [String(level.label??'').trim(),String(level.subtitle??'').trim()].filter(Boolean).join(' — ')
   : levelName(record.experience_level);
 return makeDoc([
   ...title(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ENGENHARIA — ${text(record.contract_number,'CONTRATO SEM NUMERAÇÃO — NÃO EMITIR')}`,'Instrumento particular • identidade profissional protegida'),
   p('Pelo presente instrumento particular de Contrato de Prestação de Serviços de Engenharia, de um lado:'),
   p(`CONTRATADO(A): ${professionalQualification(profile)}, doravante denominada simplesmente CONTRATADO(A);`),
   p(`CONTRATANTE: ${record.prospect_name}, CPF/CNPJ ${text(record.cpf_cnpj)}, com endereço em ${text(record.address)}, e-mail ${text(record.email)} e telefone/WhatsApp ${text(record.phone)}, doravante denominado(a) simplesmente CONTRATANTE.`),
   p('Têm entre si, justo e acertado, o presente Contrato de Prestação de Serviços de Engenharia, que se regerá pelas cláusulas e condições a seguir:'),
   ...body,
   h('RESUMO COMERCIAL VINCULADO'),
   p(`Valor total dos honorários: ${money(record.total_value)}.`,true,GOLD),
   p(`Nível de experiência: ${levelDisplay}.`),
   p('O detalhamento definitivo dos serviços, entregáveis, revisões, formatos e cronograma consta do Anexo I, que deve refletir o mesmo escopo estruturado utilizado na proposta comercial.'),
   p('E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.'),
   p(`${text(record.city,'[Cidade]')}, _____ de __________________ de ______.`),
   p('_____________________________________________'),
   p(professionalLabel(profile)),
   p('_____________________________________________'),
   p('CONTRATANTE'),
   p('Testemunhas:'),
   p('1) ______________________________  CPF: ______________________'),
   p('2) ______________________________  CPF: ______________________')
 ],profile,`CON ${record.contract_number??''}`);
}

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const {caller,service,user}=await requireAdmin(req);const body=await req.json();const recordId=typeof body.recordId==='string'?body.recordId:'';const kind=body.kind==='contrato'?'contrato':'orcamento';
  if(!/^[0-9a-f-]{36}$/i.test(recordId))return json({error:'Registro comercial inválido.'},400);
  const {error:rateError}=await caller.rpc('consume_admin_rate_limit',{p_action:`commercial-document-${kind}`});if(rateError)return json({error:'Muitas tentativas. Aguarde antes de repetir.'},429);
  const firstRead=await service.from('commercial_records').select('*').eq('id',recordId).maybeSingle();if(firstRead.error)throw firstRead.error;if(!firstRead.data)return json({error:'Registro comercial não encontrado.'},404);
  if(firstRead.data.status==='convertido'&&kind==='contrato')return json({error:'O registro já foi convertido. O contrato histórico não pode ser substituído.'},409);
  if(kind==='contrato'){const assigned=await caller.rpc('admin_assign_commercial_contract_number',{p_record_id:recordId});if(assigned.error)throw assigned.error;}
  const refreshed=await service.from('commercial_records').select('*').eq('id',recordId).single();if(refreshed.error)throw refreshed.error;const record=refreshed.data as CommercialRecord;
  let documentId=kind==='orcamento'?record.quote_document_id:record.contract_document_id;
  if(!documentId){const inserted=await service.from('documentos').insert({nome:kind==='orcamento'?`Orçamento ${record.quote_number} — ${record.prospect_name}`:`Contrato ${record.contract_number} — ${record.prospect_name}`,tipo:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',categoria:'Comercial',versao:'1.0',storage_bucket:'documentos',permitir_download:true,protection_mode:'administrative',autoral:false,workflow_status:'rascunho',optional_document:false,generated_data:{commercial_record_id:record.id,quote_number:record.quote_number,contract_number:record.contract_number,prospect_name:record.prospect_name,contract_master_id:record.contract_master_id,contract_master_version:record.contract_master_version,smart_texts:record.smart_texts}}).select('id').single();if(inserted.error)throw inserted.error;documentId=inserted.data.id;const linked=await service.from('commercial_records').update(kind==='orcamento'?{quote_document_id:documentId}:{contract_document_id:documentId}).eq('id',record.id);if(linked.error)throw linked.error;}
  const professionalProfile=await loadProfessionalIdentity(service,kind);
  const missingProfile=missingProfessionalFields(professionalProfile,kind);
  if(missingProfile.length)return json({error:`Complete a identificação profissional sigilosa em Configurações antes de gerar este documento. Campos pendentes: ${missingProfile.join(', ')}.`},422);
  const contractMaster=kind==='contrato'?await loadContractMaster(service,record):null;
  const word=kind==='orcamento'?quoteDocument(record,professionalProfile):contractDocument(record,professionalProfile,contractMaster!.body);const buffer=await Packer.toBuffer(word);const number=kind==='orcamento'?record.quote_number:record.contract_number??'contrato';const path=`comercial/${record.id}/${kind}-${number}-v1.0.docx`;
  const uploaded=await service.storage.from('documentos').upload(path,buffer,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:true});if(uploaded.error)throw uploaded.error;
  const updatedDocument=await service.from('documentos').update({arquivo:path,workflow_status:'gerado',generated_at:new Date().toISOString()}).eq('id',documentId);if(updatedDocument.error)throw updatedDocument.error;
  const nextStatus=record.status==='convertido'?'convertido':kind==='contrato'?'contrato_gerado':record.contract_document_id?'contrato_gerado':'orcamento_gerado';const updatedRecord=await service.from('commercial_records').update({status:nextStatus,updated_at:new Date().toISOString()}).eq('id',record.id);if(updatedRecord.error)throw updatedRecord.error;
  await service.from('audit_log').insert({user_id:user.id,action:`generate_commercial_${kind}_docx`,entity_type:'commercial_records',entity_id:record.id,details:{document_id:documentId,path,quote_number:record.quote_number,contract_number:record.contract_number,contract_master_version:record.contract_master_version}});
  return json({generated:true,documentId,path,quoteNumber:record.quote_number,contractNumber:record.contract_number});
 }catch(error){const message=error instanceof Error?error.message:'Não foi possível gerar o documento comercial.';return json({error:message},message.includes('Acesso')?403:message.includes('Sessão')?401:500);}
});
