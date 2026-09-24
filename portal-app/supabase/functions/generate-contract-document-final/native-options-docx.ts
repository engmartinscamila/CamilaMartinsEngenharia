import { AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import JSZip from 'jszip';

type Obj=Record<string,unknown>;
type Profile=Record<string,string|undefined>;

const NAVY='0B1726',GOLD='B89A63',TEXT='26313D',MUTED='667281';
const value=(d:Obj,key:string,fallback='Não informado')=>typeof d[key]==='string'&&String(d[key]).trim()?String(d[key]).trim():fallback;
const list=(v:unknown)=>Array.isArray(v)?v.map(String).filter(Boolean):v?[String(v)]:[];
const selected=(v:unknown,key:string)=>Array.isArray(v)?v.map(String).includes(key):String(v??'')===key;
const options=(d:Obj)=>(d.document_options&&typeof d.document_options==='object'?d.document_options:{}) as Obj;
const money=(raw:unknown)=>{const n=Number(raw);return Number.isFinite(n)?new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n):'A definir';};
const datePt=(raw:unknown)=>{if(typeof raw!=='string'||!raw)return'Não informado';const date=new Date(raw);return Number.isNaN(date.getTime())?raw:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(date);};
const p=(text:string,bold=false,color=TEXT)=>new Paragraph({spacing:{after:120,line:300},children:[new TextRun({text,bold,font:'Century Gothic',size:20,color})]});
const h=(text:string)=>new Paragraph({heading:HeadingLevel.HEADING_2,spacing:{before:300,after:130},border:{bottom:{color:GOLD,style:BorderStyle.SINGLE,size:8,space:5}},children:[new TextRun({text,bold:true,font:'Century Gothic',size:23,color:NAVY})]});
const bullet=(text:string)=>new Paragraph({bullet:{level:0},spacing:{after:70,line:280},children:[new TextRun({text,font:'Century Gothic',size:19,color:TEXT})]});
const mark=(on:boolean)=>on?'[[CME-CHECKED]]':'[[CME-UNCHECKED]]';
const profileValue=(profile:Profile,key:string)=>String(profile[key]??'').trim();
const professionalLabel=(profile:Profile)=>{const crea=[profileValue(profile,'crea_rj')?`CREA-RJ nº ${profileValue(profile,'crea_rj')}`:'',profileValue(profile,'crea_sp')?`CREA-SP nº ${profileValue(profile,'crea_sp')}`:''].filter(Boolean).join(' • ');return [profileValue(profile,'full_name'),profileValue(profile,'professional_title')||'Engenheira Civil',crea].filter(Boolean).join(' — ');};
const title=(text:string,subtitle:string)=>[
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{before:180,after:100},children:[new TextRun({text:'CAMILA MARTINS',bold:true,font:'Century Gothic',size:22,color:GOLD,characterSpacing:40})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:320},children:[new TextRun({text:'ENGENHARIA CIVIL',font:'Century Gothic',size:14,color:MUTED,characterSpacing:55})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:90},children:[new TextRun({text,bold:true,font:'Century Gothic',size:31,color:NAVY})]}),
 new Paragraph({alignment:AlignmentType.CENTER,spacing:{after:260},children:[new TextRun({text:subtitle,font:'Century Gothic',size:18,color:MUTED})]}),
];
const identity=(d:Obj,profile:Profile)=>[
 h('1. IDENTIFICAÇÃO'),
 p(`Data de emissão: ${datePt(d.emitted_at)}`),
 p(`Contrato: ${value(d,'contract_number')}`),
 p(`CONTRATADO(A): ${professionalLabel(profile)}`),
 p(`CONTRATANTE: ${value(d,'client_name')}`),
 p(`Projeto: ${value(d,'project_name')} • Tipo: ${value(d,'project_type')}`),
 p(`Imóvel / obra: ${value(d,'property_address')}`),
];
const signature=(profile:Profile,d:Obj)=>[
 p(`Local: _______________________________ • Data: ${datePt(d.emitted_at)}`),p('_______________________________________________'),p(professionalLabel(profile)),p('_______________________________________________'),p('CONTRATANTE')
];
const brandHeader=()=>new Header({children:[new Paragraph({border:{bottom:{color:GOLD,style:BorderStyle.SINGLE,size:6,space:4}},spacing:{after:70},children:[new TextRun({text:'Camila Martins',bold:true,font:'Century Gothic',size:18,color:GOLD}),new TextRun({text:'  •  Engenharia Civil',font:'Century Gothic',size:14,color:NAVY})]})]});
const brandFooter=(profile:Profile,code:string)=>new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,border:{top:{color:GOLD,style:BorderStyle.SINGLE,size:4,space:4}},spacing:{before:70},children:[new TextRun({text:`${professionalLabel(profile)}  •  ${code}`,font:'Century Gothic',size:13,color:MUTED})]})]});
const makeDoc=(children:Paragraph[],profile:Profile,code:string)=>new Document({styles:{default:{document:{run:{font:'Century Gothic',size:20,color:TEXT},paragraph:{spacing:{line:300,after:100}}}}},sections:[{properties:{page:{margin:{top:900,right:1050,bottom:900,left:1050}}},headers:{default:brandHeader()},footers:{default:brandFooter(profile,code)},children}]});

function build(kind:string,d:Obj,profile:Profile){
 const o=options(d);const code=`${value(d,'contract_number','SEM-CONTRATO')} • ${kind.replaceAll('_',' ').toUpperCase()}`;
 if(kind==='termo_aceite')return makeDoc([
  ...title('TERMO DE ACEITE DE ETAPA','Manifestação do contratante vinculada à entrega e à versão correspondente'),
  ...identity(d,profile),
  h('2. ETAPA ENTREGUE'),
  p(`Etapa: ${value(d,'approval_title')}`,true,GOLD),
  p(`Data do envio/entrega: ${datePt(d.delivered_at)}`),
  p(`Prazo de manifestação: até ${datePt(d.approval_due_at)}`),
  h('3. MANIFESTAÇÃO DO(A) CONTRATANTE'),
  p(`${mark(false)} Aceito sem ressalvas.`),
  p(`${mark(false)} Aceito com ressalvas.`),
  p(`${mark(false)} Recuso esta entrega.`),
  p('Ressalvas / motivo da recusa: ______________________________________________________________'),
  p('__________________________________________________________________________________________'),
  p('A decisão eletrônica é registrada pelo próprio CONTRATANTE no portal, com data, versão, documento e projeto vinculados.'),
  h('4. CONTINUIDADE'),
  p('O aceite desta etapa não amplia o escopo originalmente contratado e não impede a correção de vícios técnicos.'),
  h('5. ASSINATURAS'),
  ...signature(profile,d)
 ],profile,code);
 if(kind==='autorizacao_imagem'){
  const materials=list(o.materials),channels=list(o.channels),privacy=list(o.privacy);
  return makeDoc([...title('AUTORIZAÇÃO DE USO DE IMAGEM E DIVULGAÇÃO','Permissões específicas para portfólio e comunicação profissional'),...identity(d,profile),h('2. MATERIAIS AUTORIZADOS'),p(`${mark(materials.includes('facade'))} Fotografias externas / fachada.`),p(`${mark(materials.includes('interiors'))} Fotografias de interiores.`),p(`${mark(materials.includes('renders'))} Renders 3D e imagens de apresentação.`),p(`${mark(materials.includes('plans'))} Plantas e pranchas sem dados pessoais sensíveis.`),p(`${mark(materials.includes('videos'))} Vídeos e tour virtual 360°.`),p(`${mark(materials.includes('work_records'))} Registros de obra sem identificação de pessoas.`),h('3. CANAIS AUTORIZADOS'),p(`${mark(channels.includes('portfolio'))} Portfólio profissional e site.`),p(`${mark(channels.includes('social'))} Redes sociais.`),p(`${mark(channels.includes('commercial'))} Apresentações comerciais.`),p(`${mark(channels.includes('technical'))} Publicações técnicas, concursos e premiações.`),p(`${mark(channels.includes('print'))} Material impresso institucional.`),h('4. RESTRIÇÕES DE PRIVACIDADE'),p(`${mark(privacy.includes('hide_address'))} Não divulgar endereço exato.`),p(`${mark(privacy.includes('hide_client'))} Não divulgar nome do(a) cliente.`),p(`${mark(privacy.includes('no_people'))} Não utilizar imagens com pessoas identificáveis sem autorização específica.`),...(String(o.wait_months??'').trim()?[p(`${mark(true)} Aguardar ${String(o.wait_months).trim()} meses após a conclusão para a primeira divulgação.`)]:[p(`${mark(false)} Sem prazo adicional informado para primeira divulgação.`)]),...(String(o.other_restrictions??'').trim()?[p(`${mark(true)} Outras restrições: ${String(o.other_restrictions).trim()}`)]:[]),h('5. CONDIÇÕES'),p('A autorização é gratuita e não exclusiva, limitada aos materiais e canais assinalados, observadas as restrições registradas e a legislação aplicável.'),h('6. ASSINATURAS'),...signature(profile,d)],profile,code);
 }
 if(kind==='servico_adicional'){
  const reasons=list(o.reasons);const pricing=String(o.pricing??'');const payment=String(o.payment_method??'');
  const serviceName=String(o.additional_service_name??'').trim();const serviceCode=String(o.additional_service_code??'').trim();const serviceLevel=String(o.additional_service_level_label??o.additional_service_level??'').trim();
  return makeDoc([...title('TERMO DE APROVAÇÃO DE SERVIÇO ADICIONAL','Alteração de escopo • aprovação prévia antes do início'),...identity(d,profile),h('2. ATIVIDADE ADICIONAL'),p(serviceName?`${serviceCode?`(${serviceCode}) `:''}${serviceName}${serviceLevel?` — nível ${serviceLevel}`:''}`:'Atividade adicional não informada.',true,GOLD),h('3. ORIGEM DA NOVA SOLICITAÇÃO'),p(`${mark(reasons.includes('extra_revisions'))} Revisão além das rodadas incluídas.`),p(`${mark(reasons.includes('scope_change'))} Alteração de escopo, premissas, programa, metragem ou layout já aprovado.`),p(`${mark(reasons.includes('level_upgrade'))} Migração para nível de prestação superior ao contratado.`),p(`${mark(reasons.includes('survey'))} Vistoria ou levantamento não incluído no escopo original.`),p(`${mark(reasons.includes('editable_file'))} Arquivo editável ou formato não previsto.`),p(`${mark(reasons.includes('other'))} Outro${String(o.other_reason??'').trim()?`: ${String(o.other_reason).trim()}`:'.'}`),h('4. DESCRIÇÃO DO SERVIÇO ADICIONAL'),p(value(o,'additional_service_description','Não informado')),p('Este termo integra o contrato identificado acima e não cria contrato paralelo; o escopo original permanece preservado, salvo pelas alterações expressamente descritas neste documento.'),h('5. IMPACTO COMERCIAL E DE PRAZO'),p(`${mark(pricing==='hour')} Hora técnica`),p(`${mark(pricing==='percentage')} Percentual sobre etapa afetada`),p(`${mark(pricing==='fixed')} Valor fechado aprovado por orçamento específico`),p(`Valor adicional aprovado: ${value(o,'additional_value','Não informado')}`),p(`Forma de pagamento: ${payment==='pix'?'Pix':payment==='bank_transfer'?'Transferência bancária':payment==='card_cash'?'Cartão à vista':payment==='card_installments'?'Cartão parcelado':payment==='cash'?'Dinheiro':payment==='other'?'Outro':'Não informada'}`),p(`Condição de pagamento: ${value(o,'payment_terms','Não informada')}`),...(String(o.new_contract_total??'').trim()?[p(`Novo total contratual informado: ${String(o.new_contract_total).trim()}`)]:[]),p(`Impacto adicional no cronograma: ${value(o,'schedule_impact','Não informado')}`),h('6. MANIFESTAÇÃO DO(A) CONTRATANTE'),p(`${mark(false)} Aceito o serviço adicional nos limites deste termo.`),p(`${mark(false)} Aceito com ressalvas.`),p(`${mark(false)} Recuso o serviço adicional.`),p('Ressalvas / motivo da recusa: ______________________________________________________________'),p('A decisão eletrônica é registrada pelo próprio CONTRATANTE no portal; o documento não é pré-aprovado pela administradora.'),h('7. ASSINATURAS'),...signature(profile,d)],profile,code);
 }
 if(kind==='quitacao_encerramento'){
  const reason=String(o.closing_reason??''),financial=String(o.financial??'');
  return makeDoc([...title('TERMO DE QUITAÇÃO E ENCERRAMENTO','Consolidação documental do término da relação contratual'),...identity(d,profile),h('2. MOTIVO DO ENCERRAMENTO'),p(`${mark(reason==='completed')} Conclusão integral do escopo contratado.`),p(`${mark(reason==='client_termination')} Rescisão antecipada pelo CONTRATANTE.`),p(`${mark(reason==='contractor_termination')} Rescisão antecipada pelo CONTRATADO(A).`),p(`${mark(reason==='mutual')} Rescisão por mútuo acordo.`),p(`${mark(reason==='other')} Outro${String(o.closing_other??'').trim()?`: ${String(o.closing_other).trim()}`:'.'}`),h('3. ENTREGAS E PENDÊNCIAS'),p(`Arquivos e documentos finais entregues: ${value(o,'delivered_files','Não informado')}`),p(`Pendências técnicas ou administrativas: ${value(o,'open_items','Não informado')}`),p(`Processos perante órgãos públicos: ${value(o,'public_processes','Não informado')}`),h('4. SITUAÇÃO FINANCEIRA'),p(`Valor contratual registrado: ${money(d.contract_value)}.`),p(`${mark(financial==='paid')} Quitação integral.`),p(`${mark(financial==='balance')} Existe saldo pendente${financial==='balance'?` no valor de ${value(o,'balance_value')} com vencimento em ${value(o,'balance_due')}`:''}.`),h('5. OBRIGAÇÕES QUE PERMANECEM'),bullet('Direitos autorais e condições de uso dos materiais técnicos.'),bullet('Confidencialidade e proteção de dados quando aplicáveis.'),bullet('Responsabilidades técnicas e civis previstas em lei.'),h('6. ASSINATURAS'),...signature(profile,d)],profile,code);
 }
 if(kind==='levantamento_tecnico'){
  const observed=list(o.observed),conditions=list(o.conditions);
  const observedLabels:Record<string,string>={
   electrical:'Instalações / pontos elétricos',
   hydraulic:'Instalações / pontos hidráulicos',
   sanitary:'Esgoto / ventilação sanitária',
   structure:'Estrutura aparente',
   masonry:'Alvenarias e vedações',
   frames:'Esquadrias',
   finishes:'Pisos / revestimentos / pinturas',
   roof:'Cobertura / telhado',
   waterproofing:'Impermeabilização',
   drainage:'Drenagem / águas pluviais',
   facade:'Fachadas',
   stairs:'Escadas / guarda-corpos',
   accessibility:'Acessibilidade',
   fire_safety:'Elementos de segurança contra incêndio',
   dimensions:'Dimensões / níveis / pé-direito',
   equipment:'Equipamentos / instalações existentes',
   access:'Acessos e circulação',
   other:'Outros'
  };
  const conditionLabels:Record<string,string>={
   cracks:'Fissuras / trincas',
   moisture:'Umidade / infiltração',
   levels:'Desníveis / deformações',
   corrosion:'Corrosão aparente',
   detachment:'Desplacamentos / destacamentos',
   leaks:'Vazamentos',
   wear:'Desgaste / deterioração',
   document_mismatch:'Divergência entre realidade e documentos fornecidos',
   restricted_access:'Acesso restrito',
   safety_risk:'Condição aparente que requer avaliação de segurança',
   no_anomaly:'Sem anomalia aparente'
  };
  return makeDoc([
   ...title('FICHA DE LEVANTAMENTO TÉCNICO / VISTORIA','Registro padronizado das condições verificadas no local'),
   ...identity(d,profile),
   p(`Data e horário da vistoria: ${value(o,'inspection_datetime',value(o,'survey_datetime','Não informado'))}`),
   p(`Responsável pelo acompanhamento no local: ${value(o,'site_contact',value(o,'site_companion','Não informado'))}`),
   p(`Responsável técnico: ${value(o,'technical_responsible',professionalLabel(profile))}`),
   h('2. DADOS DO IMÓVEL'),
   p(`Tipo: ${value(d,'project_type')} • Endereço: ${value(d,'property_address')}`),
   p(`Medidas / níveis / pé-direito: ${value(o,'measurements','Registrar ou complementar no Word')}`),
   h('3. ELEMENTOS OBSERVADOS'),
   ...Object.entries(observedLabels).map(([key,label])=>p(`${mark(observed.includes(key))} ${label}`)),
   h('4. CONDIÇÕES E DIVERGÊNCIAS'),
   ...Object.entries(conditionLabels).map(([key,label])=>p(`${mark(conditions.includes(key))} ${label}`)),
   p(`Descrição detalhada: ${value(o,'conditions_description',value(o,'detailed_description','Não informado'))}`),
   h('5. REGISTROS E FOTOS'),
   p(`Registros / referências: ${value(o,'records','_______________________________________________')}`),
   p('Espaço para fotografias e legendas: _______________________________________________'),
   p('________________________________________________________________________________'),
   h('6. OBSERVAÇÕES'),
   p(value(o,'notes','________________________________________________________________________________')),
   h('7. LIMITES DA VISTORIA'),
   p('O registro limita-se às condições acessíveis e observáveis no momento da visita e não substitui ensaios, investigações destrutivas ou serviços especializados não contratados.'),
   h('8. ASSINATURAS / CIÊNCIA'),
   ...signature(profile,d)
  ],profile,code);
 }
 return null;
}


function xmlEscape(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]??char));}

async function applyInteractiveCheckboxes(bytes:Uint8Array){
 const zip=await JSZip.loadAsync(bytes);
 const file=zip.file('word/document.xml');
 if(!file)return bytes;
 let xml=await file.async('string');
 if(!xml.includes('xmlns:w14=')){
  xml=xml.replace('<w:document ', '<w:document xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ');
 }
 let controlId=700000;
 const pattern=/<w:r\b[^>]*>[\s\S]*?<w:t(?:\s[^>]*)?>\[\[CME-(CHECKED|UNCHECKED)\]\]([^<]*)<\/w:t>[\s\S]*?<\/w:r>/g;
 xml=xml.replace(pattern,(_match,state,label)=>{
  controlId+=1;
  const checked=state==='CHECKED';
  const visible=checked?'☒':'☐';
  const safeLabel=String(label??'');
  return `<w:sdt><w:sdtPr><w:id w:val="${controlId}"/><w14:checkbox><w14:checked w14:val="${checked?'1':'0'}"/><w14:checkedState w14:val="2612" w14:font="Segoe UI Symbol"/><w14:uncheckedState w14:val="2610" w14:font="Segoe UI Symbol"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:rPr><w:rFonts w:ascii="Segoe UI Symbol" w:hAnsi="Segoe UI Symbol"/></w:rPr><w:t>${visible}</w:t></w:r></w:sdtContent></w:sdt><w:r><w:rPr><w:rFonts w:ascii="Century Gothic" w:hAnsi="Century Gothic"/><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">${safeLabel}</w:t></w:r>`;
 });
 if(/\[\[CME-(?:CHECKED|UNCHECKED)\]\]/.test(xml))throw new Error('Nem todos os controles de checkbox foram convertidos para OOXML.');
 zip.file('word/document.xml',xml);
 return new Uint8Array(await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}));
}

export async function generateNativeOptionsDocx(kind:string,data:Obj,profile:Profile){const document=build(kind,data,profile);if(!document)return null;const packed=new Uint8Array(await Packer.toBuffer(document));return applyInteractiveCheckboxes(packed);}
