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
 const acceptanceKinds=new Set(['anexo_i','termo_aceite','servico_adicional','autorizacao_imagem','quitacao_encerramento']);
 client.functions.invoke=async(name,options)=>{
  const result=await original(routes[name]||name,options);
  const body=options?.body||{};
  if(name==='generate-contract-document'&&body.action==='send'&&result?.data?.sent&&body.documentId){
   const release=await client.rpc('admin_release_document_for_client',{
    p_document_id:body.documentId,
    p_acceptance_required:acceptanceKinds.has(body.expectedDocumentKind),
    p_valid_from:null,
    p_valid_until:null
   });
   if(release.error)return {...result,error:release.error,data:{...(result.data||{}),sent:false,error:release.error.message}};
  }
  return result;
 };
 client.functions.__cmeFinalRouting=true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();