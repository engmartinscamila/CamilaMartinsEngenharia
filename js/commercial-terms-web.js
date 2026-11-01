(function(){
'use strict';
const api=()=>window.supabaseClient;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const methods=[['pix','Pix'],['transferencia','Transferência bancária'],['boleto','Boleto'],['dinheiro','Dinheiro'],['cartao','Cartão'],['cartao_parcelado','Cartão de crédito parcelado'],['outro','Outro (descrever no contrato)']];
const units=['unidade','conjunto','projeto','processo','prancha','imagem','ambiente','m²','visita','documento','etapa','outro'];
const municipalScopes=Object.freeze({
 k:'Serviço técnico-administrativo de organização das peças técnicas expressamente contratadas, preparação dos requerimentos, protocolo e acompanhamento do processo de legalização ou aprovação perante a Prefeitura. A análise, eventuais exigências, aprovação e expedição de documentos dependem exclusivamente da Prefeitura, sem garantia de deferimento ou prazo. Taxas, emolumentos, topografia, levantamentos planialtimétricos e documentos complementares de terceiros não estão incluídos nos honorários, salvo contratação expressa.',
 l:'Serviço técnico-administrativo de preparação e organização das peças técnicas expressamente contratadas, protocolo e acompanhamento do processo de Alvará de Construção perante a Prefeitura. A análise, eventuais exigências, aprovação e expedição do Alvará dependem exclusivamente da Prefeitura, sem garantia de deferimento ou prazo. Taxas, emolumentos, topografia, levantamentos planialtimétricos e documentos complementares de terceiros não estão incluídos nos honorários, salvo contratação expressa.',
 m:'Serviço técnico-administrativo de organização das peças técnicas expressamente contratadas, protocolo e acompanhamento do pedido de Habite-se ou documento municipal equivalente. A análise, eventuais exigências, aprovação e expedição do Habite-se dependem exclusivamente da Prefeitura, sem garantia de deferimento ou prazo. Taxas, emolumentos, topografia, levantamentos planialtimétricos e documentos complementares de terceiros não estão incluídos nos honorários, salvo contratação expressa.'
});
const municipalDeadline='Prazo de análise, aprovação e expedição: depende exclusivamente da Prefeitura. Não há prazo municipal garantido. O prazo técnico dos serviços da contratada segue as condições gerais do contrato.';
const isMunicipal=code=>Object.prototype.hasOwnProperty.call(municipalScopes,String(code||''));
const money=v=>{const s=String(v??'').trim().replace(/\s/g,'');if(!s)return NaN;const normalized=s.includes(',')?s.replace(/\./g,'').replace(',','.'):s;return /^\d+(\.\d{1,2})?$/.test(normalized)?Number(normalized):NaN};
const numberString=n=>Number.isFinite(Number(n))?Number(n).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'';
const normalizeAmount=v=>{const n=money(v);return Number.isFinite(n)?n.toFixed(2):'';};
const styles="\n.cme-terms-backdrop{position:fixed;z-index:15000;inset:0;background:rgba(0,7,17,.87);display:flex;justify-content:center;align-items:center;padding:14px;box-sizing:border-box}\n.cme-terms-modal{max-width:960px;width:100%;max-height:96vh;display:flex;flex-direction:column;border:1px solid #b79a67;border-radius:16px;overflow:hidden;background:#0b1727;color:#f3f6fc;font:14px Montserrat,'Segoe UI',sans-serif;box-shadow:0 20px 70px #0009}\n.cme-terms-modal header,.cme-terms-modal footer{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 22px;background:#0c1d30;border-bottom:1px solid #715f44}\n.cme-terms-modal footer{border-bottom:0;border-top:1px solid #715f44;justify-content:flex-end}\n.cme-terms-modal header h3{margin:0 0 8px;color:#f2d7ab}.cme-terms-modal header p{margin:4px 0;line-height:1.5;color:#cad6e4}\n.cme-terms-modal [data-close]{border:1px solid #9c825a;background:transparent;border-radius:9px;padding:6px 12px;font-size:23px;color:#efdbb7;cursor:pointer}\n.cme-terms-content{overflow:auto;padding:18px 22px}.cme-terms-content h4{color:#f0d5a7;font-size:1rem;margin:20px 0 12px}\n.cme-terms-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.cme-terms-grid label,.cme-terms-installment label{display:flex;flex-direction:column;gap:6px;font-size:.81rem;font-weight:650;color:#e2ebf6}\n.cme-terms-wide{grid-column:1/-1}.cme-terms-modal input,.cme-terms-modal select,.cme-terms-modal textarea{width:100%;border:1px solid #5b708b;border-radius:7px;background:#142841;color:#fff;padding:9px;box-sizing:border-box;font:inherit}\n.cme-terms-installment{display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:10px;align-items:end;margin-bottom:10px}.cme-terms-scope{border:1px solid #36516b;border-radius:10px;margin:12px 0;padding:14px}.cme-terms-scope legend{padding:0 8px;font-weight:700;color:#f4d7a6}\n.cme-terms-hint{color:#c6d1df;font-size:.8rem}.cme-municipal-standard,.cme-municipal-deadline{border:1px solid #46617b;border-radius:8px;padding:12px 14px;line-height:1.55;background:#13273b;color:#f0f3f7}.cme-municipal-deadline{background:#173447;border-color:#4a826d;color:#d6f2e3}.cme-terms-modal [data-terms-error]{padding:10px;background:#592d30;color:#ffe2e2;border-radius:7px;margin-bottom:10px}\n@media(max-width:670px){.cme-terms-grid,.cme-terms-installment{grid-template-columns:1fr}.cme-terms-modal header,.cme-terms-modal footer{padding:12px}.cme-terms-content{padding:12px}}\n";
function showError(root,message){const box=root.querySelector('[data-terms-error]');box.textContent=message;box.hidden=!message;if(message)box.scrollIntoView({behavior:'smooth',block:'center'});}
function input(name,placeholder,value,type='text'){return '<input name="'+esc(name)+'" type="'+type+'" value="'+esc(value??'')+'" placeholder="'+esc(placeholder)+'" autocomplete="off">';}
function rowInstallment(i={}){return '<div class="cme-terms-installment"><label>Valor (R$) '+input('amount','Ex.: 4000,00',i.amount===undefined?'':numberString(i.amount))+'</label><label>Vencimento em data '+input('due_date','',i.due_date||'','date')+'</label><label>Ou evento de cobrança '+input('due_event','Ex.: na aprovação do anteprojeto',i.due_event||'')+'</label><button type="button" class="doc-btn ghost" data-delete-installment aria-label="Excluir parcela">×</button></div>';}
function getInstallments(root){return [...root.querySelectorAll('.cme-terms-installment')].map(el=>({amount:normalizeAmount(el.querySelector('[name=amount]').value),due_date:el.querySelector('[name=due_date]').value,due_event:el.querySelector('[name=due_event]').value.trim()}));}
function renderScopeItem(item,terms){
 const code=String(item.code||''),values=terms||{},revisions=values.revisions,municipal=isMunicipal(code);
 const old=String(values.deliverables||'').trim();
 const genericOld=/^(alvar[aá](\\s+de\\s+constru[cç][aã]o)?|habite[\\s-]?se)[.!]?$/i.test(old);
 const note=values.municipal_notes??(old&&!genericOld&&old!==municipalScopes[code]?old:'');
 const deadline=municipal?'<div class="cme-terms-wide"><label>Prazo estimado da Prefeitura</label><div class="cme-municipal-deadline" role="note">'+esc(municipalDeadline)+'</div></div>':'<label>Prazo técnico desta atividade (dias) * '+input('days','Ex.: 15',values.days||'','number')+'</label>';
 const deliverables=municipal?
  '<div class="cme-terms-wide"><label>Escopo contratual padrão (automático, sem necessidade de redigir)</label><div class="cme-municipal-standard" role="note">'+esc(municipalScopes[code])+'</div></div><label class="cme-terms-wide">Observações complementares (opcional) <textarea name="municipal_notes" rows="2" placeholder="Informe somente particularidades desta contratação">'+esc(note)+'</textarea></label>':
  '<label class="cme-terms-wide">Entregáveis e quantitativos detalhados * <textarea name="deliverables" rows="2" placeholder="Ex.: 4 pranchas técnicas, 2 perspectivas e 1 memorial">'+esc(values.deliverables||'')+'</textarea></label>';
 return '<fieldset class="cme-terms-scope" data-code="'+esc(code)+'"><legend>'+esc(item.name||code)+' <small>('+esc(code)+')</small></legend><div class="cme-terms-grid"><label>Quantidade * '+input('quantity','Ex.: 2',values.quantity||'','text')+'</label><label>Unidade * <select name="unit"><option value="">Selecionar</option>'+units.map(u=>'<option value="'+esc(u)+'" '+(values.unit===u?'selected':'')+'>'+esc(u)+'</option>').join('')+'</select></label>'+deadline+'<label>Rodadas de revisão incluídas * '+input('revisions','0 quando nenhuma',revisions??'','number')+'</label><label>Visitas incluídas (se aplicável) '+input('visits','0 quando nenhuma',values.visits??'','number')+'</label>'+deliverables+'</div></fieldset>';
}
async function editTerms(recordId){
 const {data:rec,error}=await api().from('commercial_records')
 .select('id,prospect_name,cpf_cnpj,contract_number,quote_number,record_kind,total_value,services,payment_terms,commercial_terms')
 .eq('id',recordId).single();
 if(error||!rec)throw Error(error?.message||'Registro comercial não encontrado.');
 const selected=(Array.isArray(rec.services)?rec.services:[]).filter(i=>i?.included===true);
 const saved=rec.commercial_terms&&typeof rec.commercial_terms==='object'?rec.commercial_terms:{};
 const scope=Array.isArray(saved.scope)?saved.scope:[];
 const isCompany=String(rec.cpf_cnpj||'').replace(/\D/g,'').length===14;
 const representative=saved.legal_representative||{};
 const representativeFields=isCompany?'<h4>0. Representante legal da pessoa jurídica (obrigatório para contrato)</h4><div class="cme-terms-grid"><label>Nome completo * '+input('representative_name','Nome do signatário',representative.name||'')+'</label><label>CPF * '+input('representative_cpf','000.000.000-00',representative.cpf||'')+'</label><label>Cargo ou qualidade * '+input('representative_role','Ex.: Sócio-administrador',representative.role||'')+'</label><label>Poderes para representar * '+input('representative_powers','Ex.: Representante autorizado conforme contrato social',representative.powers||'')+'</label></div><p class="cme-terms-hint">Informe o signatário da empresa. A representação deve corresponder ao contrato social ou à procuração pertinente.</p>':'';

 const existing=Array.isArray(saved.installments)&&saved.installments.length?saved.installments:
    (Array.isArray(rec.payment_terms)&&rec.payment_terms.some(x=>x.value&&x.due)?rec.payment_terms.map(x=>({amount:x.value,due_date:/^\d{4}-\d\d-\d\d$/.test(x.due)?x.due:'',due_event:/^\d{4}-\d\d-\d\d$/.test(x.due)?'':x.due})):[]);
 const overlay=document.createElement('div');overlay.className='cme-terms-backdrop';overlay.innerHTML='<section class="cme-terms-modal" role="dialog" aria-modal="true" aria-label="Condições comerciais e quantitativos"><header><div><h3>Condições comerciais e cronograma</h3><p>'+esc(rec.prospect_name)+' • '+esc(rec.contract_number||rec.quote_number)+' • Valor total: <strong>R$ '+numberString(rec.total_value)+'</strong></p><p>Defina os dados reais. O contrato e o Anexo I usarão estas informações na próxima emissão, sem alterar as versões anteriores.</p></div><button type="button" data-close aria-label="Fechar">×</button></header><div class="cme-terms-content"><div data-terms-error role="alert" hidden></div>'+representativeFields+'<h4>1. Parcelamento</h4><div class="cme-terms-grid"><label>Forma de pagamento * <select name="payment_method"><option value="">Selecione</option>'+methods.map(([k,v])=>'<option value="'+esc(k)+'" '+((saved.payment_method||(rec.payment_terms||[])[0]?.method)===k?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label></div><div data-installments></div><button type="button" class="doc-btn secondary" data-add-installment>+ Adicionar parcela</button><p class="cme-terms-hint" data-sum>Confira a soma das parcelas antes de salvar.</p><h4>2. Prazos e contagem</h4><div class="cme-terms-grid"><label class="cme-terms-wide">Início da contagem * '+input('start_trigger','Ex.: assinatura + primeira parcela + recebimento de todos os documentos',saved.schedule?.start_trigger||'')+'</label><label>Prazo técnico total acordado (dias) * '+input('total_days','Ex.: 150',saved.schedule?.days||'','number')+'</label><label>Contagem * <select name="day_type"><option value="">Selecione</option><option value="uteis" '+(saved.schedule?.day_type==='uteis'?'selected':'')+'>Dias úteis</option><option value="corridos" '+(saved.schedule?.day_type==='corridos'?'selected':'')+'>Dias corridos</option></select></label></div><h4>3. Quantitativos e prazos por atividade</h4><p class="cme-terms-hint">O prazo global não é automaticamente a soma dos prazos das atividades; elas podem ocorrer em paralelo conforme o planejamento. Os serviços vêm do orçamento/contrato. A edição aqui especifica quantidades e entregáveis; não adiciona novos serviços.</p><div data-scope>'+selected.map(item=>renderScopeItem(item,scope.find(x=>x.code===item.code))).join('')+'</div></div><footer><button type="button" class="doc-btn ghost" data-cancel>Cancelar</button><button type="button" class="doc-btn" data-save>Salvar condições no sistema</button></footer></section>';
 document.body.appendChild(overlay);
 const holder=overlay.querySelector('[data-installments]'),total=Number(rec.total_value||0);
 const draw=(rows)=>{holder.innerHTML=(rows.length?rows:[{}]).map(rowInstallment).join('');updateSum();};
 const updateSum=()=>{const values=getInstallments(overlay).map(x=>Number(x.amount||0));const sum=values.reduce((a,b)=>a+b,0);const label=overlay.querySelector('[data-sum]');label.textContent='Parcelas: R$ '+numberString(sum)+' de R$ '+numberString(total)+(Math.abs(sum-total)<.009?' • soma correta':' • soma divergente');label.style.color=Math.abs(sum-total)<.009?'#bce9c8':'#ffd5a5';};
 draw(existing.length?existing:[{}]);
 holder.addEventListener('input',updateSum);
 overlay.querySelector('[data-add-installment]').onclick=()=>draw([...getInstallments(overlay),{}]);
 holder.addEventListener('click',e=>{if(e.target.closest('[data-delete-installment]'))draw(getInstallments(overlay).filter((_,index)=>index!==[...holder.children].indexOf(e.target.closest('.cme-terms-installment'))));});
 const close=ok=>{overlay.remove();return ok;};
 return new Promise(resolve=>{
  overlay.querySelector('[data-close]').onclick=()=>resolve(close(false));
  overlay.querySelector('[data-cancel]').onclick=()=>resolve(close(false));
  overlay.querySelector('[data-save]').onclick=async()=>{
    const installments=getInstallments(overlay),schedule={start_trigger:overlay.querySelector('[name=start_trigger]').value.trim(),days:overlay.querySelector('[name=total_days]').value.trim(),day_type:overlay.querySelector('[name=day_type]').value};
    const scopeRows=[...overlay.querySelectorAll('.cme-terms-scope')].map(el=>{
      const code=el.dataset.code,municipal=isMunicipal(code);
      return {code,quantity:el.querySelector('[name=quantity]').value.trim().replace(',','.'),unit:el.querySelector('[name=unit]').value,
        days:municipal?'':el.querySelector('[name=days]').value.trim(),
        deadline_type:municipal?'municipal':'technical',
        revisions:el.querySelector('[name=revisions]').value.trim(),visits:el.querySelector('[name=visits]').value.trim(),
        deliverables:municipal?municipalScopes[code]:el.querySelector('[name=deliverables]').value.trim(),
        ...(municipal?{municipal_notes:el.querySelector('[name=municipal_notes]').value.trim()}:{})};
    });
    if(!Number.isFinite(total)||total<=0){showError(overlay,'O registro não possui valor total válido. Informe o preço antes de emitir.');return;}
    if(!installments.length||installments.some(x=>!x.amount||(!x.due_date&&x.due_event.length<5))){showError(overlay,'Informe o valor e a data ou evento de cobrança de todas as parcelas.');return;}
    const sum=installments.reduce((a,b)=>a+Number(b.amount),0);if(Math.abs(sum-total)>.009){showError(overlay,'A soma das parcelas deve ser exatamente R$ '+numberString(total)+'.');return;}
    if(schedule.start_trigger.length<6||!schedule.day_type||!Number.isInteger(Number(schedule.days))||Number(schedule.days)<1){showError(overlay,'Informe o evento de início e o prazo total.');return;}
    const bad=scopeRows.find(x=>!(Number(x.quantity)>0)||!x.unit||(!isMunicipal(x.code)&&!(Number(x.days)>0))||x.deliverables.length<5||x.revisions==='');
    if(bad){showError(overlay,'Preencha quantidade, unidade, prazo, revisões e entregáveis para a atividade '+bad.code+'.');return;}
    const rep=isCompany?{name:overlay.querySelector('[name=representative_name]').value.trim(),cpf:overlay.querySelector('[name=representative_cpf]').value.trim(),role:overlay.querySelector('[name=representative_role]').value.trim(),powers:overlay.querySelector('[name=representative_powers]').value.trim()}:null;
    if(isCompany&&(!rep.name||rep.name.length<5||rep.cpf.replace(/\D/g,'').length!==11||rep.role.length<3||rep.powers.length<10)){showError(overlay,'Informe nome, CPF, cargo e poderes do representante legal da empresa.');return;}
    const data={payment_method:overlay.querySelector('[name=payment_method]').value,installments,schedule,scope:scopeRows,...(rep?{legal_representative:rep}:{})};
    const button=overlay.querySelector('[data-save]');button.disabled=true;button.textContent='Salvando...';showError(overlay,'');
    let error=null;try{({error}=await api().rpc('admin_save_commercial_terms',{p_record_id:rec.id,p_terms:data}));}catch(err){error=err;}
    button.disabled=false;button.textContent='Salvar condições no sistema';
    if(error){showError(overlay,error.message||'Não foi possível salvar as condições.');return;}
    window.dispatchEvent(new CustomEvent('cme:commercial-terms-saved',{detail:{recordId:rec.id}}));
    resolve(close(true));
   };
 });
}
window.CMEEditCommercialTerms=editTerms;
const css=document.createElement('style');css.textContent=styles;document.head.appendChild(css);
document.addEventListener('click',async e=>{
 const b=e.target.closest('#commercialList button[data-action="commercial-terms"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();
 b.disabled=true;try{await editTerms(b.dataset.id);}catch(err){alert(err.message||'Erro ao abrir as condições.');}finally{b.disabled=false;}
},true);
})();