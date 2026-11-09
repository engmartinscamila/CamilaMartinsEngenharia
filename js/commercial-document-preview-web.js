(function(){
'use strict';
const client=()=>window.supabaseClient;const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function b64blob(base64,type='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){const binary=atob(base64),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new Blob([bytes],{type})}
function download(base64,name){const url=URL.createObjectURL(b64blob(base64)),a=document.createElement('a');a.href=url;a.download=name||'documento.docx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function status(text,type=''){const e=document.getElementById('commercialMessage');if(e){e.textContent=text;e.className=`doc-status ${type}`}}
function nextVersion(current){const major=Number.parseInt(String(current||'1.0').split('.')[0],10);return `${(Number.isFinite(major)?major:1)+1}.0`}
function validateContractScopeForPreview(record){
 const issues=[];
 const included=(Array.isArray(record.services)?record.services:[]).filter(item=>item?.included===true);
 const scope=Array.isArray(record.commercial_terms?.scope)?record.commercial_terms.scope:[];
 const norm=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 for(const item of included){
   const code=String(item.code||'').toLowerCase();
   const row=scope.find(entry=>String(entry.code||'').toLowerCase()===code);
   const deliverables=norm(row?.deliverables);
   if(!deliverables){
     issues.push({code,name:item.name||code,message:'Entregáveis específicos não cadastrados para esta atividade. Edite as condições comerciais antes de emitir.',kind:'terms'});continue;
   }
   const waterSystems=deliverables.replace(/\b(?:sem|nao inclui|nao contempla|nao abrange|exclui)\b[^,.;\n]*(?:esgoto|hidrossanit)[^,.;\n]*/g,'');
   if(code==='am'&&/hidrossanit|esgoto/.test(waterSystems))
     issues.push({code,name:item.name||code,message:'Os entregáveis incluem esgoto, mas a atividade selecionada contempla somente água. Reclassifique como Projeto Hidrossanitário antes de emitir.',kind:'classification'});
   if(code==='aj'&&/projeto.*hidraulico|projeto.*hidrossanitario/.test(deliverables)&&!/rede externa|rede publica|saneamento externo|rede de abastecimento/.test(deliverables))
     issues.push({code,name:item.name||code,message:'Instalações prediais foram associadas a saneamento externo. Selecione a categoria hidráulica ou hidrossanitária adequada.',kind:'classification'});
   if(code==='u'&&/elaboracao de projeto arquitetonico|projeto arquitetonico para projeto executivo/.test(deliverables)&&!/levantamento geometrico|levantamento cadastral|medicao cadastral/.test(deliverables))
     issues.push({code,name:item.name||code,message:'Os entregáveis descrevem projeto arquitetônico e maquete 3D, não um levantamento cadastral. Corrija a classificação ou remova a atividade redundante após conferir as demais entregas.',kind:'classification'});
 }
 return issues;
}
async function preview(recordId,kind){const {data:r,error}=await client().from('commercial_records').select('id,quote_number,contract_number,prospect_name,cpf_cnpj,address,property_address,property_type,total_value,services,commercial_terms,quote_document_id,contract_document_id').eq('id',recordId).single();if(error)throw error;const docId=kind==='contrato'?r.contract_document_id:r.quote_document_id;let currentVersion=null,frozen=false,pending=false;if(docId){const [d,s]=await Promise.all([client().from('documentos').select('id,versao,generated_at,generated_data').eq('id',docId).maybeSingle(),client().from('document_emission_snapshots').select('id').eq('document_id',docId).maybeSingle()]);if(d.error)throw d.error;if(s.error)throw s.error;currentVersion=d.data?.versao||'1.0';pending=Boolean(d.data?.generated_at&&d.data?.generated_data?.commercial_record_snapshot&&(!s.data||d.data.generated_data.commercial_finalization_state==='pending'));frozen=Boolean(s.data)&&!pending;if(pending)Object.assign(r,d.data.generated_data.commercial_record_snapshot)}const services=(Array.isArray(r.services)?r.services:[]).filter(x=>x?.included!==false).map(x=>`(${esc(x.code||'')}) ${esc(x.name||'Serviço')}`).join(' • ');
const issues=kind==='contrato'?validateContractScopeForPreview(r):[];
return new Promise(resolve=>{const wrap=document.createElement('div');wrap.className='commercial-preview-modal';const render=()=>{const version=frozen?nextVersion(currentVersion):(currentVersion||'1.0');
const blocker=issues.length?`<div class="doc-status error" role="alert"><strong>Emissão bloqueada antes da geração. Nenhuma nova versão será criada até corrigir o escopo.</strong><button type="button" class="doc-btn" data-smart-closure>Resolver com o assistente de fechamento</button>${issues.map(issue=>`<div class="commercial-preview-block"><strong>(${esc(issue.code)}) ${esc(issue.name)}</strong><span>${esc(issue.message)}</span><button type="button" class="doc-btn secondary" data-preview-correct="${esc(issue.code)}" data-correction-kind="${esc(issue.kind)}">${issue.kind==='terms'?'Editar entregáveis':'Corrigir classificação de serviço'}</button></div>`).join('')}</div>`:'';wrap.innerHTML=`<div class="commercial-preview-dialog"><button class="commercial-preview-close" type="button">×</button><h3>Pré-visualização antes do Word</h3><p>Confira os dados que serão usados na emissão.</p><div class="commercial-preview-grid"><div><small>Documento</small><strong>${esc(kind==='contrato'?r.contract_number:r.quote_number)}</strong></div><div><small>Versão</small><strong>v${esc(version)}</strong></div><div><small>Cliente / prospect</small><strong>${esc(r.prospect_name)}</strong></div><div><small>Valor</small><strong>${Number(r.total_value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></div></div><div class="commercial-preview-block"><small>Endereço da obra${kind==='contrato'?' usado no contrato':''}</small><strong>${esc(r.property_address||'Não informado')}</strong></div><div class="commercial-preview-block"><small>Endereço cadastral do contratante</small><span>${esc(r.address||'Não informado')}</span></div><div class="commercial-preview-block"><small>Serviços</small><span>${services||'Nenhum serviço identificado'}</span></div>${blocker}${frozen?`<p class="commercial-preview-first">Nova revisão sequencial do mesmo documento. A versão anterior ficará preservada no histórico.</p><div class="doc-field"><label>Motivo da revisão *</label><input data-preview-reason placeholder="Ex.: ajuste de escopo solicitado pelo cliente"></div>`:pending?'<p class="commercial-preview-first">Retomada da emissão pendente: o mesmo documento e a mesma versão serão concluídos.</p>':version==='1.0'?'<p class="commercial-preview-first">Primeira emissão: versão v1.0.</p>':`<p class="commercial-preview-first">Emissão da versão v${esc(version)} já preparada.</p>`}${kind==='contrato'?'<p class="commercial-preview-first">Ao confirmar, o Word será emitido e registrado no histórico. Criar ou vincular projeto continua sendo opcional.</p>':''}<div data-preview-error class="doc-status error doc-hidden"></div><div class="doc-actions"><button type="button" class="doc-btn ghost" data-preview-cancel>Cancelar</button><button type="button" class="doc-btn" data-preview-confirm ${issues.length?'disabled title="Corrija primeiro o escopo indicado"':''}>Confirmar e gerar Word</button></div></div>`;document.body.appendChild(wrap);const close=()=>{wrap.remove();resolve(null)};wrap.querySelector('.commercial-preview-close').onclick=close;wrap.querySelector('[data-preview-cancel]').onclick=close;
wrap.querySelector('[data-smart-closure]')?.addEventListener('click',()=>{close();window.CMEOpenCommercialClosure?.(recordId);});
wrap.querySelectorAll('[data-preview-correct]').forEach(button=>button.onclick=()=>{
 const code=button.dataset.previewCorrect,kind=button.dataset.correctionKind;
 close();
 status('A revisão não foi criada. Corrija o serviço ('+code+') e tente novamente. A versão emitida anteriormente permanece preservada.','error');
 if(kind==='classification'&&typeof window.CMECorrectCommercialServiceClassification==='function')
   window.CMECorrectCommercialServiceClassification(recordId,code);
 else if(kind==='terms'&&typeof window.CMEEditCommercialTerms==='function')
   window.CMEEditCommercialTerms(recordId);
});
wrap.querySelector('[data-preview-confirm]').onclick=()=>{const reason=wrap.querySelector('[data-preview-reason]')?.value.trim()||'';if(frozen&&reason.replace(/[^\p{L}\p{N}]/gu,'').length<10){const e=wrap.querySelector('[data-preview-error]');e.textContent='Descreva o motivo da nova versão com pelo menos 10 letras (ex.: Alteração do prazo de entrega).';e.classList.remove('doc-hidden');return}wrap.remove();resolve({versionReason:reason,version})}};render()})}
async function formalizeServiceContract(recordId){
  const {data,error}=await client().rpc('admin_formalize_service_contract',{p_record_id:recordId});
  if(error) return {ok:false,error:error.message||'Não foi possível habilitar o contrato'};
  if(!data?.contract_id) return {ok:false,error:'Não foi retornado o contrato'};
  window.dispatchEvent(new CustomEvent('cme:commercial-records-updated',{
    detail:{recordId,projectId:data.project_id}
  }));
  return {ok:true,projectId:data.project_id};
}
async function invocationError(result,fallback){
 if(result.data?.error)return String(result.data.error);
 if(result.error?.context?.json){try{const body=await result.error.context.clone().json();if(body?.error)return String(body.error);}catch{}}
 return result.error?.message||fallback;
}
async function downloadIssued(documentId,recover=false){
 status(recover?'Reconstituindo cópia da versão emitida...':'Baixando a versão emitida, sem criar revisão...');
 const result=await client().functions.invoke('download-commercial-word',{body:{documentId,recover}});
 if(result.error||!result.data?.delivered){
  let code=result.data?.code,error=await invocationError(result,'Não foi possível baixar a versão emitida.');
  if(result.error?.context?.json){try{code=(await result.error.context.clone().json())?.code||code;}catch{}}
  if(code==='ORIGINAL_WORD_MISSING'&&!recover&&window.confirm(error+'\n\nReconstituir essa cópia agora?'))return downloadIssued(documentId,true);
  status(error,'error');return {ok:false,error};
 }
 download(result.data.contentBase64,result.data.fileName);
 status(result.data.reconstituted?'Cópia reconstituída baixada. A versão e a data da emissão foram preservadas; confira a identificação profissional antes de usar.':'Word da versão emitida baixado. Nenhuma revisão foi criada.','success');
 return {ok:true,documentId,reconstituted:result.data.reconstituted};
}
async function showVersions(recordId,kind){
 const {data,error}=await client().from('documentos').select('id,nome,versao,generated_at').contains('generated_data',{commercial_record_id:recordId,commercial_document_kind:kind}).not('generated_at','is',null).order('generated_at',{ascending:false}).limit(100);
 if(error){status(error.message||'Não foi possível carregar as versões.','error');return;}
 const wrap=document.createElement('div');wrap.className='commercial-preview-modal';wrap.innerHTML=`<div class="commercial-preview-dialog"><button type="button" class="commercial-preview-close">×</button><h3>Versões emitidas</h3><p>Baixar uma versão existente não altera o contrato e não cria revisão.</p>${(data||[]).map(d=>`<div class="commercial-preview-block"><strong>${esc(d.nome)} • v${esc(d.versao)}</strong><span>Emitido em ${esc(new Date(d.generated_at).toLocaleString('pt-BR'))}</span><button type="button" class="doc-btn" data-issued-document="${esc(d.id)}">Baixar Word v${esc(d.versao)}</button></div>`).join('')||'<p>Nenhuma versão emitida localizada.</p>'}</div>`;document.body.appendChild(wrap);wrap.querySelector('.commercial-preview-close').onclick=()=>wrap.remove();
 wrap.addEventListener('click',async e=>{const b=e.target.closest('[data-issued-document]');if(!b)return;b.disabled=true;try{await downloadIssued(b.dataset.issuedDocument);}finally{b.disabled=false;}});
}
window.CMEDownloadIssuedCommercialWord=downloadIssued;
const checklistMoney=value=>{if(typeof value==='number')return value;let raw=String(value??'').replace(/[^\d,.-]/g,'');if(raw.includes(',')||/^-?\d{1,3}(\.\d{3})+$/.test(raw))raw=raw.replace(/\./g,'').replace(',','.');const n=Number(raw);return Number.isFinite(n)?n:NaN;};
// Conferência antes de gerar o contrato: bloqueia o que impede a emissão e pergunta sobre o que fica incompleto.
async function contractChecklist(recordId){
  const {data:r,error}=await client().from('commercial_records').select('prospect_name,cpf_cnpj,rg,address,property_address,total_value,commercial_terms,services,linked_project_id').eq('id',recordId).single();
  if(error)return {ok:false,error:error.message};
  const digits=String(r.cpf_cnpj||'').replace(/\D/g,'');const company=digits.length===14;const terms=r.commercial_terms||{};
  const blocking=[];const warnings=[];
  if(!String(r.prospect_name||'').trim())blocking.push('Nome do contratante não preenchido.');
  if(digits.length!==11&&digits.length!==14)blocking.push('CPF ou CNPJ do contratante inválido ou vazio.');
  if(company){const rep=terms.legal_representative||{};if(!String(rep.name||'').trim()||String(rep.cpf||'').replace(/\D/g,'').length!==11)blocking.push('Representante legal da empresa (nome e CPF) incompleto.');}
  else if(!String(r.rg||'').trim())warnings.push('RG do contratante não preenchido (cadastro do cliente).');
  if(!String(r.address||'').trim())warnings.push('Endereço do contratante (cadastro) vazio.');
  if(!String(r.property_address||'').trim())warnings.push('Endereço da obra vazio.');
  else if(!/\d|s\/?n/i.test(String(r.property_address)))warnings.push('Endereço da obra sem número (use S/N se não houver).');
  if(r.linked_project_id){const {data:proj}=await client().from('projetos').select('cep_obra').eq('id',r.linked_project_id).maybeSingle();if(proj&&!String(proj.cep_obra||'').trim())warnings.push('CEP da obra não preenchido no projeto.');}
  const inst=Array.isArray(terms.installments)?terms.installments:[];const sum=inst.reduce((a,x)=>a+(checklistMoney(x?.amount)||0),0);const total=checklistMoney(r.total_value);
  if(inst.some(x=>!(checklistMoney(x?.amount)>0)))blocking.push('Há parcela sem valor.');
  if(inst.length&&Number.isFinite(total)&&total>0&&Math.abs(sum-total)>0.01)warnings.push(`Soma das parcelas (${sum.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}) diferente do valor total (${total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}).`);
  const services=(Array.isArray(r.services)?r.services:[]).filter(x=>x?.included===true);
  if(!services.length)blocking.push('Nenhuma atividade incluída no contrato.');
  const scope=Array.isArray(terms.scope)?terms.scope:[];
  if(services.some(x=>!String(scope.find(y=>String(y?.code)===String(x.code))?.deliverables||'').trim()))warnings.push('Há atividade sem entregáveis/quantidades preenchidos (Editar condições).');
  if(blocking.length){const error='Corrija antes de gerar: '+blocking.join(' ');status(error,'error');return {ok:false,error};}
  if(warnings.length&&!window.confirm('Conferência do contrato:\n\n• '+warnings.join('\n• ')+'\n\nGerar mesmo assim?'))return {ok:false,cancelled:true,error:'Emissão cancelada para completar o cadastro: '+warnings.join(' ')};
  return {ok:true};
}
async function generate(recordId,kind,archive){
  try{
    if(kind==='contrato'){
      const {data:terms,error:termsError}=await client().from('commercial_records').select('commercial_terms').eq('id',recordId).single();
      if(termsError)throw termsError;
      if(!Array.isArray(terms?.commercial_terms?.installments)||!terms.commercial_terms.installments.length){
        const saved=await window.CMEEditCommercialTerms(recordId);
        if(!saved)return {ok:false,cancelled:true,error:'Preencha as condições comerciais para emitir o contrato.'};
      }
    }
    if(kind==='contrato'){const check=await contractChecklist(recordId);if(!check.ok)return check;}
    const choice=await preview(recordId,kind);
    if(!choice)return {ok:false,cancelled:true,error:'Emissão cancelada. O cadastro foi preservado.'};
    status(`Gerando ${kind} (versão interna v${choice.version}; o cliente vê só as versões liberadas a ele)...`);
    const generated=await client().functions.invoke('generate-commercial-document-final',{
      body:{recordId,kind,versionReason:choice.versionReason}
    });
    if(generated.error||!generated.data?.generated){
      const error=await invocationError(generated,'Não foi possível gerar o Word.');status(error,'error');return {ok:false,error};
    }
    const documentId=generated.data.documentId;
    if(!documentId){status('Documento gerado sem vínculo de entrega.','error');return {ok:false,error:'Documento gerado sem vínculo de entrega.'};}
    const delivered=await client().functions.invoke('deliver-generated-document',{
      body:{documentId,archive,expectedDocumentKind:kind}
    });
    if(delivered.error||!delivered.data?.delivered){
      const error=await invocationError(delivered,'O Word foi gerado, mas não foi possível preparar o download.');status(error,'error');window.dispatchEvent(new CustomEvent('cme:commercial-generated',{detail:{recordId,documentId,kind}}));return {ok:false,generated:true,documentId,error};
    }
    download(delivered.data.contentBase64,delivered.data.fileName);
    const label=`${generated.data.resumed?'Emissão pendente concluída — ':''}${kind==='contrato'?'Contrato '+(generated.data.contractNumber||''):'Orçamento '+(generated.data.quoteNumber||'')} v${generated.data.version||choice.version} gerado${archive?' e arquivado':''}.`;
    if(kind==='contrato'){
      status(label+' Habilitando contrato sem projeto...');
      try{
        const linked=await formalizeServiceContract(recordId);
        status(linked.ok
          ? label+' Contrato disponível no Anexo I sem exigir projeto.'
          : label+' Atenção: o contrato precisa ser habilitado. Acesse Anexo I e use o aviso de vínculo. '+linked.error,
          linked.ok?'success':'error');
      }catch(error){
        status(label+' A habilitação do contrato não foi concluída. Use a ação de vínculo no Anexo I: '+(error?.message||'erro desconhecido'),'error');
      }
    }else{
      status(label,'success');
    }
    window.dispatchEvent(new CustomEvent('cme:commercial-generated',{detail:{recordId,documentId,kind}}));
    return {ok:true,generated:true,documentId};
  }catch(error){const message=error?.message||'Não foi possível gerar o documento.';status(message,'error');return {ok:false,error:message};}
}
const generationLocks=new Map();
window.CMEGenerateCommercialDocument=function(recordId,kind,archive){const key=recordId+':'+kind;if(generationLocks.has(key))return generationLocks.get(key);const task=generate(recordId,kind,archive).finally(()=>generationLocks.delete(key));generationLocks.set(key,task);return task;};
document.addEventListener('click',async e=>{
 const b=e.target.closest('#commercialList [data-action]');if(!b)return;const action=b.dataset.action;
 if(!['contract','contract-archive','quote','quote-archive','contract-download','quote-download','contract-revision','quote-revision','contract-versions','quote-versions'].includes(action))return;
 e.preventDefault();e.stopImmediatePropagation();if(b.disabled)return;b.disabled=true;
 const kind=action.startsWith('contract')?'contrato':'orcamento';
 try{if(action.endsWith('-download'))await downloadIssued(b.dataset.documentId);else if(action.endsWith('-versions'))await showVersions(b.dataset.id,kind);else await window.CMEGenerateCommercialDocument(b.dataset.id,kind,true);}catch(error){status(error?.message||'Não foi possível concluir a operação.','error');}finally{b.disabled=false;}
},true);
const style=document.createElement('style');style.textContent="\n/* Prévia comercial: sempre em alto contraste, independente das variáveis globais de tema. */\n.commercial-preview-modal{\n  position:fixed;inset:0;z-index:10060;\n  display:flex;justify-content:center;align-items:center;\n  padding:clamp(10px,2.5vw,24px);box-sizing:border-box;\n  background:rgba(0,7,17,.84);backdrop-filter:blur(5px);\n}\n.commercial-preview-dialog{\n  position:relative;box-sizing:border-box;\n  width:min(800px,100%);max-height:calc(100dvh - 32px);\n  overflow:auto;overscroll-behavior:contain;\n  padding:clamp(18px,3vw,30px);\n  border:1px solid rgba(197,166,105,.68);border-top:4px solid #c6a86d;\n  border-radius:18px;background:#0b1727!important;color:#f2f5fb!important;\n  box-shadow:0 30px 85px rgba(0,0,0,.66);\n  font-family:Montserrat,'Segoe UI',sans-serif;line-height:1.5;color-scheme:dark;\n}\n.commercial-preview-dialog *,\n.commercial-preview-dialog *::before,\n.commercial-preview-dialog *::after{box-sizing:border-box}\n.commercial-preview-dialog h3{\n  margin:0 44px 4px 0!important;color:#f6f8fd!important;\n  font-size:clamp(1.15rem,2.1vw,1.42rem);font-weight:750;line-height:1.3;\n}\n.commercial-preview-dialog > p:not(.commercial-preview-first){\n  color:#c7d3e1!important;margin:0 0 16px;font-size:.89rem;\n}\n.commercial-preview-close{\n  position:absolute;top:16px;right:16px;width:38px;height:38px;\n  display:grid;place-items:center;border:1px solid rgba(197,166,105,.45);\n  border-radius:10px;background:#14243a!important;color:#dfc28b!important;\n  font-size:27px;line-height:1;cursor:pointer;\n}\n.commercial-preview-close:hover{background:#203550!important;color:#fff!important}\n.commercial-preview-grid{\n  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));\n  gap:12px;margin:16px 0;\n}\n.commercial-preview-grid>div,.commercial-preview-block{\n  min-width:0;padding:13px 15px;\n  border:1px solid rgba(190,163,114,.34);\n  border-radius:11px;background:#13243a!important;\n  color:#f5f7fc!important;overflow-wrap:anywhere;\n}\n.commercial-preview-grid>div{display:flex;flex-direction:column;gap:6px;justify-content:center}\n.commercial-preview-grid small,.commercial-preview-block small{\n  display:block;margin:0;color:#bdc9d9!important;opacity:1!important;\n  font-size:.77rem;font-weight:600;letter-spacing:.01em;\n}\n.commercial-preview-grid strong,.commercial-preview-block strong,\n.commercial-preview-block span{\n  display:block;color:#f8fafc!important;opacity:1!important;\n  font-size:.94rem;line-height:1.5;font-weight:600;white-space:normal;\n}\n.commercial-preview-grid strong{font-size:1rem}\n.commercial-preview-block{display:grid;gap:6px;margin:10px 0}\n.commercial-preview-first{\n  margin:12px 0;padding:11px 14px;border-radius:10px;\n  border:1px solid rgba(197,166,105,.26);\n  background:#1d2937!important;color:#ead5ae!important;\n  font-size:.85rem;font-weight:600;\n}\n.commercial-preview-dialog .doc-field{margin:12px 0}\n.commercial-preview-dialog .doc-field label{\n  color:#d5dfeb!important;font-weight:650;font-size:.82rem;\n}\n.commercial-preview-dialog .doc-field input,\n.commercial-preview-dialog .doc-field select{\n  width:100%;padding:11px 12px;border-radius:9px;\n  border:1px solid rgba(197,166,105,.5);\n  background:#15263c!important;color:#fff!important;font:inherit;\n}\n.commercial-preview-dialog .doc-status.error{\n  color:#ffd0d0!important;background:#51252b!important;\n  border:1px solid #a45561;padding:12px;margin:12px 0;\n}\n.commercial-preview-dialog .doc-actions{\n  position:sticky;bottom:-30px;display:flex;justify-content:flex-end;\n  gap:10px;margin:18px -30px -30px;padding:14px 30px 18px;\n  border-top:1px solid rgba(197,166,105,.33);\n  border-radius:0 0 14px 14px;background:#0b1727!important;\n}\n.commercial-preview-dialog .doc-btn{\n  min-height:44px;padding:10px 17px;border-radius:9px;\n  background:#c6a86d!important;color:#091322!important;\n  font-size:.88rem;font-weight:700;white-space:normal;\n}\n.commercial-preview-dialog .doc-btn:hover{background:#e0c38a!important}\n.commercial-preview-dialog .doc-btn.ghost{\n  background:transparent!important;color:#e9d0a2!important;\n  border:1px solid rgba(197,166,105,.48)!important;\n}\n.commercial-preview-dialog .doc-btn.ghost:hover{background:#23344a!important}\n.commercial-preview-dialog :is(button,input,select):focus-visible{\n  outline:3px solid #ebcc8f;outline-offset:3px;\n}\n@media(max-width:620px){\n .commercial-preview-modal{align-items:center;padding:8px}\n .commercial-preview-dialog{max-height:calc(100dvh - 16px);padding:18px 14px;border-radius:12px}\n .commercial-preview-grid{grid-template-columns:1fr;gap:8px;margin:12px 0}\n .commercial-preview-grid>div,.commercial-preview-block{padding:11px 12px}\n .commercial-preview-dialog .doc-actions{\n  bottom:-18px;margin:16px -14px -18px;padding:12px 14px;\n  flex-direction:column-reverse;\n }\n .commercial-preview-dialog .doc-btn{width:100%}\n .commercial-preview-close{top:12px;right:12px}\n}";document.head.appendChild(style);
})();