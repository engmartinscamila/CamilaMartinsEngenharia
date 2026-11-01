import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const spec=JSON.parse(read('docs/CATALOGO_41_ATIVIDADES_ESCOPOS_ESPECIFICOS.json')).profiles;
const codes=Object.keys(spec);
assert.equal(codes.length,41,'O catálogo deve conter 41 serviços diferentes');
for(const [code,detail] of Object.entries(spec)){
 assert.equal(detail.length,5,'Cada atividade deve ter objeto, três conjuntos de entregáveis e insumos: '+code);
 assert.ok(detail.every(t=>typeof t==='string'&&t.trim().length>40),'Cada campo deve explicar conteúdo técnico específico: '+code);
 assert.ok(!detail.some(t=>/prestação ampliada, com maior detalhamento|peças técnicas expressamente contratadas|serviço técnico conforme escopo contratado/i.test(t)),'Texto genérico proibido na atividade '+code);
}
const sql=read('docs/MIGRACAO_ESCOPOS_41_SERVICOS_123_NIVEIS_V7.sql');
assert.ok(sql.includes('document_text_catalog_versions')&&sql.includes('service_level_scope_versions'),'Atualizações devem preservar versões anteriores');
assert.ok(sql.includes('review_status=\'approved\''),'Governança documental por nível');
assert.ok(sql.includes('new Date')===false,'Não inserir cálculos de data em SQL');
const terms=read('js/commercial-terms-web.js');
const annex=read('portal-app/supabase/functions/generate-contract-document/index.ts');
const quote=read('portal-app/supabase/functions/_shared/commercial-word-renderer.ts');
assert.ok(terms.includes("from('service_level_scope_catalog')")&&terms.includes('_catalogProducts'),'O editor deve consultar entregáveis específicos e aprovados');
assert.ok(!terms.includes('peças técnicas expressamente contratadas'),'Texto antigo não pode aparecer na interface');
assert.ok(!annex.includes('Serviço técnico conforme escopo contratado e Anexo I.'),'Anexo deve bloquear descrição ausente');
assert.ok(!quote.includes('Serviço técnico conforme escopo descrito no orçamento e no Anexo I.'),'Orçamento deve bloquear descrição ausente');
assert.ok(!quote.includes('commonLevelFeatures.map'),'Níveis genéricos não podem substituir os produtos concretos');
assert.equal(read('supabase/functions/generate-contract-document/index.ts'),annex,'Anexo espelhado sincronizado');
assert.equal(read('supabase/functions/_shared/commercial-word-renderer.ts'),quote,'Word espelhado sincronizado');
console.log('PASS: 41 serviços, 123 níveis versionados e editor de produtos específicos; sem frases genéricas proibidas.');
