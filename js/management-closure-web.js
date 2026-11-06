(function(){
'use strict';
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
let active=null;
async function rpc(name,args){const result=await window.supabaseClient.rpc(name,args);if(result.error)throw new Error(result.error.message||'Não foi possível concluir.');return result.data;}
function openDialog(title){
 if(active)active.remove();
 const previous=document.activeElement,root=document.createElement('div');root.className='closure-modal';
 root.innerHTML=`<section class="closure-dialog" role="dialog" aria-modal="true" aria-labelledby="closureTitle"><h3 id="closureTitle">${esc(title)}</h3><button type="button" class="closure-close" aria-label="Fechar assistente">×</button><div data-closure-body role="status">Conferindo os dados…</div><p data-closure-status aria-live="polite"></p></section>`;
 root.querySelector('.closure-close').onclick=()=>{if(root.dataset.busy)return;root.remove();active=null;previous?.focus?.();};
 root.addEventListener('keydown',event=>{if(event.key==='Escape')root.querySelector('.closure-close').click();if(event.key==='Tab'){const controls=[...root.querySelectorAll('button:not(:disabled),input,select,a[href]')];const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 document.body.appendChild(root);active=root;root.querySelector('.closure-close').focus();return root;
}
function message(root,text,error=false){const node=root.querySelector('[data-closure-status]');node.textContent=text;node.className=error?'closure-error':'';}
async function action(root,work){if(root.dataset.busy)return;root.dataset.busy='true';root.setAttribute('aria-busy','true');root.querySelectorAll('button').forEach(b=>b.disabled=true);try{await work();}catch(error){message(root,error.message||'Não foi possível concluir. Atualize o diagnóstico e tente novamente.',true);}finally{delete root.dataset.busy;root.removeAttribute('aria-busy');root.querySelectorAll('button').forEach(b=>b.disabled=b.hasAttribute('data-closure-blocked'));}}
function updated(recordId){window.dispatchEvent(new CustomEvent('cme:commercial-records-updated',{detail:{recordId}}));window.dispatchEvent(new CustomEvent('cme:commercial-terms-saved'));}
function formatMoney(value){return Number(value??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
async function openCommercial(recordId){
 const root=openDialog('Assistente de fechamento do contrato');let plan;
 const load=async()=>{plan=await rpc('admin_commercial_closure',{p_record_id:recordId});if(!root.isConnected)return;render();};
 const render=()=>{
  const issues=Array.isArray(plan.issues)?plan.issues:[];
  root.querySelector('[data-closure-body]').innerHTML=`<p><strong>${esc(plan.number)} • ${esc(plan.clientName)}</strong></p><p>Versão emitida: ${esc(plan.version||'nenhuma')} • Valor: ${esc(formatMoney(plan.total))}</p><p>As correções abaixo afetam a preparação da próxima revisão. As versões já emitidas e seus aceites permanecem preservados.</p>
   <div class="closure-checklist"><p>${plan.contractReady?'✓':'○'} Cadastro contratual habilitado</p><p>${plan.accessReady?'✓':'○'} Acesso do cliente associado</p><p>${issues.length?'○':'✓'} Escopo particular compatível com as atividades selecionadas</p><p>${plan.emitted?'✓':'○'} Contrato Word emitido</p><p>${plan.annexCurrent?'✓':'○'} Anexo I corresponde à versão emitida</p></div>
   ${issues.map((issue,index)=>`<article class="closure-issue"><h4>(${esc(issue.code)}) ${esc(issue.name)}</h4><p>${esc(issue.message)}</p><p><strong>Preenchimento atual</strong><br>${esc(issue.current||'Não preenchido')}</p>
    ${issue.kind==='classification'?`<p><strong>Sugestão:</strong> ${esc(issue.targetName)}. Os entregáveis particulares, valores e prazos são mantidos.</p>${issue.targetIncluded?'<p>A categoria sugerida já está incluída. Confira os itens antes de consolidar o escopo.</p>':`<button type="button" data-resolve="reclassify" data-index="${index}">Reclassificar como ${esc(issue.targetName)}</button>`}`:''}
    ${issue.kind==='scope'&&issue.suggestion?`<p><strong>Opção 1 — manter a atividade selecionada</strong><br>Entregáveis aprovados para este serviço e nível:</p><p class="closure-proposal">${esc(issue.suggestion)}</p><button type="button" data-resolve="use_approved_deliverables" data-index="${index}">Usar esses entregáveis no levantamento</button>`:''}
    ${issue.canRemove?`<p><strong>Opção 2 — eliminar a linha redundante</strong><br>Projeto executivo e maquete já estão selecionados em suas próprias atividades. Confira os quantitativos antes de retirar esta linha.</p><button type="button" data-resolve="remove_redundant" data-index="${index}">Retirar esta linha da próxima revisão</button>`:''}
    <button type="button" data-edit-terms>Editar condições manualmente</button></article>`).join('')}
   ${!plan.contractReady?'<button type="button" data-enable-contract>Habilitar contrato existente</button>':''}
   ${plan.clientId?`<p>${plan.accessReady?'O cliente já possui acesso associado.':'O cadastro existe, mas ainda não possui uma conta de acesso associada.'}</p><a href="clientes.html?clientId=${encodeURIComponent(plan.clientId)}">${plan.accessReady?'Conferir acesso do cliente':'Abrir cadastro para enviar o convite de acesso'}</a>`:''}
   ${plan.clientId&&!plan.accessReady?'<button type="button" data-invite>Enviar convite de acesso ao cliente</button>':''}
   <div class="closure-actions"><button type="button" data-projects>Resolver vínculos de projetos</button><button type="button" data-refresh>Atualizar diagnóstico</button>
    ${!issues.length?`<button type="button" data-emit>${plan.emitted?'Preparar nova revisão do contrato':'Preparar contrato Word'}</button>`:''}
    ${plan.emitted&&plan.contractReady?`<button type="button" data-annex ${plan.revisionRequired||issues.length?'disabled data-closure-blocked title="Emita a revisão do contrato com as correções antes de preparar o Anexo I."':''}>Preparar Anexo I deste contrato</button>`:''}</div>
   <p>${issues.length?`${issues.length} pendência(s) de escopo. Resolva uma por vez; o diagnóstico será atualizado após cada ação.`:plan.revisionRequired?'Escopo conferido. As alterações precisam aparecer em uma nova revisão antes de atualizar o Anexo I.':'Escopo conferido. A emissão e o aceite do cliente são etapas próprias do fluxo.'}</p>`;
  root.querySelectorAll('[data-resolve]').forEach(button=>button.onclick=()=>void action(root,async()=>{
   const issue=issues[Number(button.dataset.index)],kind=button.dataset.resolve;
   const description=kind==='reclassify'?`Reclassificar (${issue.code}) como ${issue.targetName}, preservando as condições particulares?`:kind==='remove_redundant'?`Retirar (${issue.code}) da próxima revisão? Confira que suas entregas estão cobertas pelas atividades restantes. O valor total não será recalculado automaticamente.`:`Substituir somente os entregáveis de (${issue.code}) pela sugestão exibida? Quantidades, prazos e parcelas serão mantidos.`;
   if(!window.confirm(description))return;
   plan=await rpc('admin_resolve_commercial_closure',{p_record_id:recordId,p_expected_token:plan.token,p_action:kind,p_code:issue.code,p_target_code:issue.targetCode||null});
   updated(recordId);render();message(root,'Correção salva para a próxima revisão. Os arquivos emitidos foram preservados.');
  }));
  root.querySelectorAll('[data-edit-terms]').forEach(button=>button.onclick=()=>void action(root,async()=>{if(typeof window.CMEEditCommercialTerms!=='function')throw Error('O editor não carregou. Atualize a página.');root.remove();active=null;await window.CMEEditCommercialTerms(recordId);}));
  root.querySelector('[data-enable-contract]')?.addEventListener('click',()=>void action(root,async()=>{await rpc('admin_formalize_service_contract',{p_record_id:recordId});updated(recordId);await load();message(root,'Contrato habilitado.');}));
  root.querySelector('[data-invite]')?.addEventListener('click',()=>void action(root,async()=>{
   const account=await window.supabaseClient.from('clientes').select('email').eq('id',plan.clientId).single();
   if(account.error||!account.data?.email)throw Error('Confira o e-mail do cliente no cadastro antes de enviar o convite.');
   if(!window.confirm(`Enviar convite para ${plan.clientName}, no e-mail ${account.data.email}, para criar a senha de acesso ao portal?`))return;
   const sent=await window.supabaseClient.functions.invoke('admin-invite-client',{body:{clientId:plan.clientId}});
   if(sent.error||sent.data?.invitationSent!==true)throw Error(sent.data?.error||'O envio não foi confirmado. Consulte o histórico de e-mails antes de tentar novamente.');
   await load();message(root,'Convite enviado pelo servidor. A entrega e a definição da senha podem ser acompanhadas no cadastro do cliente.');
  }));
  root.querySelector('[data-projects]').onclick=()=>void openProjects();root.querySelector('[data-refresh]').onclick=()=>void action(root,load);
  root.querySelector('[data-emit]')?.addEventListener('click',()=>{if(typeof window.CMEGenerateCommercialDocument!=='function'){message(root,'O gerador não carregou. Atualize a página.',true);return;}root.remove();active=null;void window.CMEGenerateCommercialDocument(recordId,'contrato',true);});
  root.querySelector('[data-annex]')?.addEventListener('click',()=>{
   root.remove();active=null;document.querySelector('[data-doc-tab="anexo_i"]')?.click();
   window.dispatchEvent(new CustomEvent('cme:commercial-records-updated',{detail:{recordId,projectId:plan.projectId}}));
  });
 };
 try{await load();}catch(error){message(root,error.message,true);root.querySelector('[data-closure-body]').textContent='O diagnóstico não foi concluído. Nenhuma correção foi aplicada.';}
}
async function openProjects(){
 const root=openDialog('Resolver vínculos de projetos');
 const load=async()=>{
  const projects=await rpc('admin_project_contract_closure',{});if(!root.isConnected)return;
  root.querySelector('[data-closure-body]').innerHTML=`<p>O número já preenchido é usado para ordenar as sugestões. Confira a abrangência e os endereços antes de aplicar o vínculo. Nenhum projeto será recriado.</p>${projects.length?projects.map((p,index)=>`<article class="closure-issue"><h4>${esc(p.name)} • ${esc(p.clientName)}</h4><p>Referência atual: ${esc(p.number||'Não informada')}<br>Endereço do projeto: ${esc(p.address||'Não informado')}</p>${p.candidates.length?`<label>Contrato do mesmo cliente<select data-project-choice="${index}"><option value="">Selecione após conferir</option>${p.candidates.map(c=>`<option value="${esc(c.id)}">${esc(c.number)}${c.numberMatch?' — corresponde à referência preenchida':''} • ${esc(c.service||'Serviço a conferir')}</option>`).join('')}</select></label><div>${p.candidates.map(c=>`<p><strong>${esc(c.number)}</strong>: ${esc(c.address||'Sem endereço comercial registrado')}</p>`).join('')}</div><label><input type="checkbox" data-project-ack="${index}"> Conferi que o contrato escolhido abrange este projeto, inclusive se os endereços forem diferentes.</label><button type="button" data-link-project="${index}">Vincular este projeto</button>`:`<p>Não há contrato ativo deste cliente para sugerir. Registre os dados do acordo existente para vincular este mesmo projeto.</p><label>Número do contrato existente<input data-register-number="${index}" autocomplete="off"></label><label>Serviço contratado<input data-register-service="${index}"></label><label>Valor contratado (R$)<input data-register-value="${index}" inputmode="decimal"></label><button type="button" data-register-project="${index}">Registrar acordo e vincular este projeto</button><p>Este registro não emite Word nem presume assinatura ou aceite.</p>`}</article>`).join(''):'<p>✓ Todos os projetos possuem vínculo contratual.</p>'}<button type="button" data-refresh>Atualizar diagnóstico</button>`;
  root.querySelector('[data-refresh]').onclick=()=>void action(root,load);
  root.querySelectorAll('[data-register-project]').forEach(button=>button.onclick=()=>void action(root,async()=>{
   const index=Number(button.dataset.registerProject),p=projects[index];
   const number=root.querySelector(`[data-register-number="${index}"]`).value.trim(),service=root.querySelector(`[data-register-service="${index}"]`).value.trim();
   const raw=root.querySelector(`[data-register-value="${index}"]`).value.trim();
   if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(raw))throw Error('Informe o valor em reais, por exemplo 1.200,00.');
   const value=Number(raw.replaceAll('.','').replace(',','.'));
   if(!number||service.length<3||value<=0)throw Error('Preencha número, serviço e valor do contrato existente.');
   if(!window.confirm('Registrar o acordo informado e vincular este projeto? Nenhum documento será emitido e nenhuma assinatura será presumida.'))return;
   await rpc('admin_register_existing_project_contract',{p_project_id:p.id,p_expected_token:p.token,p_number:number,p_service:service,p_value:value});
   await load();message(root,'Acordo registrado e vinculado ao projeto existente.');
  }));
  root.querySelectorAll('[data-link-project]').forEach(button=>button.onclick=()=>void action(root,async()=>{
   const index=Number(button.dataset.linkProject),p=projects[index],contractId=root.querySelector(`[data-project-choice="${index}"]`).value,ack=root.querySelector(`[data-project-ack="${index}"]`).checked;
   if(!contractId||!ack)throw Error('Selecione o contrato e confirme a conferência da abrangência e dos endereços.');
   await rpc('admin_link_existing_project_contract',{p_project_id:p.id,p_contract_id:contractId,p_expected_token:p.token,p_acknowledge:true});
   window.dispatchEvent(new CustomEvent('cme:commercial-records-updated',{detail:{projectId:p.id}}));await load();message(root,'Vínculo salvo. Endereço, arquivos e histórico do projeto foram preservados.');
  }));
 };
 try{await load();}catch(error){message(root,error.message,true);root.querySelector('[data-closure-body]').textContent='Não foi possível conferir os vínculos. Nenhum registro foi alterado.';}
}
function bind(){
 const parent=document.querySelector('.doc-shell')||document.querySelector('main.conteudo');if(!parent)return;
 const panel=document.createElement('section');panel.className='closure-entry';panel.innerHTML='<h3>Fechamento de pendências</h3><p>Confira contratos sem vínculo e resolva divergências com os dados já cadastrados. Nos contratos, use “Resolver pendências” para conferir escopo, emissão, Anexo I e acesso.</p><button type="button" data-open-project-closure>Conferir vínculos de projetos</button>';parent.prepend(panel);
 panel.querySelector('button').onclick=()=>void openProjects();
 document.addEventListener('click',event=>{const button=event.target.closest('[data-closure-record]');if(button){event.preventDefault();void openCommercial(button.dataset.closureRecord);}});
}
window.CMEOpenCommercialClosure=openCommercial;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
