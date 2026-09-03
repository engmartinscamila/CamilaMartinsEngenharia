(function(){
'use strict';
function install(){
 const client=window.supabaseClient;
 if(!client?.functions?.invoke||client.functions.__cmeFinalRouting)return;
 const original=client.functions.invoke.bind(client.functions);
 const routes={
  'generate-contract-document':'generate-contract-document-final',
  'generate-commercial-document':'generate-commercial-document-final'
 };
 client.functions.invoke=(name,options)=>original(routes[name]||name,options);
 client.functions.__cmeFinalRouting=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();