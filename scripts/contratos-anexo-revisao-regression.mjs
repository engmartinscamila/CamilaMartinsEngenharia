import assert from 'node:assert/strict';
import fs from 'node:fs';

const contractGenerator=fs.readFileSync('portal-app/supabase/functions/generate-contract-document/index.ts','utf8');
const commercialRenderer=fs.readFileSync('portal-app/supabase/functions/_shared/commercial-word-renderer.ts','utf8');

assert.ok(!contractGenerator.includes('contract_signed_at:documentDate'), 'Emissão não pode afirmar data de assinatura');
assert.ok(contractGenerator.includes('A CONFIRMAR NO ATO DA ASSINATURA'), 'Anexo deve distinguir emissão de assinatura');
assert.ok(contractGenerator.includes('String(item.description??\'\').includes(\'Atividade específica solicitada:\')'), 'Anexo deve refletir descrição personalizada');
assert.ok(contractGenerator.includes('serviceName(item)}: ${rule}'), 'As exclusões devem estar associadas à atividade');
assert.ok(contractGenerator.includes('sem rodadas adicionais presumidas; confirmar condições particulares'), 'Não presumir revisões não contratadas');
assert.ok(!commercialRenderer.includes('Data de assinatura: ${generatedDatePt(generatedAt)}'), 'Contrato não deve assumir assinatura na emissão');
assert.ok(commercialRenderer.includes('Representante legal da pessoa jurídica'), 'Destacar qualificação de signatário PJ');
console.log('PASS: emissão não simula assinatura; escopo personalizado e exclusões claras; campos faltantes visíveis.');
