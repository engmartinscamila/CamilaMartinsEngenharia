/*
==========================================================
CAMILA MARTINS ENGENHARIA
UI CORE — INTERFACE ADMINISTRATIVA COMPARTILHADA
==========================================================
*/
(function(){"use strict";
const CME_STYLE_VERSION=new URL(document.currentScript?.src||location.href,location.href).searchParams.get('v')||'20261029-controls-1';
const CHAVE_TEMA="cme_admin_tema",CHAVE_COR="cme_admin_cor_principal",CHAVE_NOTIFICACOES="cme_admin_notificacoes";
function carregarAjustesVisuais(){if(!document.getElementById("cmeAdminPolish")){const link=document.createElement("link");link.id="cmeAdminPolish";link.rel="stylesheet";link.href="css/admin-polish.css?v="+encodeURIComponent(CME_STYLE_VERSION)+"";document.head.appendChild(link)}if(!document.getElementById("cmeMobileLayoutFix")){const mobile=document.createElement("link");mobile.id="cmeMobileLayoutFix";mobile.rel="stylesheet";mobile.href="css/mobile-layout-fix.css?v="+encodeURIComponent(CME_STYLE_VERSION)+"";document.head.appendChild(mobile)}}
function fixarNomeAdministradora(){const alvo=document.querySelector("#adminName, #nomeAdministrador");if(!alvo)return;alvo.textContent="Camila";if(alvo.dataset.cmeNomeObserver==="true")return;alvo.dataset.cmeNomeObserver="true";new MutationObserver(()=>{if(alvo.textContent.trim()!=="Camila")alvo.textContent="Camila"}).observe(alvo,{childList:true,characterData:true,subtree:true})}
function elementosLoading(){return[document.getElementById("loading"),document.getElementById("loader"),document.getElementById("carregando")].filter(Boolean)}function ocultarCarregamento(){for(const elemento of elementosLoading()){elemento.style.setProperty("display","none","important");elemento.style.setProperty("pointer-events","none","important");elemento.setAttribute("aria-hidden","true")}}function mostrarCarregamento(){for(const elemento of elementosLoading()){elemento.style.removeProperty("display");elemento.style.removeProperty("pointer-events");elemento.setAttribute("aria-hidden","false")}}function corValida(valor){return/^#[0-9a-f]{6}$/i.test(String(valor||"").trim())}
function aplicarPreferencias(preferencias={}){const tema=preferencias.tema||localStorage.getItem(CHAVE_TEMA)||"escuro",cor=preferencias.cor_principal||localStorage.getItem(CHAVE_COR)||"#b89a63",notificacoes=preferencias.notificacoes;document.documentElement.dataset.adminTheme=tema==="claro"?"claro":"escuro";if(corValida(cor)){document.documentElement.style.setProperty("--dourado",cor);localStorage.setItem(CHAVE_COR,cor)}localStorage.setItem(CHAVE_TEMA,tema==="claro"?"claro":"escuro");if(typeof notificacoes==="boolean")localStorage.setItem(CHAVE_NOTIFICACOES,notificacoes?"ativo":"inativo")}
function rotaPortalDoHref(href){const match=String(href||"").match(/^\/?portal\/admin\/([a-z0-9-]+)$/i);return match?match[1]:null}
function urlPontePortal(rota){return`/portal/admin/${encodeURIComponent(rota)}/`}
function criarLinkMenu(href,icon,titulo){const link=document.createElement("a");const rota=rotaPortalDoHref(href);link.href=rota?urlPontePortal(rota):href;link.className="menu-item";link.innerHTML=`<i class="fa-solid ${icon}"></i><span>${titulo}</span>`;if(rota)link.dataset.cmePortalSection=rota;return link}

// Ordem única e imutável para TODAS as páginas do Admin clássico.
// Os hrefs modernos usam a mesma rota canônica no clique, nova aba e copiar link.
const MENU_ADMIN_CANONICO=[
  ["portal/admin/workspace","fa-house","Visão geral"],
  ["portal/admin/client-center","fa-users","Clientes e projetos"],
  ["portal/admin/crm","fa-filter","Oportunidades comerciais"],
  ["orcamentos-contratos.html","fa-file-signature","Contratos gerais"],
  ["portal/admin/asset-center","fa-folder-open","Acervo do projeto"],
  ["portal/admin/document-center","fa-file-circle-check","Emissões e aprovações"],
  ["portal/admin/works-center","fa-helmet-safety","Gestão da obra"],
  ["portal/admin/finance-center","fa-wallet","Financeiro e recibos"],
  ["portal/admin/relationship-center","fa-comments","Agenda e relacionamento"],
  ["portal/admin/settings-center","fa-gear","Configurações"],
];
const ferramentasAdministrativas=[
  ["workspace", "fa-house", "Visão geral"],
  ["client-center", "fa-users", "Clientes e projetos"],
  ["crm", "fa-filter", "Oportunidades comerciais"],
  ["asset-center", "fa-folder-open", "Acervo do projeto"],
  ["document-center", "fa-file-circle-check", "Emissões e aprovações"],
  ["works-center", "fa-helmet-safety", "Gestão da obra"],
  ["finance-center", "fa-wallet", "Financeiro e recibos"],
  ["relationship-center", "fa-comments", "Agenda e relacionamento"],
  ["settings-center", "fa-gear", "Configurações"],
];
// Generated from portal-app/src/lib/admin-menu-groups.json.
const ADMIN_MENU_GROUPS=[{"id":"home","title":"Início","icon":"home-outline","classicIcon":"fa-house","sections":["workspace"]},{"id":"clients","title":"Clientes e contratos","icon":"people-outline","classicIcon":"fa-users","sections":["client-center","crm","commercial-documents"]},{"id":"documents","title":"Documentos e arquivos","icon":"folder-open-outline","classicIcon":"fa-folder-open","sections":["asset-center","document-center"]},{"id":"works","title":"Gestão de obras","icon":"construct-outline","classicIcon":"fa-helmet-safety","sections":["works-center"]},{"id":"finance","title":"Financeiro e recibos","icon":"wallet-outline","classicIcon":"fa-receipt","sections":["finance-center"]},{"id":"communication","title":"Agenda e comunicação","icon":"calendar-outline","classicIcon":"fa-calendar-days","sections":["relationship-center"]},{"id":"settings","title":"Configurações","icon":"settings-outline","classicIcon":"fa-gear","sections":["settings-center"]}];
const GROUPED_ADMIN_ROUTES={"clients":{"area":"client-center","view":"clients"},"projects":{"area":"client-center","view":"projects"},"documents":{"area":"asset-center","view":"files"},"photos":{"area":"asset-center","view":"photos"},"document-archive":{"area":"asset-center","view":"archive"},"financial":{"area":"finance-center","view":"entries"},"receipts":{"area":"finance-center","view":"receipts"},"requests":{"area":"relationship-center","view":"requests"},"agenda":{"area":"relationship-center","view":"agenda"},"notifications":{"area":"relationship-center","view":"notifications"},"settings":{"area":"settings-center","view":"general"},"portal-control":{"area":"settings-center","view":"portal"},"security":{"area":"settings-center","view":"security"},"system-health":{"area":"settings-center","view":"health"},"service-level-governance":{"area":"settings-center","view":"services"},"website-content":{"area":"settings-center","view":"website"},"construction-schedule":{"area":"works-center","view":"complete"},"schedule":{"area":"works-center","view":"simple"},"construction-schedule-budget":{"area":"works-center","view":"budget"},"construction-schedule-measurements":{"area":"works-center","view":"measurements"},"construction-schedule-revision":{"area":"works-center","view":"revision"},"construction-schedule-baselines":{"area":"works-center","view":"baselines"},"construction-schedule-new":{"area":"works-center","view":"new"},"construction-schedule-test":{"area":"works-center","view":"test"},"tasks":{"area":"works-center","view":"tasks"},"work-diary":{"area":"works-center","view":"diary"},"procurement":{"area":"works-center","view":"procurement"},"library":{"area":"asset-center","view":"files"}};
const CLASSIC_MENU_KEYS={"admin.html":"dashboard","clientes.html":"clients","projetos.html":"projects","orcamentos-contratos.html":"commercial-documents","documentos.html":"documents","fotos.html":"photos","biblioteca.html":"library","recibos.html":"receipts","agenda.html":"agenda","cronograma.html":"schedule","solicitacoes.html":"requests","protecao-pdf-admin.html":"website-content","configuracoes.html":"settings","integridade-sistema.html":"system-health"};
function chaveMenu(href){return rotaPortalDoHref(href)||CLASSIC_MENU_KEYS[href];}
function criarGrupoMenu(group,links,active,scope){
  if(links.length===1){const item=document.createElement('div');item.className='cme-admin-menu-group cme-admin-menu-single';item.dataset.cmeMenuGroup=group.id;if(active)item.classList.add('cme-current-group');item.append(links[0]);return item;}
  const details=document.createElement('details');details.className='cme-admin-menu-group';details.dataset.cmeMenuGroup=group.id;details.open=active;
  if(active)details.classList.add('cme-current-group');
  const summary=document.createElement('summary');summary.className='cme-admin-group-toggle';summary.innerHTML=`<i class="fa-solid ${group.classicIcon}" aria-hidden="true"></i><span>${group.title}</span><i class="fa-solid fa-chevron-down cme-group-chevron" aria-hidden="true"></i>`;
  const body=document.createElement('div');body.className='cme-admin-submenu';body.append(...links);details.append(summary,body);
  summary.addEventListener('click',event=>{event.preventDefault();const opening=!details.open;for(const other of scope.querySelectorAll(':scope > details.cme-admin-menu-group'))if(other!==details)other.open=false;details.open=opening;});
  return details;
}
function normalizarHref(valor){try{const url=new URL(valor,location.origin);return url.pathname.replace(/^\//,"").replace(/\.html$/i,"").replace(/\/$/,"").toLowerCase()}catch{return String(valor||"").split("?")[0].replace(/^\//,"").replace(/\.html$/i,"").replace(/\/$/,"").toLowerCase()}}
function normalizarMenuAdministrativo(){
  const menu=document.querySelector(".menu-lateral");if(!menu)return;
  const atual=normalizarHref(location.pathname);
  const fragment=document.createDocumentFragment();
  const params=new URLSearchParams(location.search);
  const originalKey=atual==='documentos'&&params.get('visao')==='biblioteca'?'documents':atual==='documentos'&&params.get('visao')==='fotos'?'photos':chaveMenu(atual.endsWith('.html')?atual:atual+'.html')||atual.replace(/^portal\/admin\//,'');
  const currentKey=originalKey==='dashboard'?'workspace':GROUPED_ADMIN_ROUTES[originalKey]?.area||originalKey;
  const linksByKey=new Map();
  for(const[href,icone,titulo]of MENU_ADMIN_CANONICO){
    const link=criarLinkMenu(href,icone,titulo),key=chaveMenu(href);
    if(key===currentKey){link.classList.add('ativo');link.setAttribute('aria-current','page');}
    linksByKey.set(key,link);
  }
  for(const group of ADMIN_MENU_GROUPS){const links=group.sections.map(key=>linksByKey.get(key)).filter(Boolean);if(links.length)fragment.appendChild(criarGrupoMenu(group,links,group.sections.includes(currentKey),menu));}
  menu.replaceChildren(fragment);
  menu.dataset.cmeOrdemFixa="true";
  if(atual==="admin"||atual.endsWith("/admin")){
    const card=Array.from(document.querySelectorAll('.card-lateral')).find(item=>item.querySelector('h2')?.textContent?.trim()==='Ações Rápidas');
    if(card)for(const[rota,icone,titulo]of ferramentasAdministrativas){const id=`abrirFerramenta-${rota}`;if(document.getElementById(id))continue;const botao=document.createElement('button');botao.id=id;botao.type='button';botao.innerHTML=`<i class="fa-solid ${icone}"></i><span>${titulo}</span>`;botao.addEventListener('click',()=>{location.href=urlPontePortal(rota)});card.appendChild(botao)}
    if(card){
      document.getElementById('abrirBiblioteca')?.remove();
      const legacy={abrirClientes:'clients',abrirProjetos:'projects',abrirDocumentos:'documents',abrirBiblioteca:'documents',abrirFotos:'photos',abrirFinanceiro:'financial',abrirAgenda:'agenda',abrirConfiguracoes:'settings'};
      const visible=new Set(ADMIN_MENU_GROUPS.flatMap(group=>group.sections));
      for(const button of card.querySelectorAll('button[id]')){const key=button.id.startsWith('abrirFerramenta-')?button.id.slice(16):legacy[button.id];if(!visible.has(key))button.remove();}
      const buttons=Array.from(card.querySelectorAll('button[id]'));
      for(const group of ADMIN_MENU_GROUPS){const children=buttons.filter(button=>group.sections.includes(button.id.startsWith('abrirFerramenta-')?button.id.slice(16):legacy[button.id]));if(children.length)card.appendChild(criarGrupoMenu(group,children,false,card));}
    }
  }
}
function configurarMenuMobile(){
  const sidebar=document.querySelector('.layout .sidebar');
  const conteudo=document.querySelector('.layout .conteudo');
  if(!sidebar||!conteudo||document.getElementById('cmeAdminMobileMenuButton'))return;
  const botao=document.createElement('button');
  botao.id='cmeAdminMobileMenuButton';botao.type='button';botao.className='cme-admin-mobile-menu-button';
  botao.setAttribute('aria-label','Abrir menu administrativo');botao.setAttribute('aria-expanded','false');
  botao.innerHTML='<i class="fa-solid fa-bars" aria-hidden="true"></i>';
  const overlay=document.createElement('button');
  overlay.type='button';overlay.className='cme-admin-mobile-overlay';overlay.setAttribute('aria-label','Fechar menu administrativo');
  document.body.appendChild(overlay);document.body.appendChild(botao);
  const fechar=()=>{document.body.classList.remove('cme-admin-menu-open');sidebar.classList.remove('open');botao.setAttribute('aria-expanded','false');botao.setAttribute('aria-label','Abrir menu administrativo');botao.innerHTML='<i class="fa-solid fa-bars" aria-hidden="true"></i>';};
  const abrir=()=>{document.body.classList.add('cme-admin-menu-open');sidebar.classList.add('open');botao.setAttribute('aria-expanded','true');botao.setAttribute('aria-label','Fechar menu administrativo');botao.innerHTML='<i class="fa-solid fa-xmark" aria-hidden="true"></i>';};
  botao.addEventListener('click',()=>document.body.classList.contains('cme-admin-menu-open')?fechar():abrir());
  overlay.addEventListener('click',fechar);
  sidebar.addEventListener('click',event=>{if(event.target.closest('a.menu-item'))fechar()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')fechar()});
  window.addEventListener('resize',()=>{if(window.innerWidth>820)fechar()},{passive:true});
}
async function sincronizarPreferenciasDoBanco(){if(typeof window.dbBuscarConfiguracoes!=="function")return;try{const config=await window.dbBuscarConfiguracoes();if(!config)return;aplicarPreferencias({tema:config.tema,cor_principal:config.cor_principal,notificacoes:config.notificacoes!==false})}catch(erro){console.warn("Preferências administrativas não puderam ser sincronizadas.",erro)}}
function protegerNotificacoes(){const original=window.dbNotificarAtualizacao;if(typeof original!=="function"||original.__cmeConfiguravel)return;const wrapper=async function(dados){const estadoLocal=localStorage.getItem(CHAVE_NOTIFICACOES);if(estadoLocal==="inativo")return{enviado:false,motivo:"Notificações desativadas nas Configurações."};try{if(typeof window.dbBuscarConfiguracoes==="function"){const config=await window.dbBuscarConfiguracoes();if(config?.notificacoes===false){localStorage.setItem(CHAVE_NOTIFICACOES,"inativo");return{enviado:false,motivo:"Notificações desativadas nas Configurações."}}}}catch(erro){console.warn("Não foi possível consultar a preferência de notificações.",erro)}return original(dados)};wrapper.__cmeConfiguravel=true;wrapper.__cmeOriginal=original;window.dbNotificarAtualizacao=wrapper}
async function lerErroFuncao(erro,padrao){let mensagem=erro?.message||padrao;try{const contexto=erro?.context;if(contexto&&typeof contexto.json==="function"){const dados=await contexto.json();if(dados?.error)mensagem=dados.error}}catch{}return mensagem}
function protegerExclusaoDefinitivaCliente(){if(typeof window.dbExcluirClienteCompleto!=="function"||window.dbExcluirClienteCompleto.__cmeSeguro)return;const excluirSeguro=async function(clienteId){if(!window.supabaseClient)throw new Error("Não foi possível iniciar a exclusão segura. Atualize a página e tente novamente.");const id=String(clienteId||"").trim();if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error("Cliente inválido.");const clienteResultado=await window.supabaseClient.from("clientes").select("id,nome").eq("id",id).maybeSingle();if(clienteResultado.error)throw clienteResultado.error;if(!clienteResultado.data?.nome)throw new Error("Cliente não encontrado.");const previaResultado=await window.supabaseClient.functions.invoke("admin-delete-client",{body:{action:"preview",clientId:id}});if(previaResultado.error)throw new Error(await lerErroFuncao(previaResultado.error,"Não foi possível verificar se a exclusão é permitida."));const previa=previaResultado.data?.preview;if(!previa)throw new Error("A prévia segura da exclusão não foi retornada. Nenhum dado foi removido.");if(previa.canDelete!==true)throw new Error("A exclusão definitiva foi bloqueada porque existem registros documentais ou fiscais que devem ser preservados. Use Arquivar ou Revogar acesso.");const nome=String(clienteResultado.data.nome).trim();const confirmacao=window.prompt(`Confirmação final de segurança:\n\nDigite exatamente o nome completo do cliente para excluir definitivamente:\n${nome}`);if(confirmacao===null)throw new Error("Exclusão cancelada. Nenhum dado foi removido.");if(confirmacao.trim()!==nome)throw new Error("O nome digitado não corresponde ao cliente. Exclusão cancelada.");const exclusaoResultado=await window.supabaseClient.functions.invoke("admin-delete-client",{body:{action:"delete",clientId:id,confirmation:confirmacao.trim()}});if(exclusaoResultado.error)throw new Error(await lerErroFuncao(exclusaoResultado.error,"Não foi possível concluir a exclusão segura."));if(exclusaoResultado.data?.deleted!==true)throw new Error(exclusaoResultado.data?.error||"A exclusão não foi confirmada pelo servidor.");const objetos=Number(exclusaoResultado.data.deletedObjects||0),projetos=Number(exclusaoResultado.data.deletedProjects||0);return{...exclusaoResultado.data,sucesso:true,arquivos_removidos:objetos,projetos_removidos:projetos}};excluirSeguro.__cmeSeguro=true;window.dbExcluirClienteCompleto=excluirSeguro}
function iniciar(){carregarAjustesVisuais();normalizarMenuAdministrativo();configurarMenuMobile();aplicarPreferencias();protegerNotificacoes();protegerExclusaoDefinitivaCliente();fixarNomeAdministradora();window.setTimeout(fixarNomeAdministradora,150);window.setTimeout(fixarNomeAdministradora,700);window.setTimeout(ocultarCarregamento,2500);window.setTimeout(sincronizarPreferenciasDoBanco,0)}
window.ocultarCarregamentoPagina=ocultarCarregamento;window.mostrarCarregamentoPagina=mostrarCarregamento;window.CMEAplicarPreferenciasAdmin=aplicarPreferencias;window.CMENormalizarMenuAdmin=normalizarMenuAdministrativo;if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",iniciar,{once:true});else iniciar();window.addEventListener("load",()=>{fixarNomeAdministradora();window.setTimeout(ocultarCarregamento,400)},{once:true});
}());
