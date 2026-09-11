import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=(rel)=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const errors=[];
const expect=(condition,message)=>{if(!condition)errors.push(message)};

const workflow=read('portal-app/src/services/document-workflow-service.ts');
const preparation=read('portal-app/src/app/admin/document-preparation.tsx');
const contractScreen=read('portal-app/src/app/admin/contract-documents.tsx');
const commercialService=read('portal-app/src/services/commercial-service.ts');
const commercialScreen=read('portal-app/src/app/admin/commercial-documents.tsx');
const delivery=read('portal-app/supabase/functions/deliver-generated-document/index.ts');
const contractCore=read('portal-app/supabase/functions/generate-contract-document/index.ts');
const commercialCore=read('portal-app/supabase/functions/generate-commercial-document/index.ts');

const contractKinds=['anexo_i','termo_aceite','estudo_preliminar','levantamento_tecnico','servico_adicional','autorizacao_imagem','quitacao_encerramento','notificacao_formal'];
for(const kind of contractKinds) expect(workflow.includes(`'${kind}'`),`Tipo contratual ausente do serviço: ${kind}`);

// A tela de preparação recebe os documentos padrão pelo catálogo compartilhado
// CONTRACT_DOCUMENT_OPTIONS e acrescenta Termo de Aceite localmente. Não exigir
// que os identificadores do catálogo apareçam duplicados no JSX evita falsos positivos.
expect(preparation.includes('...CONTRACT_DOCUMENT_OPTIONS'),'Tela de preparação não usa o catálogo compartilhado de documentos.');
expect(preparation.includes("{kind:'termo_aceite'"),'Tela de preparação não expõe Termo de Aceite.');
for(const kind of ['anexo_i','estudo_preliminar','levantamento_tecnico','servico_adicional','autorizacao_imagem','quitacao_encerramento']) {
  expect(workflow.includes(`kind: '${kind}'`),`Catálogo compartilhado não expõe o tipo ${kind}`);
}

expect(contractScreen.includes("prepare('termo_aceite', approval.id)"),'Termo de Aceite não está ligado explicitamente à aprovação selecionada.');
expect(contractScreen.includes('generateContractDocument(item.id, item.kind, archive)'),'Download contratual não usa o document_kind do registro selecionado.');
expect(contractScreen.includes('sendContractDocument(item.id, item.kind)'),'Envio contratual não usa o document_kind do registro selecionado.');
expect(workflow.includes("generate-contract-document-final"),'Serviço contratual não usa o gerador final governado.');
expect(workflow.includes('expectedDocumentKind }'),'Serviço contratual não transmite o tipo esperado.');
expect((workflow.match(/documentKind !== expectedDocumentKind/g)||[]).length>=2,'Serviço contratual não valida o tipo retornado na geração e na entrega.');
expect(workflow.includes("generateContractDocument(documentId, 'notificacao_formal'"),'Notificação Formal não está presa ao tipo correto.');
expect(workflow.includes("sendContractDocument(documentId, 'notificacao_formal'"),'Envio da Notificação Formal não está preso ao tipo correto.');

expect(commercialScreen.includes('generateCommercialDocument(pending.record.id, pending.kind'),'Tela comercial não encaminha explicitamente orçamento/contrato selecionado.');
expect(commercialService.includes("generate-commercial-document-final"),'Comercial não usa o gerador final governado.');
expect(commercialService.includes('expectedDocumentKind: kind'),'Entrega comercial não informa orçamento/contrato esperado.');
expect(commercialService.includes('documentKind !== kind'),'Entrega comercial não recusa tipo divergente.');
expect(commercialCore.includes("const kind=body.kind==='contrato'?'contrato':'orcamento'"),'Gerador comercial principal não normaliza o tipo solicitado.');

expect(contractCore.includes('row.document_kind!==expectedDocumentKind'),'Gerador contratual principal não bloqueia document_kind diferente do solicitado.');
expect(contractCore.includes("if(!expectedDocumentKind"),'Gerador contratual principal aceita geração sem tipo esperado.');
expect(delivery.includes('actualDocumentKind !== expectedDocumentKind'),'Entregador de Word não bloqueia tipo divergente.');
expect(delivery.includes("if (!expectedDocumentKind)"),'Entregador de Word aceita download sem tipo esperado.');

const directContractCalls=[...workflow.matchAll(/functions\.invoke\('generate-contract-document'/g)].length;
const directCommercialCalls=[...commercialService.matchAll(/functions\.invoke\('generate-commercial-document'/g)].length;
expect(directContractCalls===0,'Frontend chama diretamente o gerador contratual legado em vez do wrapper final.');
expect(directCommercialCalls===0,'Frontend chama diretamente o gerador comercial legado em vez do wrapper final.');

if(errors.length){console.error('\nERROS DE GERAÇÃO DOCUMENTAL:');errors.forEach((e,i)=>console.error(`${i+1}. ${e}`));process.exit(1);}
console.log(`AUDITORIA DOCUMENTAL APROVADA: ${contractKinds.length} tipos contratuais + orçamento/contrato comercial protegidos por tipo esperado.`);
