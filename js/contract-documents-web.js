(function(){'use strict';
const $=id=>document.getElementById(id), client=()=>window.supabaseClient; const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
let scopePresets=[['a','Estudo Preliminar'],['b','Anteprojeto'],['c','Projeto Legal'],['d','Projeto Executivo / detalhamento'],['e','Projeto Estrutural'],['f','Projeto Elétrico'],['g','Projeto Hidrossanitário'],['h','Projeto de Interiores'],['i','Paisagismo'],['j','Render 3D / Maquete eletrônica'],['k','Legalização / Aprovação Prefeitura'],['l','Alvará de Construção'],['m','Habite-se'],['n','Acompanhamento técnico de obra'],['o','Laudo técnico / avaliação / vistoria'],['p','Outro']];
let serviceCatalogMeta=[];
const generators=[['anexo_i','Anexo I','Gerado a partir do escopo já contratado; não há nova seleção manual de atividades.'],['estudo_preliminar','Estudo Preliminar','Se contratado, integra o Anexo I e é remunerado conforme a proposta. Se for apenas auxiliar, não altera o escopo.'],['levantamento_tecnico','Ficha de Levantamento / Vistoria','Registre data/hora, acompanhante, responsável técnico, elementos e condições observadas.'],['servico_adicional','Serviço Adicional','Aditivo documental vinculado ao contrato vigente, enviado ao cliente para aceite. Não cria contrato paralelo.'],['autorizacao_imagem','Autorização de Uso de Imagem','Documento específico de consentimento do cliente para uso de imagens.'],['quitacao_encerramento','Quitação e Encerramento','Formalização do encerramento e situação financeira do contrato.']];
let projects=[],project=null,scope=[],approvals=[],docs=[],attention=[],documentNotifications=[],documentAcceptances=[];
const supportedDocumentKinds=new Set(['anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico','servico_adicional','autorizacao_imagem','quitacao_encerramento','notificacao_formal']);
const documentKindLabels={anexo_i:'Anexo I',termo_aceite:'Termo de Aceite',estudo_preliminar:'Estudo Preliminar',levantamento_tecnico:'Levantamento / Vistoria',servico_adicional:'Serviço Adicional',autorizacao_imagem:'Autorização de Imagem',quitacao_encerramento:'Quitação / Encerramento',notificacao_formal:'Notificação Formal'};
let activeDocumentKind=supportedDocumentKinds.has((location.hash||'').slice(1))?(location.hash||'').slice(1):null;

async function loadCatalog(){
  const {data,error}=await client().from('service_catalog')
    .select('code,name,category,level_applicable,description,deliverables,exclusions,client_inputs,default_revisions,delivery_formats,planning_reference,acceptance_required,version')
    .eq('active',true)
    .order('code');
  if(error||!Array.isArray(data)||!data.length)return;
  serviceCatalogMeta=data;
  scopePresets=data.map(item=>[item.code,item.name]);
}
function msg(text,t=''){const e=$('contractMessage');if(!e)return;e.textContent=text;e.className=`doc-status ${t}`}
function safeError(error,fallback){const raw=String(error?.message||error||'').trim(),normalized=raw.toLowerCase();if(['network request failed','failed to fetch','networkerror','timeout'].some(pattern=>normalized.includes(pattern)))return 'Sem conexão com o serviço. Verifique sua internet e tente novamente.';if([/^acesso administrativo necessário\.?$/i,/^projeto\/contrato não encontrado\.?$/i,/^tipo de documento não suportado\.?$/i,/^selecione uma aprovação para gerar o termo de aceite\.?$/i,/^aprovação não encontrada(?: para este projeto)?\.?$/i,/^este rascunho é anterior à governança documental atual\./i,/^complete a identificação profissional sigilosa em configurações antes de gerar este documento\./i,/^muitas (?:tentativas|operações)\./i].some(pattern=>pattern.test(raw)))return raw;return fallback}
function b64blob(base64){const bin=atob(base64),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})}
function download(base64,name){const u=URL.createObjectURL(b64blob(base64)),a=document.createElement('a');a.href=u;a.download=name||'documento.docx';a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
async function loadProjects(){const {data,error}=await client().from('projetos').select('id,nome,tipo,cliente_id,contract_id,numero_contrato,status,area_construida_m2,area_terreno_m2,endereco_obra,numero_obra,complemento_obra,bairro_obra,cidade_obra,estado_obra').order('created_at',{ascending:false}).limit(150);if(error){msg('Não foi possível carregar os projetos.','error');return}projects=data||[];$('contractProject').innerHTML='<option value="">Selecione o contrato / projeto...</option>'+projects.filter(p=>p.contract_id).map(p=>`<option value="${p.id}">${esc(p.numero_contrato||'Contrato')} • ${esc(p.nome)}${p.tipo?' • '+esc(p.tipo):''}</option>`).join('');if(!project&&projects.find(p=>p.contract_id)){$('contractProject').value=projects.find(p=>p.contract_id).id;await chooseProject($('contractProject').value)}}
async function chooseProject(id){
  project=projects.find(p=>p.id===id)||null;
  if(!project){scope=[];approvals=[];docs=[];attention=[];documentNotifications=[];documentAcceptances=[];renderAll();return}
  msg('Carregando fluxo contratual...');
  const [s,a,d,t,n,x]=await Promise.all([
    client().from('contract_scope_items').select('*').eq('contract_id',project.contract_id).order('display_order'),
    client().from('aprovacoes').select('id,titulo,tipo,status,descricao,delivered_at,approval_due_at,respondido_at,comentario,formal_notice_document_id').eq('projeto_id',project.id).order('created_at',{ascending:false}),
    client().from('documentos').select('id,nome,document_kind,workflow_status,optional_document,created_at,generated_at,arquivo,archived_explicitly,acceptance_required,client_released_at,version,versao').eq('projeto_id',project.id).not('document_kind','is',null).order('created_at',{ascending:false}).limit(100),
    client().rpc('admin_document_attention'),
    client().from('notificacoes').select('id,referencia_id,lida,delivery_status,scheduled_for,sent_at,created_at').eq('projeto_id',project.id).eq('referencia_tipo','documento').order('created_at',{ascending:false}).limit(200),
    client().from('document_acceptances').select('document_id,decision,note,accepted_at,document_version').eq('project_id',project.id).order('accepted_at',{ascending:false}).limit(200)
  ]);
  if(s.error||a.error||d.error||t.error||n.error||x.error){msg(safeError(s.error||a.error||d.error||t.error||n.error||x.error,'Não foi possível carregar o fluxo contratual. Tente novamente.'),'error');return}
  scope=s.data||[];approvals=a.data||[];docs=d.data||[];documentNotifications=n.data||[];documentAcceptances=x.data||[];
  attention=(t.data||[]).filter(item=>item.project_id===project.id&&item.attention_level!=='normal');
  renderAll();msg('Fluxo contratual carregado.','success');window.dispatchEvent(new CustomEvent('cme:contract-rendered'))
}
function included(code){return scope.find(x=>x.service_code===code)?.included===true}
function renderScope(){
  const box=$('scopeServices');if(!box)return;
  const contracted=scope.filter(item=>item.included===true);
  if(!contracted.length){
    box.innerHTML='<div class="doc-flow-explainer">Nenhuma atividade contratada foi encontrada. O Anexo I não permite selecionar atividades manualmente: corrija primeiro o orçamento/contrato de origem ou use Serviço Adicional para uma nova contratação.</div>';
    return;
  }
  box.className='doc-services doc-readonly-scope';
  box.innerHTML=contracted.map(item=>{
    const meta=serviceCatalogMeta.find(entry=>entry.code===item.service_code)||{};
    return `<div class="doc-service doc-service-smart"><span><strong>(${esc(item.service_code)}) ${esc(item.service_name||meta.name||item.service_code)}</strong>${meta.description?`<small class="doc-service-description">${esc(meta.description)}</small>`:''}<small class="doc-service-level">${meta.level_applicable?'Nível herdado do orçamento/contrato':'Atividade sem ampliação automática por nível'}</small></span></div>`;
  }).join('');
}
function renderGenerators(){
  $('contractGenerators').innerHTML=generators.map(([kind,title,desc])=>`
    <div class="doc-row" data-generator-kind="${kind}">
      <div class="doc-row-head">
        <div><strong>${esc(title)}</strong><div class="doc-meta">${esc(desc)}</div></div>
        <button class="doc-btn secondary" data-prepare="${kind}">Preparar</button>
      </div>
      ${kind==='estudo_preliminar'&&!included('a')?'<div class="doc-flow-explainer">Estudo Preliminar não consta no escopo vigente. Se for apenas apoio interno, será auxiliar; se o cliente o contratar, primeiro registre-o por orçamento/Serviço Adicional para que seja remunerado e passe a constar no Anexo I.</div>':''}
      ${kind==='servico_adicional'?'<div class="doc-flow-explainer">O serviço adicional ficará vinculado ao contrato selecionado acima. A versão aceita pelo cliente integra o histórico do contrato sem apagar ou substituir os documentos anteriores.</div>':''}
    </div>`).join('')
}
function renderApprovals(){
  const labels={aguardando:'Aguardando cliente',pendente:'Pendente',aceito:'Aceito',aprovado:'Aceito',recusado:'Recusado',rejeitado:'Recusado'};
  const types={etapa:'Etapa do projeto',entrega:'Entrega para validação',documento:'Documento para aprovação'};
  $('approvalList').innerHTML=approvals.length?approvals.map(a=>{
    const status=String(a.status||'aguardando').toLowerCase();
    const label=labels[status]||String(a.status||'Aguardando');
    const action=status==='aceito'||status==='aprovado'?'Ver termo':'Preparar termo';
    const due=a.approval_due_at?` • responder até ${new Date(a.approval_due_at).toLocaleDateString('pt-BR')}`:'';
    const description=a.descricao?`<div class="doc-meta">O cliente deverá avaliar: ${esc(a.descricao)}</div>`:'<div class="doc-meta">O cliente deverá avaliar a entrega registrada nesta etapa.</div>';
    return `<div class="doc-row"><div class="doc-row-head"><div><strong>${esc(a.titulo)}</strong><div class="doc-meta">${esc(types[String(a.tipo||'').toLowerCase()]||a.tipo||'Entrega')} • <span class="doc-badge">${esc(label)}</span>${a.delivered_at?` • entregue em ${new Date(a.delivered_at).toLocaleDateString('pt-BR')}`:''}${due}</div>${description}</div><button class="doc-btn secondary" data-approval="${a.id}">${action}</button></div></div>`;
  }).join(''):'<p>Nenhuma etapa/aprovação disponível.</p>'
}
function documentDeliveryStatus(documentId){
  const n=documentNotifications.find(item=>String(item.referencia_id||'')===String(documentId));
  if(!n)return '';
  if(n.delivery_status==='scheduled')return `Envio agendado${n.scheduled_for?' para '+new Date(n.scheduled_for).toLocaleString('pt-BR'):''}`;
  if(n.lida)return 'Visualizado no portal';
  if(n.sent_at||n.delivery_status==='sent')return 'Disponibilizado ao cliente';
  return String(n.delivery_status||'');
}
function documentAcceptanceStatus(documentId){
  const a=documentAcceptances.find(item=>item.document_id===documentId);
  if(!a)return '';
  const labels={accepted:'Aceito pelo cliente',accepted_with_notes:'Aceito com ressalvas',rejected:'Recusado pelo cliente'};
  return labels[a.decision]||a.decision||'';
}
function renderDocs(){
  const visibleDocs=activeDocumentKind?docs.filter(d=>d.document_kind===activeDocumentKind):[];
  const emptyLabel=activeDocumentKind?`Nenhum ${documentKindLabels[activeDocumentKind]||'documento'} preparado para este contrato/projeto.`:'Selecione um tipo de documento.';
  $('preparedDocuments').innerHTML=visibleDocs.length?visibleDocs.map(d=>{
    const delivery=documentDeliveryStatus(d.id),acceptance=documentAcceptanceStatus(d.id);
    const sendLabel=d.document_kind==='servico_adicional'||d.document_kind==='termo_aceite'||d.acceptance_required?'Enviar ao cliente para aceite':'Enviar ao cliente';
    return `<div class="doc-row"><div class="doc-row-head"><div><strong>${esc(d.nome)}</strong><div class="doc-meta">${d.optional_document?'Documento auxiliar/adicional':'Vinculado ao fluxo contratual'} • ${new Date(d.created_at).toLocaleDateString('pt-BR')}${delivery?' • '+esc(delivery):''}${acceptance?' • '+esc(acceptance):''}</div></div><span class="doc-badge">${esc(d.workflow_status)}</span></div><div class="doc-actions">${['rascunho','gerado'].includes(d.workflow_status)?`<button class="doc-btn secondary" data-download="${d.id}" data-kind="${esc(d.document_kind)}">Baixar Word</button><button class="doc-btn ghost" data-archive="${d.id}" data-kind="${esc(d.document_kind)}">Baixar + arquivar</button>`:''}${d.workflow_status==='gerado'&&d.arquivo?`<button class="doc-btn" data-send="${d.id}" data-kind="${esc(d.document_kind)}">${sendLabel}</button>`:''}</div></div>`;
  }).join(''):`<p>${esc(emptyLabel)}</p>`
}
function renderAttention(){
  $('contractAttention').innerHTML=attention.length?attention.map(a=>{
    const existing=a.formal_notice_document_id?docs.find(d=>d.id===a.formal_notice_document_id):null;
    const status=existing?documentDeliveryStatus(existing.id):'';
    return `<div class="doc-row"><div class="doc-row-head"><div><strong>${esc(a.approval_title)}</strong><div class="doc-meta">${esc(a.client_name||'Cliente')} • ${esc(a.contract_number||'Contrato')}</div></div><span class="doc-badge">${a.attention_level==='overdue'?'Prazo vencido':'Prazo próximo'}</span></div><div class="doc-meta">Entrega: ${new Date(a.delivered_at).toLocaleDateString('pt-BR')} • limite: ${new Date(a.due_at).toLocaleDateString('pt-BR')}${status?' • '+esc(status):''}</div><div class="doc-actions"><button class="doc-btn secondary" data-notice="${a.approval_id}">${existing?'Abrir / atualizar Notificação Formal':'Preparar Notificação Formal'}</button></div></div>`;
  }).join(''):'<p>Nenhuma manifestação do cliente está próxima do prazo ou vencida.</p>'
}
function renderAll(){renderScope();renderGenerators();renderApprovals();renderDocs();renderAttention();window.dispatchEvent(new CustomEvent('cme:contract-rendered'))}
async function prepare(kind,approvalId=null){
  if(!project)return;
  msg('Preparando documento com dados do contrato e escopo vigente...');
  try{
    const optionalStudy=kind==='estudo_preliminar'&&!included('a');
    const {data,error}=await client().rpc('admin_prepare_contract_document',{p_project_id:project.id,p_document_kind:kind,p_approval_id:approvalId,p_extra_data:{}});
    if(error)throw error;
    if(!data)throw new Error('Documento não preparado');
    msg(optionalStudy?'Estudo Preliminar preparado como auxiliar. Para contratá-lo, registre o serviço antes de emitir o Anexo I.':'Rascunho preparado com dados do contrato e escopo vigente.','success');
    await chooseProject(project.id)
  }catch(error){msg(safeError(error,'Não foi possível preparar o documento. Tente novamente.'),'error')}
}
async function generateAndDeliver(id,archive,expectedDocumentKind){const expected=supportedDocumentKinds.has(expectedDocumentKind)?expectedDocumentKind:null;const selected=docs.find(d=>d.id===id);if(!expected||(selected&&selected.document_kind!==expected)){msg('O documento selecionado não corresponde ao tipo aberto. A lista foi atualizada para evitar o download incorreto.','error');if(project)await chooseProject(project.id);return}msg(`Gerando ${documentKindLabels[expected]||'documento'}...`);const gen=await client().functions.invoke('generate-contract-document',{body:{documentId:id,action:'generate',expectedDocumentKind:expected}});if(gen.error||!gen.data?.generated||gen.data?.documentKind!==expected){msg(safeError(gen.data?.error||gen.error,'Não foi possível gerar o Word correto. Tente novamente.'),'error');return}const out=await client().functions.invoke('deliver-generated-document',{body:{documentId:id,archive,expectedDocumentKind:expected}});if(out.error||!out.data?.delivered||out.data?.documentKind!==expected){msg(safeError(out.data?.error||out.error,'O Word foi gerado, mas o tipo retornado não corresponde ao solicitado.'),'error');return}download(out.data.contentBase64,out.data.fileName);msg(archive?'Word baixado e arquivado.':'Word baixado; o arquivo temporário foi removido e o extrato foi preservado.','success');await chooseProject(project.id)}
async function send(id,expectedDocumentKind){const expected=supportedDocumentKinds.has(expectedDocumentKind)?expectedDocumentKind:null;if(!expected){msg('Tipo de documento inválido.','error');return}const scheduledInput=window.prompt('Agendar envio? Informe data/hora ISO (opcional) ou deixe em branco para enviar agora.','');const scheduledFor=scheduledInput&&/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}/.test(scheduledInput)?new Date(scheduledInput).toISOString():null;const out=await client().functions.invoke('generate-contract-document',{body:{documentId:id,action:'send',expectedDocumentKind:expected,scheduledFor}});if(out.error||!out.data?.sent||out.data?.documentKind!==expected){msg(safeError(out.data?.error||out.error,'Não foi possível disponibilizar o documento correto ao cliente.'),'error');return}msg(out.data?.scheduled?'Envio agendado.':'Documento disponibilizado ao cliente.','success');await chooseProject(project.id)}
async function notice(approvalId){msg('Preparando Notificação Formal...');const p=await client().rpc('admin_prepare_formal_notice',{p_approval_id:approvalId});if(p.error||!p.data){msg(safeError(p.error,'Não foi possível preparar a notificação.'),'error');return}await generateAndDeliver(p.data,false,'notificacao_formal')}
function bind(){$('contractProject')?.addEventListener('change',e=>chooseProject(e.target.value));$('contractGenerators')?.addEventListener('click',e=>{const b=e.target.closest('[data-prepare]');if(b)prepare(b.dataset.prepare)});$('approvalList')?.addEventListener('click',e=>{const b=e.target.closest('[data-approval]');if(b)prepare('termo_aceite',b.dataset.approval)});$('preparedDocuments')?.addEventListener('click',e=>{const b=e.target.closest('[data-download],[data-archive],[data-send]');if(!b)return;const expected=b.dataset.kind||activeDocumentKind;if(b.dataset.download)generateAndDeliver(b.dataset.download,false,expected);if(b.dataset.archive)generateAndDeliver(b.dataset.archive,true,expected);if(b.dataset.send)send(b.dataset.send,expected)});$('contractAttention')?.addEventListener('click',e=>{const b=e.target.closest('[data-notice]');if(b)notice(b.dataset.notice)});window.addEventListener('cme:document-mode',e=>{const kind=e.detail?.kind;activeDocumentKind=supportedDocumentKinds.has(kind)?kind:null;renderDocs()});setTimeout(async()=>{await loadCatalog();await loadProjects()},300)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();})();
