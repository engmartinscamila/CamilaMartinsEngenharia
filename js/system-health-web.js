(()=>{'use strict';
const $=id=>document.getElementById(id);const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'Sem registro';
function state(id,label,ok){const el=$(id);if(!el)return;el.textContent=label;el.className=`health-state ${ok?'ok':'bad'}`}
function message(text,tone='info'){const el=$('healthMessage');if(!el)return;el.textContent=text;el.className=`doc-status ${tone==='danger'?'error':tone==='success'?'success':''}`}
function probeSummary(probes){const labels={adminDeleteClient:'exclusão segura',contractDocument:'documentos contratuais',commercialDocument:'orçamento/contrato',documentDelivery:'entrega de Word',constructionScheduleExcel:'Excel do cronograma'};return Object.entries(probes||{}).map(([key,value])=>`${labels[key]||key}: ${value?.ok?'OK':`falha HTTP ${value?.status??0}`}`).join(' • ')}
async function load(){const button=$('refreshHealth');if(button)button.disabled=true;message('Executando diagnóstico completo...');
 try{
  const client=window.supabaseClient;if(!client)throw new Error('Cliente seguro do portal indisponível.');
  const [healthResult,buildResult]=await Promise.all([
   client.functions.invoke('system-health',{body:{}}),
   fetch('build-version.txt',{cache:'no-store'}).then(async r=>r.ok?(await r.text()).trim():null).catch(()=>null)
  ]);
  if(healthResult.error||!healthResult.data?.ok)throw new Error(healthResult.data?.error||healthResult.error?.message||'Falha no diagnóstico do backend.');
  const health=healthResult.data,db=health.database||{},criticalIssues=Number(db.critical_issues??0),dbOk=db.database==='ok'&&db.ok!==false&&criticalIssues===0;
  const hashOk=Number(db.snapshots_total||0)===Number(db.sha256_snapshots??-1);
  const storageOk=Boolean(health.storage?.ok),edgeOk=Boolean(health.edge?.ok),siteOk=Boolean(buildResult);
  state('siteState',siteOk?'Online':'Não confirmado',siteOk);$('siteMeta').innerHTML=siteOk?`Build publicado:<br><span class="health-hash">${buildResult}</span>`:'Não foi possível ler build-version.txt.';
  state('dbState',dbOk?'Operacional':'Revisar',dbOk);$('dbMeta').textContent=`Documentos: ${db.documents_total??'—'} • snapshots: ${db.snapshots_total??'—'} • inconsistências críticas: ${criticalIssues} • RLS crítico ausente: ${db.critical_rls_missing??'—'} • último documento: ${fmt(db.latest_document_generated_at)}`;
  state('hashState',hashOk&&Number(db.documents_missing_snapshot??0)===0?'100% SHA-256':'Revisar',hashOk&&Number(db.documents_missing_snapshot??0)===0);$('hashMeta').textContent=`SHA-256: ${db.sha256_snapshots??'—'} de ${db.snapshots_total??'—'} • documentos sem snapshot: ${db.documents_missing_snapshot??'—'} • tipos desconhecidos: ${db.unknown_document_kinds??'—'} • aceites pendentes: ${db.pending_acceptances??'—'}`;
  state('storageState',storageOk?'Operacional':'Falha',storageOk);$('storageMeta').textContent=`Buckets verificados: ${health.storage?.buckets??'—'}`;
  state('edgeState',edgeOk?'Operacional':'Falha',edgeOk);$('edgeMeta').textContent=probeSummary(health.edge?.probes)||'Nenhum probe retornado.';
  const warnings=Number(db.construction_schedule_weight_warnings??0);if(warnings>0)$('edgeMeta').textContent+=` • cronogramas com pesos diferentes de 100%: ${warnings}`;
  const allOk=siteOk&&dbOk&&hashOk&&Number(db.documents_missing_snapshot??0)===0&&storageOk&&edgeOk;
  state('checkState',allOk?'Concluída':'Revisar',allOk);$('checkMeta').textContent=fmt(health.checkedAt);
  message(allOk?'Verificação completa concluída sem inconsistências críticas e sem alterar dados do sistema.':'O diagnóstico encontrou uma ou mais pendências. Revise os cartões marcados em vermelho. ',allOk?'success':'danger');
 }catch(error){state('checkState','Falha',false);$('checkMeta').textContent=fmt(new Date().toISOString());message(error instanceof Error?error.message:'Falha na verificação.','danger');}
 finally{if(button)button.disabled=false;window.ocultarCarregamentoPagina?.();}}
$('refreshHealth')?.addEventListener('click',()=>void load());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void load(),{once:true});else void load();
})();
