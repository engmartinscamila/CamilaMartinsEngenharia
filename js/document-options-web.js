(function(){
'use strict';
const $=id=>document.getElementById(id);
const client=()=>window.supabaseClient;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let pendingResolve=null;
let serviceCatalog=[];

const paymentOptions=[
 ['pix','Pix'],
 ['cartao_vista','Cartão de crédito à vista'],
 ['cartao_parcelado','Cartão de crédito parcelado'],
 ['dinheiro','Dinheiro'],
 ['transferencia','Transferência bancária'],
 ['outro','Outro']
];

const schemas={
 autorizacao_imagem:{
  title:'Permissões de uso de imagem',
  intro:'Defina exatamente o que o cliente deverá autorizar. O aceite será registrado pelo próprio cliente.',
  groups:[
   ['Materiais','materials',[['facade','Fotografias externas / fachada'],['interiors','Fotografias de interiores'],['renders','Renders 3D e imagens de apresentação'],['plans','Plantas e pranchas sem dados pessoais sensíveis'],['videos','Vídeos e tour virtual 360°'],['work_records','Registros de obra sem identificação de pessoas']],'checkbox'],
   ['Canais','channels',[['portfolio','Portfólio profissional e site'],['social','Redes sociais'],['commercial','Apresentações comerciais'],['technical','Publicações técnicas, concursos e premiações'],['print','Material impresso institucional']],'checkbox'],
   ['Restrições','privacy',[['hide_address','Não divulgar endereço exato'],['hide_client','Não divulgar nome do(a) cliente'],['no_people','Não utilizar imagens com pessoas identificáveis sem autorização específica']],'checkbox']
  ],
  fields:[
   {key:'wait_months',type:'number',label:'Aguardar quantos meses após a conclusão?'},
   {key:'other_restrictions',type:'textarea',label:'Outras restrições'}
  ]
 },
 servico_adicional:{
  title:'Serviço adicional vinculado ao contrato',
  intro:'Selecione a atividade do catálogo. O texto padrão será preenchido automaticamente e poderá ser ajustado nesta contratação sem alterar o catálogo global.',
  groups:[
   ['Origem da solicitação','reasons',[['extra_revisions','Revisão além das rodadas incluídas'],['scope_change','Alteração de escopo, premissas, programa, metragem ou layout'],['level_upgrade','Migração para nível de prestação superior'],['survey','Vistoria ou levantamento não incluído'],['editable_file','Arquivo editável ou formato não previsto'],['other','Outro']],'checkbox'],
   ['Critério comercial','pricing',[['hour','Hora técnica'],['percentage','Percentual sobre etapa afetada'],['fixed','Valor fechado aprovado para esta atividade']],'radio']
  ],
  fields:[
   {key:'additional_service_code',type:'service-select',label:'Atividade adicional *'},
   {key:'additional_service_level',type:'level-select',label:'Nível desta atividade'},
   {key:'additional_service_description',type:'textarea',label:'Descrição do serviço adicional *',rows:6},
   {key:'additional_value',type:'money',label:'Valor adicional (R$) *'},
   {key:'payment_method',type:'payment-select',label:'Forma de pagamento *'},
   {key:'schedule_impact',type:'textarea',label:'Impacto no cronograma',rows:3},
   {key:'other_reason',type:'textarea',label:'Outro motivo / observações',rows:5}
  ]
 },
 quitacao_encerramento:{
  title:'Dados de quitação / encerramento',
  intro:'Registre a situação final do contrato. Nenhum campo desta tela substitui o histórico financeiro existente.',
  groups:[
   ['Motivo','closing_reason',[['completed','Conclusão integral do escopo contratado'],['client_termination','Rescisão antecipada pelo CONTRATANTE'],['contractor_termination','Rescisão antecipada pelo CONTRATADO'],['mutual','Rescisão por mútuo acordo'],['other','Outro']],'radio'],
   ['Situação financeira','financial',[['paid','Quitação integral'],['balance','Existe saldo pendente']],'radio']
  ],
  fields:[
   {key:'closing_other',type:'textarea',label:'Outro motivo'},
   {key:'delivered_files',type:'textarea',label:'Arquivos/documentos finais entregues'},
   {key:'open_items',type:'textarea',label:'Pendências técnicas ou administrativas'},
   {key:'public_processes',type:'textarea',label:'Processos em órgãos públicos ainda em andamento'},
   {key:'balance_value',type:'money',label:'Saldo pendente'},
   {key:'balance_due',type:'date',label:'Vencimento do saldo'}
  ]
 },
 termo_aceite:{
  title:'Preparar Termo de Aceite para o cliente',
  intro:'Você define o objeto do aceite. A manifestação (aceitar, aceitar com ressalvas ou recusar) será feita pelo cliente no Portal.',
  groups:[],
  fields:[
   {key:'acceptance_type',type:'select',label:'Tipo de aceite *',options:[
    ['stage_delivery','Entrega de etapa'],
    ['document_delivery','Entrega de documento'],
    ['image_authorization','Uso de imagem'],
    ['service_completion','Conclusão / finalização do serviço'],
    ['other','Outro aceite']
   ]},
   {key:'acceptance_subject',type:'textarea',label:'O que o cliente deverá avaliar / aceitar',rows:4},
   {key:'acceptance_admin_notes',type:'textarea',label:'Observações administrativas que devem constar no termo',rows:4}
  ]
 },
 levantamento_tecnico:{
  title:'Dados da vistoria / levantamento',
  intro:'Registre o que foi efetivamente observado. O Word será montado com tabelas editáveis, evitando quadradinhos e pseudo-tabelas.',
  groups:[
   ['Elementos a registrar','observed',[
    ['electrical','Instalações / pontos elétricos'],['hydraulic','Instalações / pontos hidráulicos'],['sanitary','Esgoto / ventilação sanitária'],
    ['structure','Estrutura aparente'],['masonry','Alvenarias e vedações'],['frames','Esquadrias'],['finishes','Pisos / revestimentos / pinturas'],
    ['roof','Cobertura / telhado'],['waterproofing','Impermeabilização'],['drainage','Drenagem / águas pluviais'],['facade','Fachadas'],
    ['stairs','Escadas / guarda-corpos'],['accessibility','Acessibilidade'],['fire_safety','Elementos de segurança contra incêndio'],
    ['dimensions','Dimensões / níveis / pé-direito'],['equipment','Equipamentos e instalações existentes'],['access','Acessos e áreas de circulação'],['other','Outros']
   ],'checkbox'],
   ['Condições / divergências','conditions',[
    ['cracks','Fissuras / trincas'],['moisture','Umidade / infiltração'],['levels','Desníveis / deformações'],['corrosion','Corrosão aparente'],
    ['detachment','Desplacamentos / destacamentos'],['leaks','Vazamentos'],['wear','Desgaste / deterioração'],['document_mismatch','Divergência entre realidade e documentos'],
    ['restricted_access','Acesso restrito a algum elemento'],['safety_risk','Condição aparente que requer avaliação de segurança'],['no_anomaly','Sem anomalia aparente no item observado']
   ],'checkbox']
  ],
  fields:[
   {key:'survey_datetime',type:'datetime-now',label:'Data e horário da vistoria *'},
   {key:'site_companion',type:'text',label:'Quem acompanhou a vistoria no local'},
   {key:'technical_responsible',type:'text',label:'Responsável técnico pela vistoria'},
   {key:'conditions_description',type:'textarea',label:'Descrição detalhada das condições / divergências',rows:8}
  ]
 }
};

function setError(text=''){const e=$('documentOptionsError');if(!e)return;e.textContent=text;e.className=text?'doc-status error':'doc-status doc-hidden'}
function finish(value){$('documentOptionsModal')?.classList.add('doc-hidden');document.documentElement.classList.remove('doc-options-open');document.body.classList.remove('doc-options-open');setError('');const resolve=pendingResolve;pendingResolve=null;if(resolve)resolve(value)}
function ensureModal(){
 if($('documentOptionsModal'))return;
 const wrap=document.createElement('div');wrap.id='documentOptionsModal';wrap.className='doc-options-modal doc-hidden';
 wrap.innerHTML='<div class="doc-options-dialog"><button type="button" class="doc-options-close" aria-label="Fechar">×</button><h3 id="documentOptionsTitle">Documento</h3><div id="documentOptionsIntro"></div><div id="documentOptionsError" class="doc-status doc-hidden" aria-live="polite"></div><form id="documentOptionsForm"></form><div id="documentPreview" class="doc-hidden"></div><div class="doc-actions"><button type="button" class="doc-btn ghost" data-options-cancel>Cancelar</button><button type="button" class="doc-btn" data-options-confirm>Continuar</button></div></div>';
 document.body.appendChild(wrap);wrap.querySelector('.doc-options-close').onclick=()=>finish(null);wrap.querySelector('[data-options-cancel]').onclick=()=>finish(null);wrap.addEventListener('click',e=>{if(e.target===wrap)finish(null)})
}
async function loadServiceCatalog(){
 if(serviceCatalog.length)return serviceCatalog;
 try{
  const {data,error}=await client().from('service_catalog').select('code,name,category,description,level_applicable,aliases,synonyms,keywords').eq('active',true).order('category').order('name');
  if(!error&&Array.isArray(data))serviceCatalog=data;
 }catch{}
 return serviceCatalog;
}
function groupedServiceOptions(){
 const groups=new Map();
 for(const item of serviceCatalog){const category=String(item.category||'Outros');if(!groups.has(category))groups.set(category,[]);groups.get(category).push(item)}
 return [...groups.entries()].map(([category,items])=>`<optgroup label="${esc(category)}">${items.map(item=>`<option value="${esc(item.code)}">${esc(item.name)}</option>`).join('')}</optgroup>`).join('');
}
function renderField(field){
 const key=field.key,label=field.label,type=field.type||'text';
 if(type==='textarea')return `<div class="doc-field"><label for="opt-${esc(key)}">${esc(label)}</label><textarea id="opt-${esc(key)}" name="${esc(key)}" rows="${field.rows||4}"></textarea></div>`;
 if(type==='select')return `<div class="doc-field"><label for="opt-${esc(key)}">${esc(label)}</label><select id="opt-${esc(key)}" name="${esc(key)}"><option value="">Selecione</option>${(field.options||[]).map(([v,t])=>`<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select></div>`;
 if(type==='service-select')return `<div class="doc-field"><label for="opt-${esc(key)}">${esc(label)}</label><select id="opt-${esc(key)}" name="${esc(key)}"><option value="">Selecione a atividade</option>${groupedServiceOptions()}</select><small class="doc-help">A lista usa o mesmo catálogo do orçamento.</small></div>`;
 if(type==='level-select')return `<div class="doc-field"><label for="opt-${esc(key)}">${esc(label)}</label><select id="opt-${esc(key)}" name="${esc(key)}"><option value="">Sem nível / conforme atividade</option><option value="bronze">Bronze</option><option value="prata">Prata</option><option value="ouro">Ouro</option></select></div>`;
 if(type==='payment-select')return `<div class="doc-field"><label for="opt-${esc(key)}">${esc(label)}</label><select id="opt-${esc(key)}" name="${esc(key)}"><option value="">Selecione</option>${paymentOptions.map(([v,t])=>`<option value="${v}">${esc(t)}</option>`).join('')}</select></div>`;
 if(type==='datetime-now')return `<div class="doc-field"><label for="opt-${esc(key)}">${esc(label)}</label><div class="doc-inline-field"><input id="opt-${esc(key)}" name="${esc(key)}" type="datetime-local"><button type="button" class="doc-btn secondary" data-use-now="${esc(key)}">Usar agora</button></div></div>`;
 const htmlType=type==='money'?'text':type;
 return `<div class="doc-field"><label for="opt-${esc(key)}">${esc(label)}</label><input id="opt-${esc(key)}" name="${esc(key)}" type="${esc(htmlType)}" ${type==='number'?'min="0" step="1"':''} ${type==='money'?'inputmode="decimal" placeholder="0,00"':''}></div>`;
}
function readForm(schema,form){
 const fd=new FormData(form),out={};
 for(const [,key,items,mode='checkbox'] of schema.groups||[])out[key]=mode==='radio'?String(fd.get(key)||''):items.filter(([v])=>fd.getAll(key).includes(v)).map(([v])=>v);
 for(const field of schema.fields||[])out[field.key]=String(fd.get(field.key)||'').trim();
 return out
}
function validate(kind,o){
 const has=(v,k)=>Array.isArray(v)?v.includes(k):v===k;
 if(kind==='autorizacao_imagem'){if(!o.materials?.length)return'Selecione ao menos um material autorizado.';if(!o.channels?.length)return'Selecione ao menos um canal autorizado.';if(o.wait_months&&Number(o.wait_months)<=0)return'Informe um prazo em meses maior que zero.'}
 if(kind==='termo_aceite'){if(!o.acceptance_type)return'Selecione o tipo de aceite.'}
 if(kind==='servico_adicional'){
  if(!o.reasons?.length)return'Selecione a origem da solicitação.';
  if(has(o.reasons,'other')&&!o.other_reason)return'Descreva o motivo em Outro.';
  if(!o.pricing)return'Selecione um único critério comercial.';
  if(!o.additional_service_code)return'Selecione a atividade adicional.';
  if(!o.additional_service_description)return'Confira ou ajuste a descrição da atividade.';
  if(!o.additional_value)return'Informe o valor adicional.';
  if(!o.payment_method)return'Selecione a forma de pagamento.';
 }
 if(kind==='levantamento_tecnico'){if(!o.survey_datetime)return'Informe a data e o horário da vistoria ou use o botão "Usar agora".'}
 if(kind==='quitacao_encerramento'){if(!o.closing_reason)return'Selecione o motivo do encerramento.';if(o.closing_reason==='other'&&!o.closing_other)return'Descreva o outro motivo.';if(!o.financial)return'Selecione a situação financeira.';if(o.financial==='balance'&&(!o.balance_value||!o.balance_due))return'Informe valor e vencimento do saldo.'}
 return''
}
function localDatetimeNow(){
 const d=new Date(),pad=n=>String(n).padStart(2,'0');
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
async function optionsStep(kind){
 ensureModal();const s=schemas[kind];if(!s)return Promise.resolve({});
 if(kind==='servico_adicional')await loadServiceCatalog();
 $('documentOptionsTitle').textContent=s.title;$('documentOptionsIntro').innerHTML=`<p>${esc(s.intro||'Defina agora o que deve sair preenchido no Word.')}</p>`;
 $('documentPreview').classList.add('doc-hidden');const form=$('documentOptionsForm');form.classList.remove('doc-hidden');
 form.innerHTML=(s.groups||[]).map(([label,key,items,mode='checkbox'])=>`<fieldset class="doc-options-group"><legend>${esc(label)}${mode==='radio'?' <small>— escolha uma opção</small>':''}</legend>${items.map(([v,t])=>`<label class="doc-service"><input type="${mode}" name="${esc(key)}" value="${esc(v)}"><span>${esc(t)}</span></label>`).join('')}</fieldset>`).join('')+(s.fields||[]).map(renderField).join('');
 setError('');$('documentOptionsModal').classList.remove('doc-hidden');document.documentElement.classList.add('doc-options-open');document.body.classList.add('doc-options-open');
 form.querySelectorAll('[data-use-now]').forEach(button=>button.addEventListener('click',()=>{const input=form.elements.namedItem(button.dataset.useNow);if(input)input.value=localDatetimeNow()}));
 const serviceSelect=form.elements.namedItem('additional_service_code');
 if(serviceSelect){
  serviceSelect.addEventListener('change',()=>{
   const item=serviceCatalog.find(entry=>String(entry.code)===String(serviceSelect.value));
   const description=form.elements.namedItem('additional_service_description');
   const level=form.elements.namedItem('additional_service_level');
   if(description&&item)description.value=String(item.description||'');
   if(level)level.disabled=item?.level_applicable!==true;
   if(level&&item?.level_applicable!==true)level.value='';
  });
 }
 const btn=$('documentOptionsModal').querySelector('[data-options-confirm]');btn.textContent='Revisar antes de gerar';
 return new Promise(resolve=>{pendingResolve=resolve;btn.onclick=()=>{
  const out=readForm(s,form);
  if(kind==='servico_adicional'){
   const item=serviceCatalog.find(entry=>String(entry.code)===String(out.additional_service_code));
   out.additional_service_name=item?.name||out.additional_service_code;
  }
  const error=validate(kind,out);if(error){setError(error);return}pendingResolve=null;resolve(out)
 }})
}
async function getPreview(projectId,kind,approvalId,options,bump='minor',reason=''){
 const extra={document_options:options,version_bump:bump,version_reason:reason,...options};
 const {data,error}=await client().rpc('admin_preview_contract_document',{p_project_id:projectId,p_document_kind:kind,p_approval_id:approvalId||null,p_extra_data:extra});
 if(error)throw error;return data||{}
}
function parseMoney(v){const t=String(v??'').trim().replace(/\s/g,'');if(!t)return null;const n=Number(t.includes(',')?t.replace(/\./g,'').replace(',','.'):t);return Number.isFinite(n)?n:null}
const money=v=>Number.isFinite(Number(v))?Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'Não informado';
async function previewStep(projectId,kind,approvalId,options){
 ensureModal();let bump='minor',reason='';let p=await getPreview(projectId,kind,approvalId,options,bump,reason);
 if(kind==='servico_adicional'){
  const add=parseMoney(options.additional_value),base=Number(p.contract_value);
  if(add!==null&&Number.isFinite(base))options.new_total_value=base+add;
 }
 $('documentOptionsTitle').textContent='Pré-visualização antes do Word';$('documentOptionsIntro').innerHTML='<p>Confira os dados principais. Nenhum Word será criado antes da confirmação.</p>';$('documentOptionsForm').classList.add('doc-hidden');
 const box=$('documentPreview');box.classList.remove('doc-hidden');
 const render=()=>{
  const scope=Array.isArray(p.scope_items)?p.scope_items:[];
  const additional=kind==='servico_adicional'?`<div class="doc-preview-block"><small>Serviço adicional</small><strong>${esc(options.additional_service_name||'—')}</strong><span>${esc(options.additional_service_description||'')}</span><span>Valor adicional: ${esc(options.additional_value||'—')} • Novo total de referência: ${options.new_total_value?esc(money(options.new_total_value)):'a calcular'}</span></div>`:'';
  box.innerHTML=`<div class="doc-preview-grid"><div><small>Versão</small><strong id="documentPreviewVersion">v${esc(p.next_version||'1.0')}</strong></div><div><small>Contrato</small><strong>${esc(p.contract_number||'—')}</strong></div><div><small>Cliente</small><strong>${esc(p.client_name||'—')}</strong></div><div><small>Projeto</small><strong>${esc(p.project_name||'—')}</strong></div></div><div class="doc-preview-block"><small>Endereço da obra</small><strong>${esc(p.property_address||'Não informado')}</strong></div><div class="doc-preview-block"><small>Endereço cadastral do contratante</small><span>${esc(p.client_address||'Não informado')}</span></div><div class="doc-preview-block"><small>Valor contratual vigente</small><span>${esc(money(p.contract_value))}</span></div>${additional}<div class="doc-preview-block"><small>Serviços do contrato</small><span>${scope.length?scope.map(x=>`(${esc(x.code)}) ${esc(x.name)}`).join(' • '):'Nenhum item localizado'}</span></div>${p.revision_of?'<div class="doc-field"><label>Tipo de nova versão</label><select id="documentVersionBump"><option value="minor">Revisão menor</option><option value="major">Nova versão principal</option></select></div><div class="doc-field"><label>Motivo da nova versão *</label><input id="documentVersionReason" placeholder="Ex.: ajuste solicitado pelo cliente"></div>':'<p class="doc-preview-first">Primeira emissão deste tipo de documento: versão v1.0.</p>'}`;
  if(p.revision_of){$('documentVersionBump').value=bump;$('documentVersionReason').value=reason;$('documentVersionBump').onchange=async e=>{bump=e.target.value;reason=$('documentVersionReason').value.trim();try{p=await getPreview(projectId,kind,approvalId,options,bump,reason);$('documentPreviewVersion').textContent=`v${p.next_version||'1.0'}`}catch(err){setError(err?.message||'Não foi possível recalcular a versão.')}}}
 };
 render();setError('');$('documentOptionsModal').classList.remove('doc-hidden');
 const btn=$('documentOptionsModal').querySelector('[data-options-confirm]');btn.textContent='Confirmar e preparar documento';
 return new Promise(resolve=>{pendingResolve=resolve;btn.onclick=()=>{reason=$('documentVersionReason')?.value.trim()||'';bump=$('documentVersionBump')?.value||'minor';if(p.revision_of&&!reason){setError('Informe o motivo da nova versão para preservar a rastreabilidade.');return}finish({extra:{document_options:options,version_bump:bump,version_reason:reason,...options},preview:p})}})
}
async function prepare(kind,approvalId){
 const select=$('contractProject'),projectId=select?.value;if(!projectId)return;
 try{
  const options=schemas[kind]?await optionsStep(kind):{};if(options===null)return;
  const review=await previewStep(projectId,kind,approvalId,options);if(!review)return;
  const {data,error}=await client().rpc('admin_prepare_contract_document',{p_project_id:projectId,p_document_kind:kind,p_approval_id:approvalId||null,p_extra_data:review.extra});
  if(error)throw error;
  const box=$('contractMessage');if(box){box.textContent=`Documento preparado como versão v${review.preview?.next_version||'1.0'}. O snapshot será congelado na emissão do Word.`;box.className='doc-status success'}
  window.dispatchEvent(new CustomEvent('cme:document-options-prepared',{detail:{kind,documentId:data,version:review.preview?.next_version}}));
  setTimeout(()=>select.dispatchEvent(new Event('change',{bubbles:true})),80)
 }catch(error){ensureModal();$('documentOptionsModal').classList.remove('doc-hidden');setError(error?.message||'Não foi possível preparar o documento.')}
}
window.CMEPrepareContractDocument=prepare;
document.addEventListener('click',e=>{const b=e.target.closest('[data-prepare],[data-approval]');if(!b)return;const kind=b.dataset.prepare||(b.dataset.approval?'termo_aceite':'');if(!kind)return;e.preventDefault();e.stopImmediatePropagation();prepare(kind,b.dataset.approval||null)},true);
const style=document.createElement('style');style.textContent='.doc-options-open{overflow:hidden}.doc-options-modal{position:fixed;inset:0;background:rgba(4,12,24,.82);z-index:13000;display:flex;align-items:center;justify-content:center;padding:16px}.doc-options-modal.doc-hidden{display:none}.doc-options-dialog{position:relative;width:min(820px,100%);max-height:92vh;overflow:auto;background:var(--card-bg,#0b1726);color:inherit;border:1px solid rgba(184,154,99,.48);border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.45)}.doc-options-close{position:absolute;right:14px;top:10px;border:0;background:transparent;font-size:30px;cursor:pointer;color:inherit}.doc-options-group{border:1px solid rgba(184,154,99,.35);border-radius:12px;padding:12px;margin:14px 0}.doc-options-group legend{font-weight:700;padding:0 6px}.doc-options-group legend small{font-weight:400;opacity:.72}.doc-options-dialog .doc-field{margin:12px 0}.doc-options-dialog .doc-field input,.doc-options-dialog .doc-field select,.doc-options-dialog .doc-field textarea{width:100%;box-sizing:border-box}.doc-options-dialog textarea{min-height:100px;resize:vertical}.doc-inline-field{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}.doc-preview-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:14px 0}.doc-preview-grid>div,.doc-preview-block{border:1px solid rgba(184,154,99,.28);border-radius:10px;padding:12px}.doc-preview-grid small,.doc-preview-block small{display:block;opacity:.75;margin-bottom:4px}.doc-preview-block{margin:9px 0;display:grid;gap:5px}.doc-preview-first{padding:10px 12px;border-radius:10px;background:rgba(184,154,99,.10)}@media(max-width:620px){.doc-preview-grid{grid-template-columns:1fr}.doc-inline-field{grid-template-columns:1fr}.doc-options-modal{padding:6px;align-items:flex-start}.doc-options-dialog{max-height:calc(100dvh - 12px);padding:18px 13px}}';document.head.appendChild(style);
})();