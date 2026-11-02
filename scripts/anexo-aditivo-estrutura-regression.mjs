import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(path, 'utf8');

const annexMigration=read('supabase/migrations/20261102023000_annex_frozen_commercial_source.sql');
const addendumMigration=read('supabase/migrations/20261102024000_addendum_issued_contract_snapshot.sql');
const correction=read('supabase/migrations/20261102023500_admin_reclassify_commercial_services.sql');
const noDuplicates=read('supabase/migrations/20261102024600_reclassify_without_duplicate_catalog_codes.sql');
const annex=read('supabase/functions/generate-contract-document/index.ts');
const annexMirror=read('portal-app/supabase/functions/generate-contract-document/index.ts');
const finalizer=read('portal-app/supabase/functions/generate-contract-document-final/index.ts');
const addendumWord=read('portal-app/supabase/functions/generate-contract-document-final/native-options-docx.ts');
const options=read('js/document-options-web.js');
const contractUI=read('js/contract-documents-web.js');
const commercialUI=read('js/commercial-documents-web.js');
const master=read('supabase/functions/_shared/commercial-word-renderer.ts');

assert.equal(annex,annexMirror,'Anexo I diverge entre a função canônica e o aplicativo.');
assert.ok(annexMigration.includes("v_emission->'commercial_record_snapshot'"),'Anexo I não usa o snapshot comercial da emissão.');
for (const field of ['commercial_terms','payment_terms','contract_value','property_address','source_quote_number']) {
  assert.ok(annexMigration.includes("'"+field+"'"),'Campo não herdado: '+field);
}
assert.ok(addendumMigration.includes("('anexo_i','servico_adicional')"),'Aditivo não herda o contrato emitido.');
assert.ok(addendumMigration.includes('new.acceptance_required:=true'),'Aditivo não exige aceite.');
assert.ok(addendumMigration.includes('trg_enforce_addendum_contract_snapshot'),'Não existe trigger de snapshot para aditivo.');
assert.ok(correction.includes('is_portal_admin()'),'Reclassificação não é restrita ao administrador.');
assert.ok(noDuplicates.includes('v_target_exists')&&noDuplicates.includes("'included',true"),'Reclassificação pode duplicar categorias presentes no catálogo.');
assert.ok(correction.includes("historical_documents_untouched"),'Reclassificação não informa imutabilidade do histórico.');
assert.ok(commercialUI.includes('Corrigir enquadramento de serviços'),'Não existe opção para corrigir categoria do contrato.');
assert.ok(commercialUI.includes('admin_reclassify_commercial_service'),'Editor não persiste reclassificação auditada.');

assert.ok(annex.includes("sourceData.annex_source!=='emitted_contract_snapshot'"),'Anexo I ainda aceita rascunhos fora do contrato emitido.');
assert.ok(annex.includes('source_contract_document_version'),'Anexo I não identifica a versão de origem.');
assert.ok(annex.includes('row.projeto_id||row.contract_id'),'Geração de aditivo sem projeto não está disponível.');
assert.ok(annex.includes('As quantidades de revisões são exclusivamente'),'Anexo I ainda presume revisões genéricas.');
assert.ok(!annex.includes('aplicam-se até 2 (duas) rodadas de revisão por etapa'),'Anexo I não deve presumir duas revisões.');
assert.ok(contractUI.includes('Aditivo contratual — Serviço adicional'),'Aditivo não está visível.');
assert.ok(contractUI.includes("!['anexo_i','servico_adicional'].includes(kind)"),'Contrato sem projeto não oferece aditivo.');
assert.ok(options.includes('document_emission_snapshots'),'A prévia não utiliza a emissão oficial.');
assert.ok(options.includes('inherited_terms'),'A prévia não exibe prazo e parcelas herdados.');
assert.ok(options.includes('additional_deliverables')&&options.includes('additional_quantity')&&options.includes('additional_deadline_days'),'Aditivo carece de campos específicos.');
assert.ok(!options.includes('Revisão menor')&&!options.includes('Nova versão principal'),'UI voltou a perguntar versão menor/principal.');
assert.ok(finalizer.includes("additional_deliverables")&&finalizer.includes('payment_terms'),'Finalizador não valida os campos do aditivo.');
assert.ok(addendumWord.includes('TERMO ADITIVO AO CONTRATO')&&addendumWord.includes('additional_deliverables'),'Word do aditivo incompleto.');
assert.ok(addendumWord.includes('Data da assinatura: ____/____/________'),'O aditivo confunde emissão com assinatura.');
assert.ok(addendumWord.includes('money(o.new_contract_total)'),'O aditivo não formata o valor total de referência.');
assert.ok(!master.includes('Motivo registrado para esta revisão:'),'Motivo interno não deve constar no contrato Word.');
console.log('PASS: Anexo I deriva da emissão congelada; aditivo sem projeto com aceite; histórico e revisão preservados.');
