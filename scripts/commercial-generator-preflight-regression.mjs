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
