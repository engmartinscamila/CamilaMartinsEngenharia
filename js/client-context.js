/* Contextual search only: no invitation, update or other customer action is triggered. */
(function(){'use strict';
 const id=new URLSearchParams(location.search).get('clientId');
 if(!id)return;
 async function start(){
  if(typeof window.dbBuscarClientes!=='function')return;
  try{
   const rows=await window.dbBuscarClientes();const client=rows.find(item=>String(item.id)===id);
   const list=document.getElementById('listaClientes'),input=document.getElementById('pesquisaCliente');
   if(!client||!list||!input)return;
   const apply=()=>{if(!list.textContent.includes(client.nome))return false;input.value=client.nome;input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('btnPesquisarCliente')?.click();return true;};
   if(apply())return;
   const observer=new MutationObserver(()=>{if(list.textContent.includes(client.nome)){observer.disconnect();apply();}});
   observer.observe(list,{childList:true,subtree:true});setTimeout(()=>observer.disconnect(),15000);
  }catch{/* The original client screen keeps its loading/retry behavior. */}
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void start(),{once:true});else void start();
})();
