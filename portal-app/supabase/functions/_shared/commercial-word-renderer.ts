import { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';
type CommercialRecord={id:string;linked_client_id:string|null;linked_contract_id:string|null;linked_project_id:string|null;quote_number:string;contract_number:string|null;status:string;prospect_name:string;cpf_cnpj:string|null;email:string|null;phone:string|null;address:string|null;city:string|null;state:string|null;property_address:string|null;property_type:string|null;area_terreno_m2:number|null;area_construida_m2:number|null;construction_standard:string|null;experience_level:string|null;services:unknown;coobligors:unknown;custom_service:string|null;total_value:number|null;payment_terms:unknown;commercial_terms?:unknown;historical_reconstitution?:boolean;document_version?:string;document_version_reason?:string|null;valid_until:string|null;notes:string|null;quote_document_id:string|null;contract_document_id:string|null;contract_master_id:string|null;contract_master_version:number|null;smart_texts:unknown};
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
const cpfDisplay=(value:unknown)=>{
 const digits=String(value??'').replace(/\D/g,'');
 return digits.length===11?`${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`:String(value??'').trim();
};
const contractCoobligors=(record:CommercialRecord)=>{
 const raw=Array.isArray(record.coobligors)?record.coobligors as Array<Record<string,unknown>>:[];
 return raw.map(item=>({
   kind:String(item.kind??''),
   name:String(item.name??'').trim(),
   cpf:cpfDisplay(item.cpf),
   role:String(item.role??'').trim(),
 })).filter(item=>item.name&&item.cpf);
};
const coobligorRole=(item:{kind:string;role:string})=>{
 if(item.role)return item.role;
 if(item.kind==='spouse_companion')return 'Cônjuge/companheiro(a) — interveniente anuente e coobrigado(a) solidário(a)';
 if(item.kind==='company_guarantor')return 'Sócio/administrador — coobrigado(a) solidário(a)';
 return 'Coobrigado(a) solidário(a)';
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
const quoteSignatureBlock=(placeAndDate:string,proponent:string)=>new Paragraph({
 spacing:{after:0,line:200},
 children:[
  new TextRun({text:placeAndDate,font:'Century Gothic',size:18,color:TEXT}),
  new TextRun({text:'______________________________    ______________________________',break:1,font:'Century Gothic',size:16,color:TEXT}),
  new TextRun({text:`${proponent}                            Aceite do(a) cliente`,break:1,font:'Century Gothic',size:16,color:TEXT})
 ]
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
const makeDoc=(children:(Paragraph|Table)[],profile:ProfessionalIdentity,documentCode:string)=>new Document({
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
const money=(value:number|string|null)=>{
 const amount=value===null||String(value).trim()===''?NaN:Number(value);
 return Number.isFinite(amount)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount):'A definir';
};
const datePt=(raw:string|null)=>raw?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(`${raw}T12:00:00-03:00`)):'A definir';
const generatedDatePt=(value:Date)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(value);
const generatedDateIso=(value:Date)=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
 const part=(type:string)=>parts.find(item=>item.type===type)?.value??'';
 return `${part('year')}-${part('month')}-${part('day')}`;
};
const generatedDateLongPt=(value:Date)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'numeric',month:'long',year:'numeric'}).format(value);
const signaturePlaceAndDate=(city:string|null,generatedAt:Date)=>city?.trim()
 ? `${city.trim()}, ${generatedDateLongPt(generatedAt)}.`
 : `Local: _______________________________ • Data: ${generatedDatePt(generatedAt)}`;
const selectedServices=(record:CommercialRecord)=>Array.isArray(record.services)?record.services.filter((item):item is ServiceItem=>Boolean(item&&typeof item==='object'&&(item as ServiceItem).included!==false)):[];
const arrStrings=(value:unknown)=>Array.isArray(value)?value.map(x=>String(x??'').trim()).filter(Boolean):[];
const unique=(items:string[])=>[...new Set(items.filter(Boolean))];
const levelName=(value:string|null)=> {
 const code=String(value||'').trim().toLowerCase();
 if(code)return code.toUpperCase();
 return 'Não aplicável / não selecionado';
};
const serviceLevelObject=(item:ServiceItem)=>{
 const level=item.level;
 return level&&typeof level==='object'?level as Record<string,unknown>:null;
};
const serviceLevelCode=(item:ServiceItem)=>{
 const level=serviceLevelObject(item);
 return String(level?.code??item.levelCode??'').trim().toLowerCase();
};
const levelLabel=(level:Record<string,unknown>|null)=>{
 if(!level)return '';
 return String(level.label??'').trim();
};
const serviceLevelDisplay=(item:ServiceItem)=>{
 const level=serviceLevelObject(item);
 return levelLabel(level)||levelName(serviceLevelCode(item)||null);
};
const levelEntries=(items:ServiceItem[])=>items
 .filter(item=>item.levelApplicable===true)
 .map(item=>({item,level:serviceLevelObject(item),code:serviceLevelCode(item)}))
 .filter(entry=>Boolean(entry.code));
const serviceDescription=(item:ServiceItem)=>String(item.description??'').trim();
const serviceBudgetDescription=(item:ServiceItem)=>{const result=String(item.budgetDescription??item.description??'').trim();if(!result)throw new Error('Serviço sem descrição específica e produtos técnicos: '+String(item.name??item.code));return result;};
const serviceRevisions=(item:ServiceItem)=>{
 const value=item.revisions;
 return typeof value==='number'?String(value):'PENDENTE DE DEFINIÇÃO — preencher a quantidade de revisões antes da contratação';
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
 const details=commercialTerms(record);
 const methodMap:Record<string,string>={pix:'Pix',transferencia:'Transferência bancária',boleto:'Boleto',dinheiro:'Dinheiro',cartao:'Cartão',cartao_parcelado:'Cartão de crédito parcelado',outro:'Conforme condição específica'};
 const method=String(details.payment_method||'').trim();
 const installments=Array.isArray(details.installments)?details.installments as Array<Record<string,unknown>>:[];
 if(installments.length)return [
   p('Forma de pagamento: '+(methodMap[method]||method||'Não informada')+'.'),
   ...installments.map((term,index)=>{
     const amount=money(String(term.amount??''));
     const date=String(term.due_date||'').trim();
     const event=String(term.due_event||'').trim();
     const due=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)?datePt(date):event||'Não definido';
     return p(`Parcela ${index+1} de ${installments.length}: ${amount} • Vencimento: ${due}`);
   })
 ];
 const terms=Array.isArray(record.payment_terms)?record.payment_terms as Array<Record<string,unknown>>:[];
 if(!terms.length)return [p('Condição de pagamento não informada.')];
 return terms.map((term,index)=>{
   const rawDue=String(term.due??term.dueDate??'').trim();
   const due=/^\d{4}-\d{2}-\d{2}$/.test(rawDue)?datePt(rawDue):rawDue||'Não informado';
   return p(`Parcela ${index+1}: ${money(String(term.value??term.amount??''))} • Vencimento: ${due}`);
 });
};

const legalRepresentative=(record:CommercialRecord)=>{
 const t=commercialTerms(record);
 return t.legal_representative&&typeof t.legal_representative==='object'?t.legal_representative as Record<string,unknown>:{};
};
const isCompany=(record:CommercialRecord)=>String(record.cpf_cnpj??'').replace(/\D/g,'').length===14;
const clientRg=(record:CommercialRecord)=>String((record as Record<string,unknown>).rg??'').trim();
// Endereço completo do cadastro do cliente (não confundir com o local da obra).
const clientFullAddress=(record:CommercialRecord)=>{
 const place=[String(record.city??'').trim(),String(record.state??'').trim()].filter(Boolean).join('/');
 const cep=String(record.cep??'').trim();
 return [String(record.address??'').trim(),place,cep?`CEP ${cep}`:''].filter(Boolean).join(', ')||'não informado';
};
const contractingPartyText=(record:CommercialRecord)=>{
 const contacts=`e-mail ${text(record.email)} e telefone/WhatsApp ${text(record.phone)}`;
 if(isCompany(record))return `CONTRATANTE: ${record.prospect_name}, pessoa jurídica de direito privado inscrita no CNPJ sob o nº ${text(record.cpf_cnpj)}, com sede em ${clientFullAddress(record)}, ${contacts}, doravante denominada simplesmente CONTRATANTE.`;
 const rg=clientRg(record);
 return `CONTRATANTE: ${record.prospect_name}, inscrito(a) no CPF sob o nº ${text(record.cpf_cnpj)}${rg?`, portador(a) do RG nº ${rg}`:''}, residente e domiciliado(a) em ${clientFullAddress(record)}, ${contacts}, doravante denominado(a) simplesmente CONTRATANTE.`;
};
const contractingPartySignature=(record:CommercialRecord)=>isCompany(record)
 ?`CONTRATANTE: ${record.prospect_name} — CNPJ ${text(record.cpf_cnpj)} • Representada por ${String(legalRepresentative(record).name??'').trim()} — CPF ${String(legalRepresentative(record).cpf??'').trim()}`
 :`CONTRATANTE: ${record.prospect_name} — CPF ${text(record.cpf_cnpj)}`;
const legalRepresentativeLabel=(record:CommercialRecord)=>{
 const r=legalRepresentative(record);
 const name=String(r.name??'').trim(),cpf=String(r.cpf??'').replace(/\D/g,''),role=String(r.role??'').trim(),powers=String(r.powers??'').trim();
 if(!name||cpf.length!==11||!role||!powers){
  if(record.historical_reconstitution)return 'Dados do representante não registrados na emissão histórica; conferir a via original antes de utilizar esta cópia reconstituída';
  throw new Error('Representante legal da pessoa jurídica incompleto. Edite a identificação antes de gerar o contrato.');
 }
 return `${name}, CPF nº ${cpfDisplay(cpf)}, na qualidade de ${role}, com poderes de representação: ${powers}`;
};
const commercialTerms=(record:CommercialRecord)=>record.commercial_terms&&typeof record.commercial_terms==='object'?record.commercial_terms as Record<string,unknown>:{};
const termsSchedule=(record:CommercialRecord)=>{
 const t=commercialTerms(record),s=t.schedule&&typeof t.schedule==='object'?t.schedule as Record<string,unknown>:null;
 if(!s)return [];
 const type=String(s.day_type)==='uteis'?'dias úteis':'dias corridos';
 return [p('Início da contagem: '+String(s.start_trigger||'não definido')+'.'),p('Prazo total de elaboração: '+String(s.days||'não definido')+' '+type+'. Prazos de órgãos públicos e terceiros não integram automaticamente o prazo técnico.')];
};
// Limpa pontuação colada ao juntar itens (".;", "..", " ,") e espaços repetidos.
const tidyText=(value:unknown)=>String(value??'').replace(/\s+/gu,' ').replace(/\s+([,;.:])/gu,'$1').replace(/\.+\s*;/gu,';').replace(/;\s*;/gu,';').replace(/\.{2,}/gu,'.').replace(/([,;])(?=\p{L})/gu,'$1 ').trim();
const sentencePart=(value:unknown)=>tidyText(value).replace(/[.!?]+\s*$/u,'');
const scopeQuantityRows=(record:CommercialRecord)=>{
 const t=commercialTerms(record),rows=Array.isArray(t.scope)?t.scope as Array<Record<string,unknown>>:[];
 const services=selectedServices(record);
 return rows.map(row=>{
   const item=services.find(x=>String(x.code||'')===String(row.code||''));
   if(!item)return null;
   const deliverables=sentencePart(row.deliverables);
   if(!deliverables)throw new Error('Entregáveis específicos não preenchidos para a atividade '+String(item.name||row.code)+'.');
   const municipality=['k','l','m'].includes(String(row.code||''));
   const deadline=municipality?'Prazo de análise, aprovação e expedição: depende exclusivamente da Prefeitura, sem prazo garantido; a preparação técnica da CONTRATADA segue o prazo técnico global contratual.':'Prazo técnico: '+String(row.days||'')+' '+(String((t.schedule as Record<string,unknown>|undefined)?.day_type)==='uteis'?'dias úteis':'dias corridos')+'.';
   const notes=municipality&&String(row.municipal_notes||'').trim()?' Observações complementares: '+sentencePart(row.municipal_notes)+'.':'';
   return p(String(item.name||row.code)+': '+String(row.quantity||'')+' '+String(row.unit||'')+'; serviços/entregáveis: '+deliverables+'. '+deadline+' Revisões incluídas: '+String(row.revisions??'')+'; visitas incluídas: '+(row.visits===''?'não previstas':String(row.visits??'não previstas'))+'.'+notes);
 }).filter((x):x is Paragraph=>x!==null);
};

function quoteDocument(record:CommercialRecord,profile:ProfessionalIdentity,generatedAt:Date){
 const selected=selectedServices(record);
 const entries=levelEntries(selected);
 const distinctLevels=[...new Set(entries.map(entry=>entry.code))];
 const commonLevel=distinctLevels.length===1?entries.find(entry=>entry.code===distinctLevels[0])?.level??null:null;
 const legacyLevel=entries.length===0&&record.experience_level?levelName(record.experience_level):'';
 const consolidatedExclusions=unique(selected.flatMap(item=>arrStrings(item.exclusions)));
 const today=generatedDatePt(generatedAt);

 const serviceBlocks:Paragraph[]=[];
 selected.forEach((item,index)=>{
   serviceBlocks.push(serviceHeading(`${index+1}. ${String(item.name??'Serviço')}`));
   if(item.levelApplicable===true&&serviceLevelCode(item)){
     serviceBlocks.push(small(`Nível desta atividade: ${serviceLevelDisplay(item)}.`));
   }
   serviceBlocks.push(p(serviceBudgetDescription(item)));
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
   const terms= commercialTerms(record);
   const particular=Array.isArray(terms.scope)?(terms.scope as Array<Record<string,unknown>>).find(row=>String(row.code||'')===String(item.code||'')):null;
   const revisions=particular?String(particular.revisions??''):serviceRevisions(item);
   const prazo=particular?.deadline_type==='municipal'?'Análise/expedição da Prefeitura sem prazo garantido':particular?.days?String(particular.days)+' '+(String((terms.schedule as Record<string,unknown>|undefined)?.day_type)==='uteis'?'dias úteis':'dias corridos'):'PENDENTE de definição na ficha da atividade';
   serviceBlocks.push(small(`Revisões desta atividade: ${revisions} • Formatos: ${arrStrings(item.deliveryFormats).join(', ')||'conforme contrato'} • Prazo: ${prazo}`));
 });

 if(record.custom_service){
   serviceBlocks.push(serviceHeading('Serviço adicional descrito no orçamento'));
   serviceBlocks.push(p(record.custom_service));
   serviceBlocks.push(small('Este item somente integra o escopo nos limites expressamente descritos nesta proposta e no contrato.'));
 }

 return makeDoc([
  ...title(`PROPOSTA COMERCIAL — ${record.quote_number}`,'Serviços técnicos de engenharia • escopo inteligente e rastreável'),
  p(professionalLabel(profile),true,GOLD),
  p(`Preparada para: ${record.prospect_name}`,true),
  p(`Imóvel / obra: ${text(record.property_address)}`),
  small(`Emissão: ${today} • Validade: ${datePt(record.valid_until)} • Documento vinculado ao orçamento ${record.quote_number}`),

  h('1. VISÃO GERAL DA PROPOSTA'),
  p(smartRule(record,'proposal_scope_governance','Esta proposta organiza o escopo e as condições comerciais sem ampliar, por si só, as obrigações contratuais. Após a formalização, o Contrato passa a reger definitivamente a relação entre as partes.')),
  p(`Cliente / prospect: ${record.prospect_name}`),
  p(`CPF/CNPJ: ${text(record.cpf_cnpj)} • E-mail: ${text(record.email)} • Telefone: ${text(record.phone)}`),
  p(`Tipo de imóvel: ${text(record.property_type)} • Padrão construtivo: ${text(record.construction_standard)}`),
  p(`Área do terreno: ${record.area_terreno_m2??'não informada'} m² • Área construída prevista: ${record.area_construida_m2??'não informada'} m²`),

  h('2. NÍVEIS DE PRESTAÇÃO POR ATIVIDADE'),
  ...(entries.length===0
    ? [p(legacyLevel?`Nível legado do registro: ${legacyLevel}.`:'Nenhum nível foi localizado no snapshot. Revise o orçamento antes da formalização definitiva.')]
    : distinctLevels.length===1
      ? [
          p(`Nível selecionado para as atividades aplicáveis: ${levelLabel(commonLevel)||levelName(distinctLevels[0])}.`,true,GOLD),
          p('Os produtos técnicos próprios de cada atividade selecionada e seus acréscimos por nível são discriminados abaixo, com nome, descrição e entregas correspondentes.'),
        ]
      : [
          p('Os níveis de prestação foram definidos individualmente por atividade.',true,GOLD),
          ...entries.map(({item})=>bullet(`${String(item.name??'Serviço')}: ${serviceLevelDisplay(item)}`)),
        ]),
  small(smartRule(record,'level_scope_rule','O nível de cada atividade altera somente o escopo daquela atividade e não acrescenta automaticamente serviços, visitas, aprovações, execução, taxas, fornecimentos ou entregáveis de outra categoria.')),

  h('3. ESCOPO INTELIGENTE DE SERVIÇOS'),
  ...(selected.length?serviceBlocks:[p('Nenhum serviço foi selecionado. Revise o orçamento antes da emissão definitiva.')]),

  h('4. LIMITES E EXCLUSÕES CONSOLIDADAS'),
  p(smartRule(record,'scope_limits_rule','Somente os itens expressamente incluídos nesta proposta e posteriormente confirmados no contrato integram o escopo. Solicitações posteriores ou itens não previstos serão tratados como serviço adicional, mediante aprovação prévia.')),
  ...consolidatedExclusions.map(value=>bullet(value)),
  bullet('Taxas, emolumentos e despesas de órgãos públicos, cartórios, concessionárias ou entidades de classe não integram os honorários, salvo previsão expressa em contrário.'),
  bullet('ART/RRT e demais despesas vinculadas a registros profissionais somente integram o valor quando expressamente discriminadas.'),

  h('5. PROCESSO DE DESENVOLVIMENTO E REVISÕES'),
  p(smartRule(record,'proposal_revision_rule','Na ausência de indicação específica no contrato, não se presume rodada de revisão de preferência. Alterações de programa, metragem, layout, partido ou premissas já aprovadas podem caracterizar alteração de escopo.')),
  p(smartRule(record,'proposal_client_inputs_rule','O cliente deverá fornecer documentos, respostas de briefing, medidas, aprovações e demais definições necessárias. A falta desses insumos pode suspender ou repercutir no cronograma, nos termos do Contrato.')),

  h('6. PRAZO E CRONOGRAMA'),
  p(smartRule(record,'proposal_timeline_rule','O prazo técnico será exclusivamente o preenchido nas condições comerciais aprovadas e reproduzido no contrato, com indicação de dias úteis ou corridos e do marco inicial da contagem. Não há prazo técnico presumido nem limite padrão aplicável a todas as contratações. Prazos de análise de órgãos públicos e terceiros não são prazos técnicos controlados pela contratada.')),

  h('7. INVESTIMENTO'),
  p(`Valor total dos honorários: ${money(record.total_value)}`,true,GOLD),
  ...paymentLines(record),
  ...termsSchedule(record),
  ...scopeQuantityRows(record),
  ...(record.notes?[p(`Condições / observações comerciais registradas: ${record.notes}`)]:[]),

  h('8. PRÓXIMOS PASSOS'),
  bullet('Aprovação desta proposta pelo cliente, por escrito.'),
  bullet('Formalização do Contrato de Prestação de Serviços com o escopo, valores e parcelas definitivos.'),
  bullet('Pagamento da condição inicial pactuada, quando aplicável.'),
  bullet('Entrega dos documentos, briefings e informações necessários ao início dos trabalhos.'),
  bullet('Agendamento de levantamento ou vistoria somente quando esse serviço estiver incluído.'),

  h('9. VALIDADE E ACEITE'),
  p(`Esta proposta permanece válida até ${datePt(record.valid_until)}. Após essa data, valores, disponibilidade e condições poderão ser revistos antes da formalização.`),
  p('O aceite desta proposta não substitui o Contrato definitivo.'),
  quoteSignatureBlock(signaturePlaceAndDate(record.city,generatedAt),`${profileValue(profile,'full_name')||'Camila Martins'} — proponente`)
 ],profile,record.quote_number);
}


// ---- Contrato Mestre v10: quadro-resumo no início e trechos condicionais ----
// Linhas do Contrato Mestre iniciadas por {{se:<condição>}} (sem colchetes, reservados
// pelo banco a campos provisórios) só entram quando a
// condição se aplica ao cliente; os itens são renumerados e as remissões
// "item N.M" acompanham a nova numeração (remissão a item omitido bloqueia a emissão).
const CONDITION_PREFIX=/^\{\{se:([a-z_]+)\}\}\s*/;
const isConditionalMaster=(record:CommercialRecord,body:string)=>Number(record.contract_master_version)>=10||CONDITION_PREFIX.test(body)||body.includes('{{se:');
const installmentsOf=(record:CommercialRecord)=>{
 const t=commercialTerms(record);
 const list=Array.isArray(t.installments)?t.installments as Array<Record<string,unknown>>:[];
 if(list.length)return list.map(item=>({amount:item.amount,date:String(item.due_date||'').trim(),event:String(item.due_event||'').trim()}));
 const legacy=Array.isArray(record.payment_terms)?record.payment_terms as Array<Record<string,unknown>>:[];
 return legacy.map(item=>{const raw=String(item.due??item.dueDate??'').trim();const isDate=/^\d{4}-\d{2}-\d{2}$/.test(raw);return {amount:item.value??item.amount,date:isDate?raw:'',event:isDate?'':raw};});
};
const contractConditions=(record:CommercialRecord,generatedAt:Date):Record<string,boolean>=>{
 const pj=isCompany(record);
 const limit=new Date(generatedAt.getTime());limit.setFullYear(limit.getFullYear()+1);
 const installments=installmentsOf(record);
 const reajuste=installments.length===0||installments.some(item=>!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||new Date(`${item.date}T12:00:00-03:00`)>limit);
 return {
  legalizacao:selectedServices(record).some(item=>['k','l','m'].includes(String(item.code??'').trim().toLowerCase())),
  reajuste,
  coobrigados:contractCoobligors(record).length>0,
  pf:!pj,
  pj,
 };
};
function conditionalMasterLines(body:string,conditions:Record<string,boolean>){
 const kept:string[]=[];
 const removed=new Set<string>();
 for(const raw of body.split('\n')){
  const line=raw.trim();
  if(!line)continue;
  const match=line.match(CONDITION_PREFIX);
  if(!match){kept.push(line);continue;}
  if(!(match[1] in conditions))throw new Error('Condição desconhecida no Contrato Mestre: '+match[1]+'.');
  const content=line.slice(match[0].length);
  if(conditions[match[1]])kept.push(content);
  else{const n=content.match(/^(\d+\.\d+)\./);if(n)removed.add(n[1]);}
 }
 const renumber=new Map<string,string>();
 let item=0;
 const numbered=kept.map(line=>{
  if(line.startsWith('CLÁUSULA')){item=0;return line;}
  const m=line.match(/^(\d+)\.(\d+)\.\s+/);
  if(!m)return line;
  item+=1;
  const next=`${m[1]}.${item}`;
  renumber.set(`${m[1]}.${m[2]}`,next);
  return `${next}. ${line.slice(m[0].length)}`;
 });
 return numbered.map(line=>line.replace(/\b(itens?) (\d+\.\d+)\b/g,(_all,word,ref)=>{
  if(removed.has(ref))throw new Error(`O Contrato Mestre remete ao item ${ref}, que não se aplica a este contrato. Revise o texto antes de emitir.`);
  return `${word} ${renumber.get(ref)??ref}`;
 }));
}
const CELL_BORDER={style:BorderStyle.SINGLE,size:4,color:'D6DCE3'};
const cellParagraph=(value:string,bold=false,color=TEXT)=>new Paragraph({spacing:{before:40,after:40,line:260},children:[new TextRun({text:value,bold,font:'Century Gothic',size:18,color})]});
const quadroCell=(value:string,options:{bold?:boolean;shade?:boolean;width?:number;color?:string}={})=>new TableCell({
 width:options.width?{size:options.width,type:WidthType.PERCENTAGE}:undefined,
 shading:options.shade?{fill:SOFT}:undefined,
 margins:{top:60,bottom:60,left:110,right:110},
 borders:{top:CELL_BORDER,bottom:CELL_BORDER,left:CELL_BORDER,right:CELL_BORDER},
 children:[cellParagraph(value,options.bold,options.color??(options.shade?NAVY:TEXT))]
});
const keyValueTable=(rows:Array<[string,string,boolean?]>)=>new Table({
 width:{size:100,type:WidthType.PERCENTAGE},
 rows:rows.map(([label,value,highlight])=>new TableRow({children:[
  quadroCell(label,{bold:true,shade:true,width:32}),
  quadroCell(value,{bold:Boolean(highlight),width:68,color:highlight?NAVY:TEXT}),
 ]}))
});
const gridTable=(headers:string[],rows:string[][],widths:number[])=>new Table({
 width:{size:100,type:WidthType.PERCENTAGE},
 rows:[
  new TableRow({tableHeader:true,children:headers.map((label,index)=>quadroCell(label,{bold:true,shade:true,width:widths[index]}))}),
  ...rows.map(row=>new TableRow({children:row.map((value,index)=>quadroCell(value,{width:widths[index]}))})),
 ]
});
const percentPt=(part:number,total:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(part/total*100)+'%';
const paymentMethodLabel=(record:CommercialRecord)=>{
 const map:Record<string,string>={pix:'Pix',transferencia:'Transferência bancária',boleto:'Boleto',dinheiro:'Dinheiro',cartao:'Cartão',cartao_parcelado:'Cartão de crédito parcelado',outro:'Conforme condição específica'};
 const method=String(commercialTerms(record).payment_method||'').trim();
 return map[method]||method||'';
};
const taxIdDisplay=(value:unknown)=>{
 const digits=String(value??'').replace(/\D/g,'');
 if(digits.length===14)return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
 return digits.length===11?cpfDisplay(digits):String(value??'').trim();
};
function contractDocumentV10(sourceRecord:CommercialRecord,profile:ProfessionalIdentity,contractMasterBody:string,generatedAt:Date){
 const record={...sourceRecord,cpf_cnpj:sourceRecord.cpf_cnpj?taxIdDisplay(sourceRecord.cpf_cnpj):sourceRecord.cpf_cnpj};
 const conditions=contractConditions(record,generatedAt);
 const clauses=conditionalMasterLines(contractMasterBody,conditions).map(line=>line.startsWith('CLÁUSULA')?h(line):p(line));
 const selected=selectedServices(record);
 const serviceNames=selected.map(item=>['p','outro','outros'].includes(String(item.code??'').toLowerCase())&&record.custom_service?String(record.custom_service).trim():String(item.name??item.code??'Serviço'));
 const total=Number(record.total_value);
 const installments=installmentsOf(record);
 const method=paymentMethodLabel(record);
 const t=commercialTerms(record);
 const schedule=t.schedule&&typeof t.schedule==='object'?t.schedule as Record<string,unknown>:null;
 const dayType=String(schedule?.day_type)==='uteis'?'dias úteis':'dias corridos';
 const prazo=schedule&&String(schedule.days||'').trim()
  ? `${String(schedule.days).trim()} ${dayType}, contados de: ${sentencePart(schedule.start_trigger)||'evento indicado no Quadro de Escopo'}.${conditions.legalizacao?' Análise e expedição pela Prefeitura não têm prazo garantido.':''}`
  : 'Por atividade, conforme o Quadro de Escopo.';
 const paymentRows=installments.map((item,index)=>{
  const amount=Number(item.amount);
  const due=[item.date?datePt(item.date):'',sentencePart(item.event)].filter(Boolean).join(' — ')||'Na entrega da etapa correspondente';
  return [`${index+1}ª`,money(String(item.amount??'')),Number.isFinite(amount)&&total>0?percentPt(amount,total):'—',due];
 });
 const scopeRows=Array.isArray(t.scope)?t.scope as Array<Record<string,unknown>>:[];
 const countLabel=(value:unknown,none:string)=>{const raw=String(value??'').trim();if(raw==='')return none;const n=Number(raw);return Number.isFinite(n)&&n===0?none:raw;};
 const activityRows=selected.map((item,index)=>{
  const row=scopeRows.find(entry=>String(entry.code??'').toLowerCase()===String(item.code??'').toLowerCase());
  const municipal=String(row?.deadline_type??'')==='municipal';
  const days=String(row?.days??'').trim();
  const prazo=municipal?'Preparação no prazo total do Quadro-Resumo; Prefeitura sem prazo garantido':days?`${days} ${dayType}`:'Prazo geral do contrato';
  const formats=arrStrings(item.deliveryFormats).join(', ');
  const quantity=[String(row?.quantity??'').trim(),String(row?.unit??'').trim()].filter(Boolean).join(' ');
  return [serviceNames[index],quantity||'1',prazo,countLabel(row?.revisions,'Nenhuma'),countLabel(row?.visits,'Nenhuma'),formats||'Conforme detalhamento'];
 });
 // Condições específicas acordadas para este contrato (commercial_terms.specific_clauses).
 const specificClauses=(Array.isArray(t.specific_clauses)?t.specific_clauses as Array<Record<string,unknown>>:[])
  .map(item=>({title:sentencePart(item.title),text:tidyText(item.text)}))
  .filter(item=>item.title&&item.text);
 const isPj=isCompany(record);
 const contractingSummary=`${record.prospect_name} — ${isPj?'CNPJ':'CPF'} ${text(record.cpf_cnpj)}`;
 return makeDoc([
   ...title(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ENGENHARIA — ${text(record.contract_number,'CONTRATO SEM NUMERAÇÃO — NÃO EMITIR')}`),
   small(`Data de emissão: ${generatedDatePt(generatedAt)} • Versão do contrato: v${String(record.document_version||'1.0')}`),
   ...(record.historical_reconstitution?[p('CÓPIA RECONSTITUÍDA A PARTIR DE DADOS HISTÓRICOS — confira antes de usar; não constitui nova revisão.',true,GOLD)]:[]),
   h('QUADRO-RESUMO'),
   keyValueTable([
    ['Contratada',professionalLabel(profile)],
    ['Contratante',contractingSummary],
    ['Imóvel / obra',text(record.property_address)],
    ['Serviço contratado',serviceNames.join('; ')||'Conforme o Quadro de Escopo',true],
    ['Valor total dos honorários',money(record.total_value),true],
    ['Forma de pagamento',`${method?method+', ':''}${installments.length>1?`em ${installments.length} parcelas`:installments.length===1?'em parcela única':'conforme condição registrada'}, conforme o quadro Parcelas e Entregas`,true],
    ['Prazo',prazo],
    ['Revisões e visitas incluídas','Por atividade, na tabela do Quadro de Escopo'],
    ['Taxas e serviços de terceiros','Por conta do(a) CONTRATANTE (ART, Prefeitura, cartório, topografia, sondagem e outros), conforme a Cláusula 4'],
   ]),
   h('PARCELAS E ENTREGAS'),
   ...(paymentRows.length
     ? [gridTable(['Parcela','Valor','% do total','Vencimento'],paymentRows,[12,22,14,52])]
     : [p('Condição de pagamento não informada.')]),
   h('QUADRO DE ESCOPO — O QUE ESTÁ INCLUSO'),
   ...(activityRows.length?[gridTable(['Atividade','Quantidade','Prazo','Revisões incluídas','Visitas incluídas','Formato'],activityRows,[28,13,20,12,12,15]),p('Detalhamento das entregas de cada atividade:',true,NAVY)]:[]),
   ...(specificClauses.length?[
     h('CONDIÇÕES ESPECÍFICAS DESTE CONTRATO'),
     p('As condições abaixo foram acordadas para este contrato, integram o Quadro de Escopo e prevalecem sobre as cláusulas gerais naquilo em que dispuserem de forma diferente.'),
     ...specificClauses.flatMap((item,index)=>[p(`E.${index+1}. ${item.title}`,true,NAVY),p(item.text)]),
   ]:[]),
   h('QUALIFICAÇÃO DAS PARTES'),
   p(`CONTRATADA: ${professionalQualification(profile)}, doravante denominada CONTRATADA.`),
   p(contractingPartyText(record)),
   ...(isPj ? [p('Representante legal da pessoa jurídica: '+legalRepresentativeLabel(record)+'.')] : []),
   ...contractCoobligors(record).map(item=>p(`COOBRIGADO(A) SOLIDÁRIO(A): ${item.name}, CPF nº ${item.cpf}, na qualidade de ${coobligorRole(item)}, aderindo expressamente às obrigações solidárias previstas neste instrumento.`)),
   p('As partes acima identificadas celebram este contrato, que se rege pelas cláusulas a seguir.'),
   ...clauses,
   h('ASSINATURAS'),
   p('E, por estarem de acordo, as partes assinam este contrato.'),
   p('Local: _______________________________ • Data da assinatura: ____/____/________'),
   p('_____________________________________________'),
   p(professionalLabel(profile)+' — CONTRATADA'),
   p('_____________________________________________'),
   p(contractingPartySignature(record)),
   ...contractCoobligors(record).flatMap(item=>[
     p('_____________________________________________'),
     p(`${item.name} — CPF ${item.cpf}`),
     small(coobligorRole(item)),
   ]),
   p('Testemunhas (dispensadas na assinatura eletrônica):'),
   p('1) ______________________________  CPF: ______________________'),
   p('2) ______________________________  CPF: ______________________')
 ],profile,record.contract_number??'');
}

function contractDocument(record:CommercialRecord,profile:ProfessionalIdentity,contractMasterBody:string,generatedAt:Date){
 if(isConditionalMaster(record,contractMasterBody))return contractDocumentV10(record,profile,contractMasterBody,generatedAt);
 const body=contractMasterBody.split('\n').filter(Boolean).map(line=>line.startsWith('CLÁUSULA')?h(line):p(line));
 const selected=selectedServices(record);
 const entries=levelEntries(selected);
 const distinctLevels=[...new Set(entries.map(entry=>entry.code))];
 const contractLevelSummary=entries.length===0
   ? levelName(record.experience_level)
   : distinctLevels.length===1
     ? serviceLevelDisplay(entries[0].item)
     : 'definidos individualmente por atividade no escopo técnico vinculado';
 return makeDoc([
   ...title(`CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE ENGENHARIA — ${text(record.contract_number,'CONTRATO SEM NUMERAÇÃO — NÃO EMITIR')}`,'Instrumento particular • identidade profissional protegida'),
   small(`Data de emissão: ${generatedDatePt(generatedAt)} • Versão do contrato: v${String(record.document_version||'1.0')} • Data de assinatura: a preencher no ato da assinatura`),
   ...(record.historical_reconstitution?[p('CÓPIA RECONSTITUÍDA A PARTIR DE DADOS HISTÓRICOS — confira antes de usar; não constitui nova revisão.',true,GOLD)]:[]),
   p('Pelo presente instrumento particular de Contrato de Prestação de Serviços de Engenharia, de um lado:'),
   p(`CONTRATADO(A): ${professionalQualification(profile)}, doravante denominada simplesmente CONTRATADO(A);`),
   p(contractingPartyText(record)),
   ...(isCompany(record) ? [p('Representante legal da pessoa jurídica: '+legalRepresentativeLabel(record)+'.')] : []),
   ...contractCoobligors(record).map(item=>p(`COOBRIGADO(A) SOLIDÁRIO(A): ${item.name}, CPF nº ${item.cpf}, na qualidade de ${coobligorRole(item)}, aderindo expressamente às obrigações solidárias previstas neste instrumento.`)),
   p('Têm entre si, justo e acertado, o presente Contrato de Prestação de Serviços de Engenharia, que se regerá pelas cláusulas e condições a seguir:'),
   ...body,
   h('RESUMO COMERCIAL VINCULADO'),
   p(`Valor total dos honorários: ${money(record.total_value)}.`,true,GOLD),
   p(`Nível de prestação: ${contractLevelSummary}.`),
   p('As condições comerciais, os quantitativos, os prazos individualizados, as parcelas e a forma de pagamento constam do quadro abaixo (Quadro de Condições Comerciais), que integra este contrato. A versão emitida preserva os dados aprovados no momento da emissão.'),
   h('PARCELAMENTO E VENCIMENTOS'),
   ...paymentLines(record),
   h('PRAZOS E QUANTITATIVOS CONTRATADOS'),
   ...termsSchedule(record),
   ...scopeQuantityRows(record),
   p('E por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.'),
   p('Local: _______________________________ • Data da assinatura: ____/____/________'),
   p('_____________________________________________'),
   p(professionalLabel(profile)),
   p('_____________________________________________'),
   p(contractingPartySignature(record)),
   ...contractCoobligors(record).flatMap(item=>[
     p('_____________________________________________'),
     p(`${item.name} — CPF ${item.cpf}`),
     small(coobligorRole(item)),
   ]),
   p('Testemunhas:'),
   p('1) ______________________________  CPF: ______________________'),
   p('2) ______________________________  CPF: ______________________')
 ],profile,record.contract_number??'');
}

export { quoteDocument, contractDocument, loadProfessionalIdentity, missingProfessionalFields, loadContractMaster, generatedDateIso };
export type { CommercialRecord };
