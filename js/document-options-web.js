(function(){
'use strict';
const $=id=>document.getElementById(id);
const client=()=>window.supabaseClient;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
let pendingResolve=null;

const schemas={
 autorizacao_imagem:{title:'Permissões de uso de imagem',groups:[
  ['Materiais','materials',[['facade','Fotografias externas / fachada'],['interiors','Fotografias de interiores'],['renders','Renders 3D e imagens de apresentação'],['plans','Plantas e pranchas sem dados pessoais sensíveis'],['videos','Vídeos e tour virtual 360°'],['work_records','Registros de obra sem identificação de pessoas']],'checkbox'],
  ['Canais','channels',[['portfolio','Portfólio profissional e site'],['social','Redes sociais'],['commercial','Apresentações comerciais'],['technical','Publicações técnicas, concursos e premiações'],['print','Material impresso institucional']],'checkbox'],
  ['Restrições','privacy',[['hide_address','Não divulgar endereço exato'],['hide_client','Não divulgar nome do(a) cliente'],['no_people','Não utilizar imagens com pessoas identificáveis sem autorização específica']],'checkbox']
 ],fields:[['wait_months','number','Aguardar quantos meses após a conclusão?'],['other_restrictions','text','Outras restrições']]},
 servico_adicional:{title:'Dados do serviço adicional',groups:[
  ['Origem da solicitação','reasons',[['extra_revisions','Revisão além das rodadas incluídas'],['scope_change','Alteração de escopo, premissas, programa, metragem ou layout'],['level_upgrade','Migração para nível de prestação superior'],['survey','Vistoria ou levantamento não incluído'],['editable_file','Arquivo editável ou formato não previsto'],['other','Outro']],'checkbox'],
  ['Critério comercial','pricing',[['hour','Hora técnica'],['percentage','Percentual sobre etapa afetada'],['fixed','Valor fechado aprovado por orçamento específico']],'radio'],
  ['Aprovação','approval',[['approved','Aprovo e autorizo o início do serviço adicional']],'checkbox']
 ],fields:[['additional_service_description','text','Descrição do serviço adicional'],['additional_value','text','Valor adicional aprovado'],['schedule_impact','text','Impacto adicional no cronograma'],['other_reason','text','Outro motivo']]},
 quitacao_encerramento:{title:'Dados de quitação / encerramento',groups:[
  ['Motivo','closing_reason',[['completed','Conclusão integral do escopo contratado'],['client_termination','Rescisão antecipada pelo CONTRATANTE'],['contractor_termination','Rescisão antecipada pelo CONTRATADO'],['mutual','Rescisão por mútuo acordo'],['other','Outro']],'radio'],
  ['Situação financeira','financial',[['paid','Quitação integral'],['balance','Existe saldo pendente']],'radio']
 ],fields:[['closing_other','text','Outro motivo'],['delivered_files','text','Arquivos/documentos finais entregues'],['open_items','text','Pendências técnicas ou administrativas'],['public_processes','text','Processos em órgãos públicos ainda em andamento'],['balance_value','text','Saldo pendente'],['balance_due','date','Vencimento do saldo']]},
 termo_aceite:{title:'Manifestação do contratante',groups:[['Aceite','acceptance',[['accepted','Aceito sem ressalvas'],['accepted_with_notes','Aceito com ressalvas']],'radio']],fields:[['acceptance_notes','text','Ressalvas']]},
 levantamento_tecnico:{title:'Dados prévios da vistoria',groups:[
  ['Elementos a registrar','observed',[['electrical','Pontos elétricos'],['hydraulic','Pontos hidráulicos'],['structure','Estrutura aparente'],['frames','Esquadrias'],['finishes','Revestimentos'],['roof','Cobertura'],['drainage','Drenagem'],['access','Acessos'],['other','Outros']],'checkbox'],
  ['Condições / divergências','conditions',[['cracks','Fissuras/trincas'],['moisture','Umidade/infiltração'],['levels','Desníveis'],['corrosion','Corrosão aparente'],['document_mismatch','Divergência entre realidade e documentos fornecidos'],['restricted_access','Acesso restrito a algum elemento']],'checkbox']
 ],fields:[['inspection_datetime','text','Data e horário da vistoria'],['site_contact','text','Responsável pelo acompanhamento no local'],['conditions_description','text','Descrição das condições/divergências']]}
};

function setError(text=''){
 const e=$('documentOptionsError');
 if(!e)return;
 e.textContent=text;
 e.className=text?'doc-status error':'doc-status doc-hidden';
}
function finish(value){$('documentOptionsModal')?.classList.add('doc-hidden');setError('');const resolve=pendingResolve;pendingResolve=null;if(resolve)resolve(value)}
function ensureModal(){
 if($('documentOptionsModal'))return;
 const wrap=document.createElement('div');
 wrap.id='documentOptionsModal';wrap.className='doc-options-modal doc-hidden';
 wrap.innerHTML='<div class="doc-options-dialog"><button type="button" class="doc-options-close" aria-label="Fechar">×</button><h3 id="documentOptionsTitle">Opções do documento</h3><p>Defina agora o que deve sair preenchido no Word. Opções incompatíveis não podem ser selecionadas ao mesmo tempo.</p><div id="documentOptionsError" class="doc-status doc-hidden" aria-live="polite"></div><form id="documentOptionsForm"></form><div class="doc-actions"><button type="button" class="doc-btn ghost" data-options-cancel>Cancelar</button><button type="button" class="doc-btn" data-options-confirm>Preparar documento</button></div></div>';
 document.body.appendChild(wrap);
 wrap.querySelector('.doc-options-close').onclick=()=>finish(null);
 wrap.querySelector('[data-options-cancel]').onclick=()=>finish(null);
 wrap.addEventListener('click',e=>{if(e.target===wrap)finish(null)});
}
function readForm(schema,form){
 const fd=new FormData(form),out={};
 for(const [,key,items,mode='checkbox'] of schema.groups||[]){
  if(mode==='radio')out[key]=String(fd.get(key)||'');
  else out[key]=items.filter(([v])=>fd.getAll(key).includes(v)).map(([v])=>v);
 }
 for(const [key] of schema.fields||[])out[key]=String(fd.get(key)||'').trim();
 return out;
}
function validate(kind,o){
 const has=(value,key)=>Array.isArray(value)?value.includes(key):value===key;
 if(kind==='autorizacao_imagem'){
  if(!o.materials?.length)return 'Selecione ao menos um material autorizado.';
  if(!o.channels?.length)return 'Selecione ao menos um canal autorizado.';
  if(o.wait_months&&(!Number.isFinite(Number(o.wait_months))||Number(o.wait_months)<=0))return 'Informe um prazo de espera em meses maior que zero.';
 }
 if(kind==='termo_aceite'){
  if(!o.acceptance)return 'Selecione a forma de aceite.';
  if(o.acceptance==='accepted_with_notes'&&!o.acceptance_notes)return 'Descreva as ressalvas antes de preparar o documento.';
 }
 if(kind==='servico_adicional'){
  if(!o.reasons?.length)return 'Selecione a origem da solicitação adicional.';
  if(has(o.reasons,'other')&&!o.other_reason)return 'Descreva o motivo em “Outro”.';
  if(!o.pricing)return 'Selecione um único critério comercial.';
  if(!o.additional_service_description)return 'Descreva o serviço adicional.';
 }
 if(kind==='quitacao_encerramento'){
  if(!o.closing_reason)return 'Selecione um único motivo do encerramento.';
  if(o.closing_reason==='other'&&!o.closing_other)return 'Descreva o outro motivo do encerramento.';
  if(!o.financial)return 'Selecione a situação financeira.';
  if(o.financial==='balance'&&(!o.balance_value||!o.balance_due))return 'Para saldo pendente, informe o valor e o vencimento.';
 }
 return '';
}
function open(kind){
 ensureModal();const s=schemas[kind];if(!s)return Promise.resolve({});
 $('documentOptionsTitle').textContent=s.title;const form=$('documentOptionsForm');
 form.innerHTML=(s.groups||[]).map(([label,key,items,mode='checkbox'])=>`<fieldset class="doc-options-group"><legend>${esc(label)}${mode==='radio'?' <small>— escolha uma opção</small>':''}</legend>${items.map(([v,t])=>`<label class="doc-service"><input type="${mode}" name="${esc(key)}" value="${esc(v)}"><span>${esc(t)}</span></label>`).join('')}</fieldset>`).join('')+(s.fields||[]).map(([key,type,label])=>`<div class="doc-field"><label>${esc(label)}</label><input name="${esc(key)}" type="${esc(type)}" ${type==='number'?'min="0" step="1"':''}></div>`).join('');
 setError('');$('documentOptionsModal').classList.remove('doc-hidden');
 return new Promise(resolve=>{pendingResolve=resolve;const confirm=$('documentOptionsModal').querySelector('[data-options-confirm]');confirm.onclick=()=>{const out=readForm(s,form);const error=validate(kind,out);if(error){setError(error);return}finish(out)}});
}
async function prepareWithOptions(kind,approvalId){
 const select=$('contractProject');const projectId=select?.value;if(!projectId)return;
 const options=schemas[kind]?await open(kind):{};if(options===null)return;
 const extra={document_options:options};Object.assign(extra,options);
 const {data,error}=await client().rpc('admin_prepare_contract_document',{p_project_id:projectId,p_document_kind:kind,p_approval_id:approvalId||null,p_extra_data:extra});
 const box=$('contractMessage');
 if(error){if(box){box.textContent=error.message||'Não foi possível preparar o documento.';box.className='doc-status error'};return}
 if(box){box.textContent='Documento preparado com as opções selecionadas. O Word será gerado já preenchido.';box.className='doc-status success'}
 window.dispatchEvent(new CustomEvent('cme:document-options-prepared',{detail:{kind,documentId:data}}));
 setTimeout(()=>select.dispatchEvent(new Event('change',{bubbles:true})),80);
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-prepare],[data-approval]');if(!b)return;const kind=b.dataset.prepare||(b.dataset.approval?'termo_aceite':'');if(!schemas[kind])return;e.preventDefault();e.stopImmediatePropagation();prepareWithOptions(kind,b.dataset.approval||null)},true);
const style=document.createElement('style');style.textContent='.doc-options-modal{position:fixed;inset:0;background:rgba(4,12,24,.72);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px}.doc-options-modal.doc-hidden{display:none}.doc-options-dialog{position:relative;width:min(720px,100%);max-height:88vh;overflow:auto;background:var(--card-bg,#fff);color:inherit;border-radius:16px;padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.doc-options-close{position:absolute;right:14px;top:10px;border:0;background:transparent;font-size:30px;cursor:pointer;color:inherit}.doc-options-group{border:1px solid rgba(184,154,99,.35);border-radius:12px;padding:12px;margin:14px 0}.doc-options-group legend{font-weight:700;padding:0 6px}.doc-options-group legend small{font-weight:400;opacity:.72}.doc-options-dialog .doc-field{margin:12px 0}.doc-options-dialog .doc-field input{width:100%}';document.head.appendChild(style);
})();