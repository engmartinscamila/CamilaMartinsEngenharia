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
const classicCommercial=read('js/commercial-documents-web.js');
const delivery=read('portal-app/supabase/functions/deliver-generated-document/index.ts');
const contractCore=read('portal-app/supabase/functions/generate-contract-document/index.ts');
const contractFinal=read('portal-app/supabase/functions/generate-contract-document-final/index.ts');
const contractNative=read('portal-app/supabase/functions/generate-contract-document-final/native-options-docx.ts');
const commercialCore=read('portal-app/supabase/functions/generate-commercial-document/index.ts');
const commercialAuditMigration=read('portal-app/supabase/migrations/20260911184323_allow_admin_audit_log_insert_for_commercial_flow.sql');

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

expect(preparation.includes("approvalId:kind==='termo_aceite'?approvalId:null"),'Preparação do Termo de Aceite não encaminha explicitamente a aprovação selecionada.');
expect(contractScreen.includes("prepare('termo_aceite', approval.id)"),'Termo de Aceite não está ligado explicitamente à aprovação selecionada.');
expect(contractScreen.includes('generateContractDocument(item.id, item.kind, archive)'),'Download contratual não usa o document_kind do registro selecionado.');
expect(contractScreen.includes('sendContractDocument(item.id, item.kind)'),'Envio contratual não usa o document_kind do registro selecionado.');
expect(workflow.includes("generate-contract-document-final"),'Serviço contratual não usa o gerador final governado.');
expect(workflow.includes('expectedDocumentKind }'),'Serviço contratual não transmite o tipo esperado.');
expect((workflow.match(/documentKind !== expectedDocumentKind/g)||[]).length>=2,'Serviço contratual não valida o tipo retornado na geração e na entrega.');
expect(workflow.includes("generateContractDocument(documentId, 'notificacao_formal'"),'Notificação Formal não está presa ao tipo correto.');
expect(workflow.includes("sendContractDocument(documentId, 'notificacao_formal'"),'Envio da Notificação Formal não está preso ao tipo correto.');

// Regressão crítica histórica: “Aceite de Etapa” não pode cair em outro modelo.
expect(contractCore.includes("if(kind==='termo_aceite')"),'Gerador contratual principal não possui bloco dedicado ao Termo de Aceite.');
expect(contractCore.includes("termo_aceite:'termo-aceite'"),'Gerador contratual principal não possui nome de arquivo dedicado ao Termo de Aceite.');
expect(contractFinal.includes("const nativeKinds=new Set(['termo_aceite'"),'Gerador final não inclui Termo de Aceite entre os documentos com renderização nativa governada.');
expect(contractFinal.includes("if(kind==='termo_aceite')"),'Gerador final não valida as opções específicas do Termo de Aceite.');
expect(contractNative.includes("if(kind==='termo_aceite')return makeDoc"),'Renderizador nativo não possui modelo exclusivo de Termo de Aceite.');
expect(contractNative.includes('TERMO DE ACEITE DE ETAPA'),'Modelo nativo do Termo de Aceite perdeu seu título próprio.');
expect(contractNative.includes("value(d,'approval_title')"),'Modelo nativo do Termo de Aceite não usa a etapa/aprovação vinculada.');

expect(commercialScreen.includes('generateCommercialDocument(pending.record.id, pending.kind'),'Tela comercial não encaminha explicitamente orçamento/contrato selecionado.');
expect(commercialService.includes("generate-commercial-document-final"),'Comercial não usa o gerador final governado.');
expect(commercialService.includes('expectedDocumentKind: kind'),'Entrega comercial não informa orçamento/contrato esperado.');
expect(commercialService.includes('documentKind !== kind'),'Entrega comercial não recusa tipo divergente.');
expect(commercialCore.includes("const kind=body.kind==='contrato'?'contrato':'orcamento'"),'Gerador comercial principal não normaliza o tipo solicitado.');

// A criação comercial é SECURITY INVOKER; o audit_log precisa aceitar somente o Admin
// via RLS. Sem estes grants/policy, ORC/CON falham após criar os dados e antes de concluir.
expect(commercialAuditMigration.includes('grant insert on table public.audit_log to authenticated'),'Migração comercial não concede INSERT no audit_log ao papel autenticado.');
expect(commercialAuditMigration.includes('for insert'),'Migração comercial não cria política INSERT no audit_log.');
expect(commercialAuditMigration.includes('with check (public.is_portal_admin())'),'audit_log perdeu a restrição de escrita exclusiva do Admin.');
// Evita a chamada ambígua do overload legado de dois parâmetros; a tela atual deve enviar
// explicitamente o terceiro parâmetro, ainda que seja null.
expect(classicCommercial.includes("p_source_project_id: sourceProjectId"),'Tela comercial clássica não envia explicitamente a origem do projeto ao criar contrato.');

expect(contractCore.includes('row.document_kind!==expectedDocumentKind'),'Gerador contratual principal não bloqueia document_kind diferente do solicitado.');
expect(contractCore.includes("if(!expectedDocumentKind"),'Gerador contratual principal aceita geração sem tipo esperado.');
expect(delivery.includes('actualDocumentKind !== expectedDocumentKind'),'Entregador de Word não bloqueia tipo divergente.');
expect(delivery.includes("if (!expectedDocumentKind)"),'Entregador de Word aceita download sem tipo esperado.');

const directContractCalls=[...workflow.matchAll(/functions\.invoke\('generate-contract-document'/g)].length;
const directCommercialCalls=[...commercialService.matchAll(/functions\.invoke\('generate-commercial-document'/g)].length;
expect(directContractCalls===0,'Frontend chama diretamente o gerador contratual legado em vez do wrapper final.');
expect(directCommercialCalls===0,'Frontend chama diretamente o gerador comercial legado em vez do wrapper final.');

if(errors.length){console.error('\nERROS DE GERAÇÃO DOCUMENTAL:');errors.forEach((e,i)=>console.error(`${i+1}. ${e}`));process.exit(1);}
console.log(`AUDITORIA DOCUMENTAL APROVADA: ${contractKinds.length} tipos contratuais + orçamento/contrato comercial protegidos por tipo esperado e RLS de auditoria.`);
