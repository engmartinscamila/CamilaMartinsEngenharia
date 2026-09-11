/*
==========================================================
CAMILA MARTINS ENGENHARIA
UI CORE — INTERFACE ADMINISTRATIVA COMPARTILHADA
==========================================================
*/
(function(){"use strict";
const CHAVE_TEMA="cme_admin_tema",CHAVE_COR="cme_admin_cor_principal",CHAVE_NOTIFICACOES="cme_admin_notificacoes";
function carregarAjustesVisuais(){if(!document.getElementById("cmeAdminPolish")){const link=document.createElement("link");link.id="cmeAdminPolish";link.rel="stylesheet";link.href="css/admin-polish.css?v=20260910-2";document.head.appendChild(link)}if(!document.getElementById("cmeMobileLayoutFix")){const mobile=document.createElement("link");mobile.id="cmeMobileLayoutFix";mobile.rel="stylesheet";mobile.href="css/mobile-layout-fix.css?v=20260910-3";document.head.appendChild(mobile)}}
function fixarNomeAdministradora(){const alvo=document.querySelector("#adminName, #nomeAdministrador");if(!alvo)return;alvo.textContent="Camila";if(alvo.dataset.cmeNomeObserver==="true")return;alvo.dataset.cmeNomeObserver="true";new MutationObserver(()=>{if(alvo.textContent.trim()!=="Camila")alvo.textContent="Camila"}).observe(alvo,{childList:true,characterData:true,subtree:true})}
function elementosLoading(){return[document.getElementById("loading"),document.getElementById("loader"),document.getElementById("carregando")].filter(Boolean)}function ocultarCarregamento(){for(const elemento of elementosLoading()){elemento.style.setProperty("display","none","important");elemento.style.setProperty("pointer-events","none","important");elemento.setAttribute("aria-hidden","true")}}function mostrarCarregamento(){for(const elemento of elementosLoading()){elemento.style.removeProperty("display");elemento.style.removeProperty("pointer-events");elemento.setAttribute("aria-hidden","false")}}function corValida(valor){return/^#[0-9a-f]{6}$/i.test(String(valor||"").trim())}
function aplicarPreferencias(preferencias={}){const tema=preferencias.tema||localStorage.getItem(CHAVE_TEMA)||"escuro",cor=preferencias.cor_principal||localStorage.getItem(CHAVE_COR)||"#b89a63",notificacoes=preferencias.notificacoes;document.documentElement.dataset.adminTheme=tema==="claro"?"claro":"escuro";if(corValida(cor)){document.documentElement.style.setProperty("--dourado",cor);localStorage.setItem(CHAVE_COR,cor)}localStorage.setItem(CHAVE_TEMA,tema==="claro"?"claro":"escuro");if(typeof notificacoes==="boolean")localStorage.setItem(CHAVE_NOTIFICACOES,notificacoes?"ativo":"inativo")}
function criarLinkMenu(href,icon,titulo){const link=document.createElement("a");link.href=href;link.className="menu-item";link.innerHTML=`<i class="fa-solid ${icon}"></i><span>${titulo}</span>`;return link}

// Ordem única e imutável para TODAS as páginas do Admin clássico.
// O menu não depende mais da ordem escrita em cada HTML individual.
const MENU_ADMIN_CANONICO=[
  ["admin.html","fa-house","Dashboard"],
  ["clientes.html","fa-users","Clientes"],
  ["projetos.html","fa-compass-drafting","Projetos"],
  ["orcamentos-contratos.html","fa-file-signature","Orçamentos e contratos"],
  ["portal/admin/crm.html","fa-filter","Oportunidades comerciais"],
  ["portal/admin/contract-documents.html","fa-file-contract","Documentos gerados e aceites"],
  ["portal/admin/document-preparation.html","fa-file-pen","Preparar documento do projeto"],
  ["portal/admin/document-governance.html","fa-list-check","Versões e pendências dos documentos"],
  ["portal/admin/document-archive.html","fa-box-archive","Arquivos antigos e restauração"],
  ["documentos.html","fa-folder-open","Documentos"],
  ["fotos.html","fa-images","Fotos e evolução da obra"],
  ["portal/admin/tasks.html","fa-check-square","Tarefas do projeto"],
  ["portal/admin/work-diary.html","fa-book","Diário de obra"],
  ["portal/admin/procurement.html","fa-cart-shopping","Fornecedores e cotações"],
  ["biblioteca.html","fa-book-open","Biblioteca"],
  ["financeiro.html","fa-chart-line","Financeiro"],
  ["portal/admin/financial.html","fa-building-columns","Contas bancárias e conciliação OFX"],
  ["portal/admin/portal-control.html","fa-eye","Módulos do portal do cliente"],
  ["agenda.html","fa-calendar-days","Agenda"],
  ["cronograma.html","fa-list-check","Cronograma (simples)"],
  ["portal/admin/construction-schedule.html","fa-chart-column","Cronograma de obra completo"],
  ["portal/admin/approvals.html","fa-check-double","Aprovações"],
  ["solicitacoes.html","fa-comments","Solicitações"],
  ["portal/admin/notifications.html","fa-bell","Notificações internas"],
  ["portal/admin/security.html","fa-shield-halved","Armazenamento e auditoria"],
  ["protecao-pdf-admin.html","fa-file-shield","Conteúdo do site"],
  ["configuracoes.html","fa-gear","Configurações"],
  ["integridade-sistema.html","fa-heart-pulse","Verificar funcionamento"],
];
const ferramentasAdministrativas=[
  ["crm","fa-filter","Oportunidades comerciais"],
  ["contract-documents","fa-file-contract","Documentos gerados e aceites"],
  ["document-preparation","fa-file-pen","Preparar documento do projeto"],
  ["document-governance","fa-list-check","Versões e pendências dos documentos"],
  ["document-archive","fa-box-archive","Arquivos antigos e restauração"],
  ["tasks","fa-check-square","Tarefas do projeto"],
  ["work-diary","fa-book","Diário de obra"],
  ["procurement","fa-cart-shopping","Fornecedores e cotações"],
  ["financial","fa-building-columns","Contas bancárias e conciliação OFX"],
  ["portal-control","fa-eye","Módulos do portal do cliente"],
  ["construction-schedule","fa-chart-column","Cronograma de obra completo"],
  ["approvals","fa-check-double","Aprovações"],
  ["notifications","fa-bell","Notificações internas"],
  ["security","fa-shield-halved","Armazenamento e auditoria"],
];
function normalizarHref(valor){try{const url=new URL(valor,location.origin);return url.pathname.replace(/^\//,"").replace(/\/$/,"").toLowerCase()}catch{return String(valor||"").split("?")[0].replace(/^\//,"").replace(/\/$/,"").toLowerCase()}}
function normalizarMenuAdministrativo(){
  const menu=document.querySelector(".menu-lateral");if(!menu)return;
  const atual=normalizarHref(location.pathname);
  const fragment=document.createDocumentFragment();
  for(const[href,icone,titulo]of MENU_ADMIN_CANONICO){const link=criarLinkMenu(href,icone,titulo);const destino=normalizarHref(href);const ativo=destino===atual;if(ativo){link.classList.add("ativo");link.setAttribute("aria-current","page")}fragment.appendChild(link)}
  menu.replaceChildren(fragment);
  menu.dataset.cmeOrdemFixa="true";
  if(atual==="admin.html"||atual.endsWith("/admin.html")){
    const card=Array.from(document.querySelectorAll('.card-lateral')).find(item=>item.querySelector('h2')?.textContent?.trim()==='Ações Rápidas');
    if(card)for(const[rota,icone,titulo]of ferramentasAdministrativas){const id=`abrirFerramenta-${rota}`;if(document.getElementById(id))continue;const botao=document.createElement('button');botao.id=id;botao.type='button';botao.innerHTML=`<i class="fa-solid ${icone}"></i><span>${titulo}</span>`;botao.addEventListener('click',()=>{location.href=`portal/admin/${rota}.html`});card.appendChild(botao)}
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
