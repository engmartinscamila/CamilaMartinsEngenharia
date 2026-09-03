(()=>{'use strict';
const $=id=>document.getElementById(id);const fmt=v=>v?new Date(v).toLocaleString('pt-BR'):'Sem registro';
function state(id,label,ok){const el=$(id);if(!el)return;el.textContent=label;el.className=`health-state ${ok?'ok':'bad'}`}
function message(text,tone='info'){const el=$('healthMessage');if(!el)return;el.textContent=text;el.className=`doc-status ${tone==='danger'?'error':tone==='success'?'success':''}`}
async function load(){const button=$('refreshHealth');if(button)button.disabled=true;message('Executando diagnóstico...');
 try{
  const client=window.supabaseClient;if(!client)throw new Error('Cliente seguro do portal indisponível.');
  const [healthResult,buildResult]=await Promise.all([
   client.functions.invoke('system-health',{body:{}}),
   fetch('build-version.txt',{cache:'no-store'}).then(async r=>r.ok?(await r.text()).trim():null).catch(()=>null)
  ]);
  if(healthResult.error||!healthResult.data?.ok)throw new Error(healthResult.data?.error||healthResult.error?.message||'Falha no diagnóstico do backend.');
  const health=healthResult.data,db=health.database||{},hashOk=Number(db.snapshots_total||0)===Number(db.sha256_snapshots??-1);
  state('siteState',buildResult?'Online':'Não confirmado',Boolean(buildResult));$('siteMeta').innerHTML=buildResult?`Build publicado:<br><span class="health-hash">${buildResult}</span>`:'Não foi possível ler build-version.txt.';
  state('dbState',db.database==='ok'?'Operacional':'Falha',db.database==='ok');$('dbMeta').textContent=`Documentos: ${db.documents_total??'—'} • snapshots: ${db.snapshots_total??'—'} • último documento: ${fmt(db.latest_document_generated_at)}`;
  state('hashState',hashOk?'100% SHA-256':'Revisar',hashOk);$('hashMeta').textContent=`SHA-256: ${db.sha256_snapshots??'—'} de ${db.snapshots_total??'—'} • referências históricas: ${db.legacy_snapshots??'—'} • aceites pendentes: ${db.pending_acceptances??'—'}`;
  state('storageState',health.storage?.ok?'Operacional':'Falha',Boolean(health.storage?.ok));$('storageMeta').textContent=`Buckets verificados: ${health.storage?.buckets??'—'}`;
  state('edgeState',health.edge?.ok?'Operacional':'Falha',Boolean(health.edge?.ok));$('edgeMeta').textContent=`Diagnóstico protegido: ${health.edge?.function??'—'}`;
  state('checkState','Concluída',true);$('checkMeta').textContent=fmt(health.checkedAt);message('Verificação concluída sem alterar dados do sistema.','success');
 }catch(error){state('checkState','Falha',false);$('checkMeta').textContent=fmt(new Date().toISOString());message(error instanceof Error?error.message:'Falha na verificação.','danger');}
 finally{if(button)button.disabled=false;window.ocultarCarregamentoPagina?.();}}
$('refreshHealth')?.addEventListener('click',()=>void load());if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void load(),{once:true});else void load();
})();
