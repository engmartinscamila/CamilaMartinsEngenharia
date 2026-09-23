import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const canonical = readFileSync('supabase/functions/generate-commercial-document/index.ts', 'utf8');
const mirror = readFileSync('portal-app/supabase/functions/generate-commercial-document/index.ts', 'utf8');
assert.equal(mirror, canonical, 'Gerador do aplicativo divergente da função canônica.');
const handler = canonical.slice(canonical.indexOf('Deno.serve(async(req)=>{'));
function position(fragment) {
  const index = handler.indexOf(fragment);
  assert.ok(index >= 0, `Trecho obrigatório ausente: ${fragment}`);
  return index;
}
const userProfile = position('const professionalProfile=await loadProfessionalIdentity(service,kind);');
const missingCheck = position('if(missingProfile.length)return json(');
const masterCheck = position("const contractMaster=kind==='contrato'?await loadContractMaster(service,record):null;");
const pointerRead = position("let documentId=kind==='orcamento'?record.quote_document_id:record.contract_document_id;");
const documentInsert = position("service.from('documentos').insert(");
const pointerUpdate = position("service.from('commercial_records').update(kind==='orcamento'?");
assert.ok(userProfile < missingCheck && missingCheck < masterCheck && masterCheck < pointerRead && pointerRead < documentInsert && documentInsert < pointerUpdate,
  'O gerador criou/vinculou documento antes de validar identidade profissional e Contrato Mestre.');
console.log('PASS: validação de identidade e Contrato Mestre antes de criar/vincular documento; espelho idêntico.');

assert.ok(canonical.includes('serviceBudgetDescription'), 'Orçamento não usa campo específico da matriz.');
assert.ok(canonical.includes('item.budgetDescription??item.description'), 'Orçamento não preserva fallback legado quando a matriz não está aprovada.');
const finalGenerator = readFileSync('supabase/functions/generate-commercial-document-final/index.ts', 'utf8');
assert.ok(finalGenerator.includes('text(item.contractScope) || text(item.description)'), 'Contrato não prioriza contractScope aprovado.');
const derivedGenerator = readFileSync('supabase/functions/generate-contract-document/index.ts', 'utf8');
assert.ok(derivedGenerator.includes('item.annexScope??item.description'), 'Anexo I não prioriza annexScope aprovado.');
assert.ok(derivedGenerator.includes('item.customDescription'), 'Documento derivado não preserva descrição de serviço personalizado.');

const strictChainMigration = readFileSync('supabase/migrations/20260923061000_document_chain_strict_snapshot.sql', 'utf8');
assert.ok(!canonical.includes('Base documental: Contrato Mestre v'), 'Contrato do cliente voltou a exibir metadado interno de governança.');
assert.ok(canonical.includes("admin_prepare_commercial_scope_for_generation"), 'Gerador comercial não prepara/valida a matriz aprovada antes da emissão.');
assert.ok(finalGenerator.includes("admin_prepare_commercial_scope_for_generation"), 'Finalizador comercial não congela o escopo aprovado antes do snapshot.');
assert.ok(strictChainMigration.includes('assert_commercial_contract_quote_consistency'), 'Não existe validação forte Orçamento x Contrato.');
assert.ok(strictChainMigration.includes('enforce_annex_contract_emission_snapshot'), 'Anexo I não está preso ao snapshot do contrato emitido.');
assert.ok(strictChainMigration.includes("'source_contract_document_id'"), 'Anexo I não registra o documento de contrato que lhe deu origem.');
assert.ok(strictChainMigration.includes("'scope_snapshot',v_scope"), 'Anexo I não recebe o mesmo snapshot de serviços do contrato.');
assert.ok(strictChainMigration.includes("q.contract_master_version is distinct from c.contract_master_version"), 'Versões diferentes do Contrato Mestre não são bloqueadas.');
assert.ok(strictChainMigration.includes("item->>'levelScopeReviewStatus'='approved'"), 'Documento oficial não exige matriz serviço x nível aprovada.');
assert.ok(strictChainMigration.includes('Documento bloqueado: foi encontrado placeholder'), 'Placeholder interno não é bloqueado antes da emissão.');
