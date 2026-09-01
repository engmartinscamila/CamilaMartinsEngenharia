/*
==========================================================
CAMILA MARTINS ENGENHARIA
ADMIN.JS — DASHBOARD ESTÁVEL
==========================================================
*/
document.addEventListener("DOMContentLoaded",()=>{configurarEventosAdmin();garantirAtalhoDocumentalAdmin();carregarFraseDoDiaAdmin();iniciarDashboard()});
let carregandoDashboard=false;
function carregarFraseDoDiaAdmin(){if(window.__CME_FRASE_DO_DIA__||document.getElementById("cmeFraseDoDiaScript"))return;const script=document.createElement("script");script.id="cmeFraseDoDiaScript";script.src="js/frase-do-dia.js?v=20260901-3";script.defer=true;document.head.appendChild(script)}
function garantirAtalhoDocumentalAdmin(){
 const cards=Array.from(document.querySelectorAll(".card-lateral"));
 const card=cards.find(item=>item.querySelector("h2")?.textContent?.trim()==="Ações Rápidas");
 if(!card)return;
 for(const id of["abrirComercial","abrirContratuais","abrirArquivoDocumental","abrirCentralDocumentos","atalhosGerarDocumentos"]){document.getElementById(id)?.remove()}
 if(!document.getElementById("estiloAtalhosGerarDocumentos")){
  const estilo=document.createElement("style");
  estilo.id="estiloAtalhosGerarDocumentos";
  estilo.textContent=`
   .quick-doc-group{margin-top:16px;padding-top:16px;border-top:1px solid var(--linha,rgba(184,154,99,.3))}
   .quick-doc-heading{display:flex;align-items:center;gap:9px;margin:0 0 10px;color:var(--dourado,#b89a63);font-size:.78rem;font-weight:600;letter-spacing:.07em;text-transform:uppercase}
   .quick-doc-heading i{width:18px;text-align:center}
   .quick-doc-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
   .card-lateral .quick-doc-grid button{min-width:0;min-height:68px;margin:0;padding:10px 7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;border:1px solid var(--linha,rgba(184,154,99,.3));background:rgba(7,17,31,.72);font-size:.72rem;line-height:1.2;text-align:center}
   .card-lateral .quick-doc-grid button i{width:auto;font-size:1rem;color:var(--dourado,#b89a63)}
   .card-lateral .quick-doc-grid button:hover{background:var(--dourado,#b89a63);color:#010914}
   .card-lateral .quick-doc-grid button:hover i{color:#010914}
   @media(max-width:720px){.quick-doc-group{margin-top:12px;padding-top:12px}.quick-doc-grid{gap:6px}.card-lateral .quick-doc-grid button{min-height:60px;padding:8px 5px;font-size:.68rem}.quick-doc-heading{margin-bottom:8px}}
  `;
  document.head.appendChild(estilo);
 }
 const grupo=document.createElement("div");
 grupo.id="atalhosGerarDocumentos";
 grupo.className="quick-doc-group";
 grupo.innerHTML=`<div class="quick-doc-heading"><i class="fa-solid fa-file-signature"></i><span>Gerar documentos</span></div><div class="quick-doc-grid"><button id="gerarOrcamento" type="button" title="Gerar novo orçamento"><i class="fa-solid fa-file-invoice-dollar"></i><span>Orçamento</span></button><button id="gerarContrato" type="button" title="Gerar novo contrato"><i class="fa-solid fa-file-signature"></i><span>Contrato</span></button><button id="gerarOutrosDocumentos" type="button" title="Gerar documentos auxiliares e complementares"><i class="fa-solid fa-file-circle-plus"></i><span>Outros docs</span></button></div>`;
 card.appendChild(grupo);
 const abrir=hash=>{window.location.href=`orcamentos-contratos.html${hash}`};
 document.getElementById("gerarOrcamento")?.addEventListener("click",()=>abrir("#orcamento"));
 document.getElementById("gerarContrato")?.addEventListener("click",()=>abrir("#contrato"));
 document.getElementById("gerarOutrosDocumentos")?.addEventListener("click",()=>abrir("#anexo_i"));
}
async function iniciarDashboard(){if(carregandoDashboard)return;carregandoDashboard=true;try{await Promise.allSettled([carregarTotaisAdmin(),carregarClientesAdmin(),carregarProjetosAdmin(),carregarDocumentosAdmin(),carregarBibliotecaAdmin(),carregarArmazenamentoAdmin()]);const atividades=document.getElementById("atividadeRecentes");if(atividades)atividades.innerHTML='<div class="atividade">Sistema iniciado.</div>'}catch(erro){console.error("Erro ao carregar dashboard:",erro)}finally{carregandoDashboard=false;ocultarLoadingAdmin()}}
function ocultarLoadingAdmin(){const loading=document.getElementById("loading");if(loading){loading.style.display="none";loading.style.pointerEvents="none";loading.setAttribute("aria-hidden","true")}}
function configurarEventosAdmin(){if(window.__CME_ADMIN_EVENTOS__)return;window.__CME_ADMIN_EVENTOS__=true;const navegacao={abrirClientes:"clientes.html",abrirProjetos:"projetos.html",abrirDocumentos:"documentos.html",abrirBiblioteca:"biblioteca.html",abrirFotos:"fotos.html",abrirFinanceiro:"financeiro.html",abrirAgenda:"agenda.html",abrirConfiguracoes:"configuracoes.html",abrirCentralDocumentos:"orcamentos-contratos.html",novoProjeto:"projetos.html",verTodosProjetos:"projetos.html",verTodosDocumentos:"documentos.html"};Object.entries(navegacao).forEach(([id,destino])=>{document.getElementById(id)?.addEventListener("click",()=>{window.location.href=destino})});const pesquisar=document.getElementById("btnPesquisarCliente"),campo=document.getElementById("pesquisaCliente");pesquisar?.addEventListener("click",pesquisarClientesAdmin);campo?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();pesquisarClientesAdmin()}})}
async function buscarSeguro(funcao){try{if(typeof funcao!=="function")return[];const resultado=await funcao();return Array.isArray(resultado)?resultado:[]}catch(erro){console.warn("Consulta do dashboard falhou:",erro);return[]}}
async function carregarTotaisAdmin(){const[clientes,projetos,documentos,fotos]=await Promise.all([buscarSeguro(window.dbBuscarClientes),buscarSeguro(window.dbBuscarProjetos),buscarSeguro(window.dbBuscarDocumentos),buscarSeguro(window.dbBuscarFotos)]);atualizarNumeroAdmin("totalClientes",clientes.length);atualizarNumeroAdmin("totalProjetos",projetos.length);atualizarNumeroAdmin("totalDocumentos",documentos.length);atualizarNumeroAdmin("totalFotos",fotos.length)}
async function carregarClientesAdmin(){const clientes=await buscarSeguro(window.dbBuscarClientes);renderizarClientesAdmin(clientes)}function renderizarClientesAdmin(clientes){const lista=document.getElementById("listaClientes");if(!lista)return;if(!clientes.length){lista.innerHTML='<div class="estado-vazio">Nenhum cliente cadastrado.</div>';return}lista.innerHTML=clientes.map(cliente=>`<div class="item-dashboard"><strong>${escaparAdmin(cliente.nome||"Cliente")}</strong><span>${escaparAdmin(cliente.email||"")}</span></div>`).join("")}
async function pesquisarClientesAdmin(){const termo=(document.getElementById("pesquisaCliente")?.value||"").trim().toLowerCase(),clientes=await buscarSeguro(window.dbBuscarClientes),filtrados=termo?clientes.filter(cliente=>String(cliente.nome||"").toLowerCase().includes(termo)||String(cliente.email||"").toLowerCase().includes(termo)):clientes;renderizarClientesAdmin(filtrados)}
async function carregarProjetosAdmin(){const projetos=await buscarSeguro(window.dbBuscarProjetos),lista=document.getElementById("listaProjetos");if(!lista)return;const recentes=projetos.slice(0,6);lista.innerHTML=recentes.length?recentes.map(projeto=>`<div class="item-dashboard"><strong>${escaparAdmin(projeto.nome||"Projeto")}</strong></div>`).join(""):'<div class="estado-vazio">Nenhum projeto cadastrado.</div>'}
async function carregarDocumentosAdmin(){const documentos=await buscarSeguro(window.dbBuscarDocumentos),lista=document.getElementById("listaDocumentos");if(!lista)return;const recentes=documentos.slice(0,6);lista.innerHTML=recentes.length?recentes.map(documento=>`<div class="item-dashboard"><strong>${escaparAdmin(documento.nome||documento.titulo||"Documento")}</strong><span>${escaparAdmin(documento.tipo||"")}</span></div>`).join(""):'<div class="estado-vazio">Nenhum documento cadastrado.</div>'}
async function carregarBibliotecaAdmin(){const[biblioteca,documentos,fotos]=await Promise.all([buscarSeguro(window.dbBuscarBiblioteca),buscarSeguro(window.dbBuscarDocumentos),buscarSeguro(window.dbBuscarFotos)]);atualizarNumeroAdmin("totalBiblioteca",biblioteca.length+documentos.length+fotos.length)}
async function carregarArmazenamentoAdmin(){const barra=document.getElementById("storageBar"),usado=document.getElementById("storageUsado"),limiteTexto=document.getElementById("storageLimite"),detalhes=document.getElementById("storageDetalhes"),trilho=barra?.parentElement,limite=Number(window.CM_CONFIG?.limiteArmazenamentoBytes)||(1024**3);if(limiteTexto)limiteTexto.textContent=formatarBytesAdmin(limite);try{const{data,error}=await window.supabaseClient.rpc("uso_armazenamento_portal");if(error)throw error;const bytes=Math.max(0,Number(data?.bytes_utilizados)||0),arquivos=Math.max(0,Number(data?.quantidade_arquivos)||0),percentual=limite>0?Math.min(100,bytes/limite*100):0;if(barra)barra.style.width=`${percentual}%`;trilho?.setAttribute("aria-valuenow",String(Math.round(percentual)));if(usado)usado.textContent=formatarBytesAdmin(bytes);if(detalhes)detalhes.textContent=`${arquivos} ${arquivos===1?"arquivo":"arquivos"} • ${percentual.toLocaleString("pt-BR",{maximumFractionDigits:1})}% utilizado`}catch(erro){console.warn("Não foi possível calcular o armazenamento:",erro);if(barra)barra.style.width="0%";trilho?.setAttribute("aria-valuenow","0");if(usado)usado.textContent="Indisponível";if(detalhes)detalhes.textContent="Armazenamento temporariamente indisponível."}}
function atualizarNumeroAdmin(id,valor){const elemento=document.getElementById(id);if(elemento)elemento.textContent=String(Number(valor)||0)}function formatarBytesAdmin(bytes){const valor=Number(bytes)||0;if(valor<=0)return"0 B";const unidades=["B","KB","MB","GB","TB"],indice=Math.min(Math.floor(Math.log(valor)/Math.log(1024)),unidades.length-1),numero=valor/(1024**indice);return`${numero.toLocaleString("pt-BR",{maximumFractionDigits:indice===0?0:2})} ${unidades[indice]}`}function escaparAdmin(valor){return String(valor??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
window.setTimeout(ocultarLoadingAdmin,5000);