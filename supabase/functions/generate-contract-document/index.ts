import { createClient } from 'supabase';
import { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, VerticalAlign } from 'docx';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }); }
function env() { const url=Deno.env.get('SUPABASE_URL'); const anonKey=Deno.env.get('SUPABASE_ANON_KEY'); const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'); if(!url||!anonKey||!serviceKey) throw new Error('Configuração segura do Supabase ausente.'); return {url,anonKey,serviceKey}; }
async function requireAdmin(req: Request) { const auth=req.headers.get('Authorization'); if(!auth?.startsWith('Bearer ')) throw new Error('Sessão administrativa ausente.'); const {url,anonKey,serviceKey}=env(); const caller=createClient(url,anonKey,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}); const {data:userData,error:userError}=await caller.auth.getUser(); if(userError||!userData.user) throw new Error('Sessão administrativa inválida.'); const {data:isAdmin,error:adminError}=await caller.rpc('is_portal_admin'); if(adminError||isAdmin!==true) throw new Error('Acesso administrativo necessário.'); return {caller,service:createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}),user:userData.user}; }

type Data=Record<string,unknown>;
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
  return [
    profileValue(profile,'full_name'),
    profileValue(profile,'professional_title')||'Engenheira Civil',
    creaLabel(profile)
  ].filter(Boolean).join(' — ');
};
async function loadProfessionalIdentity(service:any):Promise<ProfessionalIdentity>{
  const {data,error}=await service.rpc('service_get_professional_signature');
  if(error)throw error;
  return (data&&typeof data==='object'?data:{}) as ProfessionalIdentity;
}
const missingProfessionalFields=(profile:ProfessionalIdentity)=>{
  const missing:string[]=[];
  if(!profileValue(profile,'full_name'))missing.push('nome civil completo');
  if(!creaLabel(profile))missing.push('CREA');
  return missing;
};


const NAVY='0B1726';
const GOLD='B89A63';
const TEXT='26313D';
const MUTED='667281';

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
const gridTable=(headers:string[],rows:string[][])=>new Table({
 width:{size:100,type:WidthType.PERCENTAGE},
 rows:[
  new TableRow({children:headers.map(text=>new TableCell({width:{size:Math.floor(100/headers.length),type:WidthType.PERCENTAGE},verticalAlign:VerticalAlign.CENTER,children:[p(text,true,NAVY)]}))}),
  ...rows.map(row=>new TableRow({children:headers.map((_,index)=>new TableCell({verticalAlign:VerticalAlign.CENTER,children:[p(row[index]||' ')]}))}))
 ]
});
const compactH=(text:string)=>new Paragraph({
 heading:HeadingLevel.HEADING_2,
 spacing:{before:180,after:90},
 border:{bottom:{color:GOLD,style:BorderStyle.SINGLE,size:8,space:5}},
 children:[new TextRun({text,bold:true,font:'Century Gothic',size:23,color:NAVY})]
});
const sub=(text:string)=>new Paragraph({
 spacing:{before:170,after:80},
 children:[new TextRun({text,bold:true,font:'Century Gothic',size:20,color:GOLD})]
});
const t=(text:string,subtitle?:string)=>[
 new Paragraph({
   alignment:AlignmentType.CENTER,
   spacing:{before:180,after:100},
   children:[new TextRun({text:'CAMILA MARTINS',bold:true,font:'Century Gothic',size:22,color:GOLD,characterSpacing:40})]
 }),
 new Paragraph({
   alignment:AlignmentType.CENTER,
   spacing:{after:320},
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
const value=(d:Data,key:string,fallback='Não informado')=>typeof d[key]==='string'&&String(d[key]).trim()?String(d[key]).trim():fallback;
const datePt=(raw:unknown,fallback='Não informado')=>{
 if(typeof raw!=='string'||!raw)return fallback;
 const date=new Date(raw);
 return Number.isNaN(date.getTime())?raw:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
};
const dateTimePt=(raw:unknown,fallback='Não informado')=>{
 if(typeof raw!=='string'||!raw)return fallback;
 const date=new Date(raw);
 return Number.isNaN(date.getTime())?raw:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);
};
const generatedDatePt=(value:Date)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(value);
const generatedDateIso=(value:Date)=>{
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(value);
 const part=(type:string)=>parts.find(item=>item.type===type)?.value??'';
 return `${part('year')}-${part('month')}-${part('day')}`;
};
const contractMasterLabel=(d:Data)=>{
 const version=Number(d.contract_master_version);
 return Number.isInteger(version)&&version>0?`Contrato Mestre v${version}`:'Contrato Mestre não identificado';
};
const money=(raw:unknown)=>{
 const n=Number(raw);
 return Number.isFinite(n)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):'A definir';
};

const smartRule=(d:Data,code:string,fallback:string)=>{
 const all=d.smart_texts&&typeof d.smart_texts==='object'?d.smart_texts as Record<string,unknown>:{};
 const item=all[code];
 if(item&&typeof item==='object'){
   const body=(item as Record<string,unknown>).body;
   if(typeof body==='string'&&body.trim())return body.trim();
 }
 return fallback;
};

const arrStrings=(value:unknown)=>Array.isArray(value)?value.map(x=>String(x??'').trim()).filter(Boolean):[];
const unique=(values:string[])=>[...new Set(values.filter(Boolean))];
const scopeItems=(d:Data)=>{
 const raw=Array.isArray(d.scope_items)?d.scope_items:Array.isArray(d.scope_snapshot)?d.scope_snapshot:[];
 return raw as Array<Record<string,unknown>>;
};
const includedScope=(d:Data)=>scopeItems(d).filter(item=>item.included===true);
const excludedScope=(d:Data)=>scopeItems(d).filter(item=>item.included!==true);
const serviceName=(item:Record<string,unknown>)=>String(item.name??item.service_name??item.code??'Serviço');
const serviceDescription=(item:Record<string,unknown>)=>String(item.description??'Serviço técnico conforme escopo contratado e Anexo I.');
const serviceAnnexDescription=(item:Record<string,unknown>)=>{
 const custom=String(item.customDescription??'').trim();
 const code=String(item.code??'').trim().toLowerCase();
 if(['p','outro','outros'].includes(code)&&custom){
   return `Atividade específica contratada: ${custom}. O escopo fica limitado às atividades, etapas, entregáveis, quantidades, formatos, revisões, visitas e prazos expressamente registrados neste Anexo I; qualquer ampliação dependerá de aprovação e contratação prévias.`;
 }
 return String(item.annexScope??item.description??'Serviço técnico conforme escopo contratado e Anexo I.');
};
const itemLevelCode=(item:Record<string,unknown>)=>{
 const level=item.level&&typeof item.level==='object'?item.level as Record<string,unknown>:null;
 return String(level?.code??item.levelCode??'').trim().toLowerCase();
};
const itemLevelLabel=(item:Record<string,unknown>)=>{
 const level=item.level&&typeof item.level==='object'?item.level as Record<string,unknown>:null;
 const label=String(level?.label??'').trim();
 return label||itemLevelCode(item).toUpperCase();
};
const levelData=(d:Data)=>d.service_level&&typeof d.service_level==='object'?d.service_level as Record<string,unknown>:null;
const levelName=(d:Data)=>{
 const level=levelData(d);
 if(level)return String(level.label??'').trim()||String(d.experience_level??'').trim().toUpperCase();
 const code=String(d.experience_level??'').trim();
 if(code)return code.toUpperCase();
 return 'Não aplicável / não selecionado';
};
const levelEligibleServices=(d:Data)=>includedScope(d).filter(item=>item.levelApplicable===true).map(serviceName);
const consolidatedExclusions=(d:Data)=>unique(includedScope(d).flatMap(item=>arrStrings(item.exclusions)));
const contractedScopeLines=(d:Data)=>includedScope(d).map(item=>`(${String(item.code??'')}) ${serviceName(item)}`);
const scopeMatch=(d:Data)=>{
 const title=String(d.approval_title??'').toLowerCase();
 if(!title)return null;
 return includedScope(d).find(item=>{
   const name=serviceName(item).toLowerCase();
   const code=String(item.code??'').toLowerCase();
   return title.includes(name)||name.includes(title)||(code&&new RegExp(`(^|\\W)${code}(\\W|$)`).test(title));
 })||null;
};
const paymentLines=(d:Data)=>{
 const terms=Array.isArray(d.payment_terms)?d.payment_terms as Array<Record<string,unknown>>:[];
 if(!terms.length)return [p('Forma de pagamento: conforme condições registradas no contrato e na proposta comercial de origem.')];
 return terms.map((term,index)=>p(`${index+1}. ${String(term.label??term.description??'Parcela')} — ${String(term.value??term.amount??'valor conforme registro')} — ${String(term.due??term.dueDate??'vencimento conforme registro')}`));
};
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
   children:[new TextRun({text:`${professionalLabel(profile)}  •  ${documentCode}`,font:'Century Gothic',size:13,color:MUTED})]
 })
]});
const clientIdentity=(d:Data)=>value(d,'client_cpf_cnpj',value(d,'client_document',value(d,'cpf_cnpj','não informado')));
const identity=(d:Data,profile:ProfessionalIdentity,generatedAt:Date)=>[
 h('1. IDENTIFICAÇÃO'),
 p(`Data de emissão: ${generatedDatePt(generatedAt)}`),
 p(`Contrato: ${value(d,'contract_number')} • Data de assinatura: ${datePt(d.contract_signed_at,generatedDatePt(generatedAt))}`),
 p(`CONTRATADO(A): ${professionalLabel(profile)}`),
 p(`CONTRATANTE: ${value(d,'client_name')} • CPF/CNPJ: ${clientIdentity(d)}`),
 p(`Projeto: ${value(d,'project_name')} • Tipo: ${value(d,'project_type')}`),
 p(`Imóvel / obra: ${value(d,'property_address')}`),
 ...(d.source_quote_number?[small(`Orçamento de origem: ${String(d.source_quote_number)}`)]:[])
];
const sig=(profile:ProfessionalIdentity,generatedAt:Date,d:Data={})=>[
 p(`Local: _______________________________ • Data: ${generatedDatePt(generatedAt)}`),
 p('_______________________________________________'),
 p(professionalLabel(profile)),
 p('_______________________________________________'),
 p(`CONTRATANTE: ${value(d,'client_name')} • CPF/CNPJ: ${clientIdentity(d)}`)
];
const doc=(children:Paragraph[],profile:ProfessionalIdentity,documentCode:string)=>new Document({
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
const levelSection=(d:Data,heading='NÍVEL DE PRESTAÇÃO DE SERVIÇO',headingBuilder=h)=>{
 const perItem=includedScope(d)
   .filter(item=>item.levelApplicable===true&&itemLevelCode(item))
   .map(item=>({item,code:itemLevelCode(item),label:itemLevelLabel(item)}));
 const distinct=[...new Set(perItem.map(entry=>entry.code))];
 if(perItem.length){
   const out:Paragraph[]=[headingBuilder(heading)];
   out.push(p(distinct.length===1
     ? `Nível aplicado às atividades elegíveis: ${perItem[0]?.label||distinct[0].toUpperCase()}.`
     : 'Os níveis de prestação foram definidos individualmente por atividade.',true,GOLD));
   perItem.forEach(entry=>out.push(bullet(`(${String(entry.item.code??'')}) ${serviceName(entry.item)} — ${entry.label}`)));
   out.push(small('O nível de uma atividade não amplia automaticamente o escopo de outra atividade nem acrescenta serviços, visitas, aprovações, execução, taxas, fornecimentos ou entregáveis não contratados.'));
   return out;
 }
 const level=levelData(d);
 const eligible=levelEligibleServices(d);
 const out:Paragraph[]=[
   headingBuilder(heading),
   p(`Nível vinculado ao contrato: ${levelName(d)}`,true,GOLD)
 ];
 if(level){
   out.push(p(String(level.description??'')));
   arrStrings(level.features).forEach(item=>out.push(bullet(item)));
   arrStrings(level.exclusions).forEach(item=>out.push(bullet(`Não incluído neste nível: ${item}`)));
 }
 if(eligible.length){
   out.push(small(`Aplicável aos serviços elegíveis: ${eligible.join(', ')}.`));
 }else{
   out.push(small('O nível não amplia serviços que não tenham sido contratados expressamente.'));
 }
 out.push(small(smartRule(d,'level_scope_rule','O nível selecionado aplica-se somente aos serviços elegíveis e não acrescenta automaticamente itens que não tenham sido contratados expressamente.')));
 return out;
};
function build(kind:string,d:Data,profile:ProfessionalIdentity,generatedAt:Date){
 const code=`${value(d,'contract_number','SEM-CONTRATO')} • ${kind.replaceAll('_',' ').toUpperCase()}`;

 if(kind==='notificacao_formal'){
   const days=typeof d.regularization_days==='number'?d.regularization_days:3;
   const reason=value(d,'notification_reason','Ausência de manifestação sobre etapa entregue dentro do prazo contratual.');
   return doc([
     ...t('NOTIFICAÇÃO FORMAL','Pendência contratual • comunicação objetiva e rastreável'),
     ...identity(d,profile,generatedAt),
     h('2. MOTIVO DA NOTIFICAÇÃO'),
     p(reason,true),
     h('3. REGISTRO DO FATO'),
     p(`Etapa / decisão aguardando manifestação: ${value(d,'approval_title')}.`),
     p(`Material entregue em ${datePt(d.delivered_at)}. Prazo de manifestação registrado até ${datePt(d.approval_due_at)}.`),
     ...(d.approval_description?[p(`Descrição da entrega: ${String(d.approval_description)}`)]:[]),
     h('4. PRAZO ADICIONAL PARA REGULARIZAÇÃO'),
     p(`Por cautela e para permitir a continuidade organizada do projeto, concede-se prazo adicional de ${days} dia(s) corrido(s) para manifestação. Esse prazo administrativo não altera o prazo contratual originalmente transcorrido nem amplia o escopo contratado.`),
     h('5. EFEITOS ENQUANTO A PENDÊNCIA PERSISTIR'),
     p(smartRule(d,'notification_rule','A contagem dos prazos de execução pode permanecer suspensa quando a falta de manifestação impedir tecnicamente a continuidade dos serviços. Eventuais efeitos financeiros ou serviços adicionais somente serão aplicados quando houver fundamento no Contrato, no Anexo I e comunicação correspondente.')),
     bullet('A contagem dos prazos de execução pode permanecer suspensa quando a falta de manifestação impedir tecnicamente a continuidade dos serviços.'),
     bullet('Eventuais efeitos financeiros ou serviços adicionais somente serão aplicados quando houver fundamento no Contrato, no Anexo I e comunicação correspondente.'),
     bullet('A retomada do fluxo ocorrerá após o recebimento das informações ou aprovações necessárias.'),
     h('6. CANAIS E REGISTRO'),
     p('Esta notificação integra o histórico documental do projeto e é encaminhada pelos canais oficiais previstos no contrato.'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 if(kind==='termo_aceite'){
   const matched=scopeMatch(d);
   const deliverables=matched?arrStrings(matched.deliverables):[];
   const revisions=matched?.revisions;
   const acceptanceTypes:Record<string,string>={stage_delivery:'ENTREGA DE ETAPA',document_delivery:'ENTREGA DE DOCUMENTO',image_authorization:'AUTORIZAÇÃO DE USO DE IMAGEM',service_completion:'CONCLUSÃO / FINALIZAÇÃO DO SERVIÇO',other:'MANIFESTAÇÃO CONTRATUAL'};
   const acceptanceType=String(d.acceptance_type??'').trim();
   const acceptanceLabel=acceptanceTypes[acceptanceType]||String(d.approval_type??'').trim().toUpperCase()||'ENTREGA / ETAPA';
   return doc([
     ...t(`TERMO DE ACEITE — ${acceptanceLabel}`,'Manifestação a ser registrada pelo(a) CONTRATANTE no Portal do Cliente'),
     ...identity(d,profile,generatedAt),
     h('2. OBJETO DO ACEITE'),
     p(`Referência: ${value(d,'approval_title')}`,true,GOLD),
     ...(d.acceptance_subject?[p(`Objeto específico informado para este termo: ${String(d.acceptance_subject)}`)]:[]),
     ...(matched?[p(serviceDescription(matched)),small(`Serviço relacionado: (${String(matched.code??'')}) ${serviceName(matched)}`)]:[]),
     ...(d.approval_description?[p(`Descrição registrada da entrega: ${String(d.approval_description)}`)]:[]),
     ...(deliverables.length?[sub('Entregáveis relacionados'),...deliverables.map(bullet)]:[]),
     h('3. DADOS DA ENTREGA'),
     p(`Data do envio/entrega: ${datePt(d.delivered_at)}`),
     p(`Prazo de manifestação: até ${datePt(d.approval_due_at)}`),
     ...(matched?[p(`Revisões previstas para este serviço: ${typeof revisions==='number'?revisions:'conforme Anexo I'}.`)]:[]),
     h('4. COMO O ACEITE É REGISTRADO'),
     p(smartRule(d,'acceptance_rule','O(A) CONTRATANTE deverá registrar sua manifestação no Portal do Cliente, podendo aceitar, aceitar com ressalvas ou recusar a versão disponibilizada. A manifestação ficará vinculada à versão exata do documento e ao respectivo snapshot.')),
     gridTable(['Manifestação','Registro'],[['Aceite sem ressalvas','Registrado eletronicamente no Portal do Cliente'],['Aceite com ressalvas','Registrado no Portal com as observações do cliente'],['Recusa','Registrada no Portal com a justificativa informada']]),
     ...(d.acceptance_admin_notes?[p(`Observação da emissão: ${String(d.acceptance_admin_notes)}`)]:[]),
     h('5. CONTINUIDADE DO PROJETO'),
     p('Após a manifestação, o status é atualizado no histórico do contrato. A continuidade considera somente as etapas efetivamente previstas no Anexo I e no cronograma aplicável.'),
     h('6. IDENTIFICAÇÃO'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 if(kind==='servico_adicional'){
   const base=contractedScopeLines(d);
   const reasons=arrStrings(d.reasons);
   const reasonLabels:Record<string,string>={extra_revisions:'Revisão além das rodadas incluídas',scope_change:'Alteração de escopo, premissas, programa, metragem ou layout',level_upgrade:'Migração para nível de prestação superior',survey:'Vistoria ou levantamento não incluído',editable_file:'Arquivo editável ou formato não previsto',other:'Outro motivo'};
   const pricingLabels:Record<string,string>={hour:'Hora técnica',percentage:'Percentual sobre etapa afetada',fixed:'Valor fechado para esta atividade'};
   return doc([
     ...t('TERMO DE SERVIÇO ADICIONAL','Aditivo de escopo vinculado ao contrato vigente • sujeito ao aceite do cliente'),
     ...identity(d,profile,generatedAt),
     h('2. VÍNCULO COM O CONTRATO VIGENTE'),
     p('Este documento integra o histórico do contrato identificado acima. Não cria um contrato paralelo e não apaga, substitui ou reescreve o escopo originalmente contratado.'),
     ...(base.length?base.map(bullet):[p('Nenhum item de escopo foi localizado no snapshot contratual; revisar antes da emissão.')]),
     h('3. ORIGEM DA NOVA SOLICITAÇÃO'),
     ...(reasons.length?reasons.map(reason=>bullet(reasonLabels[reason]||reason)):[p('Origem não informada.')]),
     ...(value(d,'other_reason','')?[p(`Detalhamento adicional: ${value(d,'other_reason')}`)]:[]),
     h('4. NOVA ATIVIDADE CONTRATADA'),
     p(`Atividade: ${value(d,'additional_service_code','—')} • ${value(d,'additional_service_name','Serviço adicional')}${value(d,'additional_service_level','')?` • nível ${value(d,'additional_service_level_label',value(d,'additional_service_level'))}`:''}.`,true,GOLD),
     p(value(d,'additional_service_description',value(d,'service_description','Descrição não informada.'))),
     h('5. IMPACTO COMERCIAL E DE PRAZO'),
     p(`Critério comercial: ${pricingLabels[String(d.pricing??'')]||value(d,'pricing','conforme negociação registrada')}.`),
     p(`Valor adicional: ${value(d,'additional_value','não informado')}.`,true,GOLD),
     p(`Forma de pagamento: ${value(d,'payment_method','não informada')}.`),
     ...(value(d,'new_total_value','')?[p(`Novo total contratual de referência após este adicional: ${money(d.new_total_value)}.`,true,GOLD)]:[]),
     p(`Impacto no cronograma: ${value(d,'schedule_impact','sem impacto adicional informado')}.`),
     p(smartRule(d,'additional_service_rule','O serviço adicional somente poderá ser iniciado depois da manifestação do(a) CONTRATANTE. O aceite desta versão vincula a nova atividade, seu valor e suas condições ao contrato vigente, preservando integralmente o histórico anterior.')),
     h('6. ACEITE DO CLIENTE'),
     p('A aprovação desta contratação adicional será registrada pelo(a) CONTRATANTE no Portal do Cliente. O sistema vinculará a manifestação à versão exata deste documento.'),
     h('7. IDENTIFICAÇÃO'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 if(kind==='autorizacao_imagem'){
   return doc([
     ...t('AUTORIZAÇÃO DE USO DE IMAGEM E DIVULGAÇÃO','Permissões específicas para portfólio e comunicação profissional'),
     ...identity(d,profile,generatedAt),
     h('2. MATERIAIS QUE PODERÃO SER UTILIZADOS'),
     p('Marque somente os materiais autorizados:'),
     p('☐ Fotografias externas / fachada.'),
     p('☐ Fotografias de interiores.'),
     p('☐ Renders 3D e imagens de apresentação.'),
     p('☐ Plantas e pranchas sem dados pessoais sensíveis.'),
     p('☐ Vídeos e tour virtual 360°.'),
     p('☐ Registros de obra sem identificação de pessoas.'),
     h('3. CANAIS AUTORIZADOS'),
     p('☐ Portfólio profissional e site.   ☐ Redes sociais.   ☐ Apresentações comerciais.'),
     p('☐ Publicações técnicas, concursos e premiações.   ☐ Material impresso institucional.'),
     h('4. RESTRIÇÕES DE PRIVACIDADE'),
     p('☐ Não divulgar endereço exato.'),
     p('☐ Não divulgar nome do(a) cliente.'),
     p('☐ Não utilizar imagens com pessoas identificáveis sem autorização específica.'),
     p('☐ Aguardar ______ meses após a conclusão para a primeira divulgação.'),
     p('☐ Outras restrições: _______________________________________________'),
     h('5. CONDIÇÕES'),
     p(smartRule(d,'image_authorization_conditions','A autorização é gratuita e não exclusiva, limitada aos materiais e canais assinalados. A divulgação deverá respeitar as restrições indicadas, a legislação aplicável e os direitos autorais técnicos.')),
     p('A revogação futura poderá ser solicitada por escrito com efeitos prospectivos, sem exigir a retirada de materiais já publicados de boa-fé quando isso não for técnica ou razoavelmente possível, ressalvados direitos legais.'),
     h('6. ASSINATURAS'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 if(kind==='quitacao_encerramento'){
   const base=contractedScopeLines(d);
   return doc([
     ...t('TERMO DE QUITAÇÃO E ENCERRAMENTO','Consolidação documental do término da relação contratual'),
     ...identity(d,profile,generatedAt),
     h('2. MOTIVO DO ENCERRAMENTO'),
     p('☐ Conclusão integral do escopo contratado.'),
     p('☐ Rescisão antecipada por iniciativa do(a) CONTRATANTE.'),
     p('☐ Rescisão antecipada por iniciativa do(a) CONTRATADO(A).'),
     p('☐ Rescisão por mútuo acordo.'),
     p('☐ Outro: _______________________________________________'),
     h('3. ESCOPO CONTRATUAL DE REFERÊNCIA'),
     ...(base.length?base.map(bullet):[p('Escopo não localizado automaticamente; revisar o Anexo I.')]),
     h('4. ENTREGAS E PENDÊNCIAS'),
     p('Arquivos e documentos finais entregues: __________________________________________'),
     p('Pendências técnicas ou administrativas que permanecem abertas: _____________________'),
     p('Processos perante órgãos públicos ainda em andamento, quando aplicável: _____________'),
     h('5. SITUAÇÃO FINANCEIRA'),
     p(`Valor contratual registrado: ${money(d.contract_value)}.`),
     p('☐ Quitação integral.'),
     p('☐ Existe saldo pendente no valor de __________________ com vencimento em __________.'),
     h('6. OBRIGAÇÕES QUE PERMANECEM'),
     bullet('Direitos autorais e condições de uso dos materiais técnicos.'),
     bullet('Confidencialidade e proteção de dados quando aplicáveis.'),
     bullet('Responsabilidades técnicas e civis previstas em lei.'),
     bullet('Obrigações referentes a saldos, garantias ou processos expressamente indicados neste termo.'),
     h('7. DECLARAÇÃO FINAL'),
     p(smartRule(d,'closing_release_rule','A quitação, quando assinalada, refere-se às obrigações identificadas neste instrumento e não representa renúncia a direitos irrenunciáveis ou exclusão de responsabilidades legais.')),
     h('8. ASSINATURAS'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 if(kind==='levantamento_tecnico'){
   const inputs=unique(includedScope(d).flatMap(item=>arrStrings(item.clientInputs)));
   const observed=arrStrings(d.observed);
   const conditions=arrStrings(d.conditions);
   const observedLabels:Record<string,string>={electrical:'Instalações / pontos elétricos',hydraulic:'Instalações / pontos hidráulicos',sanitary:'Esgoto / ventilação sanitária',structure:'Estrutura aparente',masonry:'Alvenarias e vedações',frames:'Esquadrias',finishes:'Pisos / revestimentos / pinturas',roof:'Cobertura / telhado',waterproofing:'Impermeabilização',drainage:'Drenagem / águas pluviais',facade:'Fachadas',stairs:'Escadas / guarda-corpos',accessibility:'Acessibilidade',fire_safety:'Elementos de segurança contra incêndio',dimensions:'Dimensões / níveis / pé-direito',equipment:'Equipamentos / instalações existentes',access:'Acessos e circulação',other:'Outros'};
   const conditionLabels:Record<string,string>={cracks:'Fissuras / trincas',moisture:'Umidade / infiltração',levels:'Desníveis / deformações',corrosion:'Corrosão aparente',detachment:'Desplacamentos / destacamentos',leaks:'Vazamentos',wear:'Desgaste / deterioração',document_mismatch:'Divergência entre realidade e documentos',restricted_access:'Acesso restrito',safety_risk:'Condição aparente que requer avaliação de segurança',no_anomaly:'Sem anomalia aparente'};
   const responsible=value(d,'technical_responsible',profileValue(profile,'full_name')||'Responsável técnico não informado');
   return doc([
     ...t('FICHA DE LEVANTAMENTO TÉCNICO / VISTORIA','Registro editável das condições verificadas no local'),
     ...identity(d,profile,generatedAt),
     p(`Data e horário da vistoria: ${dateTimePt(d.survey_datetime??d.visit_datetime)}`),
     p(`Responsável pelo acompanhamento no local: ${value(d,'site_companion',value(d,'accompanying_person','Não informado'))}`),
     p(`Responsável técnico pelo registro: ${responsible}`),
     h('2. DADOS DO IMÓVEL'),
     p(`Tipo cadastrado do imóvel/projeto: ${value(d,'project_type')} • Área do terreno: ${String(d.area_terreno_m2??'não informada')} m² • Área construída: ${String(d.area_construida_m2??'não informada')} m²`),
     p(`Endereço: ${value(d,'property_address')}`),
     h('3. INFORMAÇÕES E DOCUMENTOS RELEVANTES AO ESCOPO'),
     gridTable(['Insumo / documento','Situação','Observações'],(inputs.length?inputs:['Documentação e informações necessárias ao escopo contratado']).map(item=>[item,'',''])),
     h('4. MEDIDAS E AMBIENTES'),
     gridTable(['Ambiente / setor','Comprimento','Largura','Pé-direito','Observações'],Array.from({length:10},()=>['','','','',''])),
     h('5. ELEMENTOS REGISTRADOS NA VISTORIA'),
     gridTable(['Elemento selecionado','Condição / situação','Observações'],(observed.length?observed:['Outros elementos a registrar']).map(item=>[observedLabels[item]||item,'',''])),
     h('6. CONDIÇÕES E DIVERGÊNCIAS'),
     gridTable(['Condição selecionada','Local / item relacionado','Observações'],(conditions.length?conditions:['Condições a registrar']).map(item=>[conditionLabels[item]||item,'',''])),
     ...(value(d,'conditions_description','')?[p(`Descrição registrada no portal: ${value(d,'conditions_description')}`)]:[]),
     h('7. REGISTRO FOTOGRÁFICO'),
     p('O registro fotográfico poderá ser inserido manualmente neste Word após a vistoria. O documento não depende de fotos previamente cadastradas no Portal.'),
     gridTable(['Fotografia / referência','Data','Descrição'],Array.from({length:6},()=>['','',''])),
     h('8. LIMITES DA VISTORIA'),
     p(smartRule(d,'survey_limit','O registro limita-se às condições acessíveis e observáveis no momento da visita e não substitui ensaios, investigações destrutivas ou serviços especializados não contratados.')),
     h('9. ASSINATURAS / CIÊNCIA'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 if(kind==='estudo_preliminar'){
   const study=scopeItems(d).find(item=>String(item.code??'')==='a')||null;
   const deliverables=study?arrStrings(study.deliverables):[];
   const inputs=study?arrStrings(study.clientInputs):[];
   const outside=d.outside_contracted_scope===true;
   return doc([
     ...t('ESTUDO PRELIMINAR',outside?'Documento auxiliar • não altera automaticamente o escopo contratado':'Etapa prevista no escopo contratual'),
     ...identity(d,profile,generatedAt),
     ...(outside?[p('ATENÇÃO: o Estudo Preliminar não é obrigatório por padrão. Se for contratado pelo cliente, deverá ser remunerado e registrado no orçamento/Serviço Adicional e no Anexo I. Esta versão foi preparada apenas como documento auxiliar e, sozinha, não altera o valor nem o escopo do contrato.',true,GOLD)]:[]),
     compactH('2. OBJETIVO DA ETAPA'),
     p(study?serviceDescription(study):'Consolidar necessidades, condicionantes e diretrizes iniciais para orientar o desenvolvimento do projeto.'),
     ...(d.project_description?[p(`Descrição cadastrada do projeto: ${String(d.project_description)}`)]:[]),
     compactH('3. INSUMOS NECESSÁRIOS'),
     gridTable(['Insumo necessário','Recebido / pendente','Observações'],(inputs.length?inputs:['Briefing e informações do cliente','Medidas / documentos disponíveis do imóvel']).map(item=>[item,'',''])),
     compactH('4. PROGRAMA DE NECESSIDADES'),
     gridTable(['Ambiente / setor','Quantidade','Prioridade','Observações'],Array.from({length:4},()=>['','','',''])),
     compactH('5. CONDICIONANTES E PREMISSAS'),
     gridTable(['Condicionante / premissa','Registro editável'],[['Restrições legais / condominiais conhecidas',''],['Premissas funcionais e de uso',''],['Premissas de orçamento e padrão construtivo','']]),
     compactH('6. DIRETRIZES DE PARTIDO E ORGANIZAÇÃO ESPACIAL'),
     p('Registrar implantação, setorização, fluxos, orientação solar/ventilação, relações entre ambientes e diretrizes estéticas validadas para esta etapa.'),
     p('_______________________________________________________________________________'),
     compactH('7. QUADRO PRELIMINAR DE ÁREAS'),
     p(`Área do terreno cadastrada: ${String(d.area_terreno_m2??'não informada')} m².`),
     p(`Área construída prevista cadastrada: ${String(d.area_construida_m2??'não informada')} m².`),
     gridTable(['Pavimento / setor','Área / observação'],Array.from({length:5},()=>['',''])),
     compactH('8. ENTREGÁVEIS PADRÃO DESTA ETAPA'),
     ...(deliverables.length?deliverables.map(bullet):[bullet('Síntese de necessidades e premissas'),bullet('Representações compatíveis com o nível preliminar')]),
     ...levelSection(d,'9. NÍVEL DE PRESTAÇÃO DE SERVIÇO',compactH),
     compactH('10. LIMITES E PRÓXIMOS PASSOS'),
     p(smartRule(d,'study_prelim_limit','O Estudo Preliminar não substitui Projeto Legal, Projeto Executivo ou projetos complementares. Após sua validação, seguem somente as etapas efetivamente contratadas no Anexo I. Alterações posteriores de premissas já aprovadas podem caracterizar alteração de escopo.')),
     compactH('11. REGISTRO DA ETAPA'),
     p('O aceite desta etapa é registrado separadamente no Termo de Aceite correspondente, mantendo este estudo como documento técnico de referência.'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 if(kind==='anexo_i'){
   const scope=scopeItems(d);
   const included=includedScope(d);
   const excluded=excludedScope(d);
   const exclusions=consolidatedExclusions(d);
   const serviceBlocks:Paragraph[]=[];

   included.forEach((item,index)=>{
     serviceBlocks.push(sub(`${index+1}. (${String(item.code??'')}) ${serviceName(item)}`));
     serviceBlocks.push(p(serviceAnnexDescription(item)));
     const deliverables=arrStrings(item.deliverables);
     if(deliverables.length){
       serviceBlocks.push(small('Entregáveis contratados a partir do padrão deste serviço:'));
       deliverables.forEach(value=>serviceBlocks.push(bullet(value)));
     }
     const clientInputs=arrStrings(item.clientInputs);
     if(clientInputs.length){
       serviceBlocks.push(small('Insumos e definições esperados do cliente:'));
       clientInputs.forEach(value=>serviceBlocks.push(bullet(value)));
     }
     serviceBlocks.push(small(`Revisões incluídas: ${typeof item.revisions==='number'?item.revisions:'conforme condição específica'} • Formatos: ${arrStrings(item.deliveryFormats).join(', ')||'PDF'} • Aceite de etapa: ${item.acceptanceRequired===false?'não obrigatório':'previsto'}`));
     if(item.planningReference)serviceBlocks.push(small(`Referência de planejamento: ${String(item.planningReference)}`));
     if(item.notes)serviceBlocks.push(p(`Observação específica: ${String(item.notes)}`));
   });

   return doc([
     ...t('ANEXO I','ESCOPO DE SERVIÇOS • PROPOSTA COMERCIAL • CRONOGRAMA'),
     ...identity(d,profile,generatedAt),
     h('2. FUNÇÃO DESTE ANEXO'),
     p(smartRule(d,'anexo_scope_governance','Este Anexo I integra o Contrato e constitui a referência específica para o escopo, entregáveis, revisões, formatos, valores e planejamento da contratação. Somente os itens expressamente indicados como incluídos integram o objeto.')),
     h('3. DADOS DO IMÓVEL / OBRA'),
     p(`Tipo: ${value(d,'project_type')}`),
     p(`Área do terreno: ${String(d.area_terreno_m2??'não informada')} m² • Área construída prevista: ${String(d.area_construida_m2??'não informada')} m²`),
     p(`Endereço: ${value(d,'property_address')}`),
     ...levelSection(d,'4. NÍVEL DE PRESTAÇÃO DE SERVIÇO'),
     h('5. SERVIÇOS EFETIVAMENTE CONTRATADOS'),
     ...(included.length?serviceBlocks:[p('Nenhum serviço marcado como incluído. Não emitir definitivamente antes da revisão do escopo.',true,GOLD)]),
     h('6. ITENS NÃO CONTRATADOS'),
     ...(excluded.length?excluded.map(item=>bullet(`(${String(item.code??'')}) ${serviceName(item)}`)):[p('Não há outros itens cadastrados no catálogo para este contrato.')]),
     h('7. EXCLUSÕES E LIMITES CONSOLIDADOS'),
     p(smartRule(d,'scope_limits_rule','Somente os itens expressamente incluídos neste Anexo I integram o escopo. Itens não previstos serão tratados como serviço adicional mediante aprovação prévia.')),
     ...exclusions.map(bullet),
     bullet('Qualquer item não previsto neste Anexo I será tratado como serviço adicional quando solicitado posteriormente.'),
     bullet('Taxas, emolumentos, despesas de órgãos públicos/cartórios/concessionárias e registros profissionais permanecem de responsabilidade do cliente salvo previsão expressa em contrário.'),
     h('8. VALOR E PAGAMENTO'),
     p(`Valor total dos honorários registrado: ${money(d.contract_value)}`,true,GOLD),
     ...paymentLines(d),
     ...(d.commercial_notes?[p(`Observações comerciais registradas: ${String(d.commercial_notes)}`)]:[]),
     h('9. PRAZO E CRONOGRAMA'),
     p(smartRule(d,'anexo_timeline_rule','O prazo e as referências de planejamento obedecem ao Contrato Mestre e às condições específicas deste Anexo I, considerando o recebimento dos insumos necessários.')),
     p('Prazos de análise de órgãos públicos, concessionárias, cartórios e terceiros são externos ao prazo técnico de elaboração.'),
     h('10. REVISÕES, ACEITES E ALTERAÇÕES'),
     p(smartRule(d,'anexo_revision_rule','Na ausência de indicação diversa em item específico, aplicam-se até 2 (duas) rodadas de revisão por etapa para ajustes dentro do escopo original. Pedidos que alterem programa, metragem, layout, partido, premissas aprovadas ou serviços não listados poderão exigir orçamento e aditivo.')),
     p('Os aceites de etapa previstos acima serão registrados por Termo de Aceite ou pelo mecanismo contratual aplicável.'),
     h('11. ASSINATURAS'),
     ...sig(profile,generatedAt,d)
   ],profile,code);
 }

 throw new Error('Tipo de documento ainda não suportado por este gerador.');
}

async function sendClientDocumentEmail(service:any,row:any){
 const apiKey=Deno.env.get('RESEND_API_KEY');
 if(!apiKey)return {emailSent:false,emailReason:'Resend não configurado'};
 const {data:customer,error}=await service.from('clientes').select('nome,email').eq('id',row.cliente_id).maybeSingle();
 if(error)throw error;
 const email=String(customer?.email??'').trim();
 if(!email)return {emailSent:false,emailReason:'Cliente sem e-mail cadastrado'};
 const from=Deno.env.get('RESEND_FROM')||'Camila Martins Engenharia <onboarding@resend.dev>';
 const portalUrl='https://camilamartinsengenharia.com.br/documentos-cliente.html';
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[email],subject:`${row.nome} disponível — Camila Martins Engenharia`,html:`<p>Olá, ${String(customer?.nome??'cliente')}.</p><p>Um novo documento vinculado ao seu contrato foi disponibilizado no Portal do Cliente.</p><p><a href="${portalUrl}">Acessar documentos do projeto</a></p><p>Camila Martins Engenharia</p>`})});
 if(!response.ok){const body=await response.text();return {emailSent:false,emailReason:`Falha no provedor de e-mail (${response.status}): ${body.slice(0,120)}`}}
 return {emailSent:true,emailReason:null};
}

const names:Record<string,string>={notificacao_formal:'notificacao-formal',anexo_i:'anexo-i',termo_aceite:'termo-aceite',estudo_preliminar:'estudo-preliminar',levantamento_tecnico:'levantamento-tecnico',servico_adicional:'servico-adicional',autorizacao_imagem:'autorizacao-uso-imagem',quitacao_encerramento:'quitacao-encerramento'};

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const {caller,service,user}=await requireAdmin(req);
  const body=await req.json();
  const documentId=typeof body.documentId==='string'?body.documentId:'';
  const action=body.action==='send'?'send':'generate';
  const expectedDocumentKind=typeof body.expectedDocumentKind==='string'?body.expectedDocumentKind:'';
  const scheduledFor=typeof body.scheduledFor==='string'&&body.scheduledFor?new Date(body.scheduledFor):null;
  const isScheduled=scheduledFor&&!Number.isNaN(scheduledFor.getTime())&&scheduledFor.getTime()>Date.now();
  if(!/^[0-9a-f-]{36}$/i.test(documentId))return json({error:'Documento inválido.'},400);
  const {error:rateError}=await caller.rpc('consume_admin_rate_limit',{p_action:`contract-document-${action}`});
  if(rateError)return json({error:'Muitas tentativas. Aguarde antes de repetir a operação.'},429);

  const {data:row,error}=await service.from('documentos')
   .select('id,cliente_id,projeto_id,contract_id,nome,arquivo,document_kind,workflow_status,generated_data,versao')
   .eq('id',documentId).maybeSingle();
  if(error)throw error;
  if(!row)return json({error:'Documento não encontrado.'},404);
  if(!names[row.document_kind])return json({error:'Tipo de documento não suportado.'},400);
  if(!expectedDocumentKind||!names[expectedDocumentKind])return json({error:'Informe o tipo de documento que deve ser gerado.'},400);
  if(row.document_kind!==expectedDocumentKind)return json({error:'O documento selecionado não corresponde ao tipo solicitado. Atualize a tela e tente novamente.'},409);

  if(action==='send'){
   if(!row.arquivo||row.workflow_status==='rascunho')return json({error:'Gere o Word antes de enviá-lo ao cliente.'},400);
   if(row.workflow_status==='enviado')return json({sent:true,alreadySent:true,documentKind:row.document_kind});
   const existing=await service.from('notificacoes').select('id,delivery_status,scheduled_for,sent_at')
    .eq('referencia_tipo','documento').eq('referencia_id',row.id).eq('tipo','documento_contratual').order('created_at',{ascending:false}).limit(1).maybeSingle();
   if(existing.error)throw existing.error;

   if(isScheduled){
    if(existing.data?.id){
     const scheduled=await service.from('notificacoes').update({delivery_status:'scheduled',scheduled_for:scheduledFor.toISOString(),sent_at:null,lida:false})
      .eq('id',existing.data.id);
     if(scheduled.error)throw scheduled.error;
    }else{
     const notification=await service.from('notificacoes').insert({
      cliente_id:row.cliente_id,projeto_id:row.projeto_id,titulo:`${row.nome} disponível`,
      mensagem:'Um novo documento vinculado ao seu contrato será disponibilizado na data agendada.',
      tipo:'documento_contratual',destinatario:'cliente',referencia_tipo:'documento',
      referencia_id:row.id,link_path:'/documentos-cliente.html',lida:false,delivery_status:'scheduled',
      scheduled_for:scheduledFor.toISOString(),sent_at:null
     });
     if(notification.error)throw notification.error;
    }
    await service.from('audit_log').insert({user_id:user.id,action:'schedule_contract_document',entity_type:'documentos',entity_id:row.id,details:{document_kind:row.document_kind,scheduled_for:scheduledFor.toISOString()}});
    return json({sent:true,scheduled:true,scheduledFor:scheduledFor.toISOString(),documentKind:row.document_kind});
   }

   const updated=await service.from('documentos').update({workflow_status:'enviado',client_visible:true,exibir_cliente:true,client_released_at:new Date().toISOString(),client_released_by:user.id})
    .eq('id',row.id).eq('workflow_status','gerado').select('id').maybeSingle();
   if(updated.error)throw updated.error;
   if(!updated.data)return json({error:'O documento não está pronto para envio ou já foi enviado.'},409);

   let notificationId=existing.data?.id||null;
   if(notificationId){
    const notification=await service.from('notificacoes').update({titulo:`${row.nome} disponível`,mensagem:'Um novo documento vinculado ao seu contrato foi disponibilizado em Documentos.',link_path:'/documentos-cliente.html',lida:false,delivery_status:'sent',scheduled_for:null,sent_at:new Date().toISOString()}).eq('id',notificationId);
    if(notification.error)throw notification.error;
   }else{
    const notification=await service.from('notificacoes').insert({
     cliente_id:row.cliente_id,projeto_id:row.projeto_id,titulo:`${row.nome} disponível`,
     mensagem:'Um novo documento vinculado ao seu contrato foi disponibilizado em Documentos.',
     tipo:'documento_contratual',destinatario:'cliente',referencia_tipo:'documento',
     referencia_id:row.id,link_path:'/documentos-cliente.html',lida:false,delivery_status:'sent',scheduled_for:null,sent_at:new Date().toISOString()
    }).select('id').single();
    if(notification.error)throw notification.error;notificationId=notification.data?.id||null;
   }
   const email=await sendClientDocumentEmail(service,row);
   await service.from('audit_log').insert({user_id:user.id,action:'send_contract_document',entity_type:'documentos',entity_id:row.id,details:{document_kind:row.document_kind,email_sent:email.emailSent}});
   return json({sent:true,scheduled:false,documentKind:row.document_kind,emailSent:email.emailSent,emailWarning:email.emailReason,notificationId});
  }

  if(row.workflow_status==='enviado'||row.workflow_status==='assinado'||row.workflow_status==='aceito'){
   return json({error:'O documento já foi enviado/aceito e não pode ser sobrescrito. Crie uma nova versão.'},409);
  }
  const governance=await service.rpc('assert_document_governance_ready');
  if(governance.error)throw governance.error;
  const professionalProfile=await loadProfessionalIdentity(service);
  const missingProfile=missingProfessionalFields(professionalProfile);
  if(missingProfile.length)return json({error:`Complete a identificação profissional sigilosa em Configurações antes de gerar este documento. Campos pendentes: ${missingProfile.join(', ')}.`},422);

  const generatedAt=new Date();
  const generatedAtIso=generatedAt.toISOString();
  const documentDate=generatedDateIso(generatedAt);
  const sourceData=(row.generated_data&&typeof row.generated_data==='object'?row.generated_data:{}) as Data;
  const masterVersion=Number(sourceData.contract_master_version);
  const smartTexts=sourceData.smart_texts;
  if(!Number.isInteger(masterVersion)||masterVersion<=0||!smartTexts||typeof smartTexts!=='object'||Array.isArray(smartTexts)||!Object.keys(smartTexts as Record<string,unknown>).length){
   return json({error:'Este rascunho é anterior à governança documental atual. Prepare o documento novamente para alinhar contrato mestre, serviços e textos inteligentes.'},409);
  }
  const generatedData={...sourceData,emitted_at:generatedAtIso,document_date:documentDate,contract_signed_at:documentDate};
  const buffer=await Packer.toBuffer(build(row.document_kind,generatedData,professionalProfile,generatedAt));
  const version=String(row.versao??'1.0').replace(/[^0-9.]/g,'')||'1.0';
  const path=`${row.projeto_id}/contratual/${row.id}/${names[row.document_kind]}-v${version}.docx`;
  const upload=await service.storage.from('documentos').upload(path,buffer,{contentType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',upsert:true});
  if(upload.error)throw upload.error;
  const updated=await service.from('documentos').update({
   arquivo:path,storage_bucket:'documentos',workflow_status:'gerado',
   generated_at:generatedAtIso,generated_data:generatedData
  }).eq('id',row.id);
  if(updated.error)throw updated.error;
  await service.from('audit_log').insert({
   user_id:user.id,action:'generate_contract_document_docx',entity_type:'documentos',entity_id:row.id,
   details:{document_kind:row.document_kind,path,emitted_at:generatedAtIso,document_date:documentDate,contract_master_version:generatedData.contract_master_version}
  });
  return json({generated:true,documentId:row.id,documentKind:row.document_kind,path,emittedAt:generatedAtIso,documentDate});
 }catch(error){
  const message=error instanceof Error?error.message:'Não foi possível gerar o documento.';
  const status=message.includes('Acesso')?403:message.includes('Sessão')?401:message.includes('Governanca')||message.includes('Governança')?409:500;
  return json({error:message},status);
 }
});
